import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";
import { hashPassword } from "../../src/security/password.js";

test("admin user creation rejects duplicate usernames with validation error", async (t) => {
  const { app, admin } = await createTestContext("integration-admin-users");

  t.after(async () => {
    await app.close();
  });

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
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);

  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const headers = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  const payload = {
    email: "first-user@example.com",
    username: "duplicate_user",
    password: "Change-Me-Now1!",
    givenName: "First",
    familyName: "User"
  };

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload
  });
  assert.equal(created.statusCode, 201);

  const duplicate = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      ...payload,
      email: "second-user@example.com"
    }
  });

  assert.equal(duplicate.statusCode, 422);
  assert.deepEqual(duplicate.json(), {
    error: "ValidationError",
    message: "A user with this username already exists"
  });
});

test("admin password reset rejects passwords that fail policy without crashing", async (t) => {
  const { app, admin } = await createTestContext("integration-admin-users-reset-password-policy");

  t.after(async () => {
    await app.close();
  });

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
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);

  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const headers = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "reset-target@example.com",
      username: "reset_target",
      password: "Change-Me-Now1!",
      givenName: "Reset",
      familyName: "Target"
    }
  });
  assert.equal(created.statusCode, 201);

  const reset = await app.inject({
    method: "POST",
    url: `/api/admin/users/${created.json().id}/reset-password`,
    headers,
    payload: {
      password: "Short123"
    }
  });

  assert.equal(reset.statusCode, 422);
  assert.deepEqual(reset.json(), {
    error: "ValidationError",
    message: "Password must be at least 12 characters"
  });
});

test("admin user creation accepts passwordHash for API migration", async (t) => {
  const { app, admin } = await createTestContext("integration-admin-users-password-hash");

  t.after(async () => {
    await app.close();
  });

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
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);

  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const headers = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  const importedPassword = "MigratedPassword1";
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "migrated-user@example.com",
      username: "migrated_user",
      passwordHash: hashPassword(importedPassword),
      givenName: "Migrated",
      familyName: "User"
    }
  });
  assert.equal(created.statusCode, 201);

  const importedLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "migrated-user@example.com",
      password: importedPassword,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(importedLogin.statusCode, 200);
});

test("user update does not overwrite username with the user's id", async (t) => {
  const { app, admin } = await createTestContext("integration-admin-users-username-id-guard");

  t.after(async () => {
    await app.close();
  });

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
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);

  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const headers = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "guarded-user@example.com",
      username: "guarded_user",
      password: "Change-Me-Now1!",
      givenName: "Guarded",
      familyName: "User"
    }
  });
  assert.equal(created.statusCode, 201);
  const userId = created.json().id as string;

  // Simulate an OIDC client echoing the `sub` (== user id) back as the
  // username via a profile sync. The username must be preserved.
  const updated = await app.inject({
    method: "PATCH",
    url: `/api/admin/users/${userId}`,
    headers,
    payload: {
      username: userId,
      givenName: "Still"
    }
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().username, "guarded_user");
  assert.equal(updated.json().givenName, "Still");
});
