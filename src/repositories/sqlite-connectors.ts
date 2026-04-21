import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { Connector, ConnectorRun, ConnectorMapping, AuthMetricRollup } from "../domain/models.js";
import type { ConnectorRepository, ConnectorRunRepository, ConnectorMappingRepository, AuthMetricRepository } from "./contracts.js";

type DbRow = Record<string, unknown>;

function mapConnector(row: DbRow): Connector {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as Connector["type"],
    status: String(row.status) as Connector["status"],
    config: row.config_json ? JSON.parse(String(row.config_json)) : {},
    schedule: row.schedule ? String(row.schedule) : undefined,
    lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)) : undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

function mapConnectorRun(row: DbRow): ConnectorRun {
  return {
    id: String(row.id),
    connectorId: String(row.connector_id),
    status: String(row.status) as ConnectorRun["status"],
    startedAt: row.started_at ? new Date(String(row.started_at)) : undefined,
    finishedAt: row.finished_at ? new Date(String(row.finished_at)) : undefined,
    recordsImported: Number(row.records_imported ?? 0),
    recordsFailed: Number(row.records_failed ?? 0),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    createdAt: new Date(String(row.created_at))
  };
}

function mapConnectorMapping(row: DbRow): ConnectorMapping {
  return {
    id: String(row.id),
    connectorId: String(row.connector_id),
    sourceField: String(row.source_field),
    targetField: String(row.target_field),
    transform: row.transform ? String(row.transform) : undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

export class SqliteConnectorRepository implements ConnectorRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Connector[] {
    const rows = this.db.prepare("SELECT * FROM connectors ORDER BY created_at DESC").all() as DbRow[];
    return rows.map(mapConnector);
  }

  findById(id: string): Connector | undefined {
    const row = this.db.prepare("SELECT * FROM connectors WHERE id = ?").get(id) as DbRow | undefined;
    return row ? mapConnector(row) : undefined;
  }

  create(input: Omit<Connector, "id" | "createdAt" | "updatedAt">): Connector {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO connectors (id, name, type, status, config_json, schedule, last_sync_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.type, input.status, JSON.stringify(input.config), input.schedule ?? null, input.lastSyncAt?.toISOString() ?? null, now, now);
    return { id, ...input, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  update(id: string, input: Partial<Omit<Connector, "id" | "createdAt">>): Connector | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const merged = { ...existing, ...input, updatedAt: new Date(now) };
    this.db.prepare(`
      UPDATE connectors SET name = ?, type = ?, status = ?, config_json = ?, schedule = ?, last_sync_at = ?, updated_at = ? WHERE id = ?
    `).run(merged.name, merged.type, merged.status, JSON.stringify(merged.config), merged.schedule ?? null, merged.lastSyncAt?.toISOString() ?? null, now, id);
    return merged;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM connectors WHERE id = ?").run(id);
  }
}

export class SqliteConnectorRunRepository implements ConnectorRunRepository {
  constructor(private readonly db: Database.Database) {}

  listByConnector(connectorId: string, limit = 50): ConnectorRun[] {
    const rows = this.db.prepare(`SELECT * FROM connector_runs WHERE connector_id = ? ORDER BY created_at DESC LIMIT ${limit}`).all(connectorId) as DbRow[];
    return rows.map(mapConnectorRun);
  }

  findById(id: string): ConnectorRun | undefined {
    const row = this.db.prepare("SELECT * FROM connector_runs WHERE id = ?").get(id) as DbRow | undefined;
    return row ? mapConnectorRun(row) : undefined;
  }

  create(input: Omit<ConnectorRun, "id" | "createdAt">): ConnectorRun {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO connector_runs (id, connector_id, status, started_at, finished_at, records_imported, records_failed, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.connectorId, input.status, input.startedAt?.toISOString() ?? null, input.finishedAt?.toISOString() ?? null, input.recordsImported, input.recordsFailed, input.errorMessage ?? null, now);
    return { id, ...input, createdAt: new Date(now) };
  }

  update(id: string, input: Partial<Omit<ConnectorRun, "id" | "createdAt">>): ConnectorRun | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...input };
    this.db.prepare(`
      UPDATE connector_runs SET status = ?, started_at = ?, finished_at = ?, records_imported = ?, records_failed = ?, error_message = ? WHERE id = ?
    `).run(merged.status, merged.startedAt?.toISOString() ?? null, merged.finishedAt?.toISOString() ?? null, merged.recordsImported, merged.recordsFailed, merged.errorMessage ?? null, id);
    return merged;
  }

  deleteByConnector(connectorId: string): void {
    this.db.prepare("DELETE FROM connector_runs WHERE connector_id = ?").run(connectorId);
  }
}

export class SqliteConnectorMappingRepository implements ConnectorMappingRepository {
  constructor(private readonly db: Database.Database) {}

  listByConnector(connectorId: string): ConnectorMapping[] {
    const rows = this.db.prepare("SELECT * FROM connector_mappings WHERE connector_id = ? ORDER BY created_at ASC").all(connectorId) as DbRow[];
    return rows.map(mapConnectorMapping);
  }

  create(input: Omit<ConnectorMapping, "id" | "createdAt" | "updatedAt">): ConnectorMapping {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO connector_mappings (id, connector_id, source_field, target_field, transform, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.connectorId, input.sourceField, input.targetField, input.transform ?? null, now, now);
    return { id, ...input, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  update(id: string, input: Partial<Omit<ConnectorMapping, "id" | "createdAt">>): ConnectorMapping | undefined {
    const existing = this.listByConnector("").find(() => false); // find by id instead
    const row = this.db.prepare("SELECT * FROM connector_mappings WHERE id = ?").get(id) as DbRow | undefined;
    if (!row) return undefined;
    const now = new Date().toISOString();
    const current = mapConnectorMapping(row);
    const merged = { ...current, ...input, updatedAt: new Date(now) };
    this.db.prepare(`
      UPDATE connector_mappings SET source_field = ?, target_field = ?, transform = ?, updated_at = ? WHERE id = ?
    `).run(merged.sourceField, merged.targetField, merged.transform ?? null, now, id);
    return merged;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM connector_mappings WHERE id = ?").run(id);
  }
}

export class SqliteAuthMetricRepository implements AuthMetricRepository {
  constructor(private readonly db: Database.Database) {}

  increment(bucket: string, event: string, by = 1): void {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_metric_rollups (id, bucket, event, count, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (bucket, event) DO UPDATE SET count = count + excluded.count
    `).run(id, bucket, event, by, now);
  }

  query(input: { startBucket: string; endBucket: string; event?: string }): AuthMetricRollup[] {
    const conditions = ["bucket >= ?", "bucket <= ?"];
    const params: unknown[] = [input.startBucket, input.endBucket];
    if (input.event) {
      conditions.push("event = ?");
      params.push(input.event);
    }
    const rows = this.db.prepare(`
      SELECT * FROM auth_metric_rollups WHERE ${conditions.join(" AND ")} ORDER BY bucket ASC, event ASC
    `).all(...params) as DbRow[];
    return rows.map((row) => ({
      id: String(row.id),
      bucket: String(row.bucket),
      event: String(row.event),
      count: Number(row.count),
      createdAt: new Date(String(row.created_at))
    }));
  }
}
