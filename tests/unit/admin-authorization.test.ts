import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAdminPermission,
  isBootstrapAdminServiceIdentityMetadata,
  isUngatedAdminClientId,
  parseUngatedAdminClientIds,
  resetUngatedAdminClientIdsCache
} from "../../src/http/admin-authorization.js";

test("hasAdminPermission accepts wildcard and scoped grants", () => {
  assert.equal(hasAdminPermission({ permissions: ["*:*"], resource: "users", action: "view" }), true);
  assert.equal(hasAdminPermission({ permissions: ["users:*"], resource: "users", action: "add" }), true);
  assert.equal(hasAdminPermission({ permissions: ["users:view"], resource: "users", action: "view" }), true);
  assert.equal(hasAdminPermission({ permissions: ["users:view"], resource: "users", action: "add" }), false);
});

test("parseUngatedAdminClientIds splits comma and whitespace", () => {
  const ids = parseUngatedAdminClientIds("admin-worker-1, admin-worker-2  admin-worker-3");
  assert.deepEqual([...ids].sort(), ["admin-worker-1", "admin-worker-2", "admin-worker-3"]);
});

test("isUngatedAdminClientId reads ADMIN_UNGATED_CLIENT_IDS", () => {
  const previous = process.env.ADMIN_UNGATED_CLIENT_IDS;
  process.env.ADMIN_UNGATED_CLIENT_IDS = "bootstrap-client";
  resetUngatedAdminClientIdsCache();

  try {
    assert.equal(isUngatedAdminClientId("bootstrap-client"), true);
    assert.equal(isUngatedAdminClientId("other-client"), false);
  } finally {
    if (previous === undefined) {
      delete process.env.ADMIN_UNGATED_CLIENT_IDS;
    } else {
      process.env.ADMIN_UNGATED_CLIENT_IDS = previous;
    }
    resetUngatedAdminClientIdsCache();
  }
});

test("isBootstrapAdminServiceIdentityMetadata recognizes bootstrap flags", () => {
  assert.equal(isBootstrapAdminServiceIdentityMetadata({ bootstrap_admin: true }), true);
  assert.equal(isBootstrapAdminServiceIdentityMetadata({ ungated_admin: true }), true);
  assert.equal(isBootstrapAdminServiceIdentityMetadata({ bootstrap_admin: false }), false);
  assert.equal(isBootstrapAdminServiceIdentityMetadata(undefined), false);
});
