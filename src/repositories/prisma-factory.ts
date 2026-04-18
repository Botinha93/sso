import type { AppConfig } from "../core/config.js";
import type { RepositoryBundle } from "./factory.js";
import { SqliteDatabase } from "./sqlite.js";
import { createPrismaRepositories } from "./prisma-repositories.js";

type PrismaClientLike = {
  $disconnect(): Promise<void>;
};

type PrismaClientModule = {
  PrismaClient: new () => PrismaClientLike;
};

let prismaClientInstance: PrismaClientLike | null = null;
let prismaClientSignature: string | null = null;

const resolveDatabaseUrl = (config: AppConfig) => {
  if (config.databaseProvider === "sqlite") {
    return `file:${config.databasePath}`;
  }

  if (!config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  return config.externalDatabaseUrl;
};

const getSignature = (config: AppConfig) => `${config.databaseProvider}:${resolveDatabaseUrl(config)}`;

const loadPrismaClientModule = async (provider: AppConfig["databaseProvider"]): Promise<PrismaClientModule> => {
  switch (provider) {
    case "sqlite":
      return import("../generated/prisma/sqlite/client.js") as Promise<PrismaClientModule>;
    case "postgresql":
      return import("../generated/prisma/postgresql/client.js") as Promise<PrismaClientModule>;
    case "mysql":
      return import("../generated/prisma/mysql/client.js") as Promise<PrismaClientModule>;
  }
};

/**
 * Get or create a provider-specific singleton Prisma Client instance.
 */
export async function getPrismaClient(config: AppConfig): Promise<PrismaClientLike> {
  const signature = getSignature(config);

  if (prismaClientInstance && prismaClientSignature !== signature) {
    await prismaClientInstance.$disconnect();
    prismaClientInstance = null;
    prismaClientSignature = null;
  }

  if (!prismaClientInstance) {
    process.env.DATABASE_PROVIDER = config.databaseProvider;
    process.env.DATABASE_URL = resolveDatabaseUrl(config);

    if (config.databaseProvider === "sqlite") {
      const sqlite = new SqliteDatabase(config.databasePath);
      sqlite.migrate();
    }

    const module = await loadPrismaClientModule(config.databaseProvider);
    prismaClientInstance = new module.PrismaClient();
    prismaClientSignature = signature;
  }

  return prismaClientInstance;
}

/**
 * Create a repository bundle using Prisma-backed repositories.
 */
export async function createPrismaRepositoryBundle(config: AppConfig): Promise<RepositoryBundle> {
  const prisma = await getPrismaClient(config);
  return createPrismaRepositories(prisma);
}

/**
 * Disconnect Prisma Client (useful for cleanup).
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaClientInstance) {
    await prismaClientInstance.$disconnect();
    prismaClientInstance = null;
    prismaClientSignature = null;
  }
}
