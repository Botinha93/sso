import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OPENAPI_PATH = path.join(ROOT, "openapi.yaml");
const SDK_SRC_PATH = path.join(ROOT, "sdk", "src");
const ALLOWLIST_PATH = path.join(ROOT, "sdk", "openapi-drift-allowlist.json");

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const normalizePath = (value) => {
  const withoutQuery = value.split("?")[0];
  const normalizedTemplate = withoutQuery
    .replace(/\$\{[^}]+\}/g, "{param}")
    .replace(/\{[^}]+\}/g, "{param}");
  return normalizedTemplate.replace(/\/{2,}/g, "/");
};

const collectFiles = async (dir, predicate) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(fullPath, predicate);
    }
    return predicate(fullPath) ? [fullPath] : [];
  }));

  return files.flat();
};

const extractOpenApiOperations = (openapiText) => {
  const operations = new Set();
  const lines = openapiText.split(/\r?\n/);

  let inPaths = false;
  let currentPath = null;

  for (const line of lines) {
    if (!inPaths) {
      if (/^paths:\s*$/.test(line)) {
        inPaths = true;
      }
      continue;
    }

    if (/^[A-Za-z]/.test(line)) {
      break;
    }

    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && currentPath) {
      const method = methodMatch[1].toLowerCase();
      operations.add(`${method} ${normalizePath(currentPath)}`);
    }
  }

  return operations;
};

const extractSdkOperations = (code) => {
  const operations = new Set();
  const regex = /client\.(get|post|put|patch|delete)\s*(?:<[^>]+>)?\s*\(\s*([`"'])([^`"']+)\2/gm;

  let match = regex.exec(code);
  while (match) {
    const method = match[1].toLowerCase();
    const rawPath = match[3].trim();

    if (rawPath.startsWith("/")) {
      operations.add(`${method} ${normalizePath(rawPath)}`);
    }

    match = regex.exec(code);
  }

  return operations;
};

const run = async () => {
  const [openapiText, sdkFiles] = await Promise.all([
    readFile(OPENAPI_PATH, "utf8"),
    collectFiles(SDK_SRC_PATH, (file) => file.endsWith(".ts"))
  ]);

  let allowlistedMissing = new Set();
  try {
    const allowlistRaw = await readFile(ALLOWLIST_PATH, "utf8");
    const parsed = JSON.parse(allowlistRaw);
    const values = Array.isArray(parsed.missingInOpenApi) ? parsed.missingInOpenApi : [];
    allowlistedMissing = new Set(values.map((value) => String(value)));
  } catch {
    // Optional file. If absent/invalid, run without allowlist.
  }

  const openApiOperations = extractOpenApiOperations(openapiText);
  const sdkOperations = new Set();

  for (const file of sdkFiles) {
    const source = await readFile(file, "utf8");
    const fileOps = extractSdkOperations(source);
    for (const op of fileOps) {
      const [method] = op.split(" ");
      if (HTTP_METHODS.has(method)) {
        sdkOperations.add(op);
      }
    }
  }

  const missingInOpenApi = [...sdkOperations]
    .filter((op) => !openApiOperations.has(op))
    .sort();

  const blockingMissing = missingInOpenApi.filter((op) => !allowlistedMissing.has(op));

  if (blockingMissing.length > 0) {
    console.error("OpenAPI drift detected: SDK operations missing in openapi.yaml");
    for (const op of blockingMissing) {
      console.error(`- ${op}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`OpenAPI drift check passed: ${sdkOperations.size} SDK operations validated.`);
  if (missingInOpenApi.length > 0) {
    console.log(`Allowlisted missing operations: ${missingInOpenApi.length}`);
  }
};

run().catch((error) => {
  console.error("OpenAPI drift check failed with an unexpected error.");
  console.error(error);
  process.exitCode = 1;
});
