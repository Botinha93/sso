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
  assert.ok(created.correlationId);
  assert.equal(created.resource, "db:prod");
  assert.equal(created.action, "write");
  assert.ok(created.expiresAt);
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

  // Check elevation decision while session is active
  const checkAllowedResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/check",
    headers: authHeaders,
    payload: { resource: "db:prod", action: "write" },
  });

  assert.equal(checkAllowedResponse.statusCode, 200);
  const checkAllowed = checkAllowedResponse.json();
  assert.equal(checkAllowed.allowed, true);
  assert.ok(checkAllowed.sessionId);

  // Elevation sessions endpoint should include active session
  const sessionsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/elevations/sessions?status=active",
    headers: { cookie: `${sid}; ${csrfCookie}` },
  });

  assert.equal(sessionsResponse.statusCode, 200);
  const sessions = sessionsResponse.json();
  assert.ok(Array.isArray(sessions));
  assert.ok(sessions.every((s: { correlationId?: string }) => typeof s.correlationId === "string"));
  assert.ok(sessions.some((s: { elevationRequestId: string; status: string }) => s.elevationRequestId === elevationId && s.status === "active"));

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

  const checkDeniedResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/check",
    headers: authHeaders,
    payload: { resource: "db:prod", action: "write" },
  });

  assert.equal(checkDeniedResponse.statusCode, 200);
  assert.equal(checkDeniedResponse.json().allowed, false);
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
  assert.equal(typeof result.expired, "number");
});

test("PAM-lite elevation: check endpoint denies access when no active elevation exists", async (t) => {
  const { app, admin } = await createTestContext("integration-elevations-check-denied");

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

  const checkResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/check",
    headers: authHeaders,
    payload: { resource: "db:prod", action: "write" },
  });

  assert.equal(checkResponse.statusCode, 200);
  assert.equal(checkResponse.json().allowed, false);
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

test("PAM-lite elevation: break-glass emergency activation bypasses approval", async (t) => {
  const { app, admin } = await createTestContext("integration-elevations-breakglass");

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

  // Trigger break-glass emergency elevation
  const breakGlassResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/break-glass",
    headers: authHeaders,
    payload: {
      resource: "backup:prod",
      action: "restore",
      reason: "Production database corruption detected - immediate restore required",
      durationMinutes: 15,
    },
  });

  assert.equal(breakGlassResponse.statusCode, 201);
  const breakGlassResult = breakGlassResponse.json();
  assert.ok(breakGlassResult.breakGlassId);
  assert.ok(breakGlassResult.request);
  assert.ok(breakGlassResult.session);

  // Verify request is immediately active (bypasses normal approval)
  assert.equal(breakGlassResult.request.status, "active");
  assert.ok(breakGlassResult.request.correlationId);

  // Verify session is immediately active
  assert.equal(breakGlassResult.session.status, "active");
  assert.ok(breakGlassResult.session.startedAt);
  assert.ok(typeof breakGlassResult.session.requesterId === "string");

  // Verify access check passes immediately
  const checkResponse = await app.inject({
    method: "POST",
    url: "/api/admin/elevations/check",
    headers: authHeaders,
    payload: { resource: "backup:prod", action: "restore" },
  });

  assert.equal(checkResponse.statusCode, 200);
  assert.equal(checkResponse.json().allowed, true);

  // Verify break-glass session appears in listings
  const sessionsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/elevations/sessions",
    headers: { cookie: `${sid}; ${csrfCookie}` },
  });

  assert.equal(sessionsResponse.statusCode, 200);
  const sessions = sessionsResponse.json();
  assert.ok(sessions.some((s: { id: string }) => s.id === breakGlassResult.session.id));
});
