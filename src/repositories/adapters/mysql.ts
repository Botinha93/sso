/**
 * MySQL Database Adapter
 * Uses mysql2/promise for database operations
 * Install: npm install mysql2
 */

import { createPool, type Pool } from "mysql2/promise";
import type { DatabaseAdapter, StatementResult } from "./database.js";

export class MySQLDatabaseAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor(private readonly connectionString: string) {}

  async initialize(): Promise<void> {
    const url = new URL(this.connectionString);
    const config = {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableTimeoutOnExpiredConnection: true,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0
    };

    this.pool = await createPool(config);

    // Verify connection
    const conn = await this.pool.getConnection();
    try {
      await conn.query("SELECT 1");
    } finally {
      conn.release();
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const [rows] = await this.pool.query(sql, params);
    const rowArray = rows as T[];
    return rowArray[0] ?? undefined;
  }

  async execute(sql: string, params?: unknown[]): Promise<StatementResult> {
    const [result] = await this.pool.query(sql, params);
    const mysqlResult = result as { affectedRows: number };
    return {
      changes: mysqlResult.affectedRows
    };
  }

  async transaction(operations: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      try {
        for (const op of operations) {
          await conn.query(op.sql, op.params);
        }
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getDialect(): "mysql" {
    return "mysql";
  }

  /**
   * Get the underlying pool for advanced operations
   */
  getPool(): Pool {
    return this.pool;
  }
}
