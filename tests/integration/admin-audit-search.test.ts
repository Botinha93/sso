import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createTestContext, loginAsAdmin } from "../helpers/test-app.js";

type AuditRow = { id: string; type: string; actorId?: string; metadata?: Record<string, unknown>; createdAt: string };

test("admin audit search runs against full history, pages with a cursor and reports stats", async (t) => {
  const { app, admin } = await createTestContext("integration-admin-audit-search");
  t.after(async () => {
    await app.close();
  });

  // One old, distinctive event buried under 300 newer ones — beyond the default page size.
  const db = new Database(process.env.DATABASE_PATH!);
  const insert = db.prepare(
    "INSERT INTO audit_events (id, type, actor_id, actor_type, client_id, ip, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const base = Date.now() - 2 * 24 * 60 * 60 * 1000;
  insert.run("needle-event", "account_lockout", "user-needle-0123456789abcdef", "user", null, "203.0.113.7",
    JSON.stringify({ email: "Needle.Person@example.com", reason: "too many attempts" }), new Date(base).toISOString());
  const seed = db.transaction(() => {
    for (let i = 1; i <= 300; i += 1) {
      insert.run(`filler-${String(i).padStart(4, "0")}`, "token_issued", `user-${i}`, "user", "client-a", null, null,
        new Date(base + i * 60_000).toISOString());
    }
  });
  seed();
  db.close();

  const sid = await loginAsAdmin(app, admin);
  const get = async (url: string) => {
    const response = await app.inject({ method: "GET", url, headers: { cookie: sid } });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };

  // Case-insensitive search reaches old events and matches metadata contents.
  const byMetadata = (await get("/api/admin/audit?search=needle.person")) as AuditRow[];
  assert.deepEqual(byMetadata.map((e) => e.id), ["needle-event"]);
  assert.equal(byMetadata[0].actorId, "user-needle-0123456789abcdef");

  const byIp = (await get("/api/admin/audit?search=203.0.113")) as AuditRow[];
  assert.deepEqual(byIp.map((e) => e.id), ["needle-event"]);

  const byType = (await get("/api/admin/audit?type=account_lockout")) as AuditRow[];
  assert.ok(byType.some((e) => e.id === "needle-event"));

  // Keyset pagination walks the whole filtered set without gaps or duplicates.
  const seen = new Set<string>();
  let cursor = "";
  for (let pageCount = 0; pageCount < 10; pageCount += 1) {
    const page = (await get(`/api/admin/audit?clientId=client-a&limit=120${cursor}`)) as AuditRow[];
    for (const event of page) {
      assert.ok(!seen.has(event.id), `duplicate ${event.id}`);
      seen.add(event.id);
    }
    if (page.length < 120) break;
    const last = page[page.length - 1];
    cursor = `&before=${encodeURIComponent(last.createdAt)}&beforeId=${encodeURIComponent(last.id)}`;
  }
  assert.equal(seen.size, 300);

  const stats = (await get("/api/admin/audit/stats?days=14")) as {
    total: number;
    byType: Array<{ type: string; count: number }>;
    byHour: Array<{ hour: string; count: number }>;
    riskBySeverity: { medium: number; high: number; critical: number };
  };
  assert.equal(stats.byType.find((row) => row.type === "token_issued")?.count, 300);
  assert.ok(stats.riskBySeverity.high >= 1);
  assert.equal(stats.byHour.reduce((sum, row) => sum + row.count, 0), stats.total);
  assert.ok(stats.total >= 301);

  const invalid = await app.inject({ method: "GET", url: "/api/admin/audit?from=not-a-date", headers: { cookie: sid } });
  assert.equal(invalid.statusCode, 400);
});
