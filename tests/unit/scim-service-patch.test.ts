import test from "node:test";
import assert from "node:assert/strict";
import { ScimService } from "../../src/services/scim-service.js";

const buildScimService = () => {
  const users = new Map<string, {
    id: string;
    username: string;
    email: string;
    givenName: string;
    familyName: string;
    active: boolean;
  }>([
    [
      "user-1",
      {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
        givenName: "Alice",
        familyName: "Jones",
        active: true
      }
    ]
  ]);

  const groups = new Map<string, { id: string; name: string; description: string }>([
    ["group-1", { id: "group-1", name: "Developers", description: "Developers group" }]
  ]);

  const memberships = new Map<string, Set<string>>([
    ["user-1", new Set(["group-1"])],
    ["user-2", new Set(["group-1"])]
  ]);

  users.set("user-2", {
    id: "user-2",
    username: "bob",
    email: "bob@example.com",
    givenName: "Bob",
    familyName: "Smith",
    active: true
  });

  const userService = {
    listUsers: async () => Array.from(users.values()),
    findUserById: async (id: string) => users.get(id),
    updateUserProfile: async (id: string, input: Partial<{ username: string; email: string; givenName: string; familyName: string }>) => {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("missing user");
      }
      const updated = {
        ...existing,
        ...input
      };
      users.set(id, updated);
      return updated;
    },
    setUserActive: async (id: string, active: boolean) => {
      const existing = users.get(id);
      if (!existing) {
        throw new Error("missing user");
      }
      users.set(id, { ...existing, active });
    },
    resetPassword: async () => undefined
  };

  const groupService = {
    findGroupById: async (id: string) => groups.get(id),
    updateGroup: async (id: string, input: Partial<{ name: string; description: string }>) => {
      const existing = groups.get(id);
      if (!existing) {
        throw new Error("missing group");
      }
      groups.set(id, { ...existing, ...input });
      return groups.get(id);
    },
    listGroupIdsForUser: async (userId: string) => Array.from(memberships.get(userId) ?? []),
    resolveGroupNamesForUser: async (userId: string) =>
      Array.from(memberships.get(userId) ?? [])
        .map((groupId) => groups.get(groupId)?.name)
        .filter((name): name is string => Boolean(name)),
    assignUserToGroup: async (input: { userId: string; groupId: string }) => {
      const existing = memberships.get(input.userId) ?? new Set<string>();
      existing.add(input.groupId);
      memberships.set(input.userId, existing);
    },
    removeUserFromGroup: async (input: { userId: string; groupId: string }) => {
      const existing = memberships.get(input.userId);
      if (!existing) {
        return;
      }
      existing.delete(input.groupId);
      memberships.set(input.userId, existing);
    },
    createGroup: async () => {
      throw new Error("not used");
    },
    deleteGroup: async () => undefined
  };

  return {
    scimService: new ScimService(userService as never, groupService as never),
    users,
    groups,
    memberships
  };
};

test("SCIM patchUser applies profile and active operations", async () => {
  const { scimService } = buildScimService();

  const patched = await scimService.patchUser("user-1", [
    { op: "replace", path: "name.givenName", value: "Alicia" },
    { op: "replace", path: "externalId", value: "okta:user:42" },
    { op: "replace", path: "active", value: false }
  ]);

  assert.equal(patched.name.givenName, "Alicia");
  assert.equal(patched.externalId, "okta:user:42");
  assert.equal(patched.active, false);
});

test("SCIM patchGroup updates name and removes members", async () => {
  const { scimService, memberships } = buildScimService();

  const patched = await scimService.patchGroup("group-1", [
    { op: "replace", path: "displayName", value: "Engineering" },
    { op: "replace", path: "externalId", value: "okta:group:99" },
    { op: "remove", path: "members", value: [{ value: "user-2" }] }
  ]);

  assert.equal(patched.displayName, "Engineering");
  assert.equal(patched.externalId, "okta:group:99");
  assert.equal(memberships.get("user-2")?.has("group-1"), false);
});