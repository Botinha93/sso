import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("SCIM Users and Groups lifecycle endpoints", async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "sso-scim-lifecycle-"));
  process.env.NODE_ENV = "test";
  process.env.ISSUER = "http://localhost:4000";
  process.env.DATABASE_PATH = join(tempDir, "sso.sqlite");

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const createUserResponse = await app.inject({
    method: "POST",
    url: "/scim/v2/Users",
    payload: {
      userName: "scim.integration.user",
      name: { givenName: "Scim", familyName: "Integration" },
      emails: [{ value: "scim.integration.user@example.com", primary: true }],
      active: true
    }
  });

  assert.equal(createUserResponse.statusCode, 201);
  const createdUser = createUserResponse.json() as { id: string; userName: string; active: boolean };
  assert.equal(createdUser.userName, "scim.integration.user");
  assert.equal(createdUser.active, true);

  const listUsersResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/Users?filter=userName%20eq%20%22scim.integration.user%22"
  });
  assert.equal(listUsersResponse.statusCode, 200);
  const listedUsers = listUsersResponse.json() as { totalResults: number; Resources: Array<{ id: string }> };
  assert.equal(listedUsers.totalResults, 1);
  assert.equal(listedUsers.Resources[0]?.id, createdUser.id);

  const patchUserResponse = await app.inject({
    method: "PATCH",
    url: `/scim/v2/Users/${createdUser.id}`,
    payload: {
      Operations: [
        { op: "replace", path: "name.givenName", value: "Updated" },
        { op: "replace", path: "active", value: false }
      ]
    }
  });
  assert.equal(patchUserResponse.statusCode, 200);
  const patchedUser = patchUserResponse.json() as { name: { givenName: string }; active: boolean };
  assert.equal(patchedUser.name.givenName, "Updated");
  assert.equal(patchedUser.active, false);

  const createGroupResponse = await app.inject({
    method: "POST",
    url: "/scim/v2/Groups",
    payload: {
      displayName: "SCIM Integration Group",
      members: [{ value: createdUser.id }]
    }
  });
  assert.equal(createGroupResponse.statusCode, 201);
  const createdGroup = createGroupResponse.json() as { id: string; displayName: string; members: Array<{ value: string }> };
  assert.equal(createdGroup.displayName, "SCIM Integration Group");
  assert.ok(createdGroup.members.some((member) => member.value === createdUser.id));

  const patchGroupResponse = await app.inject({
    method: "PATCH",
    url: `/scim/v2/Groups/${createdGroup.id}`,
    payload: {
      Operations: [
        { op: "replace", path: "displayName", value: "SCIM Integration Group Updated" }
      ]
    }
  });
  assert.equal(patchGroupResponse.statusCode, 200);
  const patchedGroup = patchGroupResponse.json() as { displayName: string };
  assert.equal(patchedGroup.displayName, "SCIM Integration Group Updated");

  const deleteGroupResponse = await app.inject({
    method: "DELETE",
    url: `/scim/v2/Groups/${createdGroup.id}`
  });
  assert.equal(deleteGroupResponse.statusCode, 204);

  const deleteUserResponse = await app.inject({
    method: "DELETE",
    url: `/scim/v2/Users/${createdUser.id}`
  });
  assert.equal(deleteUserResponse.statusCode, 204);
});
