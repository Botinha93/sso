import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const analystPassword = "Change-Me-Now1";

const login = async (app: Awaited<ReturnType<typeof createTestContext>>["app"], input: {
  email: string;
  password: string;
  clientId?: string;
  userAgent?: string;
}) => {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    headers: input.userAgent ? { "user-agent": input.userAgent } : undefined,
    payload: {
      email: input.email,
      password: input.password,
      clientId: input.clientId ?? "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
};

const registerClient = async (app: Awaited<ReturnType<typeof createTestContext>>["app"], input: {
  name: string;
  redirectUris?: string[];
}) => {
  const response = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: input.name,
      redirect_uris: input.redirectUris ?? ["http://localhost:3000/callback"],
      grant_types: ["authorization_code", "refresh_token", "client_credentials", "password"],
      response_types: ["code", "token"],
      scope: "openid profile email"
    }
  });

  assert.equal(response.statusCode, 201);
  return response.json() as { client_id: string; client_secret: string };
};

test("security hardening: lockout, endpoint throttling, and session anomaly auditing", async (t) => {
  const { app, admin } = await createTestContext("integration-security-hardening");

  t.after(async () => {
    await app.close();
  });

  const adminLogin = await login(app, {
    email: admin.email,
    password: admin.password,
    userAgent: "security-admin-session"
  });

  assert.equal(adminLogin.statusCode, 200);
  const sid = extractCookie(adminLogin.headers["set-cookie"], "sid");

  const createUserResponse = await app.inject({
    method: "POST",
    url: "/users",
    payload: {
      email: "analyst@example.com",
      username: "analyst",
      password: analystPassword,
      givenName: "Audit",
      familyName: "Analyst"
    }
  });

  assert.equal(createUserResponse.statusCode, 201);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedLogin = await login(app, {
      email: admin.email,
      password: "wrong-pass",
      userAgent: `lockout-attempt-${attempt}`
    });

    assert.equal(failedLogin.statusCode, 401);
  }

  const lockedLogin = await login(app, {
    email: admin.email,
    password: admin.password,
    userAgent: "lockout-after-threshold"
  });

  assert.equal(lockedLogin.statusCode, 401);
  assert.equal(lockedLogin.json().code, "account_locked");
  assert.match(lockedLogin.json().message, /temporarily locked/i);
  assert.match(lockedLogin.json().message, /try again in \d+ minutes?/i);

  const firstAnalystLogin = await login(app, {
    email: "analyst@example.com",
    password: analystPassword,
    userAgent: "analyst-browser-a"
  });

  assert.equal(firstAnalystLogin.statusCode, 200);

  const secondAnalystLogin = await login(app, {
    email: "analyst@example.com",
    password: analystPassword,
    userAgent: "analyst-browser-b"
  });

  assert.equal(secondAnalystLogin.statusCode, 200);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const recoveryAttempt = await app.inject({
      method: "POST",
      url: "/auth/recovery/request",
      payload: {
        identifier: "analyst@example.com",
        clientId: "sso-admin-ui"
      }
    });

    assert.equal(recoveryAttempt.statusCode, 200);
  }

  const rateLimitedRecovery = await app.inject({
    method: "POST",
    url: "/auth/recovery/request",
    payload: {
      identifier: "analyst@example.com",
      clientId: "sso-admin-ui"
    }
  });

  assert.equal(rateLimitedRecovery.statusCode, 429);
  assert.equal(rateLimitedRecovery.json().error, "rate_limited");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/api/admin/audit?limit=100",
    headers: {
      cookie: sid
    }
  });

  assert.equal(auditResponse.statusCode, 200);

  const events = auditResponse.json() as Array<{
    type: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }>;

  const lockoutEvent = events.find((event) => event.type === "account_lockout");
  assert.ok(lockoutEvent, "expected account_lockout event");
  assert.equal(lockoutEvent?.metadata?.identifier, admin.email);

  const anomalyEvent = events.find((event) => event.type === "session_anomaly_detected");
  assert.ok(anomalyEvent, "expected session_anomaly_detected event");
  assert.deepEqual(anomalyEvent?.metadata?.reasons, ["new_user_agent_for_user"]);

  const rateLimitEvent = events.find((event) => event.type === "security_rate_limit_blocked");
  assert.ok(rateLimitEvent, "expected security_rate_limit_blocked event");
  assert.equal(rateLimitEvent?.metadata?.endpointKey, "auth_recovery_request");
});

test("security hardening: introspection and logout responses do not leak sensitive details", async (t) => {
  const { app, admin } = await createTestContext("integration-security-sanitization");

  t.after(async () => {
    await app.close();
  });

  const client = await registerClient(app, { name: "Security Client" });

  const loginResponse = await login(app, {
    email: admin.email,
    password: admin.password,
    clientId: client.client_id,
    userAgent: "security-sanitization-browser"
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const tokenResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: client.client_id,
      client_secret: client.client_secret,
      scope: "openid profile"
    }
  });

  assert.equal(tokenResponse.statusCode, 200);
  const accessToken = String(tokenResponse.json().access_token);

  const failedIntrospection = await app.inject({
    method: "POST",
    url: "/oauth/introspect",
    payload: {
      token: accessToken,
      client_id: client.client_id,
      client_secret: "wrong-client-secret"
    }
  });

  assert.equal(failedIntrospection.statusCode, 401);
  assert.equal(failedIntrospection.json().message, "Token validation failed");
  assert.doesNotMatch(failedIntrospection.body, /invalid client credentials/i);

  const failedLogoutRedirect = await app.inject({
    method: "GET",
    url: `/oauth/logout?post_logout_redirect_uri=${encodeURIComponent("http://evil.example/logout")}`,
    headers: {
      cookie: sid
    }
  });

  assert.equal(failedLogoutRedirect.statusCode, 401);
  assert.equal(failedLogoutRedirect.json().message, "Authentication failed");
  assert.doesNotMatch(failedLogoutRedirect.body, /unregistered post-logout redirect/i);
});

test("security hardening: backchannel logout only revokes sessions owned by the authenticated client", async (t) => {
  const { app, admin } = await createTestContext("integration-security-backchannel");

  t.after(async () => {
    await app.close();
  });

  const clientA = await registerClient(app, { name: "Backchannel Client A" });
  const clientB = await registerClient(app, { name: "Backchannel Client B" });

  const loginResponse = await login(app, {
    email: admin.email,
    password: admin.password,
    clientId: clientA.client_id,
    userAgent: "backchannel-client-a-browser"
  });

  assert.equal(loginResponse.statusCode, 200);
  const loginBody = loginResponse.json() as { session: { id: string } };
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const wrongClientLogout = await app.inject({
    method: "POST",
    url: "/oauth/backchannel-logout",
    payload: {
      client_id: clientB.client_id,
      client_secret: clientB.client_secret,
      sid: loginBody.session.id
    }
  });

  assert.equal(wrongClientLogout.statusCode, 200);
  assert.equal(wrongClientLogout.json().revoked, 0);

  const sessionStillActive = await app.inject({
    method: "GET",
    url: "/api/admin/me",
    headers: {
      cookie: sid
    }
  });

  assert.equal(sessionStillActive.statusCode, 200);
});

test("security hardening: setup initialization is endpoint-rate-limited", async (t) => {
  const { app } = await createTestContext("integration-security-setup-throttle");

  t.after(async () => {
    await app.close();
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const setupAttempt = await app.inject({
      method: "POST",
      url: "/api/setup/initialize",
      payload: {
        name: "Admin User",
        email: `another-admin-${attempt}@example.com`,
        username: `admin_${attempt}`,
        password: "Another-Change-Me1"
      }
    });

    assert.equal(setupAttempt.statusCode, 422);
    assert.match(setupAttempt.body, /setup has already been completed/i);
  }

  const throttledAttempt = await app.inject({
    method: "POST",
    url: "/api/setup/initialize",
    payload: {
      name: "Admin User",
      email: "blocked-admin@example.com",
      username: "blocked_admin",
      password: "Another-Change-Me1"
    }
  });

  assert.equal(throttledAttempt.statusCode, 429);
  assert.equal(throttledAttempt.json().error, "rate_limited");
});

test("security hardening: frontend assets block path traversal", async (t) => {
  const { app } = await createTestContext("integration-security-asset-traversal");

  t.after(async () => {
    await app.close();
  });

  const traversalRequest = await app.inject({
    method: "GET",
    url: "/portal/assets/../../../etc/passwd"
  });

  assert.equal(traversalRequest.statusCode, 500);
  assert.equal(traversalRequest.json().error, "InternalServerError");
  assert.equal(traversalRequest.json().message, "Unexpected server error");
  assert.doesNotMatch(traversalRequest.body, /root:/i);
});