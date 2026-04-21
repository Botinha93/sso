import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { RiskEvent, RiskDecision, RiskReason } from "../domain/models.js";
import type { RiskEventRepository } from "./contracts.js";

type DbRow = Record<string, unknown>;

function mapRiskEvent(row: DbRow): RiskEvent {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    ip: row.ip ? String(row.ip) : undefined,
    deviceFingerprintHash: row.device_fingerprint_hash ? String(row.device_fingerprint_hash) : undefined,
    geo: row.geo ? String(row.geo) : undefined,
    confidence: Number(row.confidence),
    reason: String(row.reason) as RiskReason,
    decision: String(row.decision) as RiskDecision,
    metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
    createdAt: new Date(String(row.created_at))
  };
}

export class SqliteRiskEventRepository implements RiskEventRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<RiskEvent, "id" | "createdAt">): RiskEvent {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO risk_events (id, user_id, ip, device_fingerprint_hash, geo, confidence, reason, decision, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.userId ?? null,
      input.ip ?? null,
      input.deviceFingerprintHash ?? null,
      input.geo ?? null,
      input.confidence,
      input.reason,
      input.decision,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now
    );

    return { id, ...input, createdAt: new Date(now) };
  }

  list(input?: { limit?: number; userId?: string; minConfidence?: number }): RiskEvent[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input?.userId) {
      conditions.push("user_id = ?");
      params.push(input.userId);
    }
    if (input?.minConfidence !== undefined) {
      conditions.push("confidence >= ?");
      params.push(input.minConfidence);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const limit = input?.limit ? ` LIMIT ${input.limit}` : " LIMIT 100";
    const rows = this.db.prepare(`SELECT * FROM risk_events${where} ORDER BY created_at DESC${limit}`).all(...params) as DbRow[];
    return rows.map(mapRiskEvent);
  }

  countRecentByIp(ip: string, windowMs: number): number {
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM risk_events WHERE ip = ? AND created_at >= ?").get(ip, since) as { cnt: number };
    return row.cnt;
  }
}
