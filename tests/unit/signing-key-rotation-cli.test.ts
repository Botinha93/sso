import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exportPKCS8, exportSPKI } from "jose";
import { createSigningKeys, loadSigningKeysFromFile } from "../../src/security/keys.js";

const repositoryRoot = new URL("../../", import.meta.url).pathname;

function run(script: string, args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env },
  });
}

test("operator signing-key backup and rotation commands preserve their protected contract", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nexusid-key-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const keyFile = join(directory, "signing-keys.json");
  const backupFile = join(directory, "recovery", "signing-keys.json");
  const initial = await createSigningKeys();
  await mkdir(join(directory, "recovery"), { mode: 0o700 });
  await writeFile(keyFile, JSON.stringify({
    schemaVersion: 1,
    kid: initial.kid,
    privateKeyPem: await exportPKCS8(initial.privateKey),
    publicKeyPem: await exportSPKI(initial.publicKey),
  }), { mode: 0o600 });
  await chmod(keyFile, 0o600);

  const backup = run("scripts/backup-signing-key.ts", ["--file", keyFile, "--to", backupFile]);
  assert.equal(backup.status, 0, backup.stderr);
  assert.match(backup.stdout, new RegExp(initial.kid));
  assert.doesNotMatch(backup.stdout, /BEGIN (?:RSA )?PRIVATE KEY/);
  assert.equal((await stat(backupFile)).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(backupFile, "utf8")), JSON.parse(await readFile(keyFile, "utf8")));
  const overwrite = run("scripts/backup-signing-key.ts", ["--file", keyFile, "--to", backupFile]);
  assert.notEqual(overwrite.status, 0, "backup CLI must refuse an existing destination");

  const restoredFile = join(directory, "restored-signing-keys.json");
  const restore = run("scripts/restore-signing-key.ts", ["--from", backupFile, "--to", restoredFile]);
  assert.equal(restore.status, 0, restore.stderr);
  assert.match(restore.stdout, new RegExp(initial.kid));
  assert.doesNotMatch(restore.stdout, /BEGIN (?:RSA )?PRIVATE KEY/);
  assert.equal((await stat(restoredFile)).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(restoredFile, "utf8")), JSON.parse(await readFile(backupFile, "utf8")));
  const restoreWithoutForce = run("scripts/restore-signing-key.ts", ["--from", backupFile, "--to", restoredFile]);
  assert.notEqual(restoreWithoutForce.status, 0, "restore CLI must refuse an existing destination without --force");
  const restoreForced = run("scripts/restore-signing-key.ts", ["--from", backupFile, "--to", restoredFile, "--force"]);
  assert.equal(restoreForced.status, 0, restoreForced.stderr);

  const oldPrivateKey = JSON.parse(await readFile(keyFile, "utf8")).privateKeyPem as string;
  const deadline = new Date(Date.now() + 60_000).toISOString();
  const staged = run("scripts/rotate-signing-key.ts", ["--file", keyFile, "--previous-valid-until", deadline]);
  assert.equal(staged.status, 0, staged.stderr);
  assert.doesNotMatch(staged.stdout, /BEGIN (?:RSA )?PRIVATE KEY/);
  const rotated = await loadSigningKeysFromFile(keyFile);
  assert.ok(rotated);
  const persistedRotation = JSON.parse(await readFile(keyFile, "utf8")) as { privateKeyPem: string };
  assert.notEqual(persistedRotation.privateKeyPem, oldPrivateKey);
  assert.equal(rotated.verificationJwks.length, 2);
  assert.deepEqual(rotated.verificationJwks.map((key) => key.kid), [rotated.kid, initial.kid]);
  assert.ok(rotated.verificationJwks.every((key) => !("d" in key)));
  assert.equal((await stat(keyFile)).mode & 0o777, 0o600);

  const beforeEarlyRetirement = await readFile(keyFile, "utf8");
  const earlyRetire = run("scripts/rotate-signing-key.ts", ["--file", keyFile, "--retire"]);
  assert.notEqual(earlyRetire.status, 0, "CLI must retain the old key before the configured token-expiry fence");
  assert.match(earlyRetire.stderr, /cannot be retired before/);
  assert.equal(await readFile(keyFile, "utf8"), beforeEarlyRetirement);
});
