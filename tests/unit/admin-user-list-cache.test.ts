import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminUserListCache,
  serializeAdminUserFromCache
} from "../../src/services/admin-user-list-cache.js";

test("admin user list cache serializes roles, groups, and merged custom attributes", () => {
  const cache = buildAdminUserListCache({
    groups: [
      { id: "g1", name: "Managers", description: "", appId: "app1", appIds: ["app1"], createdAt: new Date() }
    ],
    roles: [
      { id: "r1", name: "admin", description: "", permissions: ["*"], scope: "platform", createdAt: new Date() },
      { id: "r2", name: "viewer", description: "", permissions: ["read"], scope: "platform", createdAt: new Date() }
    ],
    userRoleAssignments: [
      { id: "ura1", userId: "u1", roleId: "r2", createdAt: new Date() }
    ],
    userGroupAssignments: [
      { id: "uga1", userId: "u1", groupId: "g1", createdAt: new Date() }
    ],
    userAppAssignments: [],
    groupRoleAssignments: [
      { id: "gra1", groupId: "g1", roleId: "r1", createdAt: new Date() }
    ],
    groupAppAssignments: [],
    groupUserAttributeAssignments: [
      { id: "gaa1", groupId: "g1", attributeId: "attr1", enabled: true, value: "RH", createdAt: new Date(), updatedAt: new Date() }
    ],
    attributeDefinitions: [
      { id: "attr1", key: "area", name: "Area", description: "", type: "text", enabled: true, showOnPortal: false, userEditable: false, createdAt: new Date(), updatedAt: new Date() }
    ]
  });

  const serialized = serializeAdminUserFromCache({
    id: "u1",
    email: "user@example.com",
    username: "user",
    passwordHash: "hash",
    givenName: "Test",
    familyName: "User",
    customAttributes: { area: "Finance" },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }, cache);

  assert.deepEqual(serialized.roles.sort(), ["admin", "viewer"]);
  assert.deepEqual(serialized.groups, ["Managers"]);
  assert.equal(serialized.customAttributes.area, "Finance");
  assert.equal(serialized.directRoleIds.length, 1);
});
