/**
 * Operational status for an external monitor (the JC Decor ERP observability
 * central polls `GET /api/admin/observability/status` every minute).
 *
 * - Requests answered per minute (count, failures, duration) live in memory:
 *   the monitor reads them every minute and keeps them, so a restart loses at
 *   most the minute in progress.
 * - Server errors (unhandled exceptions and anything logged at `error`) are
 *   written to the audit trail as `server_error`, so they survive a restart and
 *   also show up in the admin audit screen. If that write fails (the database
 *   may be the thing that broke) the error stays in memory instead.
 * - Warnings stay in memory only: they are frequent and low value, and are not
 *   worth a row in the audit trail.
 *
 * The cursor is a timestamp in epoch milliseconds: the monitor sends back the
 * cursor of its previous read and gets what was recorded after it.
 */

import type { AuditEvent } from "../domain/models.js";
import type { AuditRepository } from "../repositories/contracts.js";

const MINUTE_MS = 60_000;
const MAX_BUCKET_MINUTES = 24 * 60;
const MAX_ENTRIES_PER_READ = 200;
const MAX_MEMORY_ENTRIES = 200;
const MAX_MESSAGE_CHARS = 2000;
const MAX_STACK_CHARS = 8000;
const FIRST_READ_WINDOW_MS = 24 * 60 * MINUTE_MS;
/** Entries kept per minute for one message; the rest of a storm is dropped. */
const MAX_PER_MINUTE = { ERROR: 20, WARNING: 5 } as const;

/** pino levels (https://getpino.io/#/docs/api?id=levels). */
const PINO_WARN = 40;
const PINO_ERROR = 50;

/** Paths that are the monitor itself, not proof that users are being served. */
const UNCOUNTED_PATHS = ["/health", "/api/admin/observability"];

export const SERVER_ERROR_AUDIT_TYPE = "server_error";

export type ObservedLevel = "ERROR" | "WARNING";

export interface ObservedEntry {
  id: string;
  at: string;
  level: ObservedLevel;
  logger: string;
  type: string;
  message: string;
  stack: string;
  method: string;
  path: string;
  status: number | null;
  request: string;
  service: string;
}

export interface ObservedMinute {
  minute: string;
  ok: number;
  failed: number;
  /** Average and worst response time of the minute, in milliseconds. */
  ms: number;
  max: number;
}

export interface ObservabilitySnapshot {
  requests: ObservedMinute[];
  errors: ObservedEntry[];
  /** Pass it back as `after` on the next read. */
  cursor: number;
}

interface RecordInput {
  level: ObservedLevel;
  error?: unknown;
  message?: string;
  method?: string;
  path?: string;
  status?: number;
  request?: string;
}

type AuditLog = Pick<AuditRepository, "log" | "search">;

export const isCountedPath = (path: string) =>
  !UNCOUNTED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export class ObservabilityService {
  private readonly buckets = new Map<number, { ok: number; failed: number; ms: number; max: number }>();
  private memory: Array<ObservedEntry & { atMs: number }> = [];
  private lastAtMs = 0;
  private readonly rate = new Map<string, { minute: number; count: number }>();
  /** Errors already recorded with their request, so the logger hook skips them. */
  private readonly seen = new WeakSet<object>();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly auditLog?: AuditLog,
    private readonly now: () => number = Date.now
  ) {}

  /** A response below 500 is the server working, whatever it answered. */
  recordResponse(path: string, statusCode: number, elapsedMs = 0) {
    if (!isCountedPath(path)) {
      return;
    }
    const minute = Math.floor(this.now() / MINUTE_MS);
    let bucket = this.buckets.get(minute);
    if (!bucket) {
      bucket = { ok: 0, failed: 0, ms: 0, max: 0 };
      this.buckets.set(minute, bucket);
      this.pruneBuckets(minute);
    }
    if (statusCode >= 500) {
      bucket.failed += 1;
    } else {
      bucket.ok += 1;
    }
    const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    bucket.ms += elapsed;
    bucket.max = Math.max(bucket.max, elapsed);
  }

  /** An unhandled exception of a request (called by the HTTP error handler). */
  recordError(input: { error: unknown; method: string; path: string; status: number; request?: string }) {
    this.record({ level: "ERROR", ...input });
  }

  /**
   * Everything the server logs at `warn` or above (pino `logMethod` hook), so
   * failures outside a request (background sweeps, hooks) are not lost.
   */
  recordLog(level: number, args: readonly unknown[], bindings: Record<string, unknown> = {}) {
    if (level < PINO_WARN) {
      return;
    }
    const first = args[0];
    const error = first instanceof Error ? first : isRecord(first) && first.err instanceof Error ? first.err : undefined;
    if (error && this.seen.has(error)) {
      return;
    }
    const message = args.find((arg): arg is string => typeof arg === "string");
    this.record({
      level: level >= PINO_ERROR ? "ERROR" : "WARNING",
      error,
      message,
      path: isRecord(first) && typeof first.path === "string" ? first.path : undefined,
      request: bindings.reqId === undefined ? undefined : String(bindings.reqId)
    });
  }

  async snapshot(query: { since?: Date; after?: number } = {}): Promise<ObservabilitySnapshot> {
    const nowMs = this.now();
    const current = Math.floor(nowMs / MINUTE_MS);
    const oldest = current - MAX_BUCKET_MINUTES;
    const from = query.since ? Math.max(oldest, Math.floor(query.since.getTime() / MINUTE_MS)) : oldest;
    const requests = [...this.buckets.entries()]
      .filter(([minute]) => minute >= from)
      .sort(([a], [b]) => a - b)
      .map(([minute, bucket]) => {
        const total = bucket.ok + bucket.failed;
        return {
          minute: new Date(minute * MINUTE_MS).toISOString(),
          ok: bucket.ok,
          failed: bucket.failed,
          ms: total ? Math.round((bucket.ms / total) * 100) / 100 : 0,
          max: Math.round(bucket.max * 100) / 100
        };
      });

    // Without a cursor (first read) only the last day is announced.
    const after = query.after ?? nowMs - FIRST_READ_WINDOW_MS;
    const persisted = this.auditLog
      ? (
          await this.auditLog.search({
            type: SERVER_ERROR_AUDIT_TYPE,
            from: new Date(after + 1),
            limit: MAX_ENTRIES_PER_READ
          })
        ).map((event) => ({ ...entryFromAudit(event), atMs: event.createdAt.getTime() }))
      : [];
    const entries = [...persisted, ...this.memory.filter((entry) => entry.atMs > after)]
      .sort((a, b) => a.atMs - b.atMs)
      .slice(-MAX_ENTRIES_PER_READ);

    return {
      requests,
      errors: entries.map(({ atMs: _atMs, ...entry }) => entry),
      cursor: entries.length > 0 ? entries[entries.length - 1].atMs : query.after ?? nowMs
    };
  }

  /** Resolves once every error handed to the audit trail has been written (tests, shutdown). */
  async flush() {
    await Promise.all([...this.pending]);
  }

  private record(input: RecordInput) {
    const error = input.error;
    const isError = error instanceof Error;
    if (isError) {
      this.seen.add(error);
    }
    const type = isError ? error.name || "Error" : error === undefined ? "" : typeof error;
    const message = String(input.message ?? (isError ? error.message : error ?? "")).slice(0, MAX_MESSAGE_CHARS);
    if (!this.allow(input.level, `${type}|${message.slice(0, 120)}`)) {
      return;
    }
    // Strictly increasing, so two entries of the same millisecond keep their order and the cursor never skips one.
    const atMs = Math.max(this.now(), this.lastAtMs + 1);
    this.lastAtMs = atMs;
    const entry: ObservedEntry & { atMs: number } = {
      atMs,
      id: `m${atMs}`,
      at: new Date(atMs).toISOString(),
      level: input.level,
      logger: "nexusid",
      type,
      message: isError && input.message && input.message !== error.message ? `${message}: ${error.message}`.slice(0, MAX_MESSAGE_CHARS) : message,
      stack: String((isError && error.stack) || "").slice(0, MAX_STACK_CHARS),
      method: input.method ?? "",
      path: input.path ?? "",
      status: input.status ?? null,
      request: input.request ?? "",
      service: "nexusid"
    };

    if (input.level !== "ERROR" || !this.auditLog) {
      this.remember(entry);
      return;
    }
    const { atMs: _atMs, id: _id, at: _at, ...metadata } = entry;
    const write = Promise.resolve()
      .then(() => this.auditLog!.log({ type: SERVER_ERROR_AUDIT_TYPE, actorType: "system", metadata }))
      .then(
        () => undefined,
        // The database may be what failed: keep the error where the monitor can still read it.
        () => this.remember(entry)
      )
      .finally(() => this.pending.delete(write));
    this.pending.add(write);
  }

  private remember(entry: ObservedEntry & { atMs: number }) {
    this.memory.push(entry);
    if (this.memory.length > MAX_MEMORY_ENTRIES) {
      this.memory = this.memory.slice(-MAX_MEMORY_ENTRIES);
    }
  }

  private allow(level: ObservedLevel, key: string) {
    const minute = Math.floor(this.now() / MINUTE_MS);
    if (this.rate.size > 2000) {
      this.rate.clear();
    }
    const slot = this.rate.get(key);
    if (!slot || slot.minute !== minute) {
      this.rate.set(key, { minute, count: 1 });
      return true;
    }
    slot.count += 1;
    return slot.count <= MAX_PER_MINUTE[level];
  }

  private pruneBuckets(current: number) {
    if (this.buckets.size <= MAX_BUCKET_MINUTES) {
      return;
    }
    const oldest = current - MAX_BUCKET_MINUTES;
    for (const minute of this.buckets.keys()) {
      if (minute < oldest) {
        this.buckets.delete(minute);
      }
    }
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

const entryFromAudit = (event: AuditEvent): ObservedEntry => {
  const metadata = event.metadata ?? {};
  return {
    id: event.id,
    at: event.createdAt.toISOString(),
    level: "ERROR",
    logger: text(metadata.logger) || "nexusid",
    type: text(metadata.type),
    message: text(metadata.message),
    stack: text(metadata.stack),
    method: text(metadata.method),
    path: text(metadata.path),
    status: typeof metadata.status === "number" ? metadata.status : null,
    request: text(metadata.request),
    service: text(metadata.service) || "nexusid"
  };
};
