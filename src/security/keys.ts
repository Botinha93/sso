import { generateKeyPair, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { exportJWK, type JWK, importPKCS8, importSPKI, type KeyLike } from "jose";

const generateKeyPairAsync = promisify(generateKeyPair);

export interface SigningKeys {
  publicKey: KeyLike;
  privateKey: KeyLike;
  jwk: JWK;
  kid: string;
}

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

  const importedPrivateKey = await importPKCS8(privateKey, "RS256");
  const importedPublicKey = await importSPKI(publicKey, "RS256");
  const jwk = await exportJWK(importedPublicKey);
  const kid = randomUUID();

  return {
    publicKey: importedPublicKey,
    privateKey: importedPrivateKey,
    jwk: {
      ...jwk,
      use: "sig",
      alg: "RS256",
      kid
    },
    kid
  };
};
