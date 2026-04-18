import Database from "better-sqlite3";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { ValidationError } from "../core/errors.js";

type ExternalProvider = "postgresql" | "mysql";

interface SqliteColumnInfo {
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: unknown;
  pk: number;
}

interface SqliteIndexInfo {
  name: string;
  unique: 0 | 1;
  origin: "c" | "u" | "pk";
  partial: 0 | 1;
}

interface SqliteIndexColumnInfo {
  seqno: number;
  cid: number;
  name: string;
}

interface SqliteForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

type ExternalDriver = {
  query: (sql: string, params?: unknown[]) => Promise<void>;
  begin: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  close: () => Promise<void>;
};

const TABLE_SKIP = new Set(["sqlite_sequence"]);

const quoteIdentifier = (provider: ExternalProvider, value: string) => {
  if (provider === "postgresql") {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return `\`${value.replace(/`/g, "``")}\``;
};

const buildInsertSql = (provider: ExternalProvider, table: string, columns: string[]) => {
  const quotedTable = quoteIdentifier(provider, table);
  const quotedColumns = columns.map((column) => quoteIdentifier(provider, column)).join(", ");
  const placeholders = provider === "postgresql"
    ? columns.map((_column, index) => `$${index + 1}`).join(", ")
    : columns.map(() => "?").join(", ");
  return `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${placeholders})`;
};

const mapSqliteType = (provider: ExternalProvider, sqliteType: string) => {
  const normalized = sqliteType.trim().toUpperCase();

  if (normalized.includes("INT")) {
    return "INTEGER";
  }
  if (normalized.includes("CHAR") || normalized.includes("CLOB") || normalized.includes("TEXT")) {
    return provider === "postgresql" ? "TEXT" : "LONGTEXT";
  }
  if (normalized.includes("BLOB")) {
    return provider === "postgresql" ? "BYTEA" : "LONGBLOB";
  }
  if (normalized.includes("REAL") || normalized.includes("FLOA") || normalized.includes("DOUB")) {
    return provider === "postgresql" ? "DOUBLE PRECISION" : "DOUBLE";
  }
  if (normalized.includes("NUM") || normalized.includes("DEC")) {
    return "NUMERIC";
  }

  return provider === "postgresql" ? "TEXT" : "LONGTEXT";
};

const normalizeForeignKeyAction = (action: string) => {
  const normalized = action.trim().toUpperCase();
  if (!normalized || normalized === "NO ACTION") {
    return "NO ACTION";
  }
  if (normalized === "RESTRICT") {
    return "RESTRICT";
  }
  if (normalized === "SET NULL") {
    return "SET NULL";
  }
  if (normalized === "SET DEFAULT") {
    return "SET DEFAULT";
  }
  if (normalized === "CASCADE") {
    return "CASCADE";
  }

  return "NO ACTION";
};

const buildCreateTableSql = (
  provider: ExternalProvider,
  table: string,
  columns: SqliteColumnInfo[],
  foreignKeys: SqliteForeignKeyInfo[]
) => {
  const quotedTable = quoteIdentifier(provider, table);
  const primaryKeyColumns = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk).map((column) => column.name);

  const columnDefs = columns.map((column) => {
    const type = mapSqliteType(provider, column.type || "TEXT");
    const quotedName = quoteIdentifier(provider, column.name);
    const notNull = column.notnull === 1 ? " NOT NULL" : "";

    let defaultExpr = "";
    if (column.dflt_value !== null && column.dflt_value !== undefined) {
      defaultExpr = ` DEFAULT ${String(column.dflt_value)}`;
    }

    return `${quotedName} ${type}${notNull}${defaultExpr}`;
  });

  if (primaryKeyColumns.length > 0) {
    const pk = primaryKeyColumns.map((column) => quoteIdentifier(provider, column)).join(", ");
    columnDefs.push(`PRIMARY KEY (${pk})`);
  }

  const groupedForeignKeys = new Map<number, SqliteForeignKeyInfo[]>();
  for (const foreignKey of foreignKeys) {
    const existing = groupedForeignKeys.get(foreignKey.id) ?? [];
    existing.push(foreignKey);
    groupedForeignKeys.set(foreignKey.id, existing);
  }

  for (const group of groupedForeignKeys.values()) {
    const ordered = group.sort((left, right) => left.seq - right.seq);
    const localColumns = ordered.map((entry) => quoteIdentifier(provider, entry.from)).join(", ");
    const targetColumns = ordered.map((entry) => quoteIdentifier(provider, entry.to)).join(", ");
    const targetTable = quoteIdentifier(provider, ordered[0].table);
    const onUpdate = normalizeForeignKeyAction(ordered[0].on_update);
    const onDelete = normalizeForeignKeyAction(ordered[0].on_delete);

    columnDefs.push(
      `FOREIGN KEY (${localColumns}) REFERENCES ${targetTable} (${targetColumns}) ON UPDATE ${onUpdate} ON DELETE ${onDelete}`
    );
  }

  return `CREATE TABLE IF NOT EXISTS ${quotedTable} (${columnDefs.join(", ")})`;
};

const buildDeleteSql = (provider: ExternalProvider, table: string) => {
  const quotedTable = quoteIdentifier(provider, table);
  return provider === "postgresql"
    ? `TRUNCATE TABLE ${quotedTable} RESTART IDENTITY CASCADE`
    : `DELETE FROM ${quotedTable}`;
};

const normalizeExternalIndexName = (table: string, indexName: string) => {
  const normalized = `${table}_${indexName}`.replace(/[^a-zA-Z0-9_]/g, "_");
  return normalized.length > 60 ? normalized.slice(0, 60) : normalized;
};

const buildCreateUniqueIndexSql = (
  provider: ExternalProvider,
  table: string,
  indexName: string,
  columns: string[]
) => {
  const quotedTable = quoteIdentifier(provider, table);
  const quotedColumns = columns.map((column) => quoteIdentifier(provider, column)).join(", ");
  const normalizedIndexName = normalizeExternalIndexName(table, indexName);
  const quotedIndexName = quoteIdentifier(provider, normalizedIndexName);

  if (provider === "postgresql") {
    return `CREATE UNIQUE INDEX IF NOT EXISTS ${quotedIndexName} ON ${quotedTable} (${quotedColumns})`;
  }

  return `CREATE UNIQUE INDEX ${quotedIndexName} ON ${quotedTable} (${quotedColumns})`;
};

const isAlreadyExistsError = (provider: ExternalProvider, error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (provider === "postgresql") {
    return (error as { code?: string }).code === "42P07";
  }

  const mysqlError = error as { code?: string; errno?: number };
  return mysqlError.code === "ER_DUP_KEYNAME" || mysqlError.errno === 1061;
};

const buildExternalDriver = async (provider: ExternalProvider, url: string): Promise<ExternalDriver> => {
  if (provider === "postgresql") {
    const client = new PgClient({ connectionString: url });
    await client.connect();

    return {
      query: async (sql: string, params?: unknown[]) => {
        await client.query(sql, params as any[] | undefined);
      },
      begin: async () => {
        await client.query("BEGIN");
      },
      commit: async () => {
        await client.query("COMMIT");
      },
      rollback: async () => {
        await client.query("ROLLBACK");
      },
      close: async () => {
        await client.end();
      }
    };
  }

  const connection = await mysql.createConnection(url);

  return {
    query: async (sql: string, params?: unknown[]) => {
      await connection.query(sql, params as any[] | undefined);
    },
    begin: async () => {
      await connection.beginTransaction();
    },
    commit: async () => {
      await connection.commit();
    },
    rollback: async () => {
      await connection.rollback();
    },
    close: async () => {
      await connection.end();
    }
  };
};

export class DatabaseMigrationService {
  private async ensureUniqueIndexes(
    source: Database.Database,
    provider: ExternalProvider,
    driver: ExternalDriver,
    table: string
  ) {
    const indexes = source.prepare(`PRAGMA index_list(${table})`).all() as SqliteIndexInfo[];

    for (const index of indexes) {
      if (index.unique !== 1 || index.origin === "pk") {
        continue;
      }

      const indexColumns = source.prepare(`PRAGMA index_info(${index.name})`).all() as SqliteIndexColumnInfo[];
      const columnNames = indexColumns
        .sort((left, right) => left.seqno - right.seqno)
        .map((column) => column.name)
        .filter((name) => typeof name === "string" && name.length > 0);

      if (columnNames.length === 0) {
        continue;
      }

      const sql = buildCreateUniqueIndexSql(provider, table, index.name, columnNames);

      try {
        await driver.query(sql);
      } catch (error) {
        if (!isAlreadyExistsError(provider, error)) {
          throw error;
        }
      }
    }
  }

  private ensureExternalSchema(
    source: Database.Database,
    provider: ExternalProvider,
    driver: ExternalDriver,
    tables: string[]
  ) {
    return (async () => {
      for (const table of tables) {
        const columns = source.prepare(`PRAGMA table_info(${table})`).all() as SqliteColumnInfo[];
        const foreignKeys = source.prepare(`PRAGMA foreign_key_list(${table})`).all() as SqliteForeignKeyInfo[];
        if (columns.length === 0) {
          continue;
        }

        await driver.query(buildCreateTableSql(provider, table, columns, foreignKeys));
        await this.ensureUniqueIndexes(source, provider, driver, table);
      }
    })();
  }

  async testConnection(provider: ExternalProvider, externalDatabaseUrl: string) {
    const driver = await buildExternalDriver(provider, externalDatabaseUrl);
    try {
      await driver.query(provider === "postgresql" ? "SELECT 1" : "SELECT 1");
      return { ok: true as const };
    } finally {
      await driver.close();
    }
  }

  async migrateFromSqlite(input: {
    sqlitePath: string;
    provider: ExternalProvider;
    externalDatabaseUrl: string;
  }) {
    const source = new Database(input.sqlitePath, { readonly: true });
    const driver = await buildExternalDriver(input.provider, input.externalDatabaseUrl);

    try {
      const tables = source
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC")
        .all() as Array<{ name: string }>;

      const userTables = tables
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith("sqlite_") && !TABLE_SKIP.has(name));

      if (userTables.length === 0) {
        throw new ValidationError("SQLite source has no user tables to migrate");
      }

      await this.ensureExternalSchema(source, input.provider, driver, userTables);

      await driver.begin();

      if (input.provider === "mysql") {
        await driver.query("SET FOREIGN_KEY_CHECKS = 0");
      }

      for (const table of userTables) {
        const columns = source.prepare(`PRAGMA table_info(${table})`).all() as SqliteColumnInfo[];
        const columnNames = columns.map((column) => column.name);
        if (columnNames.length === 0) {
          continue;
        }

        await driver.query(buildDeleteSql(input.provider, table));

        const rows = source.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
        const insertSql = buildInsertSql(input.provider, table, columnNames);

        for (const row of rows) {
          await driver.query(insertSql, columnNames.map((name) => row[name]));
        }
      }

      if (input.provider === "mysql") {
        await driver.query("SET FOREIGN_KEY_CHECKS = 1");
      }

      await driver.commit();
      return { migratedTables: userTables.length };
    } catch (error) {
      await driver.rollback();

      if (input.provider === "mysql") {
        try {
          await driver.query("SET FOREIGN_KEY_CHECKS = 1");
        } catch {
          // noop
        }
      }

      throw error;
    } finally {
      source.close();
      await driver.close();
    }
  }
}
