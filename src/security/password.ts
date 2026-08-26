import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  try {
    const [salt, storedKey] = passwordHash.split(":");

    if (!salt || !storedKey) {
      return false;
    }

    const derivedKey = scryptSync(password, salt, KEY_LENGTH);
    const storedBuffer = Buffer.from(storedKey, "hex");

    if (derivedKey.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
};
