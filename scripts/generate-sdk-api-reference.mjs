import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "sdk", "src", "index.ts");
const outputPath = path.join(root, "sdk", "API_REFERENCE.md");

const extractNamedExports = (source, isTypeExport) => {
  const regex = isTypeExport
    ? /export\s+type\s*\{([\s\S]*?)\}\s+from\s+"([^"]+)";/g
    : /export\s+\{([\s\S]*?)\}\s+from\s+"([^"]+)";/g;
  const groups = [];

  let match = regex.exec(source);
  while (match) {
    const rawNames = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    groups.push({
      from: match[2],
      names: rawNames
    });

    match = regex.exec(source);
  }

  return groups;
};

const toBulletList = (items) => items.map((item) => `- ${item}`).join("\n");

const splitTopLevel = (value) => {
  const parts = [];
  let current = "";
  let depth = 0;

  for (const ch of value) {
    if (ch === "<" || ch === "(" || ch === "{" || ch === "[") depth += 1;
    if (ch === ">" || ch === ")" || ch === "}" || ch === "]") depth = Math.max(0, depth - 1);

    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
};

const inferTypeFromDefault = (value) => {
  const normalized = value.trim();
  if (/^[-+]?\d+(?:_\d+)*(?:\.\d+)?$/.test(normalized)) return "number";
  if (/^(true|false)$/.test(normalized)) return "boolean";
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    return "string";
  }
  if (normalized === "{}") return "object";
  if (normalized === "[]") return "unknown[]";
  return "unknown";
};

const parseParams = (paramsText) => {
  if (!paramsText.trim()) return [];
  return splitTopLevel(paramsText).map((entry) => {
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) {
      const equalsIndex = entry.indexOf("=");
      if (equalsIndex === -1) {
        return { name: entry.trim(), type: "unknown" };
      }

      const name = entry.slice(0, equalsIndex).trim();
      const defaultValue = entry.slice(equalsIndex + 1).trim();
      return { name, type: inferTypeFromDefault(defaultValue) };
    }

    const name = entry.slice(0, colonIndex).trim();
    const type = entry.slice(colonIndex + 1).trim();
    return { name, type };
  });
};

const describeRuntimeSymbol = (name, kind) => {
  const map = {
    createAdminClient: "Creates an admin client for typed administrative APIs.",
    createAuthAPI: "Creates an auth API helper for token lifecycle operations.",
    buildAuthorizeUrl: "Builds an OAuth authorization URL from client parameters.",
    createCodeChallenge: "Derives a PKCE code challenge from a verifier.",
    createCodeVerifier: "Generates a PKCE code verifier string.",
    generatePKCEPair: "Generates both PKCE verifier and challenge values.",
    createClient: "Creates the base HTTP SDK client instance.",
    createPortalAPI: "Creates a portal API helper for current logged-in user actions.",
    pollWorkflowState: "Polls a state fetcher until a terminal condition is met.",
    waitForAccessRequestTerminalState: "Waits until an access request reaches a terminal status.",
    waitForElevationTerminalState: "Waits until an elevation request reaches a terminal status.",
    APIClientError: "Base SDK error with standardized metadata.",
    APIRequestTimeoutError: "Error raised when request timeout is reached.",
    APIResponseError: "Error raised for non-2xx HTTP responses."
  };

  if (map[name]) return map[name];
  if (kind === "class") return "Exported class symbol.";
  return "Exported runtime symbol.";
};

const loadModuleSource = async (fromPath) => {
  const absolute = path.join(root, "sdk", "src", `${fromPath.replace(/^\.\//, "").replace(/\.js$/, ".ts")}`);
  return readFile(absolute, "utf8");
};

const findMatching = (source, startIndex, openChar, closeChar) => {
  let depth = 0;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

const extractRuntimeSignature = (source, name) => {
  const constStart = source.indexOf(`export const ${name}`);
  if (constStart !== -1) {
    const equalsIndex = source.indexOf("=", constStart);
    const paramsStart = source.indexOf("(", equalsIndex);

    if (equalsIndex !== -1 && paramsStart !== -1) {
      const paramsEnd = findMatching(source, paramsStart, "(", ")");
      const arrowIndex = paramsEnd === -1 ? -1 : source.indexOf("=>", paramsEnd);
      if (paramsEnd !== -1 && arrowIndex !== -1 && paramsEnd < arrowIndex) {
        const paramsText = source.slice(paramsStart + 1, paramsEnd);
        const returnPrefix = source.slice(paramsEnd + 1, arrowIndex).trim();
        const returns = returnPrefix.startsWith(":") ? returnPrefix.slice(1).trim() : "inferred";

        return {
          kind: "function",
          params: parseParams(paramsText),
          returns
        };
      }
    }
  }

  const classStart = source.indexOf(`export class ${name}`);
  if (classStart !== -1) {
    const classOpenBrace = source.indexOf("{", classStart);
    const classCloseBrace = classOpenBrace === -1 ? -1 : findMatching(source, classOpenBrace, "{", "}");
    const classBlock = classCloseBrace === -1 ? source.slice(classStart) : source.slice(classStart, classCloseBrace + 1);

    const ctorRegex = /constructor\(([^)]*)\)/m;
    const ctorMatch = classBlock.match(ctorRegex);
    return {
      kind: "class",
      params: parseParams(ctorMatch?.[1] ?? ""),
      returns: name
    };
  }

  return {
    kind: "unknown",
    params: [],
    returns: "unknown"
  };
};

const run = async () => {
  const source = await readFile(indexPath, "utf8");

  const runtimeExports = extractNamedExports(source, false);
  const typeExports = extractNamedExports(source, true);

  const runtimeNames = runtimeExports.flatMap((group) => group.names);
  const typeNames = typeExports.flatMap((group) => group.names);

  const sections = [];

  sections.push("# SDK API Reference");
  sections.push("");
  sections.push("This file is generated from sdk/src/index.ts. Do not edit manually.");
  sections.push("");
  sections.push(`Generated at: ${new Date().toISOString()}`);
  sections.push("");

  sections.push("## Runtime API Documentation");
  sections.push("");
  for (const group of runtimeExports) {
    const moduleSource = await loadModuleSource(group.from);

    for (const name of group.names) {
      const signature = extractRuntimeSignature(moduleSource, name);
      sections.push(`### ${name}`);
      sections.push("");
      sections.push(`**Purpose:** ${describeRuntimeSymbol(name, signature.kind)}`);
      sections.push("");
      sections.push(`**Declared in:** ${group.from}`);
      sections.push("");

      if (signature.params.length > 0) {
        sections.push("**Parameters:**");
        sections.push("");
        for (const param of signature.params) {
          sections.push(`- ${param.name}: ${param.type}`);
        }
        sections.push("");
      } else {
        sections.push("**Parameters:** none");
        sections.push("");
      }

      sections.push(`**Returns:** ${signature.returns}`);
      sections.push("");
    }
  }

  sections.push("## Type Exports Index");
  sections.push("");
  sections.push(toBulletList(typeNames));
  sections.push("");

  sections.push("## Export Groups");
  sections.push("");

  for (const group of runtimeExports) {
    sections.push(`### Runtime from ${group.from}`);
    sections.push("");
    sections.push(toBulletList(group.names));
    sections.push("");
  }

  for (const group of typeExports) {
    sections.push(`### Types from ${group.from}`);
    sections.push("");
    sections.push(toBulletList(group.names));
    sections.push("");
  }

  await writeFile(outputPath, sections.join("\n"), "utf8");
  console.log(`Generated ${path.relative(root, outputPath)} with detailed docs for ${runtimeNames.length} runtime exports and index entries for ${typeNames.length} type exports.`);
};

run().catch((error) => {
  console.error("Failed to generate SDK API reference.");
  console.error(error);
  process.exitCode = 1;
});
