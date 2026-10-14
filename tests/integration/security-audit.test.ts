import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("blocked SQL injection attempts are recorded in admin audit stream", async (t) => {
  const { app, admin } = await createTestContext("integration-security-audit");

  t.after(async () => {
    await app.close();
  });

  const blocked = await app.inject({
    method: "GET",
    url: "/health?q=1%20UNION%20SELECT%201"
  });

  assert.equal(blocked.statusCode, 400);

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/api/admin/audit",
    headers: {
      cookie: sid
    }
  });

  assert.equal(auditResponse.statusCode, 200);
  const events = auditResponse.json() as Array<{ type: string; metadata?: Record<string, unknown> }>;

  const found = events.find((event) => event.type === "security_sqli_blocked");
  assert.ok(found, "expected security_sqli_blocked event in audit stream");
  assert.equal(found?.metadata?.method, "GET");
});
