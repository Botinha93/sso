import { generateKeyPair, randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { exportJWK, importPKCS8, importSPKI } from "jose";
const generateKeyPairAsync = promisify(generateKeyPair);
const buildSigningKeys = async (input) => {
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
export const createSigningKeys = async () => {
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
const loadSigningKeysFromEnv = async () => {
    const privateKeyPem = process.env.JWT_PRIVATE_KEY_PEM?.trim();
    const publicKeyPem = process.env.JWT_PUBLIC_KEY_PEM?.trim();
    if (!privateKeyPem || !publicKeyPem) {
        return undefined;
    }
    const kid = process.env.JWT_KID?.trim() || randomUUID();
    return buildSigningKeys({ kid, privateKeyPem, publicKeyPem });
};
const loadSigningKeysFromFile = async (filePath) => {
    try {
        await access(filePath);
    }
    catch {
        return undefined;
    }
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.kid || !parsed.privateKeyPem || !parsed.publicKeyPem) {
        return undefined;
    }
    return buildSigningKeys({
        kid: parsed.kid,
        privateKeyPem: parsed.privateKeyPem,
        publicKeyPem: parsed.publicKeyPem
    });
};
const persistSigningKeysToFile = async (filePath, keys, privateKeyPem, publicKeyPem) => {
    const payload = {
        kid: keys.kid,
        privateKeyPem,
        publicKeyPem
    };
    await writeFile(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
};
export const loadOrCreateSigningKeys = async (keysFilePath) => {
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
const mkdirSafe = async (directory) => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(directory, { recursive: true });
};
