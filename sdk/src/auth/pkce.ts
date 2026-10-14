import type { PKCEPair } from "./types.js";

const PKCE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

const getCrypto = (): Crypto => {
  if (!globalThis.crypto) {
    throw new Error("PKCE requires globalThis.crypto to be available in the current runtime");
  }

  return globalThis.crypto;
};

const encodeBase64Url = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

/**
 * Generates a PKCE code verifier.
 *
 * @param length Desired verifier length. Must be an integer between 43 and 128.
 * @returns A verifier string suitable for OAuth PKCE flows.
 */
export const createCodeVerifier = (length = 64): string => {
  if (!Number.isInteger(length) || length < 43 || length > 128) {
    throw new RangeError("PKCE code verifier length must be an integer between 43 and 128");
  }

  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);

  let verifier = "";
  for (const byte of bytes) {
    verifier += PKCE_ALPHABET[byte % PKCE_ALPHABET.length];
  }

  return verifier;
};

/**
 * Derives a PKCE S256 code challenge from a code verifier.
 *
 * @param codeVerifier Previously generated PKCE verifier.
 * @returns Base64URL encoded SHA-256 challenge string.
 */
export const createCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return encodeBase64Url(new Uint8Array(digest));
};

/**
 * Creates a complete PKCE pair for OAuth authorization code flows.
 *
 * @param length Desired verifier length. Must be an integer between 43 and 128.
 * @returns PKCE verifier/challenge pair with `S256` method.
 */
export const generatePKCEPair = async (length = 64): Promise<PKCEPair> => {
  const codeVerifier = createCodeVerifier(length);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256"
  };
};