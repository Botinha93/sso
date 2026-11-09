import assert from "node:assert/strict";
import { mkdtemp, chmod, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exportPKCS8, exportSPKI, jwtVerify, SignJWT } from "jose";
import { createSigningKeys, loadOrCreateSigningKeys, loadSigningKeysFromFile } from "../../src/security/keys.js";
import { backupSigningKeyFile, restoreSigningKeyFile, retirePreviousSigningKey, stageSigningKeyRotation } from "../../src/security/key-rotation.js";
import { JwtService } from "../../src/security/jwt.js";
import type { AppConfig } from "../../src/core/config.js";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "nexusid-key-rotation-"));
  const file = join(dir, ".jwt-signing-keys.json");
  const keys = await createSigningKeys();
  await writeFile(file, JSON.stringify({ schemaVersion: 1, kid: keys.kid,
    privateKeyPem: await exportPKCS8(keys.privateKey), publicKeyPem: await exportSPKI(keys.publicKey) }), { mode: 0o600 });
  await chmod(file, 0o600);
  return { dir, file, keys, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("rotation stages a new active signer and advertises only old public material through overlap", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const oldToken = await new SignJWT({ marker: "old" }).setProtectedHeader({ alg: "RS256", kid: f.keys.kid })
    .setIssuer("https://identity.example.test").setSubject("user-1").setIssuedAt().setExpirationTime("1h").sign(f.keys.privateKey);
  const staged = await stageSigningKeyRotation(f.file, new Date(Date.now() + 60_000).toISOString());
  assert.equal(staged.oldKid, f.keys.kid); assert.notEqual(staged.newKid, f.keys.kid);
  const oldEnv = { privateKey: process.env.JWT_PRIVATE_KEY_PEM, publicKey: process.env.JWT_PUBLIC_KEY_PEM, kid: process.env.JWT_KID };
  process.env.JWT_PRIVATE_KEY_PEM = await exportPKCS8(f.keys.privateKey);
  process.env.JWT_PUBLIC_KEY_PEM = await exportSPKI(f.keys.publicKey);
  process.env.JWT_KID = f.keys.kid;
  let loaded;
  try { loaded = await loadOrCreateSigningKeys(f.file); }
  finally {
    if (oldEnv.privateKey === undefined) delete process.env.JWT_PRIVATE_KEY_PEM; else process.env.JWT_PRIVATE_KEY_PEM = oldEnv.privateKey;
    if (oldEnv.publicKey === undefined) delete process.env.JWT_PUBLIC_KEY_PEM; else process.env.JWT_PUBLIC_KEY_PEM = oldEnv.publicKey;
    if (oldEnv.kid === undefined) delete process.env.JWT_KID; else process.env.JWT_KID = oldEnv.kid;
  }
  assert.ok(loaded);
  assert.equal(loaded.kid, staged.newKid);
  assert.deepEqual(loaded.verificationJwks.map(k => k.kid), [staged.newKid, staged.oldKid]);
  assert.equal(loaded.verificationKeys.length, 2);
  assert.ok(loaded.verificationJwks.every(k => !("d" in k)), "JWKS contains no private key parameter");
  const oldClaims = await jwtVerify(oldToken, loaded.verificationKeys.find(k => k.kid === staged.oldKid)!.key, { issuer: "https://identity.example.test" });
  assert.equal(oldClaims.payload.marker, "old");
  assert.equal((await new JwtService(loaded, { issuer: "https://identity.example.test" } as AppConfig).verifyAccessToken(oldToken)).marker, "old",
    "NexusID's own verifier accepts old-key tokens during overlap");
  const newToken = await new SignJWT({ marker: "new" }).setProtectedHeader({ alg: "RS256", kid: loaded.kid })
    .setIssuer("https://identity.example.test").setSubject("user-1").setIssuedAt().setExpirationTime("1h").sign(loaded.privateKey);
  const newClaims = await jwtVerify(newToken, loaded.verificationKeys.find(k => k.kid === loaded.kid)!.key, { issuer: "https://identity.example.test" });
  assert.equal(newClaims.payload.marker, "new");
  assert.equal((await stat(f.file)).mode & 0o777, 0o600);
});

test("old public key cannot be retired before its recorded maximum token expiry", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const validUntil = new Date(Date.now() + 60_000).toISOString();
  const staged = await stageSigningKeyRotation(f.file, validUntil);
  await assert.rejects(retirePreviousSigningKey(f.file), /cannot be retired before/);
  assert.equal((await loadSigningKeysFromFile(f.file))?.verificationJwks.length, 2);
  const retired = await retirePreviousSigningKey(f.file, new Date(Date.parse(validUntil) + 1));
  assert.equal(retired.retiredKid, staged.oldKid);
  const loaded = await loadSigningKeysFromFile(f.file); assert.ok(loaded);
  assert.deepEqual(loaded.verificationJwks.map(k => k.kid), [staged.newKid]);
  assert.equal(loaded.verificationKeys.length, 1);
});

test("rotation rejects insecure files, expired deadlines, and a second unretired predecessor", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  await chmod(f.file, 0o644);
  await assert.rejects(stageSigningKeyRotation(f.file, new Date(Date.now() + 60000).toISOString()), /mode 0600/);
  await chmod(f.file, 0o600);
  await assert.rejects(stageSigningKeyRotation(f.file, new Date(Date.now() - 1).toISOString()), /future ISO timestamp/);
  await stageSigningKeyRotation(f.file, new Date(Date.now() + 60_000).toISOString());
  await assert.rejects(stageSigningKeyRotation(f.file, new Date(Date.now() + 120_000).toISOString()), /already staged/);
  const parsed = JSON.parse(await readFile(f.file, "utf8"));
  assert.equal(parsed.schemaVersion, 2);
});

test("protected key backup verifies the keyset, publishes atomically with private mode, and never overwrites", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const backup = join(f.dir, "recovery", "signing-keys.backup.json");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(f.dir, "recovery"), { mode: 0o700 });
  const result = await backupSigningKeyFile(f.file, backup);
  assert.equal(result.kid, f.keys.kid);
  assert.deepEqual(JSON.parse(await readFile(backup, "utf8")), JSON.parse(await readFile(f.file, "utf8")));
  assert.equal((await stat(backup)).mode & 0o777, 0o600);
  await assert.rejects(backupSigningKeyFile(f.file, backup), /EEXIST/);
  assert.equal((await stat(backup)).mode & 0o077, 0);
});

test("protected key backup rejects insecure source and unsafe backup directory", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { mkdir, symlink } = await import("node:fs/promises");
  const unsafe = join(f.dir, "unsafe");
  await mkdir(unsafe, { mode: 0o777 });
  await chmod(unsafe, 0o777);
  await assert.rejects(backupSigningKeyFile(f.file, join(unsafe, "backup.json")), /not group\/world writable/);
  const recovery = join(f.dir, "recovery");
  const recoveryAlias = join(f.dir, "recovery-alias");
  await mkdir(recovery, { mode: 0o700 });
  await mkdir(join(recovery, "nested"), { mode: 0o700 });
  await symlink(recovery, recoveryAlias);
  await assert.rejects(backupSigningKeyFile(f.file, join(recoveryAlias, "nested", "backup.json")), /must not traverse symlinks/);
  await chmod(f.file, 0o644);
  await assert.rejects(backupSigningKeyFile(f.file, join(f.dir, "backup.json")), /mode 0600/);
});

test("protected key restore recovers a backup onto a missing active path and refuses to clobber an existing one", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(f.dir, "recovery"), { mode: 0o700 });
  const backup = join(f.dir, "recovery", "signing-keys.backup.json");
  await backupSigningKeyFile(f.file, backup);
  const destination = join(f.dir, "restored-keys.json");
  const result = await restoreSigningKeyFile(backup, destination);
  assert.equal(result.kid, f.keys.kid);
  assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), JSON.parse(await readFile(backup, "utf8")));
  assert.equal((await stat(destination)).mode & 0o777, 0o600);
  await assert.rejects(restoreSigningKeyFile(backup, destination), /already exists.*--force/);
  const untouched = await readFile(destination, "utf8");
  const forced = await restoreSigningKeyFile(backup, destination, { force: true });
  assert.equal(forced.kid, f.keys.kid);
  assert.equal(await readFile(destination, "utf8"), untouched, "forced restore of an identical backup leaves the destination byte-identical");
  assert.equal((await stat(destination)).mode & 0o777, 0o600);
});

test("protected key restore rejects insecure backup source and unsafe destination directory", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { mkdir, symlink } = await import("node:fs/promises");
  await mkdir(join(f.dir, "recovery"), { mode: 0o700 });
  const backup = join(f.dir, "recovery", "signing-keys.backup.json");
  await backupSigningKeyFile(f.file, backup);
  const unsafe = join(f.dir, "unsafe");
  await mkdir(unsafe, { mode: 0o777 });
  await chmod(unsafe, 0o777);
  await assert.rejects(restoreSigningKeyFile(backup, join(unsafe, "restored.json")), /not group\/world writable/);
  const aliasDirectory = join(f.dir, "restore-alias");
  await symlink(f.dir, aliasDirectory);
  await assert.rejects(restoreSigningKeyFile(backup, join(aliasDirectory, "restored.json")), /must not traverse symlinks/);
  await chmod(backup, 0o644);
  await assert.rejects(restoreSigningKeyFile(backup, join(f.dir, "restored.json")), /mode 0600/);
});

test("rotation refuses a keyset path reached through a symlinked ancestor", async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const { mkdir, symlink } = await import("node:fs/promises");
  const realDirectory = join(f.dir, "real");
  const aliasDirectory = join(f.dir, "alias");
  await mkdir(realDirectory, { mode: 0o700 });
  const realFile = join(realDirectory, "keys.json");
  await writeFile(realFile, await readFile(f.file), { mode: 0o600 });
  await symlink(realDirectory, aliasDirectory);

  const beforeStage = await readFile(realFile, "utf8");
  await assert.rejects(stageSigningKeyRotation(join(aliasDirectory, "keys.json"), new Date(Date.now() + 60_000).toISOString()), /must not traverse symlinks/);
  assert.equal(await readFile(realFile, "utf8"), beforeStage, "rejected stage leaves the authoritative keyset unchanged");

  const staged = await stageSigningKeyRotation(realFile, new Date(Date.now() + 60_000).toISOString());
  const beforeRetire = await readFile(realFile, "utf8");
  await assert.rejects(retirePreviousSigningKey(join(aliasDirectory, "keys.json"), new Date(Date.now() + 120_000)), /must not traverse symlinks/);
  assert.equal(await readFile(realFile, "utf8"), beforeRetire, "rejected retirement leaves the overlap keyset unchanged");
  assert.equal((await loadSigningKeysFromFile(realFile))?.kid, staged.newKid);
});
