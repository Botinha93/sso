import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("SCIM Users and Groups lifecycle endpoints", async (t) => {
  const { app, admin } = await createTestContext("integration-scim-lifecycle");
  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: {
      cookie: sid
    }
  });

  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authCookies = `${sid}; ${csrfCookie}`;

  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/admin/provisioning/tokens",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      label: "integration-scim-token"
    }
  });

  assert.equal(tokenResponse.statusCode, 201);
  const scimToken = String(tokenResponse.json().token);
  const scimHeaders = {
    authorization: `Bearer ${scimToken}`
  };

  const createUserResponse = await app.inject({
    method: "POST",
    url: "/scim/v2/Users",
    headers: scimHeaders,
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
    url: "/scim/v2/Users?filter=userName%20eq%20%22scim.integration.user%22",
    headers: scimHeaders
  });
  assert.equal(listUsersResponse.statusCode, 200);
  const listedUsers = listUsersResponse.json() as { totalResults: number; Resources: Array<{ id: string }> };
  assert.equal(listedUsers.totalResults, 1);
  assert.equal(listedUsers.Resources[0]?.id, createdUser.id);

  const patchUserResponse = await app.inject({
    method: "PATCH",
    url: `/scim/v2/Users/${createdUser.id}`,
    headers: scimHeaders,
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
    headers: scimHeaders,
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
    headers: scimHeaders,
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
    url: `/scim/v2/Groups/${createdGroup.id}`,
    headers: scimHeaders
  });
  assert.equal(deleteGroupResponse.statusCode, 204);

  const deleteUserResponse = await app.inject({
    method: "DELETE",
    url: `/scim/v2/Users/${createdUser.id}`,
    headers: scimHeaders
  });
  assert.equal(deleteUserResponse.statusCode, 204);
});
