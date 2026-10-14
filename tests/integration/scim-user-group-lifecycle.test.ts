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

  const eventTypesResponse = await app.inject({
    method: "GET",
    url: "/api/admin/events/types",
    headers: {
      cookie: authCookies
    }
  });
  assert.equal(eventTypesResponse.statusCode, 200);
  const eventTypes = eventTypesResponse.json() as string[];
  assert.ok(eventTypes.includes("scim.user.created"));
  assert.ok(eventTypes.includes("scim.user.updated"));
  assert.ok(eventTypes.includes("scim.user.deleted"));
  assert.ok(eventTypes.includes("scim.group.created"));
  assert.ok(eventTypes.includes("scim.group.updated"));
  assert.ok(eventTypes.includes("scim.group.deleted"));

  const createHookResponse = await app.inject({
    method: "POST",
    url: "/api/admin/events/hooks",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      eventType: "*",
      targetUrl: "http://127.0.0.1:9/scim-hook",
      method: "POST"
    }
  });
  assert.equal(createHookResponse.statusCode, 201);

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
      externalId: "okta:user:1001",
      userName: "scim.integration.user",
      name: { givenName: "Scim", familyName: "Integration" },
      emails: [{ value: "scim.integration.user@example.com", primary: true }],
      active: true
    }
  });

  assert.equal(createUserResponse.statusCode, 201);
  const createdUser = createUserResponse.json() as { id: string; userName: string; externalId?: string; active: boolean };
  assert.equal(createdUser.userName, "scim.integration.user");
  assert.equal(createdUser.externalId, "okta:user:1001");
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
        { op: "replace", path: "externalId", value: "okta:user:1001-updated" },
        { op: "replace", path: "active", value: false }
      ]
    }
  });
  assert.equal(patchUserResponse.statusCode, 200);
  const patchedUser = patchUserResponse.json() as { name: { givenName: string }; externalId?: string; active: boolean };
  assert.equal(patchedUser.name.givenName, "Updated");
  assert.equal(patchedUser.externalId, "okta:user:1001-updated");
  assert.equal(patchedUser.active, false);

  const createGroupResponse = await app.inject({
    method: "POST",
    url: "/scim/v2/Groups",
    headers: scimHeaders,
    payload: {
      externalId: "okta:group:5001",
      displayName: "SCIM Integration Group",
      members: [{ value: createdUser.id }]
    }
  });
  assert.equal(createGroupResponse.statusCode, 201);
  const createdGroup = createGroupResponse.json() as { id: string; displayName: string; externalId?: string; members: Array<{ value: string }> };
  assert.equal(createdGroup.displayName, "SCIM Integration Group");
  assert.equal(createdGroup.externalId, "okta:group:5001");
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
  const patchedGroup = patchGroupResponse.json() as { displayName: string; externalId?: string };
  assert.equal(patchedGroup.displayName, "SCIM Integration Group Updated");
  assert.equal(patchedGroup.externalId, "okta:group:5001");

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

  const deprovisionQueueResponse = await app.inject({
    method: "GET",
    url: "/api/admin/provisioning/deprovisioning-queue?limit=100",
    headers: {
      cookie: authCookies
    }
  });
  assert.equal(deprovisionQueueResponse.statusCode, 200);
  const deprovisionQueue = deprovisionQueueResponse.json() as Array<{ subjectType: string; subjectId: string; actionType: string; status: string }>;
  assert.ok(deprovisionQueue.some((item) => item.subjectType === "group" && item.subjectId === createdGroup.id && item.actionType === "group_cleanup" && item.status === "pending"));
  assert.ok(deprovisionQueue.some((item) => item.subjectType === "user" && item.subjectId === createdUser.id && item.actionType === "user_offboard" && item.status === "pending"));

  const notificationsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/events/notifications?limit=100",
    headers: {
      cookie: authCookies
    }
  });
  assert.equal(notificationsResponse.statusCode, 200);
  const notifications = notificationsResponse.json() as Array<{ eventType: string }>;
  const scimEventTypes = notifications
    .filter((notification) => notification.eventType.startsWith("scim."))
    .map((notification) => notification.eventType);
  assert.ok(scimEventTypes.includes("scim.user.created"));
  assert.ok(scimEventTypes.includes("scim.user.updated"));
  assert.ok(scimEventTypes.includes("scim.user.deleted"));
  assert.ok(scimEventTypes.includes("scim.group.created"));
  assert.ok(scimEventTypes.includes("scim.group.updated"));
  assert.ok(scimEventTypes.includes("scim.group.deleted"));

  const auditResponse = await app.inject({
    method: "GET",
    url: "/api/admin/audit?limit=200",
    headers: {
      cookie: authCookies
    }
  });
  assert.equal(auditResponse.statusCode, 200);
  const auditEvents = auditResponse.json() as Array<{ type: string }>;
  const auditTypes = auditEvents.map((event) => event.type);
  assert.ok(auditTypes.includes("scim_user_created"));
  assert.ok(auditTypes.includes("scim_user_updated"));
  assert.ok(auditTypes.includes("scim_user_deleted"));
  assert.ok(auditTypes.includes("scim_group_created"));
  assert.ok(auditTypes.includes("scim_group_updated"));
  assert.ok(auditTypes.includes("scim_group_deleted"));
});
