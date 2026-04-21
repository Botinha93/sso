import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("Non-functional: token issuance and policy decision throughput baseline", async (t) => {
  const { app, admin } = await createTestContext("nf-throughput");

  t.after(async () => {
    await app.close();
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Throughput Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["client_credentials"],
      response_types: ["token"],
      scope: "openid profile email"
    }
  });

  assert.equal(registerResponse.statusCode, 201);
  const registeredClient = registerResponse.json() as { client_id: string; client_secret: string };

  const tokenRequests = 60;
  const tokenStart = performance.now();
  const tokenResponses = await Promise.all(
    Array.from({ length: tokenRequests }, () => app.inject({
      method: "POST",
      url: "/oauth/token",
      payload: {
        grant_type: "client_credentials",
        client_id: registeredClient.client_id,
        client_secret: registeredClient.client_secret,
        scope: "openid profile"
      }
    }))
  );
  const tokenDurationMs = performance.now() - tokenStart;

  for (const response of tokenResponses) {
    assert.equal(response.statusCode, 200);
  }

  const tokenThroughput = tokenRequests / (tokenDurationMs / 1000);
  assert.ok(Number.isFinite(tokenThroughput));
  assert.ok(tokenThroughput > 5, `Token throughput too low: ${tokenThroughput.toFixed(2)} req/s`);

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(login.statusCode, 200);

  const sid = extractCookie(login.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({ method: "GET", url: "/api/csrf-token", headers: { cookie: sid } });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  const usersResp = await app.inject({ method: "GET", url: "/api/admin/users", headers: { cookie: authHeaders.cookie } });
  assert.equal(usersResp.statusCode, 200);
  const usersPayload = usersResp.json() as { data: Array<{ id: string; email: string }> };
  const adminUser = usersPayload.data.find((user) => user.email === admin.email);
  assert.ok(adminUser, "Expected admin user to be present in user list");

  const policyRequests = 80;
  const policyStart = performance.now();
  const policyResponses = await Promise.all(
    Array.from({ length: policyRequests }, (_, index) => app.inject({
      method: "POST",
      url: "/api/admin/authorization/check",
      headers: authHeaders,
      payload: {
        userId: adminUser?.id,
        resource: `throughput:resource:${index}`,
        action: "read",
        context: { source: "non-functional-test" }
      }
    }))
  );
  const policyDurationMs = performance.now() - policyStart;

  for (const response of policyResponses) {
    assert.equal(response.statusCode, 200);
  }

  const policyThroughput = policyRequests / (policyDurationMs / 1000);
  assert.ok(Number.isFinite(policyThroughput));
  assert.ok(policyThroughput > 5, `Policy decision throughput too low: ${policyThroughput.toFixed(2)} req/s`);
});
