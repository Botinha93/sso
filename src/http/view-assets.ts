import { access, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const candidateDirs = [
  join(currentDir, "..", "views"),
  resolve(process.cwd(), "src", "views")
];

const distDir = resolve(currentDir, "..", "..", "dist");

const frontendDirs = {
  admin: [join(distDir, "admin")],
  portal: [join(distDir, "portal")]
} as const;

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

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

export const readFrontendAsset = async (frontend: keyof typeof frontendDirs, relativePath: string) => {
  for (const dir of frontendDirs[frontend]) {
    const filePath = join(dir, relativePath);
    const resolvedPath = resolve(filePath);
    const resolvedDir = resolve(dir);

    // Prevent path traversal: resolved path must remain within the frontend directory.
    if (!resolvedPath.startsWith(resolvedDir + sep) && resolvedPath !== resolvedDir) {
      continue;
    }

    try {
      await access(filePath);
      return await readFile(filePath);
    } catch {
      continue;
    }
  }

  throw new Error(`Frontend asset not found: ${frontend}/${relativePath}`);
};

export const getAssetContentType = (assetPath: string) => {
  return contentTypes[extname(assetPath).toLowerCase()] ?? "application/octet-stream";
};
