import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, getCsrf, loginAsAdmin, registerClientAsAdmin } from "../helpers/test-app.js";

type App = Awaited<ReturnType<typeof createTestContext>>["app"];

const login = (app: App, payload: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { scope: ["openid"], clientId: "sso-admin-ui", ...payload }
  });

const assertLoginError = (response: { statusCode: number; body: string; json: () => any }, status: number, reason: string) => {
  assert.equal(response.statusCode, status, response.body);
  assert.equal(response.json().reason, reason, response.body);
  assert.ok(response.json().message, response.body);
};

test("login on a misconfigured client answers 428 with a reason and does not count toward lockout", async (t) => {
  const { app, admin } = await createTestContext("integration-client-misconfiguration");
  t.after(async () => {
    await app.close();
  });

  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "Broken App",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "openid profile email"
  });
  assert.equal(registered.statusCode, 201);
  const { client_id: clientId } = registered.json() as { client_id: string };

  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  const update = await app.inject({
    method: "PUT",
    url: `/api/admin/clients/${clientId}`,
    headers: csrf.headers,
    payload: { allowedScopes: [] }
  });
  assert.equal(update.statusCode, 200);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await login(app, { email: admin.email, password: admin.password, clientId });
    assertLoginError(response, 428, "allowed_scopes_missing");
    assert.equal(response.json().error, "ClientMisconfiguredError");
  }

  // Six 428s would have tripped the lockout had they counted as failures.
  await loginAsAdmin(app, admin);
});

test("login errors carry a status and reason clients can act on", async (t) => {
  const { app, admin } = await createTestContext("integration-login-errors");
  t.after(async () => {
    await app.close();
  });

  assertLoginError(await login(app, { email: admin.email }), 422, "invalid_request");
  assertLoginError(await login(app, { email: admin.email, password: admin.password, clientId: "no-such-client" }), 404, "client_not_found");
  assertLoginError(await login(app, { email: admin.email, password: admin.password, tenantSlug: "no-such-tenant" }), 404, "tenant_not_found");

  // An unknown account and a wrong password must look identical.
  const unknownUser = await login(app, { email: "nobody@example.com", password: "Wrong-Password1" });
  const wrongPassword = await login(app, { email: admin.email, password: "Wrong-Password1" });
  assertLoginError(unknownUser, 401, "invalid_credentials");
  assertLoginError(wrongPassword, 401, "invalid_credentials");
  assert.equal(unknownUser.json().message, wrongPassword.json().message);

  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: csrf.headers,
    payload: { email: "disabled@example.com", username: "disabled", password: "Change-Me-Now1", givenName: "Dis", familyName: "Abled" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const deactivated = await app.inject({
    method: "PATCH",
    url: `/api/admin/users/${created.json().id}`,
    headers: csrf.headers,
    payload: { active: false }
  });
  assert.equal(deactivated.statusCode, 200, deactivated.body);

  // Disabled is only revealed once the password matched.
  assertLoginError(await login(app, { email: "disabled@example.com", password: "Change-Me-Now1" }), 403, "account_disabled");
  assertLoginError(await login(app, { email: "disabled@example.com", password: "Wrong-Password1" }), 401, "invalid_credentials");

  assertLoginError(
    await app.inject({ method: "POST", url: "/auth/login/mfa", payload: { mfaTicket: "not-a-real-ticket", code: "123456" } }),
    401,
    "mfa_ticket_invalid"
  );
  assertLoginError(
    await app.inject({
      method: "POST",
      url: "/auth/login/change-password",
      payload: { changePasswordTicket: "not-a-real-ticket", newPassword: "Another-Pass1" }
    }),
    401,
    "password_change_ticket_invalid"
  );
  assertLoginError(
    await app.inject({ method: "POST", url: "/auth/login/webauthn/begin", payload: { identifier: "nobody@example.com" } }),
    401,
    "webauthn_not_available"
  );
  assertLoginError(
    await app.inject({
      method: "POST",
      url: "/auth/login/webauthn/finish",
      payload: { loginId: "not-a-real-login", credentialId: "not-a-real-credential-id" }
    }),
    401,
    "webauthn_transaction_invalid"
  );
});

test("a locked account answers 423 with Retry-After", async (t) => {
  const { app, admin } = await createTestContext("integration-login-lockout-status");
  t.after(async () => {
    await app.close();
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assertLoginError(await login(app, { email: admin.email, password: "Wrong-Password1" }), 401, "invalid_credentials");
  }

  const locked = await login(app, { email: admin.email, password: admin.password });
  assertLoginError(locked, 423, "account_locked");
  assert.equal(locked.json().code, "account_locked");
  assert.ok(Number(locked.headers["retry-after"]) > 0);
});
