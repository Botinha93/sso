import { generateKeyPair, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { exportJWK, type JWK, importJWK, importPKCS8, importSPKI, jwtVerify, SignJWT, type KeyLike } from "jose";

const generateKeyPairAsync = promisify(generateKeyPair);

export interface SigningKeys {
  publicKey: KeyLike;
  privateKey: KeyLike;
  jwk: JWK;
  /** Public verification keys advertised during an explicitly staged restart-based overlap. */
  verificationJwks: JWK[];
  verificationKeys: Array<{ kid: string; key: KeyLike }>;
  previousValidUntil?: string;
  keySetSchemaVersion?: 1 | 2;
  kid: string;
}

type PersistedSigningKeys = {
  schemaVersion?: 1 | 2;
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
  previousPublicKeys?: JWK[];
  previousValidUntil?: string;
};

const buildSigningKeys = async (input: PersistedSigningKeys): Promise<SigningKeys> => {
  const importedPrivateKey = await importPKCS8(input.privateKeyPem, "RS256");
  const importedPublicKey = await importSPKI(input.publicKeyPem, "RS256");
  const challenge = randomUUID();
  const proof = await new SignJWT({ challenge }).setProtectedHeader({ alg: "RS256", kid: input.kid }).sign(importedPrivateKey);
  const verified = await jwtVerify(proof, importedPublicKey, { algorithms: ["RS256"] });
  if (verified.payload.challenge !== challenge) throw new Error("Active signing private/public keys do not match");
  const jwk = await exportJWK(importedPublicKey);

  const jwkWithMetadata = {
    ...jwk,
    use: "sig" as const,
    alg: "RS256" as const,
    kid: input.kid
  };
  const previous = input.previousPublicKeys ?? [];
  if (!Array.isArray(previous) || previous.length > 1) throw new Error("Signing key file may contain at most one previous public key");
  const previousJwks: JWK[] = [];
  const verificationKeys: Array<{ kid: string; key: KeyLike }> = [{ kid: input.kid, key: importedPublicKey }];
  for (const candidate of previous) {
    if (!candidate || typeof candidate !== "object" || candidate.kty !== "RSA" || typeof candidate.kid !== "string" ||
        !candidate.kid || candidate.kid === input.kid || candidate.alg !== "RS256" ||
        ["d", "p", "q", "dp", "dq", "qi", "oth"].some((field) => field in candidate)) {
      throw new Error("Previous signing key must be a distinct RS256 public RSA JWK without private parameters");
    }
    const previousKey = await importJWK(candidate, "RS256") as KeyLike;
    verificationKeys.push({ kid: candidate.kid, key: previousKey });
    previousJwks.push({ ...candidate, use: "sig", alg: "RS256" });
  }
  if (previous.length && (!input.previousValidUntil || !Number.isFinite(Date.parse(input.previousValidUntil)))) {
    throw new Error("Previous signing key requires a valid previousValidUntil timestamp");
  }

  return {
    publicKey: importedPublicKey,
    privateKey: importedPrivateKey,
    jwk: jwkWithMetadata,
    verificationJwks: [jwkWithMetadata, ...previousJwks],
    verificationKeys,
    ...(input.previousValidUntil ? { previousValidUntil: input.previousValidUntil } : {}),
    ...(input.schemaVersion ? { keySetSchemaVersion: input.schemaVersion } : {}),
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

export const loadSigningKeysFromFile = async (filePath: string): Promise<SigningKeys | undefined> => {
  let fileHandle;
  try {
    fileHandle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  let raw: string;
  try {
    const stat = await fileHandle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("Signing key file must be a regular file with mode 0600 or stricter");
    raw = await fileHandle.readFile("utf8");
  } finally { await fileHandle.close(); }
  const parsed = JSON.parse(raw) as Partial<PersistedSigningKeys>;
  if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) throw new Error("Unsupported signing key file schemaVersion");
  if (!parsed.kid || !parsed.privateKeyPem || !parsed.publicKeyPem) {
    return undefined;
  }

  return buildSigningKeys({
    kid: parsed.kid,
    privateKeyPem: parsed.privateKeyPem,
    publicKeyPem: parsed.publicKeyPem,
    ...(parsed.previousPublicKeys !== undefined ? { previousPublicKeys: parsed.previousPublicKeys } : {}),
    ...(parsed.previousValidUntil !== undefined ? { previousValidUntil: parsed.previousValidUntil } : {}),
    ...(parsed.schemaVersion !== undefined ? { schemaVersion: parsed.schemaVersion } : {})
  });
};

const persistSigningKeysToFile = async (filePath: string, keys: SigningKeys, privateKeyPem: string, publicKeyPem: string) => {
  const payload: PersistedSigningKeys = {
    schemaVersion: 1,
    kid: keys.kid,
    privateKeyPem,
    publicKeyPem
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
};

export const loadOrCreateSigningKeys = async (keysFilePath?: string): Promise<SigningKeys> => {
  // Once an operator stages schema-v2 rotation, the protected keyset becomes
  // authoritative even if legacy JWT_* env overrides are still configured.
  // This prevents a successfully staged rotation from being silently ignored.
  const persisted = keysFilePath ? await loadSigningKeysFromFile(keysFilePath) : undefined;
  if (persisted?.keySetSchemaVersion === 2) return persisted;

  const fromEnv = await loadSigningKeysFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  if (persisted) return persisted;

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
