import { generateKeyPair, randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { exportJWK, type JWK, importPKCS8, importSPKI, type KeyLike } from "jose";

const generateKeyPairAsync = promisify(generateKeyPair);

export interface SigningKeys {
  publicKey: KeyLike;
  privateKey: KeyLike;
  jwk: JWK;
  kid: string;
}

type PersistedSigningKeys = {
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
};

const buildSigningKeys = async (input: PersistedSigningKeys): Promise<SigningKeys> => {
  const importedPrivateKey = await importPKCS8(input.privateKeyPem, "RS256");
  const importedPublicKey = await importSPKI(input.publicKeyPem, "RS256");
  const jwk = await exportJWK(importedPublicKey);

  return {
    publicKey: importedPublicKey,
    privateKey: importedPrivateKey,
    jwk: {
      ...jwk,
      use: "sig",
      alg: "RS256",
      kid: input.kid
    },
    kid: input.kid
  };
};

export const createSigningKeys = async (): Promise<SigningKeys> => {
  const { publicKey, privateKey } = await generateKeyPairAsync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });

  return buildSigningKeys({
    kid: randomUUID(),
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  });
};

const loadSigningKeysFromEnv = async (): Promise<SigningKeys | undefined> => {
  const privateKeyPem = process.env.JWT_PRIVATE_KEY_PEM?.trim();
  const publicKeyPem = process.env.JWT_PUBLIC_KEY_PEM?.trim();
  if (!privateKeyPem || !publicKeyPem) {
    return undefined;
  }

  const kid = process.env.JWT_KID?.trim() || randomUUID();
  return buildSigningKeys({ kid, privateKeyPem, publicKeyPem });
};

const loadSigningKeysFromFile = async (filePath: string): Promise<SigningKeys | undefined> => {
  try {
    await access(filePath);
  } catch {
    return undefined;
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<PersistedSigningKeys>;
  if (!parsed.kid || !parsed.privateKeyPem || !parsed.publicKeyPem) {
    return undefined;
  }

  return buildSigningKeys({
    kid: parsed.kid,
    privateKeyPem: parsed.privateKeyPem,
    publicKeyPem: parsed.publicKeyPem
  });
};

const persistSigningKeysToFile = async (filePath: string, keys: SigningKeys, privateKeyPem: string, publicKeyPem: string) => {
  const payload: PersistedSigningKeys = {
    kid: keys.kid,
    privateKeyPem,
    publicKeyPem
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
};

export const loadOrCreateSigningKeys = async (keysFilePath?: string): Promise<SigningKeys> => {
  const fromEnv = await loadSigningKeysFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  if (keysFilePath) {
    const fromFile = await loadSigningKeysFromFile(keysFilePath);
    if (fromFile) {
      return fromFile;
    }
  }

  const { publicKey, privateKey } = await generateKeyPairAsync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });

  const keys = await buildSigningKeys({
    kid: randomUUID(),
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  });

  if (keysFilePath) {
    await mkdirSafe(dirname(keysFilePath));
    await persistSigningKeysToFile(keysFilePath, keys, privateKey, publicKey);
  }

  return keys;
};

const mkdirSafe = async (directory: string) => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(directory, { recursive: true });
};
