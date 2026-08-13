import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function loginAs(
  app: Awaited<ReturnType<typeof createTestContext>>["app"],
  email: string,
  password: string
) {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email,
      password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
}

async function createAdminHeaders(
  app: Awaited<ReturnType<typeof createTestContext>>["app"],
  admin: { email: string; password: string }
) {
  const login = await loginAs(app, admin.email, admin.password);
  assert.equal(login.statusCode, 200, login.body);
  const sid = extractCookie(login.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  return {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": String(csrfResponse.json().csrf_token)
  };
}

async function enablePasswordExpiration(
  app: Awaited<ReturnType<typeof createTestContext>>["app"],
  headers: Record<string, string>,
  config: { days: number; warnDaysBefore: number }
) {
  const policiesResponse = await app.inject({
    method: "GET",
    url: "/api/admin/policies",
    headers
  });
  assert.equal(policiesResponse.statusCode, 200, policiesResponse.body);
  const policies = policiesResponse.json() as Array<{ id: string; key: string }>;
  const expiration = policies.find((policy) => policy.key === "password_expiration_days");
  assert.ok(expiration, "Expected password_expiration_days policy to exist");

  const assignment = await app.inject({
    method: "PUT",
    url: `/api/admin/policies/${expiration.id}/assignments`,
    headers,
    payload: {
      scopeType: "global",
      enabled: true,
      config
    }
  });
  assert.equal(assignment.statusCode, 200, assignment.body);
}

test("login and /me expose a password expiration warning with a change-password path", async (t) => {
  const { app, admin } = await createTestContext("integration-password-expiration-warning");
  t.after(async () => {
    await app.close();
  });

  const headers = await createAdminHeaders(app, admin);
  await enablePasswordExpiration(app, headers, { days: 90, warnDaysBefore: 14 });

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "expiring@example.com",
      username: "expiring.user",
      password: "Change-Me-Now1!",
      givenName: "Expiring",
      familyName: "User",
      customAttributes: {
        password_changed_at: new Date(Date.now() - 80 * MS_PER_DAY).toISOString()
      }
    }
  });
  assert.equal(created.statusCode, 201, created.body);

  const login = await loginAs(app, "expiring@example.com", "Change-Me-Now1!");
  assert.equal(login.statusCode, 200, login.body);
  const loginBody = login.json() as { passwordExpirationWarning?: { message?: string } };
  assert.equal(typeof loginBody.passwordExpirationWarning?.message, "string");
  assert.match(String(loginBody.passwordExpirationWarning?.message), /expires in/i);

  const sid = extractCookie(login.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const userHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": String(csrfResponse.json().csrf_token)
  };

  const portalMe = await app.inject({
    method: "GET",
    url: "/api/portal/me",
    headers: { cookie: sid }
  });
  assert.equal(portalMe.statusCode, 200, portalMe.body);
  assert.equal(typeof portalMe.json().passwordExpirationWarning?.message, "string");

  const adminMe = await app.inject({
    method: "GET",
    url: "/api/admin/me",
    headers: { cookie: sid }
  });
  assert.equal(adminMe.statusCode, 200, adminMe.body);
  assert.equal(typeof adminMe.json().passwordExpirationWarning?.message, "string");

  const changed = await app.inject({
    method: "POST",
    url: "/api/admin/change-password",
    headers: userHeaders,
    payload: {
      currentPassword: "Change-Me-Now1!",
      newPassword: "Change-Me-Next2!"
    }
  });
  assert.equal(changed.statusCode, 204, changed.body);

  const meAfterChange = await app.inject({
    method: "GET",
    url: "/api/portal/me",
    headers: { cookie: sid }
  });
  assert.equal(meAfterChange.statusCode, 200, meAfterChange.body);
  assert.equal(meAfterChange.json().passwordExpirationWarning, undefined);
});

test("expired passwords require a change on login", async (t) => {
  const { app, admin } = await createTestContext("integration-password-expiration-expired");
  t.after(async () => {
    await app.close();
  });

  const headers = await createAdminHeaders(app, admin);
  await enablePasswordExpiration(app, headers, { days: 90, warnDaysBefore: 14 });

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "expired@example.com",
      username: "expired.user",
      password: "Change-Me-Now1!",
      givenName: "Expired",
      familyName: "User",
      customAttributes: {
        password_changed_at: new Date(Date.now() - 120 * MS_PER_DAY).toISOString()
      }
    }
  });
  assert.equal(created.statusCode, 201, created.body);

  const login = await loginAs(app, "expired@example.com", "Change-Me-Now1!");
  assert.equal(login.statusCode, 202, login.body);
  const challenge = login.json() as { changePasswordTicket?: string; passwordChangeRequired?: boolean; message?: string };
  assert.equal(challenge.passwordChangeRequired, true);
  assert.equal(typeof challenge.changePasswordTicket, "string");
  assert.match(String(challenge.message), /expired/i);

  const updated = await app.inject({
    method: "POST",
    url: "/auth/login/change-password",
    payload: {
      changePasswordTicket: challenge.changePasswordTicket,
      newPassword: "Change-Me-Next2!",
      confirmPassword: "Change-Me-Next2!"
    }
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().passwordExpirationWarning, undefined);
});

test("SSO authorize shows password expiration before redirecting to the app", async (t) => {
  const { app, admin } = await createTestContext("integration-password-expiration-sso");
  t.after(async () => {
    await app.close();
  });

  const headers = await createAdminHeaders(app, admin);
  await enablePasswordExpiration(app, headers, { days: 90, warnDaysBefore: 14 });

  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload: {
      email: "sso-expiring@example.com",
      username: "sso.expiring",
      password: "Change-Me-Now1!",
      givenName: "Sso",
      familyName: "Expiring",
      customAttributes: {
        password_changed_at: new Date(Date.now() - 80 * MS_PER_DAY).toISOString()
      }
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const userId = String(created.json().id);

  const registered = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "SSO App",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile email"
    }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const clientId = String(registered.json().client_id);

  const login = await loginAs(app, "sso-expiring@example.com", "Change-Me-Now1!");
  assert.equal(login.statusCode, 200, login.body);
  const sid = extractCookie(login.headers["set-cookie"], "sid");
  const codeVerifier = "code-verifier-for-password-expiration-sso";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authorizeUrl = `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=sso-warn&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

  const blocked = await app.inject({
    method: "GET",
    url: authorizeUrl,
    headers: { cookie: sid }
  });
  assert.equal(blocked.statusCode, 302, blocked.body);
  const blockedLocation = String(blocked.headers.location);
  assert.match(blockedLocation, /\/password-expiration\?/);
  assert.match(blockedLocation, /client_id=/);
  assert.doesNotMatch(blockedLocation, /password_warning=continue/);

  const status = await app.inject({
    method: "GET",
    url: "/api/account/password-expiration",
    headers: { cookie: sid }
  });
  assert.equal(status.statusCode, 200, status.body);
  assert.equal(status.json().active, true);
  assert.equal(status.json().status, "warning");
  assert.equal(typeof status.json().message, "string");

  const continued = await app.inject({
    method: "GET",
    url: `${authorizeUrl}&password_warning=continue`,
    headers: { cookie: sid }
  });
  assert.equal(continued.statusCode, 302, continued.body);
  const continuedLocation = new URL(String(continued.headers.location), "http://localhost:3000");
  assert.equal(continuedLocation.origin + continuedLocation.pathname, "http://localhost:3000/callback");
  assert.ok(continuedLocation.searchParams.get("code"));

  const expireUser = await app.inject({
    method: "PATCH",
    url: `/api/admin/users/${userId}`,
    headers,
    payload: {
      customAttributes: {
        password_changed_at: new Date(Date.now() - 120 * MS_PER_DAY).toISOString()
      }
    }
  });
  assert.equal(expireUser.statusCode, 200, expireUser.body);

  const expiredBlocked = await app.inject({
    method: "GET",
    url: `${authorizeUrl}&password_warning=continue`,
    headers: { cookie: sid }
  });
  assert.equal(expiredBlocked.statusCode, 302, expiredBlocked.body);
  assert.match(String(expiredBlocked.headers.location), /\/password-expiration\?/);
});

