import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("policy evaluation endpoint simulates authorization decisions", async (t) => {
  const { app, admin } = await createTestContext("integration-policy-evaluate");
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

  const usersResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: {
      cookie: sid
    }
  });

  assert.equal(usersResponse.statusCode, 200);
  const users = usersResponse.json() as Array<{ id: string; email: string }>;
  const adminUser = users.find((user) => user.email === admin.email);
  assert.ok(adminUser, "Expected seeded admin user to exist");

  const createPolicyResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      key: "abac_finance_write_guard",
      name: "ABAC finance write guard",
      description: "Deny write action to finance resources",
      stageBindings: [],
      javascriptCode: `
if (policy.request.action === 'write' && String(policy.request.resource).startsWith('finance:')) {
  return { allow: false, message: 'Finance write is blocked by ABAC policy' }
}

return true
`,
      enabled: true
    }
  });

  assert.equal(createPolicyResponse.statusCode, 201);
  const createdPolicy = createPolicyResponse.json() as { id: string; category?: string };
  assert.equal(createdPolicy.category, "authorization");

  const listPoliciesResponse = await app.inject({
    method: "GET",
    url: "/api/admin/policies",
    headers: {
      cookie: sid
    }
  });
  assert.equal(listPoliciesResponse.statusCode, 200);
  const policies = listPoliciesResponse.json() as Array<{ id: string; category?: string }>;
  const listedPolicy = policies.find((item) => item.id === createdPolicy.id);
  assert.ok(listedPolicy);
  assert.equal(listedPolicy?.category, "authorization");

  const assignmentResponse = await app.inject({
    method: "PUT",
    url: `/api/admin/policies/${createdPolicy.id}/assignments`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      scopeType: "global",
      enabled: true,
      config: {
        effect: "deny",
        priority: 100,
        resourcePattern: "finance:*",
        actionPattern: "write"
      }
    }
  });

  assert.equal(assignmentResponse.statusCode, 200);

  const denyResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "write",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(denyResponse.statusCode, 200);
  const denyResult = denyResponse.json() as {
    allow: boolean;
    deniedBy: string[];
    decisions: Array<{ key: string; allow: boolean }>;
  };

  assert.equal(denyResult.allow, false);
  assert.ok(denyResult.deniedBy.includes("abac_finance_write_guard"));
  assert.ok(denyResult.decisions.some((decision) => decision.key === "abac_finance_write_guard" && decision.allow === false));

  const createAllowPolicyResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      key: "abac_finance_write_allow_override",
      name: "ABAC finance write allow override",
      description: "Allow write action to finance resources",
      stageBindings: [],
      javascriptCode: `
if (policy.request.action === 'write' && String(policy.request.resource).startsWith('finance:')) {
  return true
}

return false
`,
      enabled: true
    }
  });

  assert.equal(createAllowPolicyResponse.statusCode, 201);
  const allowOverridePolicy = createAllowPolicyResponse.json() as { id: string };

  const allowAssignmentResponse = await app.inject({
    method: "PUT",
    url: `/api/admin/policies/${allowOverridePolicy.id}/assignments`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      scopeType: "global",
      enabled: true,
      config: {
        effect: "allow",
        priority: 10
      }
    }
  });

  assert.equal(allowAssignmentResponse.statusCode, 200);

  const allowOverrideResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "write",
      decisionStrategy: "allow_overrides",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(allowOverrideResponse.statusCode, 200);
  const allowOverrideResult = allowOverrideResponse.json() as {
    decisionStrategy: string;
    allow: boolean;
    deniedBy: string[];
    decisions: Array<{ key: string; effect: string; priority: number; applied: boolean; allow: boolean }>;
  };

  assert.equal(allowOverrideResult.decisionStrategy, "allow_overrides");
  assert.equal(allowOverrideResult.allow, true);
  assert.equal(allowOverrideResult.deniedBy.length, 0);
  assert.ok(allowOverrideResult.decisions.some((decision) => decision.key === "abac_finance_write_guard" && decision.effect === "deny" && decision.applied && decision.allow === false));
  assert.ok(allowOverrideResult.decisions.some((decision) => decision.key === "abac_finance_write_allow_override" && decision.effect === "allow" && decision.applied && decision.allow === true));

  const denyOverridesResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "write",
      decisionStrategy: "deny_overrides",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(denyOverridesResponse.statusCode, 200);
  const denyOverridesResult = denyOverridesResponse.json() as {
    decisionStrategy: string;
    allow: boolean;
    deniedBy: string[];
    decisions: Array<{ key: string; effect: string; priority: number; applied: boolean; allow: boolean }>;
  };
  assert.equal(denyOverridesResult.decisionStrategy, "deny_overrides");
  assert.equal(denyOverridesResult.allow, false);
  assert.ok(denyOverridesResult.deniedBy.includes("abac_finance_write_guard"));
  assert.ok(denyOverridesResult.decisions.some((decision) => decision.key === "abac_finance_write_guard" && decision.effect === "deny" && decision.priority === 100 && decision.applied && decision.allow === false));
  assert.ok(denyOverridesResult.decisions.some((decision) => decision.key === "abac_finance_write_allow_override" && decision.effect === "allow" && decision.priority === 10 && decision.applied && decision.allow === true));

  const firstApplicableResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "write",
      decisionStrategy: "first_applicable",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(firstApplicableResponse.statusCode, 200);
  const firstApplicableResult = firstApplicableResponse.json() as { allow: boolean; deniedBy: string[] };
  assert.equal(firstApplicableResult.allow, false);
  assert.ok(firstApplicableResult.deniedBy.includes("abac_finance_write_guard"));

  const allowResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "read",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(allowResponse.statusCode, 200);
  const allowResult = allowResponse.json() as {
    allow: boolean;
    deniedBy: string[];
    decisions: Array<{ key: string; applied: boolean; message?: string }>;
  };

  assert.equal(allowResult.allow, true);
  assert.equal(allowResult.deniedBy.length, 0);
  const denyDecisionOnRead = allowResult.decisions.find((decision) => decision.key === "abac_finance_write_guard");
  assert.ok(denyDecisionOnRead, "Expected deny policy decision to be present for read flow");
  assert.equal(denyDecisionOnRead?.applied, false);
  assert.match(String(denyDecisionOnRead?.message ?? ""), /actionPattern/i);

  const authCheckResponse = await app.inject({
    method: "POST",
    url: "/api/admin/authorization/check",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "finance:invoice:123",
      action: "write",
      context: {
        department: "finance"
      }
    }
  });

  assert.equal(authCheckResponse.statusCode, 200);
  const authCheckResult = authCheckResponse.json() as {
    allow: boolean;
    deniedBy: string[];
  };
  assert.equal(authCheckResult.allow, false);
  assert.ok(authCheckResult.deniedBy.includes("abac_finance_write_guard"));

  const historyResponse = await app.inject({
    method: "GET",
    url: "/api/admin/policies/decisions?limit=10",
    headers: {
      cookie: sid
    }
  });

  assert.equal(historyResponse.statusCode, 200);
  const history = historyResponse.json() as Array<{
    resource: string;
    action: string;
    allow: boolean;
    source?: string;
  }>;

  assert.ok(history.some((entry) => entry.resource === "finance:invoice:123" && entry.action === "write" && entry.allow === false));
  assert.ok(history.some((entry) => entry.resource === "finance:invoice:123" && entry.action === "read" && entry.allow === true));
  assert.ok(history.some((entry) => entry.source === "authorization_check" && entry.resource === "finance:invoice:123"));
});
