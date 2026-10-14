import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { getAsset } from "node:sea";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const MANIFEST_KEY = "__manifest.json";

const readManifest = () => {
  const manifestText = getAsset(MANIFEST_KEY, "utf8");
  if (!manifestText) {
    throw new Error("SEA manifest asset is missing");
  }
  return JSON.parse(manifestText);
};

const ensureExtractedRuntime = async (manifest) => {
  const cacheHash = createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex").slice(0, 12);
  const runtimeRoot = join(homedir(), ".cache", "sso-platform", `runtime-${cacheHash}`);
  const markerPath = join(runtimeRoot, ".ready");

  try {
    await stat(markerPath);
    return runtimeRoot;
  } catch {
    // Continue extraction.
  }

  await mkdir(runtimeRoot, { recursive: true });

  for (const file of manifest.files) {
    const targetPath = join(runtimeRoot, file.path);
    await mkdir(dirname(targetPath), { recursive: true });
    const content = getAsset(file.key);
    if (!content) {
      throw new Error(`Missing SEA asset for ${file.path}`);
    }
    await writeFile(targetPath, Buffer.from(content));
  }

  await writeFile(markerPath, new Date().toISOString(), "utf8");
  return runtimeRoot;
};

const run = async () => {
  const manifest = readManifest();
  const runtimeRoot = await ensureExtractedRuntime(manifest);

  process.chdir(runtimeRoot);

  const entryPath = join(runtimeRoot, manifest.entrypoint);
  const module = await import(pathToFileURL(entryPath).href);
  if (typeof module.runContainerEntrypoint !== "function") {
    throw new Error("Entrypoint export runContainerEntrypoint was not found");
  }

  await module.runContainerEntrypoint();
};

await run();
