import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { open, lstat, rename, unlink, link } from "node:fs/promises";
import { dirname, basename, join, resolve, sep } from "node:path";
import { exportPKCS8, exportSPKI } from "jose";
import { createSigningKeys, loadSigningKeysFromFile } from "./keys.js";

interface StoredKeySet {
  schemaVersion?: 1 | 2;
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
  previousPublicKeys?: Array<Record<string, unknown>>;
  previousValidUntil?: string;
}

async function readProtectedKeySet(path: string): Promise<StoredKeySet> {
  const fileHandle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let parsed: Partial<StoredKeySet>;
  try {
    const stat = await fileHandle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("Signing key file must be a regular file with mode 0600 or stricter");
    parsed = JSON.parse(await fileHandle.readFile("utf8")) as Partial<StoredKeySet>;
  } finally { await fileHandle.close(); }
  if (typeof parsed.kid !== "string" || typeof parsed.privateKeyPem !== "string" || typeof parsed.publicKeyPem !== "string") {
    throw new Error("Signing key file has an invalid format");
  }
  if (!await loadSigningKeysFromFile(path)) throw new Error("Signing key file cannot be loaded");
  return parsed as StoredKeySet;
}

async function assertNoSymlinkDirectoryTraversal(path: string): Promise<void> {
  const absolute = resolve(path);
  let current: string = sep;
  for (const component of absolute.split(sep).filter(Boolean)) {
    current = join(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error("Signing key directory path must not traverse symlinks or non-directories");
    }
  }
}

async function writeAtomically(path: string, value: StoredKeySet): Promise<void> {
  const directory = dirname(path);
  // The final directory check alone is insufficient: an otherwise protected
  // directory can be reached through a symlinked ancestor. Refuse that path
  // before replacing the authoritative keyset.
  await assertNoSymlinkDirectoryTraversal(directory);
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || (directoryStat.mode & 0o022) !== 0) {
    throw new Error("Signing key directory must be a non-symlink directory that is not group/world writable");
  }
  const temporary = join(directory, `.${basename(path)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
    const directoryHandle = await open(directory, "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/** Create a verified, mode-0600 point-in-time copy without replacing an existing backup. */
export async function backupSigningKeyFile(sourcePath: string, backupPath: string): Promise<{ kid: string }> {
  if (sourcePath === backupPath) throw new Error("Backup destination must differ from the signing key file");
  const stored = await readProtectedKeySet(sourcePath);
  const source = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let contents: Buffer;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("Signing key file must be a regular file with mode 0600 or stricter");
    contents = await source.readFile();
  } finally { await source.close(); }

  const directory = dirname(backupPath);
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || (directoryStat.mode & 0o022) !== 0) {
    throw new Error("Backup directory must be a non-symlink directory that is not group/world writable");
  }
  await assertNoSymlinkDirectoryTraversal(directory);
  const temporary = join(directory, `.${basename(backupPath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    // link() makes publication atomic and fails if the requested backup name exists.
    await link(temporary, backupPath);
    await unlink(temporary);
    const directoryHandle = await open(directory, "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { kid: stored.kid };
}

/**
 * Restore a verified protected keyset backup to an active signing-key path.
 * Refuses to overwrite an existing destination unless `force` is set, since a
 * restore is normally recovery onto a missing/corrupt file, not routine
 * replacement of a live one.
 */
export async function restoreSigningKeyFile(backupPath: string, destinationPath: string, options: { force?: boolean } = {}): Promise<{ kid: string }> {
  if (backupPath === destinationPath) throw new Error("Restore destination must differ from the backup file");
  const stored = await readProtectedKeySet(backupPath);
  const source = await open(backupPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let contents: Buffer;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("Backup file must be a regular file with mode 0600 or stricter");
    contents = await source.readFile();
  } finally { await source.close(); }

  const directory = dirname(destinationPath);
  await assertNoSymlinkDirectoryTraversal(directory);
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || (directoryStat.mode & 0o022) !== 0) {
    throw new Error("Restore destination directory must be a non-symlink directory that is not group/world writable");
  }
  if (!options.force) {
    try {
      await lstat(destinationPath);
      throw new Error("Restore destination already exists; pass --force to replace an active signing-key file");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  const temporary = join(directory, `.${basename(destinationPath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (options.force) {
      // Atomic replace: acceptable here because the caller explicitly opted into overwriting a live file.
      await rename(temporary, destinationPath);
    } else {
      // link() makes publication atomic and fails if the destination now exists (closes the check-then-act race above).
      await link(temporary, destinationPath);
      await unlink(temporary);
    }
    const directoryHandle = await open(directory, "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { kid: stored.kid };
}

/** Stage a restart-based overlap: the new private key signs; only the old public key is retained. */
export async function stageSigningKeyRotation(path: string, previousValidUntil: string): Promise<{ oldKid: string; newKid: string }> {
  const retireAt = Date.parse(previousValidUntil);
  if (!Number.isFinite(retireAt) || retireAt <= Date.now()) throw new Error("previousValidUntil must be a future ISO timestamp after the maximum old-token expiry");
  const stored = await readProtectedKeySet(path);
  if (stored.previousPublicKeys?.length) throw new Error("A previous signing key is already staged; retire it before starting another rotation");
  const oldKeys = await loadSigningKeysFromFile(path);
  if (!oldKeys) throw new Error("Signing key file cannot be loaded");
  const next = await createSigningKeys();
  stored.previousPublicKeys = [oldKeys.jwk as unknown as Record<string, unknown>];
  stored.schemaVersion = 2;
  stored.previousValidUntil = new Date(retireAt).toISOString();
  stored.kid = next.kid;
  stored.privateKeyPem = await exportPKCS8(next.privateKey);
  stored.publicKeyPem = await exportSPKI(next.publicKey);
  await writeAtomically(path, stored);
  return { oldKid: oldKeys.kid, newKid: next.kid };
}

/** Remove the previous public key only once the operator-specified token expiry has elapsed. */
export async function retirePreviousSigningKey(path: string, now = new Date()): Promise<{ retiredKid: string }> {
  const stored = await readProtectedKeySet(path);
  const old = stored.previousPublicKeys?.[0];
  if (!old || typeof old.kid !== "string") throw new Error("No previous signing key is staged");
  if (!stored.previousValidUntil || !Number.isFinite(Date.parse(stored.previousValidUntil))) throw new Error("Staged previous key has no valid retirement deadline");
  if (now.getTime() < Date.parse(stored.previousValidUntil)) throw new Error(`Previous key cannot be retired before ${stored.previousValidUntil}`);
  delete stored.previousPublicKeys;
  delete stored.previousValidUntil;
  stored.schemaVersion = 2;
  await writeAtomically(path, stored);
  return { retiredKid: old.kid };
}

