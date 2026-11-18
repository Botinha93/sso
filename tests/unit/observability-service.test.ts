import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { AuditEvent } from "../../src/domain/models.js";
import type { AuditSearchQuery } from "../../src/repositories/contracts.js";
import { ObservabilityService } from "../../src/services/observability-service.js";

const T0 = Date.parse("2026-11-18T10:00:30.000Z");

/** The two audit repository methods the service uses, over an array. */
const fakeAudit = (clock: () => number) => {
  const events: AuditEvent[] = [];
  return {
    events,
    failing: false,
    async log(input: Omit<AuditEvent, "id" | "createdAt">) {
      if (this.failing) {
        throw new Error("database is gone");
      }
      const event = { ...input, id: `a${events.length + 1}`, createdAt: new Date(clock()) } as AuditEvent;
      events.push(event);
      return event;
    },
    async search(query: AuditSearchQuery) {
      return events
        .filter((event) => event.type === query.type && (!query.from || event.createdAt >= query.from))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit ?? 200);
    }
  };
};

test("requests are counted per minute with their duration; a 5xx is a failure, a 4xx is not", async () => {
  let now = T0;
  const service = new ObservabilityService(undefined, () => now);
  service.recordResponse("/oauth/token", 200, 10);
  service.recordResponse("/oauth/token", 401, 20);
  service.recordResponse("/api/portal/me", 503, 300);
  now += 60_000;
  service.recordResponse("/api/portal/me", 200, 7.5);

  assert.deepEqual((await service.snapshot()).requests, [
    { minute: "2026-11-18T10:00:00.000Z", ok: 2, failed: 1, ms: 110, max: 300 },
    { minute: "2026-11-18T10:01:00.000Z", ok: 1, failed: 0, ms: 7.5, max: 7.5 }
  ]);
  assert.deepEqual((await service.snapshot({ since: new Date("2026-11-18T10:01:00Z") })).requests, [
    { minute: "2026-11-18T10:01:00.000Z", ok: 1, failed: 0, ms: 7.5, max: 7.5 }
  ]);
});

test("the monitor's own calls are not proof that users are being served", async () => {
  const service = new ObservabilityService(undefined, () => T0);
  service.recordResponse("/health", 200, 1);
  service.recordResponse("/api/admin/observability/status", 200, 1);
  assert.deepEqual((await service.snapshot()).requests, []);
});

test("minutes older than a day are dropped", async () => {
  let now = T0;
  const service = new ObservabilityService(undefined, () => now);
  for (let i = 0; i < 24 * 60 + 30; i += 1) {
    service.recordResponse("/oauth/token", 200, 1);
    now += 60_000;
  }
  const { requests } = await service.snapshot();
  assert.ok(requests.length <= 24 * 60 + 1, String(requests.length));
});

test("an unhandled exception is written to the audit trail and read once through the cursor", async () => {
  let now = T0;
  const audit = fakeAudit(() => now);
  const service = new ObservabilityService(audit, () => now);
  service.recordError({ error: new TypeError("boom"), method: "GET", path: "/api/admin/users/:id", status: 500, request: "req-1" });
  await service.flush();

  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0].type, "server_error");
  assert.equal(audit.events[0].actorType, "system");

  const first = await service.snapshot();
  assert.deepEqual(
    first.errors.map((e) => [e.level, e.type, e.message, e.method, e.path, e.status, e.request]),
    [["ERROR", "TypeError", "boom", "GET", "/api/admin/users/:id", 500, "req-1"]]
  );
  assert.match(first.errors[0].stack, /TypeError: boom/);
  assert.equal(first.cursor, T0);
  assert.deepEqual((await service.snapshot({ after: first.cursor })).errors, []);
  assert.equal((await service.snapshot({ after: first.cursor })).cursor, first.cursor);

  now += 5_000;
  service.recordError({ error: new Error("again"), method: "POST", path: "/oauth/token", status: 500 });
  await service.flush();
  assert.deepEqual((await service.snapshot({ after: first.cursor })).errors.map((e) => e.message), ["again"]);
});

test("errors written before a restart are still there for the next process", async () => {
  const audit = fakeAudit(() => T0);
  const before = new ObservabilityService(audit, () => T0);
  before.recordError({ error: new Error("crashed"), method: "GET", path: "/x", status: 500 });
  await before.flush();

  const afterRestart = new ObservabilityService(audit, () => T0 + 60_000);
  assert.deepEqual((await afterRestart.snapshot({ after: T0 - 1 })).errors.map((e) => e.message), ["crashed"]);
});

test("when the audit trail cannot be written the error stays readable in memory", async () => {
  const audit = fakeAudit(() => T0);
  audit.failing = true;
  const service = new ObservabilityService(audit, () => T0);
  service.recordError({ error: new Error("db down"), method: "GET", path: "/x", status: 500 });
  await service.flush();

  assert.equal(audit.events.length, 0);
  assert.deepEqual((await service.snapshot()).errors.map((e) => e.message), ["db down"]);
});

test("the first read announces only the last day", async () => {
  let now = T0 - 3 * 24 * 60 * 60_000;
  const audit = fakeAudit(() => now);
  const service = new ObservabilityService(audit, () => now);
  service.recordError({ error: new Error("old"), method: "GET", path: "/x", status: 500 });
  await service.flush();
  now = T0;

  const first = await service.snapshot();
  assert.deepEqual(first.errors, []);
  assert.equal(first.cursor, T0);
});

test("log lines: warnings stay in memory, errors are persisted, lower levels are ignored", async () => {
  let now = T0;
  const audit = fakeAudit(() => now);
  const service = new ObservabilityService(audit, () => now);
  service.recordLog(30, ["server listening"]);
  service.recordLog(40, [{ path: "/oauth/userinfo" }, "rejected an invalid or expired token"], { reqId: "req-9" });
  now += 1;
  service.recordLog(50, [{ err: new RangeError("sweep failed") }, "retention sweep"]);
  await service.flush();

  assert.equal(audit.events.length, 1);
  const { errors } = await service.snapshot();
  assert.deepEqual(
    errors.map((e) => [e.level, e.type, e.message, e.path, e.request]),
    [
      ["WARNING", "", "rejected an invalid or expired token", "/oauth/userinfo", "req-9"],
      ["ERROR", "RangeError", "retention sweep: sweep failed", "", ""]
    ]
  );
});

test("an exception already recorded with its request is not recorded again when it is logged", async () => {
  const audit = fakeAudit(() => T0);
  const service = new ObservabilityService(audit, () => T0);
  const error = new Error("once");
  service.recordError({ error, method: "GET", path: "/x", status: 500 });
  service.recordLog(50, [error]);
  await service.flush();

  assert.equal(audit.events.length, 1);
});

test("a storm of the same message is cut per minute", async () => {
  let now = T0;
  const service = new ObservabilityService(undefined, () => now);
  for (let i = 0; i < 50; i += 1) {
    service.recordLog(40, ["rejected an invalid or expired token"]);
  }
  assert.equal((await service.snapshot()).errors.length, 5);

  now += 60_000;
  service.recordLog(40, ["rejected an invalid or expired token"]);
  assert.equal((await service.snapshot()).errors.length, 6);
});

test("entries of the same millisecond keep their order and are never skipped by the cursor", async () => {
  const service = new ObservabilityService(undefined, () => T0);
  service.recordLog(40, ["first"]);
  service.recordLog(40, ["second"]);

  const all = await service.snapshot();
  assert.deepEqual(all.errors.map((e) => e.message), ["first", "second"]);
  assert.deepEqual((await service.snapshot({ after: T0 })).errors.map((e) => e.message), ["second"]);
});

test("the server logger hook feeds warnings and errors without changing what is logged", async () => {
  const service = new ObservabilityService(undefined, () => T0);
  const lines: string[] = [];
  const app = Fastify({
    logger: {
      stream: { write: (line: string) => lines.push(line) },
      hooks: {
        logMethod(args, method, level) {
          service.recordLog(level, args, this.bindings());
          return method.apply(this, args);
        }
      }
    }
  });
  app.get("/warn", async (request) => {
    request.log.warn({ path: "/warn" }, "careful");
    request.log.info("fine");
    return { ok: true };
  });
  await app.inject({ method: "GET", url: "/warn" });
  await app.close();

  const { errors } = await service.snapshot();
  assert.deepEqual(errors.map((e) => [e.level, e.message, e.path]), [["WARNING", "careful", "/warn"]]);
  assert.ok(errors[0].request.length > 0);
  assert.ok(lines.some((line) => line.includes('"msg":"careful"')));
  assert.ok(lines.some((line) => line.includes('"msg":"fine"')));
});
