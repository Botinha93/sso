import test from "node:test";
import assert from "node:assert/strict";
import { orderTablesByForeignKeyDependencies } from "../../src/services/database-migration-service.js";

test("orderTablesByForeignKeyDependencies places parent tables first", () => {
  const ordered = orderTablesByForeignKeyDependencies(
    ["access_tokens", "sessions", "users", "oauth_clients"],
    new Map([
      [
        "access_tokens",
        [
          { id: 0, seq: 0, table: "users", from: "user_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" },
          { id: 1, seq: 0, table: "sessions", from: "session_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" },
          { id: 2, seq: 0, table: "oauth_clients", from: "client_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" }
        ]
      ],
      ["sessions", [{ id: 0, seq: 0, table: "users", from: "user_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" }]],
      ["users", []],
      ["oauth_clients", []]
    ])
  );

  assert.ok(ordered.indexOf("users") < ordered.indexOf("sessions"));
  assert.ok(ordered.indexOf("users") < ordered.indexOf("access_tokens"));
  assert.ok(ordered.indexOf("sessions") < ordered.indexOf("access_tokens"));
  assert.ok(ordered.indexOf("oauth_clients") < ordered.indexOf("access_tokens"));
});

test("orderTablesByForeignKeyDependencies tolerates cycles", () => {
  const ordered = orderTablesByForeignKeyDependencies(
    ["a", "b"],
    new Map([
      ["a", [{ id: 0, seq: 0, table: "b", from: "b_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" }]],
      ["b", [{ id: 0, seq: 0, table: "a", from: "a_id", to: "id", on_update: "NO ACTION", on_delete: "NO ACTION", match: "NONE" }]]
    ])
  );

  assert.deepEqual(new Set(ordered), new Set(["a", "b"]));
});
