/**
 * Prisma-Based Multi-Database Repository Factory
 * 
 * This factory uses Prisma Client to provide database-agnostic access to repositories.
 * Supported backends: SQLite, PostgreSQL, MySQL (all handled by Prisma)
 * 
 * Usage:
 *   - Set DATABASE_PROVIDER environment variable: sqlite, postgresql, or mysql
 *   - Set DATABASE_URL for PostgreSQL/MySQL connection string, or DATABASE_PATH for SQLite
 *   - Prisma automatically generates the correct SQL for the target database
 */

import { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../core/config.js";
import type { RepositoryBundle } from "./factory.js";
import { createPrismaRepositories } from "./prisma-repositories.js";

let prismaClientInstance: PrismaClient | null = null;

/**
 * Get or create a singleton Prisma Client instance
 */
export async function getPrismaClient(): Promise<PrismaClient> {
  if (!prismaClientInstance) {
    prismaClientInstance = new PrismaClient({
      log: [
        { level: "query", emit: "event" },
        { level: "info", emit: "stdout" },
        { level: "warn", emit: "stdout" },
        { level: "error", emit: "stdout" }
      ]
    });

    // Log queries in development
    if (process.env.NODE_ENV === "development") {
      prismaClientInstance.$on("query", (e) => {
        console.debug(`[prisma-query] ${e.query} (${e.duration}ms)`);
      });
    }
  }

  return prismaClientInstance;
}

/**
 * Create a repository bundle using Prisma
 * This replaces the legacy SQLite-only factory
 */
export async function createPrismaRepositoryBundle(config: AppConfig): Promise<RepositoryBundle> {
  // Get the prisma-compatible provider
  const prismaProvider = getPrismaProvider(config.databaseProvider);
  const connectionString = getConnectionString(config, prismaProvider);

  // Set environment variables for Prisma
  process.env.DATABASE_PROVIDER = prismaProvider;
  process.env.DATABASE_URL = connectionString;

  // Log which provider is being used
  console.log(
    `[database] Using Prisma with ${config.databaseProvider === "sqlite" ? "SQLite" : config.databaseProvider.toUpperCase()} backend`
  );
  console.log(
    `[database] Connection: ${config.databaseProvider === "sqlite" ? config.databasePath : `${config.databaseProvider}://...`}`
  );

  // Get/create Prisma Client
  const prisma = await getPrismaClient();

  // Create repositories delegating to Prisma
  return createPrismaRepositories(prisma);
}

/**
 * Map our database provider names to Prisma provider names
 */
function getPrismaProvider(provider: "sqlite" | "postgresql" | "mysql"): string {
  switch (provider) {
    case "sqlite":
      return "sqlite";
    case "postgresql":
      return "postgresql";
    case "mysql":
      return "mysql";
    default:
      throw new Error(`Unsupported database provider: ${provider}`);
  }
}

/**
 * Construct the connection string for Prisma based on provider
 */
function getConnectionString(config: AppConfig, prismaProvider: string): string {
  switch (prismaProvider) {
    case "sqlite":
      // For SQLite, use file:// URL format
      return `file:${config.databasePath}`;
    case "postgresql":
    case "mysql":
      // For external databases, use the provided connection string
      if (!config.externalDatabaseUrl) {
        throw new Error(
          `DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`
        );
      }
      return config.externalDatabaseUrl;
    default:
      throw new Error(`Unsupported Prisma provider: ${prismaProvider}`);
  }
}

/**
 * Disconnect Prisma Client (useful for cleanup)
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaClientInstance) {
    await prismaClientInstance.$disconnect();
    prismaClientInstance = null;
  }
}
