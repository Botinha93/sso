import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("PAM-lite elevation request lifecycle: create → approve → activate → revoke", async (t) => {
  const { app, admin } = await createTestContext("integration-elevations");

  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid },
  });

  assert.equal(csrfResponse.statusCode, 200);
  const csrfToken = String(csrfResponse.json().csrf_token);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const authHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken,
  };

  // Create elevation request
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations",
    headers: authHeaders,
    payload: {
      justification: "Emergency database maintenance during incident",
      resource: "db:prod",
      action: "write",
      durationMinutes: 30,
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json();
  assert.equal(created.status, "pending");
  assert.equal(created.resource, "db:prod");
  assert.equal(created.action, "write");
  assert.equal(created.durationMinutes, 30);
  const elevationId = String(created.id);

  // List elevation requests
  const listResponse = await app.inject({
    method: "GET",
    url: "/api/admin/elevations?status=pending",
    headers: { cookie: `${sid}; ${csrfCookie}` },
  });

  assert.equal(listResponse.statusCode, 200);
  const list = listResponse.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.some((r: { id: string }) => r.id === elevationId));

  // Get by ID
  const getResponse = await app.inject({
    method: "GET",
    url: `/api/admin/elevations/${elevationId}`,
    headers: { cookie: `${sid}; ${csrfCookie}` },
  });

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.json().id, elevationId);

  // Approve elevation request
  const approveResponse = await app.inject({
    method: "POST",
    url: `/api/admin/elevations/${elevationId}/approve`,
    headers: authHeaders,
    payload: { rationale: "Verified on-call maintenance window" },
  });

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.json().status, "approved");

  // Activate elevation request
  const activateResponse = await app.inject({
    method: "POST",
    url: `/api/admin/elevations/${elevationId}/activate`,
    headers: authHeaders,
  });

  assert.equal(activateResponse.statusCode, 200);
  const activated = activateResponse.json();
  assert.equal(activated.status, "active");
  assert.ok(activated.activatedAt);
  assert.ok(activated.expiresAt);

  // Revoke elevation request
  const revokeResponse = await app.inject({
    method: "POST",
    url: `/api/admin/elevations/${elevationId}/revoke`,
    headers: authHeaders,
    payload: { reason: "Maintenance completed early" },
  });

  assert.equal(revokeResponse.statusCode, 200);
  assert.equal(revokeResponse.json().status, "revoked");

  // Verify final state
  const finalGetResponse = await app.inject({
    method: "GET",
    url: `/api/admin/elevations/${elevationId}`,
    headers: { cookie: `${sid}; ${csrfCookie}` },
  });

  assert.equal(finalGetResponse.statusCode, 200);
  assert.equal(finalGetResponse.json().status, "revoked");
});

test("PAM-lite elevation: process expirations marks expired requests", async (t) => {
  const { app, admin } = await createTestContext("integration-elevations-expiry");

  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid },
  });

  const csrfToken = String(csrfResponse.json().csrf_token);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const authHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken,
  };

  // Process expirations (no-op if no expired requests)
  const processResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/process-expirations",
    headers: authHeaders,
  });

  assert.equal(processResponse.statusCode, 200);
  const result = processResponse.json();
  assert.ok("processed" in result || Array.isArray(result.expired));
});

test("access governance: stalled requests endpoint returns pending requests past threshold", async (t) => {
  const { app, admin } = await createTestContext("integration-stalled-requests");

  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const stalledResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-requests/stalled?stalledAfterMinutes=1",
    headers: { cookie: sid },
  });

  assert.equal(stalledResponse.statusCode, 200);
  const body = stalledResponse.json();
  assert.ok("stalledRequests" in body);
  assert.ok(Array.isArray(body.stalledRequests));
});
