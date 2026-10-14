import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const OPENAPI_PATH = path.join(ROOT, "openapi.yaml");
const OUTPUT_DIR = path.join(ROOT, "sdk-python", "src", "nexusid_sdk", "generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "models.py");
const OUTPUT_INIT = path.join(OUTPUT_DIR, "__init__.py");
const PYTHON_SDK_DIR = path.join(ROOT, "sdk-python", "src", "nexusid_sdk");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

const toPascal = (value) => value
  .replace(/[{}]/g, "")
  .split(/[^a-zA-Z0-9]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

const ensureValidIdentifier = (value) => {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^\d+/, "");
  if (!cleaned) {
    return "Field";
  }
  return cleaned;
};

const quoteLiteral = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
};

const isObjectSchema = (schema) => {
  if (!schema || typeof schema !== "object") {
    return false;
  }
  if (schema.type === "object") {
    return true;
  }
  return Boolean(schema.properties || schema.allOf || schema.additionalProperties);
};

const createGenerator = (openapi, compatibilityAliases = []) => {
  const definitions = new Map();
  const usedNames = new Set();

  const reserveName = (base) => {
    const raw = ensureValidIdentifier(toPascal(base));
    let candidate = raw || "Model";
    let index = 2;
    while (usedNames.has(candidate)) {
      candidate = `${raw}${index}`;
      index += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };

  const splitNullable = (schema) => {
    if (!schema || typeof schema !== "object") {
      return { schema, nullable: false };
    }

    if (Array.isArray(schema.type)) {
      const typeParts = schema.type.filter((part) => part !== "null");
      const nullable = schema.type.includes("null") || Boolean(schema.nullable);
      return { schema: { ...schema, type: typeParts.length === 1 ? typeParts[0] : typeParts }, nullable };
    }

    return { schema, nullable: Boolean(schema.nullable) };
  };

  const resolveRefName = (ref) => {
    const suffix = ref.split("/").pop() || "Ref";
    return ensureModel(suffix, openapi.components?.schemas?.[suffix], true);
  };

  const wrapNullable = (typeExpr, nullable) => (nullable ? `${typeExpr} | None` : typeExpr);

  const resolveType = (schema, nameHint) => {
    if (!schema || typeof schema !== "object") {
      return "Any";
    }

    const { schema: normalized, nullable } = splitNullable(schema);

    if (normalized.$ref) {
      return wrapNullable(resolveRefName(normalized.$ref), nullable);
    }

    if (normalized.oneOf || normalized.anyOf) {
      const variants = normalized.oneOf || normalized.anyOf;
      const unionParts = Array.from(new Set(variants.map((item, index) => resolveType(item, `${nameHint}Option${index + 1}`))));
      const union = unionParts.length === 1 ? unionParts[0] : `Union[${unionParts.join(", ")}]`;
      return wrapNullable(union, nullable);
    }

    if (normalized.allOf && !isObjectSchema(normalized)) {
      const unionParts = Array.from(new Set(normalized.allOf.map((item, index) => resolveType(item, `${nameHint}AllOf${index + 1}`))));
      const union = unionParts.length === 1 ? unionParts[0] : `Union[${unionParts.join(", ")}]`;
      return wrapNullable(union, nullable);
    }

    if (normalized.enum) {
      const literal = `Literal[${normalized.enum.map(quoteLiteral).join(", ")}]`;
      return wrapNullable(literal, nullable);
    }

    if (normalized.type === "string") {
      return wrapNullable("str", nullable);
    }

    if (normalized.type === "integer") {
      return wrapNullable("int", nullable);
    }

    if (normalized.type === "number") {
      return wrapNullable("float", nullable);
    }

    if (normalized.type === "boolean") {
      return wrapNullable("bool", nullable);
    }

    if (normalized.type === "array") {
      const itemType = resolveType(normalized.items || {}, `${nameHint}Item`);
      return wrapNullable(`list[${itemType}]`, nullable);
    }

    if (isObjectSchema(normalized)) {
      if (normalized.properties || normalized.allOf) {
        const objectName = ensureModel(nameHint, normalized);
        return wrapNullable(objectName, nullable);
      }

      if (normalized.additionalProperties) {
        const valueType = normalized.additionalProperties === true
          ? "Any"
          : resolveType(normalized.additionalProperties, `${nameHint}Value`);
        return wrapNullable(`dict[str, ${valueType}]`, nullable);
      }

      return wrapNullable("dict[str, Any]", nullable);
    }

    return wrapNullable("Any", nullable);
  };

  const mergeObjectSchema = (schema, nameHint) => {
    const properties = {};
    const required = new Set();

    const addSchema = (target, hint) => {
      if (!target || typeof target !== "object") {
        return;
      }

      if (target.$ref) {
        const refName = target.$ref.split("/").pop();
        if (refName && openapi.components?.schemas?.[refName]) {
          addSchema(openapi.components.schemas[refName], refName);
        }
        return;
      }

      if (target.allOf) {
        target.allOf.forEach((entry, index) => addSchema(entry, `${hint}Part${index + 1}`));
      }

      if (target.properties && typeof target.properties === "object") {
        Object.assign(properties, target.properties);
      }

      if (Array.isArray(target.required)) {
        target.required.forEach((item) => required.add(item));
      }
    };

    addSchema(schema, nameHint);
    return { properties, required };
  };

  const ensureModel = (nameHint, schema, useExistingName = false) => {
    const requestedName = ensureValidIdentifier(toPascal(nameHint));
    const modelName = useExistingName
      ? requestedName
      : (definitions.has(requestedName) ? requestedName : reserveName(requestedName));

    if (definitions.has(modelName)) {
      return modelName;
    }

    if (!schema || typeof schema !== "object") {
      definitions.set(modelName, { kind: "alias", target: "Any" });
      return modelName;
    }

    const { schema: normalized, nullable } = splitNullable(schema);

    if (normalized.$ref) {
      const refName = resolveRefName(normalized.$ref);
      definitions.set(modelName, { kind: "alias", target: wrapNullable(refName, nullable) });
      return modelName;
    }

    if (normalized.enum) {
      let literal = `Literal[${normalized.enum.map(quoteLiteral).join(", ")}]`;
      literal = wrapNullable(literal, nullable);
      definitions.set(modelName, { kind: "alias", target: literal });
      return modelName;
    }

    if (isObjectSchema(normalized)) {
      const merged = mergeObjectSchema(normalized, modelName);
      const fieldEntries = Object.entries(merged.properties).map(([rawName, propertySchema]) => {
        const fieldName = ensureValidIdentifier(rawName);
        const typeExpr = resolveType(propertySchema, `${modelName}${toPascal(rawName)}`);
        const required = merged.required.has(rawName);
        return { rawName, fieldName, typeExpr, required };
      });

      definitions.set(modelName, { kind: "typed-dict", fields: fieldEntries });
      return modelName;
    }

    const aliasType = resolveType(normalized, modelName);
    definitions.set(modelName, { kind: "alias", target: aliasType });
    return modelName;
  };

  const createOperationBase = (method, rawPath) => {
    const parts = rawPath.split("/").filter(Boolean).map((part) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return `By${toPascal(part.slice(1, -1))}`;
      }
      return toPascal(part);
    });

    return `${toPascal(method.toLowerCase())}${parts.join("")}`;
  };

  const generateOperationModels = () => {
    const paths = openapi.paths || {};

    for (const [rawPath, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem?.[method];
        if (!operation) {
          continue;
        }

        const base = createOperationBase(method, rawPath);
        const allParams = [...(pathItem.parameters || []), ...(operation.parameters || [])];

        const queryProps = {};
        const queryRequired = [];
        const pathProps = {};
        const pathRequired = [];

        for (const param of allParams) {
          const schema = param.schema || {};
          if (param.in === "query") {
            queryProps[param.name] = schema;
            if (param.required) {
              queryRequired.push(param.name);
            }
          }

          if (param.in === "path") {
            pathProps[param.name] = schema;
            pathRequired.push(param.name);
          }
        }

        if (Object.keys(queryProps).length > 0) {
          ensureModel(`${base}QueryParams`, { type: "object", properties: queryProps, required: queryRequired });
        }

        if (Object.keys(pathProps).length > 0) {
          ensureModel(`${base}PathParams`, { type: "object", properties: pathProps, required: pathRequired });
        }

        const requestBody = operation.requestBody;
        if (requestBody?.content) {
          const preferredContentType = ["application/json", "application/x-www-form-urlencoded", "multipart/form-data"]
            .find((value) => Boolean(requestBody.content[value]))
            || Object.keys(requestBody.content)[0];

          const schema = preferredContentType ? requestBody.content[preferredContentType]?.schema : undefined;
          if (schema) {
            ensureModel(`${base}RequestBody`, schema);
          }
        }

        const responseTypes = [];
        for (const [statusCode, response] of Object.entries(operation.responses || {})) {
          if (!String(statusCode).startsWith("2")) {
            continue;
          }

          if (!response || typeof response !== "object") {
            continue;
          }

          const content = response.content || {};
          if (Object.keys(content).length === 0) {
            responseTypes.push("None");
            continue;
          }

          const preferredContentType = ["application/json", "text/html", "text/plain", "application/xml", "application/samlmetadata+xml"]
            .find((value) => Boolean(content[value]))
            || Object.keys(content)[0];

          const schema = preferredContentType ? content[preferredContentType]?.schema : undefined;
          if (!schema) {
            responseTypes.push("Any");
            continue;
          }

          const responseModel = ensureModel(`${base}Response${String(statusCode)}`, schema);
          responseTypes.push(responseModel);
        }

        const deduped = Array.from(new Set(responseTypes));
        const responseTarget = deduped.length === 0
          ? "Any"
          : (deduped.length === 1 ? deduped[0] : `Union[${deduped.join(", ")}]`);

        definitions.set(ensureValidIdentifier(`${toPascal(base)}Response`), { kind: "alias", target: responseTarget });
      }
    }
  };

  const generate = () => {
    const components = openapi.components?.schemas || {};
    for (const [name, schema] of Object.entries(components)) {
      ensureModel(name, schema, true);
    }

    generateOperationModels();

    for (const aliasName of compatibilityAliases) {
      if (!definitions.has(aliasName)) {
        definitions.set(aliasName, { kind: "alias", target: "Any" });
      }
    }

    const aliases = [];
    const typedDicts = [];

    for (const [name, definition] of definitions.entries()) {
      if (definition.kind === "alias") {
        aliases.push({ name, target: definition.target });
      } else {
        typedDicts.push({ name, fields: definition.fields });
      }
    }

    aliases.sort((a, b) => a.name.localeCompare(b.name));
    typedDicts.sort((a, b) => a.name.localeCompare(b.name));

    const lines = [
      "# Generated from openapi.yaml by scripts/generate-python-sdk-models.mjs",
      "# Do not edit by hand.",
      "from __future__ import annotations",
      "",
      "from typing import Any, Literal, TypeAlias, Union",
      "from typing_extensions import NotRequired, TypedDict",
      "",
    ];

    for (const model of typedDicts) {
      lines.push(`class ${model.name}(TypedDict):`);
      if (model.fields.length === 0) {
        lines.push("    pass", "");
        continue;
      }

      for (const field of model.fields) {
        const annotation = field.required ? field.typeExpr : `NotRequired[${field.typeExpr}]`;
        lines.push(`    ${ensureValidIdentifier(field.rawName)}: ${annotation}`);
      }
      lines.push("");
    }

    for (const alias of aliases) {
      const escaped = alias.target.replaceAll('"', '\\"');
      lines.push(`${alias.name}: TypeAlias = \"${escaped}\"`);
    }

    if (aliases.length > 0) {
      lines.push("");
    }

    const exportNames = [...aliases.map((alias) => alias.name), ...typedDicts.map((model) => model.name)]
      .sort((a, b) => a.localeCompare(b));

    lines.push("__all__ = [");
    for (const name of exportNames) {
      lines.push(`    \"${name}\",`);
    }
    lines.push("]", "");

    return lines.join("\n");
  };

  return { generate };
};

const collectPythonSdkModelReferences = async () => {
  const entries = await fs.readdir(PYTHON_SDK_DIR, { withFileTypes: true });
  const names = new Set();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".py")) {
      continue;
    }

    const source = await fs.readFile(path.join(PYTHON_SDK_DIR, entry.name), "utf8");
    const matches = source.matchAll(/\bgm\.([A-Za-z_][A-Za-z0-9_]*)\b/g);
    for (const match of matches) {
      names.add(match[1]);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
};

const main = async () => {
  const raw = await fs.readFile(OPENAPI_PATH, "utf8");
  const openapi = parse(raw);
  const compatibilityAliases = await collectPythonSdkModelReferences();
  const generator = createGenerator(openapi, compatibilityAliases);
  const output = generator.generate();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, output, "utf8");
  await fs.writeFile(OUTPUT_INIT, "from .models import *\n", "utf8");

  console.log(`Generated ${path.relative(ROOT, OUTPUT_FILE)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
