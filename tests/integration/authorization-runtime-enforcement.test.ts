import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("admin route enforcement applies RBAC prefilter and ABAC decision", async (t) => {
  const { app, admin } = await createTestContext("integration-authorization-runtime");
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

  const createPolicyResponse = await app.inject({
    method: "POST",
    url: "/api/admin/policies",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      key: "abac_admin_users_view_deny",
      name: "ABAC admin users view deny",
      description: "Blocks read access to admin users resource",
      category: "authorization",
      stageBindings: [],
      javascriptCode: "return false",
      enabled: true
    }
  });

  assert.equal(createPolicyResponse.statusCode, 201);
  const createdPolicy = createPolicyResponse.json() as { id: string };

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
        priority: 500,
        resourcePattern: "admin:users",
        actionPattern: "view"
      }
    }
  });

  assert.equal(assignmentResponse.statusCode, 200);

  const deniedUsersResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: {
      cookie: sid
    }
  });

  assert.equal(deniedUsersResponse.statusCode, 403);
  const deniedPayload = deniedUsersResponse.json() as { error: string; deniedBy?: string[] };
  assert.equal(deniedPayload.error, "forbidden");
  assert.ok(Array.isArray(deniedPayload.deniedBy));
  assert.ok(deniedPayload.deniedBy?.includes("abac_admin_users_view_deny"));

  const allowedRolesResponse = await app.inject({
    method: "GET",
    url: "/api/admin/roles",
    headers: {
      cookie: sid
    }
  });

  assert.equal(allowedRolesResponse.statusCode, 200);
});