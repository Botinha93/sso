import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const candidateDirs = [
  join(currentDir, "..", "views"),
  resolve(process.cwd(), "src", "views")
];

export const readViewAsset = async (filename: string) => {
  for (const dir of candidateDirs) {
    const filePath = join(dir, filename);

    try {
      await access(filePath);
      return await readFile(filePath, "utf8");
    } catch {
      continue;
    }
  }

  throw new Error(`View asset not found: ${filename}`);
};
