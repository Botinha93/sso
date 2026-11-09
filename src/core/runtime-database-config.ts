import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { AppConfig } from "./config.js";

const execFileAsync = promisify(execFile);
const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..", "..");
const runtimeDatabaseConfigPath = resolve("./data/database-config.json");
const prismaTemplatePath = join(projectRoot, "prisma", "schema.template.prisma");

const withSchemaPushLock = async <T>(provider: RuntimeDatabaseConfig["databaseProvider"], databaseUrl: string, run: () => Promise<T>): Promise<T> => {
  if (provider === "postgresql") {
    const pgModule = await import("pg");
    const Client = pgModule.default.Client;
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    let locked = false;
    try {
      await client.query("SELECT pg_advisory_lock(hashtextextended('nexusid:schema-push:' || current_database(), 0))");
      locked = true;
      return await run();
    } finally {
      try {
        if (locked) await client.query("SELECT pg_advisory_unlock(hashtextextended('nexusid:schema-push:' || current_database(), 0))");
      } finally {
        await client.end();
      }
    }
  }

  if (provider === "mysql") {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection(databaseUrl);
    const lockName = `nexusid:schema-push:${createHash("sha256").update(new URL(databaseUrl).host + new URL(databaseUrl).pathname).digest("hex").slice(0, 32)}`;
    let locked = false;
    try {
      const [rows] = await connection.query("SELECT GET_LOCK(?, 300) AS acquired", [lockName]);
      if ((rows as Array<{ acquired: number | null }>)[0]?.acquired !== 1) throw new Error("Timed out waiting for the NexusID schema-push lock");
      locked = true;
      return await run();
    } finally {
      try {
        if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
      } finally {
        await connection.end();
      }
    }
  }

  return run();
};

type RuntimeDatabaseConfig = Pick<AppConfig, "databaseProvider" | "databasePath" | "externalDatabaseUrl">;

const isDatabaseProvider = (value: unknown): value is RuntimeDatabaseConfig["databaseProvider"] =>
  value === "sqlite" || value === "postgresql" || value === "mysql";

const normalizeRuntimeDatabaseConfig = (value: unknown): RuntimeDatabaseConfig | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  if (!isDatabaseProvider(raw.databaseProvider)) {
    return undefined;
  }

  return {
    databaseProvider: raw.databaseProvider,
    databasePath: typeof raw.databasePath === "string" && raw.databasePath.trim()
      ? raw.databasePath
      : "./data/sso.sqlite",
    externalDatabaseUrl: typeof raw.externalDatabaseUrl === "string" && raw.externalDatabaseUrl.trim()
      ? raw.externalDatabaseUrl
      : undefined
  };
};

export const readRuntimeDatabaseConfigSync = (): RuntimeDatabaseConfig | undefined => {
  if (!existsSync(runtimeDatabaseConfigPath)) {
    return undefined;
  }

  try {
    return normalizeRuntimeDatabaseConfig(JSON.parse(readFileSync(runtimeDatabaseConfigPath, "utf8")));
  } catch {
    return undefined;
  }
};

export const saveRuntimeDatabaseConfig = async (config: RuntimeDatabaseConfig) => {
  await mkdir(dirname(runtimeDatabaseConfigPath), { recursive: true });
  await writeFile(runtimeDatabaseConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

export const applyRuntimeDatabaseConfig = (config: AppConfig): AppConfig => {
  // An explicit DATABASE_PATH (e.g. set by the test harness) takes precedence
  // over the persisted runtime configuration.
  if (process.env.DATABASE_PATH) {
    return config;
  }

  const persisted = readRuntimeDatabaseConfigSync();
  if (!persisted) {
    return config;
  }

  return {
    ...config,
    ...persisted
  };
};

export const ensureExternalDatabaseSchema = async (config: AppConfig) => {
  if (config.databaseProvider === "sqlite") {
    return;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`External database URL is required when database provider is ${config.databaseProvider}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "sso-prisma-"));
  const tempSchemaPath = join(tempDir, `schema.${config.databaseProvider}.prisma`);

  try {
    const template = await readFile(prismaTemplatePath, "utf8");
    const providerSchema = template
      .replaceAll("__PROVIDER__", config.databaseProvider)
      .replaceAll("__OUTPUT_DIR__", "../dist/generated/prisma/runtime");
    const schema = config.databaseProvider === "mysql"
      ? providerSchema
        .replace(/^(\s+\w+Json\s+String\??)(\s+)/gm, "$1 @db.LongText$2")
        .replace(/^([^\n]*@db\.LongText[^\n]*?) @default\("[^)]*"\)(?= @map)/gm, "$1")
      : providerSchema;

    await writeFile(tempSchemaPath, schema, "utf8");
    await withSchemaPushLock(config.databaseProvider, config.externalDatabaseUrl, () => execFileAsync(process.platform === "win32" ? "npx.cmd" : "npx", [
        "prisma",
        "db",
        "push",
        "--accept-data-loss",
        "--skip-generate",
        "--schema",
        tempSchemaPath
      ], {
        cwd: projectRoot,
        env: {
          ...process.env,
          DATABASE_URL: config.externalDatabaseUrl
        }
      }));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
