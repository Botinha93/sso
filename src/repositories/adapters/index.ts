/**
 * Database Adapter Factory
 * Creates the appropriate database adapter based on configuration
 */

import type { DatabaseAdapter } from "./database.js";
import { SqliteDatabaseAdapter } from "./sqlite.js";
import { PostgreSQLDatabaseAdapter } from "./postgresql.js";
import { MySQLDatabaseAdapter } from "./mysql.js";

export async function createDatabaseAdapter(
  provider: "sqlite" | "postgresql" | "mysql",
  connectionString: string
): Promise<DatabaseAdapter> {
  let adapter: DatabaseAdapter;

  switch (provider) {
    case "sqlite":
      adapter = new SqliteDatabaseAdapter(connectionString);
      break;
    case "postgresql":
      adapter = new PostgreSQLDatabaseAdapter(connectionString);
      break;
    case "mysql":
      adapter = new MySQLDatabaseAdapter(connectionString);
      break;
    default:
      throw new Error(`Unsupported database provider: ${provider}`);
  }

  await adapter.initialize();
  return adapter;
}

export { DatabaseAdapter } from "./database.js";
export { SqliteDatabaseAdapter } from "./sqlite.js";
export { PostgreSQLDatabaseAdapter } from "./postgresql.js";
export { MySQLDatabaseAdapter } from "./mysql.js";
