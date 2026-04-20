import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const loginAsAdmin = async (app: Awaited<ReturnType<typeof createTestContext>>["app"], admin: { username: string; password: string }) => {
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

  return {
    cookies: `${sid}; ${csrfCookie}`,
    csrfToken
  };
};

test("SCIM endpoints require a valid bearer provisioning token", async (t) => {
  const { app, admin } = await createTestContext("integration-scim-token-auth");
  t.after(async () => {
    await app.close();
  });

  const missingTokenResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig"
  });

  assert.equal(missingTokenResponse.statusCode, 401);
  assert.equal(missingTokenResponse.json().detail, "Missing SCIM bearer token");

  const invalidTokenResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig",
    headers: {
      authorization: "Bearer invalid"
    }
  });

  assert.equal(invalidTokenResponse.statusCode, 401);
  assert.equal(invalidTokenResponse.json().detail, "Invalid SCIM bearer token");

  const adminAuth = await loginAsAdmin(app, admin);

  const createTokenResponse = await app.inject({
    method: "POST",
    url: "/api/admin/provisioning/tokens",
    headers: {
      cookie: adminAuth.cookies,
      "x-csrf-token": adminAuth.csrfToken
    },
    payload: {
      label: "integration-scim-bearer"
    }
  });

  assert.equal(createTokenResponse.statusCode, 201);
  const createdToken = createTokenResponse.json() as { id: string; token: string };

  const validTokenResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig",
    headers: {
      authorization: `Bearer ${createdToken.token}`
    }
  });

  assert.equal(validTokenResponse.statusCode, 200);

  const revokeTokenResponse = await app.inject({
    method: "DELETE",
    url: `/api/admin/provisioning/tokens/${createdToken.id}`,
    headers: {
      cookie: adminAuth.cookies,
      "x-csrf-token": adminAuth.csrfToken
    }
  });

  assert.equal(revokeTokenResponse.statusCode, 204);

  const revokedTokenResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig",
    headers: {
      authorization: `Bearer ${createdToken.token}`
    }
  });

  assert.equal(revokedTokenResponse.statusCode, 401);
  assert.equal(revokedTokenResponse.json().detail, "Invalid SCIM bearer token");
});
