import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("E2E: admin creates authorization policy, simulation denies, live route is enforced", async (t) => {
  const { app, admin } = await createTestContext("e2e-admin-policy-enforcement");
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
      key: "e2e_admin_users_deny",
      name: "E2E admin users deny",
      description: "Deny read access to admin users resource",
      category: "authorization",
      stageBindings: [],
      javascriptCode: "return false",
      enabled: true
    }
  });

  assert.equal(createPolicyResponse.statusCode, 201);
  const createdPolicy = createPolicyResponse.json() as { id: string; category: string };
  assert.equal(createdPolicy.category, "authorization");

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
        priority: 400,
        resourcePattern: "admin:users",
        actionPattern: "view"
      }
    }
  });

  assert.equal(assignmentResponse.statusCode, 200);

  const simulateResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies/evaluate",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: adminUser.id,
      resource: "admin:users",
      action: "view",
      decisionStrategy: "deny_overrides",
      context: {
        path: "/api/admin/users",
        method: "GET"
      }
    }
  });

  assert.equal(simulateResponse.statusCode, 200);
  const simulateBody = simulateResponse.json() as { allow: boolean; deniedBy: string[] };
  assert.equal(simulateBody.allow, false);
  assert.ok(simulateBody.deniedBy.includes("e2e_admin_users_deny"));

  const deniedUsersResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: {
      cookie: sid
    }
  });

  assert.equal(deniedUsersResponse.statusCode, 403);
  const deniedBody = deniedUsersResponse.json() as { error: string; deniedBy?: string[] };
  assert.equal(deniedBody.error, "forbidden");
  assert.ok(Array.isArray(deniedBody.deniedBy));
  assert.ok(deniedBody.deniedBy?.includes("e2e_admin_users_deny"));
});