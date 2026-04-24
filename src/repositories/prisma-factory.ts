import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AppConfig } from "../core/config.js";
import type { RepositoryBundle } from "./factory.js";
import { SqliteDatabase } from "./sqlite.js";

type PrismaClientLike = {
  $disconnect(): Promise<void>;
};

const ensureAppAssignmentTables = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  if (provider === "postgresql") {
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS user_app_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, app_id)
      )
    `;
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS group_app_assignments (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (group_id, app_id)
      )
    `;
    return;
  }

  if (provider === "mysql") {
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS user_app_assignments (
        id VARCHAR(191) PRIMARY KEY,
        user_id VARCHAR(191) NOT NULL,
        app_id VARCHAR(191) NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE KEY user_app_unique (user_id, app_id)
      )
    `;
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS group_app_assignments (
        id VARCHAR(191) PRIMARY KEY,
        group_id VARCHAR(191) NOT NULL,
        app_id VARCHAR(191) NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE KEY group_app_unique (group_id, app_id)
      )
    `;
    return;
  }

  await (prisma as any).$queryRaw`
    CREATE TABLE IF NOT EXISTS user_app_assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, app_id)
    )
  `;
  await (prisma as any).$queryRaw`
    CREATE TABLE IF NOT EXISTS group_app_assignments (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (group_id, app_id)
    )
  `;
};

type PrismaRepositoryClient = PrismaClientLike & Record<string, unknown>;

type PrismaClientModule = {
  PrismaClient: new () => PrismaClientLike;
};

type PrismaRepositoriesModule = {
  createPrismaRepositories: (prisma: PrismaRepositoryClient) => Omit<RepositoryBundle, "dispose">;
};

const resolveSqlitePath = (databasePath: string) => resolve(databasePath);

const resolveDatabaseUrl = (config: AppConfig) => {
  if (config.databaseProvider === "sqlite") {
    return `file:${resolveSqlitePath(config.databasePath)}`;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  return config.externalDatabaseUrl;
};

const resolveModuleUrl = (relativePath: string) => new URL(relativePath, import.meta.url).href;

const loadPrismaClientModule = async (provider: AppConfig["databaseProvider"]): Promise<PrismaClientModule> => {
  switch (provider) {
    case "sqlite":
      return import(resolveModuleUrl("../generated/prisma/sqlite/client.js")) as Promise<PrismaClientModule>;
    case "postgresql":
      return import(resolveModuleUrl("../generated/prisma/postgresql/client.js")) as Promise<PrismaClientModule>;
    case "mysql":
      return import(resolveModuleUrl("../generated/prisma/mysql/client.js")) as Promise<PrismaClientModule>;
  }
};

const loadPrismaRepositoriesModule = async (): Promise<PrismaRepositoriesModule> => {
  return import(resolveModuleUrl("./prisma-repositories.js")) as Promise<PrismaRepositoriesModule>;
};

/**
 * Create a provider-specific Prisma Client instance for a single app lifecycle.
 */
export async function getPrismaClient(config: AppConfig): Promise<PrismaClientLike> {
  process.env.DATABASE_PROVIDER = config.databaseProvider;
  process.env.DATABASE_URL = resolveDatabaseUrl(config);

  if (config.databaseProvider === "sqlite") {
    const sqlitePath = resolveSqlitePath(config.databasePath);
    mkdirSync(dirname(sqlitePath), { recursive: true });
    const sqlite = new SqliteDatabase(sqlitePath);
    try {
      sqlite.migrate();
      sqlite.assertHealthy();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SQLite initialization error";
      throw new Error(`SQLite database failed integrity validation at ${sqlitePath}: ${message}`);
    } finally {
      sqlite.close();
    }
  }

  const module = await loadPrismaClientModule(config.databaseProvider);
  const prisma = new module.PrismaClient() as PrismaClientLike & Record<string, unknown>;
  await ensureAppAssignmentTables(prisma, config.databaseProvider);
  return prisma;
}

/**
 * Create a repository bundle using Prisma-backed repositories.
 */
export async function createPrismaRepositoryBundle(config: AppConfig): Promise<RepositoryBundle> {
  const prisma = await getPrismaClient(config);
  const { createPrismaRepositories } = await loadPrismaRepositoriesModule();
  return {
    ...createPrismaRepositories(prisma as PrismaRepositoryClient),
    dispose: async () => {
      await prisma.$disconnect();
    }
  };
}

/**
 * Disconnect Prisma Client (compatibility no-op for app-scoped clients).
 */
export async function disconnectPrisma(): Promise<void> {
  return Promise.resolve();
}
