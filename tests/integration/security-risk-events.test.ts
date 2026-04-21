import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("admin risk-events endpoint lists security-relevant audit records", async (t) => {
  const { app, admin } = await createTestContext("integration-security-risk-events");
  t.after(async () => {
    await app.close();
  });

  const failedLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
      password: "wrong-password",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(failedLoginResponse.statusCode, 401);

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

  const riskEventsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/security/risk-events?limit=20",
    headers: { cookie: sid }
  });

  assert.equal(riskEventsResponse.statusCode, 200);
  const riskEvents = riskEventsResponse.json() as Array<{
    sourceType: string;
    severity: string;
    title: string;
    createdAt: string;
  }>;

  assert.equal(Array.isArray(riskEvents), true);
  assert.equal(riskEvents.some((event) => event.sourceType === "login_failed"), true);
  const loginFailedEvent = riskEvents.find((event) => event.sourceType === "login_failed");
  assert.ok(loginFailedEvent);
  assert.equal(loginFailedEvent?.severity, "medium");
  assert.match(String(loginFailedEvent?.title), /failed login/i);
});
