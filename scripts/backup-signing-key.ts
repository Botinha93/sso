import { resolve } from "node:path";
import { backupSigningKeyFile } from "../src/security/key-rotation.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const file = option("--file");
const destination = option("--to");
if (!file || !destination) throw new Error("Pass --file with the protected keyset and --to with a new private backup path");
const result = await backupSigningKeyFile(resolve(file), resolve(destination));
process.stdout.write(`Created protected signing-key backup for kid ${result.kid}. The backup contains private key material; store it separately and securely.\n`);
