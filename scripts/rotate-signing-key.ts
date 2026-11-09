import { resolve } from "node:path";
import { retirePreviousSigningKey, stageSigningKeyRotation } from "../src/security/key-rotation.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const file = option("--file");
if (!file) throw new Error("Pass --file with the protected .jwt-signing-keys.json path");
const keyFile = resolve(file);
if (process.argv.includes("--retire")) {
  const result = await retirePreviousSigningKey(keyFile);
  process.stdout.write(`Retired previous public signing key ${result.retiredKid}. Restart NexusID to publish the reduced JWKS.\n`);
} else {
  const previousValidUntil = option("--previous-valid-until");
  if (!previousValidUntil) throw new Error("Pass --previous-valid-until with the latest expiry of all tokens signed by the old key");
  const result = await stageSigningKeyRotation(keyFile, previousValidUntil);
  process.stdout.write(`Staged signing key overlap: active kid ${result.newKid}; previous public kid ${result.oldKid}. Restart NexusID to activate the new signer and publish both public keys.\n`);
}
