import { resolve } from "node:path";
import { restoreSigningKeyFile } from "../src/security/key-rotation.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

const backup = option("--from");
const destination = option("--to");
if (!backup || !destination) throw new Error("Pass --from with the protected backup and --to with the active signing-key path to restore");
const result = await restoreSigningKeyFile(resolve(backup), resolve(destination), { force: flag("--force") });
process.stdout.write(`Restored protected signing-key backup for kid ${result.kid} to the active path. The restored file contains private key material; the service must reload it before new tokens use it.\n`);
