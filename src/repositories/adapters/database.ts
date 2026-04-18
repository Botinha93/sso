/**
 * Database Adapter - Unified interface for SQLite, PostgreSQL, and MySQL
 * Allows repositories to work with multiple database backends
 */

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface StatementResult {
  changes: number;
}

/**
 * Normalized database adapter interface
 * All database implementations (SQLite, PostgreSQL, MySQL) implement this
 */
export interface DatabaseAdapter {
  /**
   * Initialize the database connection and schema
   */
  initialize(): Promise<void>;

  /**
   * Execute a query and return rows
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Execute a query returning a single row
   */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;

  /**
   * Execute a mutation (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params?: unknown[]): Promise<StatementResult>;

  /**
   * Execute multiple mutations in a transaction
   */
  transaction(operations: Array<{ sql: string; params?: unknown[] }>): Promise<void>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Get database-specific dialect for migrations
   */
  getDialect(): "sqlite" | "postgresql" | "mysql";
}
