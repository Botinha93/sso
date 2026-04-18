import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const analystPassword = "Change-Me-Now1";

const login = async (app: Awaited<ReturnType<typeof createTestContext>>["app"], input: {
  email: string;
  password: string;
  userAgent?: string;
}) => {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    headers: input.userAgent ? { "user-agent": input.userAgent } : undefined,
    payload: {
      email: input.email,
      password: input.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
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
  assert.match(lockedLogin.body, /temporarily locked/i);

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