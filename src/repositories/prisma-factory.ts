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

const ensureNexusHubDelegationConsentTable = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  const execute = (prisma as any).$executeRawUnsafe?.bind(prisma);
  if (!execute) throw new Error("Database adapter cannot initialize NexusHub delegation consent storage");
  const idType = provider === "mysql" ? "VARCHAR(191)" : "TEXT";
  const hashType = provider === "mysql" ? "CHAR(64)" : "TEXT";
  const valueType = provider === "mysql" ? "VARCHAR(512)" : "TEXT";
  const scopesType = provider === "mysql" ? "VARCHAR(2048)" : "TEXT";
  const timeType = provider === "mysql" ? "VARCHAR(40)" : "TEXT";
  await execute(`CREATE TABLE IF NOT EXISTS nexushub_delegation_consents (
    id ${idType} PRIMARY KEY,
    tuple_hash ${hashType} NOT NULL UNIQUE,
    user_id ${idType} NOT NULL,
    client_id ${idType} NOT NULL,
    installation_id ${valueType} NOT NULL,
    resource ${valueType} NOT NULL,
    scopes_json ${scopesType} NOT NULL DEFAULT '[]',
    expires_at ${timeType} NOT NULL,
    revoked_at ${timeType},
    created_at ${timeType} NOT NULL,
    updated_at ${timeType} NOT NULL
  )`);
  // Upgrade installations that already have the initial tuple-only table.
  // Keep provider-specific duplicate-column handling narrow so real migration
  // failures still stop startup.
  try {
    await execute(`ALTER TABLE nexushub_delegation_consents ADD COLUMN scopes_json ${scopesType} NOT NULL DEFAULT '[]'`);
  } catch (error) {
    const candidate = error as { code?: string; meta?: { code?: string; message?: string }; message?: string };
    const code = candidate.code ?? candidate.meta?.code;
    const message = `${candidate.message ?? ''} ${candidate.meta?.message ?? ''}`;
    const alreadyExists = code === "42701" || code === "ER_DUP_FIELDNAME" || /duplicate column|column .* already exists/i.test(message);
    if (!alreadyExists) throw error;
  }
};

const ensureNexusHubDelegationTokenTable = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  const execute = (prisma as any).$executeRawUnsafe?.bind(prisma);
  if (!execute) throw new Error("Database adapter cannot initialize NexusHub delegation token storage");
  const id = provider === "mysql" ? "VARCHAR(191)" : "TEXT";
  const value = provider === "mysql" ? "VARCHAR(512)" : "TEXT";
  const time = provider === "mysql" ? "VARCHAR(40)" : "TEXT";
  await execute(`CREATE TABLE IF NOT EXISTS nexushub_delegation_tokens (
    token_id ${id} PRIMARY KEY, user_id ${id} NOT NULL, client_id ${id} NOT NULL,
    installation_id ${value} NOT NULL, resource ${value} NOT NULL,
    expires_at ${time} NOT NULL, revoked_at ${time}
  )`);
};

const ensureNexusBusManagementEnrollmentTable = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  const execute = (prisma as any).$executeRawUnsafe?.bind(prisma);
  if (!execute) throw new Error("Database adapter cannot initialize NexusBus management enrollment storage");
  const id = provider === "mysql" ? "VARCHAR(191)" : "TEXT";
  const value = provider === "mysql" ? "VARCHAR(512)" : "TEXT";
  const roles = provider === "mysql" ? "VARCHAR(2048)" : "TEXT";
  const time = provider === "mysql" ? "VARCHAR(40)" : "TEXT";
  await execute(`CREATE TABLE IF NOT EXISTS nexusbus_management_enrollments (
    enrollment_id ${id} PRIMARY KEY,
    installation_id ${id} NOT NULL UNIQUE,
    service_identity_id ${id} NOT NULL UNIQUE,
    credential_id ${id} NOT NULL UNIQUE,
    credential_hash ${id} NOT NULL,
    organization_id ${value} NOT NULL,
    project_id ${value},
    tenant ${value} NOT NULL,
    app ${value} NOT NULL,
    roles_json ${roles} NOT NULL,
    status ${id} NOT NULL,
    created_at ${time} NOT NULL,
    revoked_at ${time}
  )`);
};

const ensureOAuthResourceMetadataColumn = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  const execute = (prisma as any).$executeRawUnsafe?.bind(prisma);
  if (!execute) throw new Error("Database adapter cannot initialize OAuth resource metadata storage");
  // MySQL does not permit defaults on TEXT/BLOB columns. The administrator-
  // authored metadata is a small JSON object; VARCHAR supports '{}' defaults
  // across the supported MySQL versions.
  const columnType = provider === "mysql" ? "VARCHAR(8192)" : "TEXT";
  try {
    await execute(`ALTER TABLE oauth_clients ADD COLUMN resource_metadata_json ${columnType} NOT NULL DEFAULT '{}'`);
  } catch (error) {
    const candidate = error as { code?: string; meta?: { code?: string; message?: string }; message?: string };
    const code = candidate.code ?? candidate.meta?.code;
    const message = `${candidate.message ?? ''} ${candidate.meta?.message ?? ''}`;
    const alreadyExists = code === "42701" || code === "ER_DUP_FIELDNAME" || /duplicate column|column .* already exists/i.test(message);
    if (!alreadyExists) throw error;
  }
};

const ensureSuggestionsTable = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  if (provider === "postgresql") {
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        app_id TEXT,
        proposed_name TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        image_urls_json TEXT NOT NULL DEFAULT '[]',
        author_user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        internal_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    return;
  }

  if (provider === "mysql") {
    await (prisma as any).$queryRaw`
      CREATE TABLE IF NOT EXISTS suggestions (
        id VARCHAR(191) PRIMARY KEY,
        kind VARCHAR(191) NOT NULL,
        app_id VARCHAR(191),
        proposed_name TEXT,
        title TEXT NOT NULL,
        body LONGTEXT NOT NULL,
        image_urls_json TEXT NOT NULL,
        author_user_id VARCHAR(191) NOT NULL,
        status VARCHAR(191) NOT NULL,
        internal_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    return;
  }

  await (prisma as any).$queryRaw`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      app_id TEXT,
      proposed_name TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_urls_json TEXT NOT NULL DEFAULT '[]',
      author_user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      internal_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
};

/**
 * Indexes backing the retention sweep.
 *
 * Every sweep filters and orders on one timestamp column, and the same columns
 * back the `ORDER BY created_at DESC` list queries the console already issues.
 * Without these, both full-scan.
 *
 * Statements are built from this fixed list only — nothing here is caller
 * supplied. Failures are non-fatal: an index is an optimisation, and a table
 * that does not exist on a given provider should not block startup.
 */
const RETENTION_INDEXES: ReadonlyArray<{ table: string; column: string }> = [
  { table: "authorization_codes", column: "expires_at" },
  { table: "access_tokens", column: "expires_at" },
  { table: "refresh_tokens", column: "expires_at" },
  { table: "sessions", column: "expires_at" },
  { table: "federation_transactions", column: "expires_at" },
  { table: "elevation_requests", column: "created_at" },
  { table: "elevation_sessions", column: "expires_at" },
  { table: "audit_events", column: "created_at" },
  { table: "saml_assertion_audits", column: "created_at" },
  { table: "policy_decision_logs", column: "created_at" },
  { table: "risk_events", column: "created_at" },
  { table: "event_notifications", column: "created_at" },
  { table: "connector_runs", column: "created_at" },
  { table: "provisioning_jobs", column: "created_at" },
  { table: "deprovisioning_queue", column: "created_at" }
];

const ensureRetentionIndexes = async (prisma: PrismaClientLike & Record<string, unknown>, provider: AppConfig["databaseProvider"]) => {
  const execute = (prisma as any).$executeRawUnsafe?.bind(prisma) ?? (prisma as any).$queryRawUnsafe?.bind(prisma);
  if (typeof execute !== "function") {
    return;
  }

  for (const { table, column } of RETENTION_INDEXES) {
    const name = `idx_${table}_${column}`;
    // MySQL has no CREATE INDEX ... IF NOT EXISTS; a duplicate there simply
    // errors and is swallowed below.
    const sql =
      provider === "mysql"
        ? `CREATE INDEX ${name} ON ${table} (${column})`
        : `CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${column})`;

    try {
      await execute(sql);
    } catch {
      // Index already present, or the table does not exist on this deployment.
    }
  }
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
    throw new Error(`External database URL is required when database provider is ${config.databaseProvider}`);
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
  await ensureNexusHubDelegationConsentTable(prisma, config.databaseProvider);
  await ensureNexusHubDelegationTokenTable(prisma, config.databaseProvider);
  await ensureNexusBusManagementEnrollmentTable(prisma, config.databaseProvider);
  await ensureOAuthResourceMetadataColumn(prisma, config.databaseProvider);
  await ensureSuggestionsTable(prisma, config.databaseProvider);
  await ensureRetentionIndexes(prisma, config.databaseProvider);
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
