import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("high-risk login requires prompt acknowledgement when risk_check is enabled", async (t) => {
  const { app, admin } = await createTestContext("integration-risk-adaptive-login");
  const riskIp = "198.51.100.10";

  t.after(async () => {
    await app.close();
  });

  const adminLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "x-forwarded-for": riskIp },
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(adminLogin.statusCode, 200);

  const sid = extractCookie(adminLogin.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({ method: "GET", url: "/api/csrf-token", headers: { cookie: sid } });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);

  const flowsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/authentication/flows",
    headers: {
      cookie: `${sid}; ${csrfCookie}`
    }
  });
  assert.equal(flowsResponse.statusCode, 200);
  const flows = flowsResponse.json() as Array<{
    id: string;
    designation: string;
    enabled: boolean;
    name: string;
    description: string;
    grantTypes: string[];
    stages: Array<{ type: string; required: boolean; order: number }>;
  }>;

  const activeAuthFlow = flows.find((flow) => flow.designation === "authentication" && flow.enabled);
  assert.ok(activeAuthFlow);

  const hasRiskCheck = activeAuthFlow!.stages.some((stage) => stage.type === "risk_check");
  const nextStages = hasRiskCheck
    ? activeAuthFlow!.stages
    : [
        ...activeAuthFlow!.stages,
        { type: "risk_check", required: true, order: activeAuthFlow!.stages.length + 1 }
      ];

  const flowUpdate = await app.inject({
    method: "PUT",
    url: `/api/admin/authentication/flows/${activeAuthFlow!.id}`,
    headers: {
      cookie: `${sid}; ${csrfCookie}`,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: activeAuthFlow!.name,
      description: activeAuthFlow!.description,
      designation: "authentication",
      enabled: true,
      grantTypes: activeAuthFlow!.grantTypes,
      stages: nextStages
    }
  });
  assert.equal(flowUpdate.statusCode, 200);

  // Build up recent IP risk events via repeated failed password-grant attempts.
  for (let i = 0; i < 10; i += 1) {
    const failed = await app.inject({
      method: "POST",
      url: "/oauth/token",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": riskIp
      },
      payload: {
        grant_type: "password",
        username: `unknown-user-${i}@example.com`,
        password: "invalid-password",
        client_id: "sso-admin-ui",
        client_secret: "invalid-secret",
        scope: "openid profile email"
      }
    });
    assert.ok(failed.statusCode >= 400);
  }

  const challenged = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "x-forwarded-for": riskIp },
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(challenged.statusCode, 401);
  assert.match(challenged.body, /elevated risk|verification required/i);

  const acknowledged = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "x-forwarded-for": riskIp },
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"],
      promptAcknowledged: true
    }
  });

  assert.equal(acknowledged.statusCode, 200);
});
