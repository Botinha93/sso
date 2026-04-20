import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("access governance request intake and listing", async (t) => {
  const { app, admin } = await createTestContext("integration-access-governance-requests");
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

  const subjectCreateResponse = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      email: "access-subject@example.com",
      username: "access_subject",
      password: "Change-Me-Now1!",
      givenName: "Access",
      familyName: "Subject",
      roleIds: [],
      groupIds: []
    }
  });

  assert.equal(subjectCreateResponse.statusCode, 201);
  const subject = subjectCreateResponse.json() as { id: string };

  const createRequestResponse = await app.inject({
    method: "POST",
    url: "/api/admin/access-requests",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      subjectUserId: subject.id,
      entitlementType: "role",
      entitlementValue: "finance_approver",
      justification: "User joined AP operations and needs temporary approver access."
    }
  });

  assert.equal(createRequestResponse.statusCode, 201);
  const created = createRequestResponse.json() as {
    id: string;
    requesterId: string;
    subjectUserId: string;
    status: string;
    entitlementType: string;
    entitlementValue: string;
  };
  assert.equal(created.subjectUserId, subject.id);
  assert.equal(created.requesterId.length > 0, true);
  assert.equal(created.status, "pending");
  assert.equal(created.entitlementType, "role");
  assert.equal(created.entitlementValue, "finance_approver");

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-requests?status=pending&limit=20",
    headers: {
      cookie: sid
    }
  });

  assert.equal(listResponse.statusCode, 200);
  const requests = listResponse.json() as Array<{ id: string; status: string; subjectUserId: string }>;
  assert.ok(requests.some((request) => request.id === created.id && request.status === "pending" && request.subjectUserId === subject.id));
});
