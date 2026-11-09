import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export type SecretVerifier = { salt: string; verifier: string };

const scrypt = (secret: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(secret, salt, KEY_LENGTH, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error);
    else resolve(key as Buffer);
  });
});

export async function makeSecretVerifier(secret: string): Promise<SecretVerifier> {
  const salt = randomBytes(SALT_LENGTH);
  const verifier = await scrypt(secret, salt);
  return { salt: salt.toString("base64url"), verifier: verifier.toString("base64url") };
}

export async function verifySecret(secret: string, encodedSalt: string, encodedVerifier: string): Promise<boolean> {
  try {
    const expected = Buffer.from(encodedVerifier, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(secret, Buffer.from(encodedSalt, "base64url"));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
