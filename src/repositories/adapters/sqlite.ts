/**
 * SQLite Database Adapter
 * Wraps better-sqlite3 for compatibility with the unified DatabaseAdapter interface
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { DatabaseAdapter, StatementResult } from "./database.js";

export class SqliteDatabaseAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(private readonly path: string) {}

  async initialize(): Promise<void> {
    const absolutePath = resolve(this.path);
    mkdirSync(dirname(absolutePath), { recursive: true });

    this.db = new Database(absolutePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.all(...params) : stmt.all()) as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
  }

  async execute(sql: string, params?: unknown[]): Promise<StatementResult> {
    const stmt = this.db.prepare(sql);
    const info = params ? stmt.run(...params) : stmt.run();
    return {
      changes: info.changes
    };
  }

  async transaction(operations: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const op of operations) {
        const stmt = this.db.prepare(op.sql);
        if (op.params) {
          stmt.run(...op.params);
        } else {
          stmt.run();
        }
      }
    });

    tx();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  getDialect(): "sqlite" {
    return "sqlite";
  }

  /**
   * Get the underlying better-sqlite3 connection for legacy code
   * (temporary bridge during migration)
   */
  getConnection(): Database.Database {
    return this.db;
  }
}
