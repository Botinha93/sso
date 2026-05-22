import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bootstrap } from "../bootstrap.js";
import { loadConfig } from "../core/config.js";
import { ensureExternalDatabaseSchema } from "../core/runtime-database-config.js";
import { DatabaseMigrationService } from "../services/database-migration-service.js";
import { startServer } from "../server.js";

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

const maybeImportSqliteData = async () => {
  const config = loadConfig();
  const sourceSqlitePath = process.env.MIGRATE_FROM_SQLITE_PATH;

  if (!sourceSqlitePath || config.databaseProvider === "sqlite") {
    return;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`External database URL is required when database provider is ${config.databaseProvider}`);
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
  await ensureExternalDatabaseSchema(loadConfig());
  await maybeImportSqliteData();
  await maybeAutoSetup();
  await startServer();
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runContainerEntrypoint();
}