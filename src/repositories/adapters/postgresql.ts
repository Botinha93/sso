/**
 * PostgreSQL Database Adapter
 * Uses pg (postgres) client for database operations
 * Install: npm install pg
 */

import { Pool } from "pg";
import type { DatabaseAdapter, StatementResult } from "./database.js";

export class PostgreSQLDatabaseAdapter implements DatabaseAdapter {
  private pool!: Pool;

  constructor(private readonly connectionString: string) {}

  async initialize(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    // Verify connection
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const result = await this.pool.query(sql, params);
    return (result.rows[0] as T | undefined) ?? undefined;
  }

  async execute(sql: string, params?: unknown[]): Promise<StatementResult> {
    const result = await this.pool.query(sql, params);
    return {
      changes: result.rowCount ?? 0
    };
  }

  async transaction(operations: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      try {
        for (const op of operations) {
          await client.query(op.sql, op.params);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getDialect(): "postgresql" {
    return "postgresql";
  }

  /**
   * Get the underlying pool for advanced operations
   */
  getPool(): Pool {
    return this.pool;
  }
}
