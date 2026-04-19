import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { bootstrap } from "../bootstrap.js";
import { loadConfig } from "../core/config.js";
import { DatabaseMigrationService } from "../services/database-migration-service.js";
import { startServer } from "../server.js";

const execFileAsync = promisify(execFile);
const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..", "..", "..");
const prismaTemplatePath = join(projectRoot, "prisma", "schema.template.prisma");
const initSentinelPath = process.env.INIT_SENTINEL_PATH ?? "/app/data/.container-init-complete";

const log = (message: string) => {
  console.log(`[container-init] ${message}`);
};

const exists = async (filePath: string) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const deriveAdminUsername = (email: string) => {
  const localPart = email.split("@")[0] ?? "admin";
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "admin";
};

const ensureExternalSchema = async () => {
  const config = loadConfig();

  if (config.databaseProvider === "sqlite" || process.env.RUN_PRISMA_DB_PUSH === "false") {
    return;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "sso-prisma-"));
  const tempSchemaPath = join(tempDir, `schema.${config.databaseProvider}.prisma`);

  try {
    const template = await readFile(prismaTemplatePath, "utf8");
    const schema = template
      .replaceAll("__PROVIDER__", config.databaseProvider)
      .replaceAll("__OUTPUT_DIR__", "../dist/generated/prisma/runtime");

    await writeFile(tempSchemaPath, schema, "utf8");
    log(`Pushing ${config.databaseProvider} schema`);
    await execFileAsync(process.platform === "win32" ? "npx.cmd" : "npx", [
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
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const maybeImportSqliteData = async () => {
  const config = loadConfig();
  const sourceSqlitePath = process.env.MIGRATE_FROM_SQLITE_PATH;

  if (!sourceSqlitePath || config.databaseProvider === "sqlite") {
    return;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  if (await exists(initSentinelPath)) {
    log(`Skipping SQLite import because sentinel exists at ${initSentinelPath}`);
    return;
  }

  const migrationService = new DatabaseMigrationService();
  const resolvedSourcePath = resolve(sourceSqlitePath);

  log(`Importing SQLite data from ${resolvedSourcePath}`);
  await migrationService.migrateFromSqlite({
    sqlitePath: resolvedSourcePath,
    provider: config.databaseProvider,
    externalDatabaseUrl: config.externalDatabaseUrl
  });

  await mkdir(dirname(initSentinelPath), { recursive: true });
  await writeFile(initSentinelPath, new Date().toISOString(), "utf8");
};

const maybeAutoSetup = async () => {
  if (process.env.AUTO_SETUP === "false") {
    return;
  }

  const config = loadConfig();
  const services = await bootstrap(config);

  try {
    const status = await services.setupService.status();
    if (!status.requiresSetup) {
      return;
    }

    const email = (process.env.ADMIN_EMAIL ?? config.admin.email).trim().toLowerCase();
    const password = (process.env.ADMIN_PASSWORD ?? config.admin.password).trim();
    const name = (process.env.ADMIN_NAME ?? "Platform Administrator").trim();
    const username = (process.env.ADMIN_USERNAME ?? deriveAdminUsername(email)).trim();

    if (!email || !password) {
      log("Skipping auto-setup because admin credentials are incomplete");
      return;
    }

    log(`Running initial setup for ${email}`);
    await services.setupService.initialize({
      name,
      email,
      username,
      password,
      databaseProvider: config.databaseProvider,
      databasePath: config.databasePath,
      externalDatabaseUrl: config.externalDatabaseUrl
    });
  } finally {
    await services.dispose();
  }
};

export const runContainerEntrypoint = async () => {
  await ensureExternalSchema();
  await maybeImportSqliteData();
  await maybeAutoSetup();
  await startServer();
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runContainerEntrypoint();
}