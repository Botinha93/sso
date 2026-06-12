import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeRolePermission,
  flattenRolePermissions,
  isPlatformPermission
} from "../../src/domain/permissions.js";

test("isPlatformPermission recognizes portal and admin resource keys", () => {
  assert.equal(isPlatformPermission("users:view"), true);
  assert.equal(isPlatformPermission("portal:read"), true);
  assert.equal(isPlatformPermission("*:*"), true);
  assert.equal(isPlatformPermission("billing-app:invoices:view"), false);
  assert.equal(isPlatformPermission("invoices:view"), false);
});

test("canonicalizeRolePermission keeps platform permissions unchanged", () => {
  assert.equal(
    canonicalizeRolePermission("users:view", { scope: "platform", appId: "admin-portal" }),
    "users:view"
  );
  assert.equal(
    canonicalizeRolePermission("portal:read", { scope: "tenant", appId: "app-b" }),
    "portal:read"
  );
});

test("canonicalizeRolePermission prefixes ambiguous app permissions with role appId", () => {
  assert.equal(
    canonicalizeRolePermission("invoices:view", { scope: "tenant", appId: "app-a" }),
    "app-a:invoices:view"
  );
  assert.equal(
    canonicalizeRolePermission("orders:change", { scope: "tenant", appId: "app-b" }),
    "app-b:orders:change"
  );
});

test("canonicalizeRolePermission leaves already app-scoped permissions unchanged", () => {
  assert.equal(
    canonicalizeRolePermission("app-a:invoices:view", { scope: "tenant", appId: "app-a" }),
    "app-a:invoices:view"
  );
});

test("flattenRolePermissions preserves permissions from multiple apps", () => {
  const flattened = flattenRolePermissions([
    {
      scope: "platform",
      appId: "admin-portal",
      permissions: ["users:view", "portal:read"]
    },
    {
      scope: "tenant",
      appId: "app-a",
      permissions: ["invoices:view"]
    },
    {
      scope: "tenant",
      appId: "app-b",
      permissions: ["invoices:view", "reports:view"]
    }
  ]);

  assert.deepEqual(flattened.sort(), [
    "app-a:invoices:view",
    "app-b:invoices:view",
    "app-b:reports:view",
    "portal:read",
    "users:view"
  ]);
});
