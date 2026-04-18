import test from "node:test";
import assert from "node:assert/strict";
import { hasSqlInjectionPayload } from "../../src/http/sql-injection-guard.js";

test("sql injection guard allows typical payloads", () => {
  const blocked = hasSqlInjectionPayload({
    body: { username: "alice", password: "StrongPass123!" },
    query: { page: "1", filter: "active" },
    params: { id: "user_123" },
    headers: { "user-agent": "test-runner" }
  });

  assert.equal(blocked, false);
});

test("sql injection guard blocks obvious SQLi markers", () => {
  const blocked = hasSqlInjectionPayload({
    body: { username: "admin' OR 1=1 --", password: "anything" },
    query: {},
    params: {},
    headers: {}
  });

  assert.equal(blocked, true);
});
