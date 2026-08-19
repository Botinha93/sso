import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

async function createAdminHeaders(
  app: Awaited<ReturnType<typeof createTestContext>>["app"],
  admin: Awaited<ReturnType<typeof createTestContext>>["admin"]
) {
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
  assert.equal(login.statusCode, 200, login.body);

  const sid = extractCookie(login.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  return {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": String(csrfResponse.json().csrf_token)
  };
}

test("login succeeds with both email and username for the same user", async (t) => {
  const { app, admin } = await createTestContext("integration-login-identifier");
  t.after(async () => {
    await app.close();
  });

  const headers = await createAdminHeaders(app, admin);
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "Ada.Lovelace@example.com",
      username: "Ada.Lovelace",
      password: "Change-Me-Now1!",
      givenName: "Ada",
      familyName: "Lovelace"
    }
  });
  assert.equal(created.statusCode, 201, created.body);

  const withEmail = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "ada.lovelace@example.com",
      password: "Change-Me-Now1!",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(withEmail.statusCode, 200, withEmail.body);

  const withUsername = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "ada.lovelace",
      password: "Change-Me-Now1!",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(withUsername.statusCode, 200, withUsername.body);

  const withUsernameCased = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "ADA.LOVELACE",
      password: "Change-Me-Now1!",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(withUsernameCased.statusCode, 200, withUsernameCased.body);
});

test("login with a colliding email/username string authenticates the user whose password matches", async (t) => {
  const { app, admin } = await createTestContext("integration-login-identifier-collision");
  t.after(async () => {
    await app.close();
  });

  const headers = await createAdminHeaders(app, admin);
  const emailOwner = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "shared@example.com",
      username: "email.owner",
      password: "Email-Owner-Pass1!",
      givenName: "Email",
      familyName: "Owner"
    }
  });
  assert.equal(emailOwner.statusCode, 201, emailOwner.body);

  const usernameOwner = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "username-owner@example.com",
      username: "shared@example.com",
      password: "Username-Owner-Pass1!",
      givenName: "Username",
      familyName: "Owner"
    }
  });
  assert.equal(usernameOwner.statusCode, 422, usernameOwner.body);

  const emailLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "shared@example.com",
      password: "Email-Owner-Pass1!",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(emailLogin.statusCode, 200, emailLogin.body);
  assert.ok(emailLogin.json().session?.id);
});
