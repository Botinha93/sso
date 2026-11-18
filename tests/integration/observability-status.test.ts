import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, loginAsAdmin } from "../helpers/test-app.js";

test("observability status reports the database, request minutes and server errors to admins only", async (t) => {
  const { app, admin } = await createTestContext("integration-observability-status");
  t.after(async () => {
    await app.close();
  });

  const anonymous = await app.inject({ method: "GET", url: "/api/admin/observability/status" });
  assert.equal(anonymous.statusCode, 401);

  const sid = await loginAsAdmin(app, admin);
  const response = await app.inject({ method: "GET", url: "/api/admin/observability/status", headers: { cookie: sid } });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();

  assert.equal(body.system, "nexusid");
  assert.equal(body.checks.database.ok, true);
  assert.equal(body.checks.database.error, "");
  assert.deepEqual(body.errors, []);
  assert.ok(body.cursor > 0);
  assert.ok(body.requests.every((row: { ms: number; max: number }) => row.ms > 0 && row.max >= row.ms));
  // Setup and login were answered below 500; calls to this route are not counted.
  const total = body.requests.reduce((sum: number, row: { ok: number }) => sum + row.ok, 0);
  assert.ok(total >= 2, JSON.stringify(body.requests));
  assert.ok(body.requests.every((row: { failed: number }) => row.failed === 0));

  // Polling the status does not inflate the counts it reports.
  const again = await app.inject({ method: "GET", url: "/api/admin/observability/status", headers: { cookie: sid } });
  const totalAgain = again.json().requests.reduce((sum: number, row: { ok: number }) => sum + row.ok, 0);
  assert.equal(totalAgain, total);

  const future = new Date(Date.now() + 5 * 60_000).toISOString();
  const windowed = await app.inject({
    method: "GET",
    url: `/api/admin/observability/status?since=${encodeURIComponent(future)}&after=0`,
    headers: { cookie: sid }
  });
  assert.deepEqual(windowed.json().requests, []);

  // A server error is kept in the audit trail and comes back after the cursor.
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(process.env.DATABASE_PATH!);
  db.prepare(
    "INSERT INTO audit_events (id, type, actor_id, actor_type, client_id, ip, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("err-1", "server_error", null, "system", null, null,
    JSON.stringify({ level: "ERROR", type: "TypeError", message: "boom", stack: "TypeError: boom", method: "GET", path: "/api/admin/users/:id", status: 500, request: "req-1", service: "nexusid" }),
    new Date(body.cursor + 1000).toISOString());
  db.close();
  const withError = await app.inject({
    method: "GET",
    url: `/api/admin/observability/status?after=${body.cursor}`,
    headers: { cookie: sid }
  });
  const errorBody = withError.json();
  assert.deepEqual(
    errorBody.errors.map((e: Record<string, unknown>) => [e.id, e.level, e.type, e.message, e.path, e.status]),
    [["err-1", "ERROR", "TypeError", "boom", "/api/admin/users/:id", 500]]
  );
  assert.equal(errorBody.cursor, body.cursor + 1000);

  const invalid = await app.inject({
    method: "GET",
    url: "/api/admin/observability/status?since=yesterday",
    headers: { cookie: sid }
  });
  assert.equal(invalid.statusCode, 422);
});
