import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("webauthn registration and login flow", async (t) => {
  const { app, admin } = await createTestContext("integration-webauthn");

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
    headers: {
      cookie: sid
    }
  });

  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authCookie = `${sid}; ${csrfCookie}`;

  const beginRegistration = await app.inject({
    method: "POST",
    url: "/api/account/mfa/webauthn/register/begin",
    headers: {
      cookie: authCookie,
      "x-csrf-token": csrfToken
    },
    payload: {}
  });

  assert.equal(beginRegistration.statusCode, 200);
  const registrationPayload = beginRegistration.json() as { registrationId: string };

  const credentialId = "integration-passkey-1";

  const finishRegistration = await app.inject({
    method: "POST",
    url: "/api/account/mfa/webauthn/register/finish",
    headers: {
      cookie: authCookie,
      "x-csrf-token": csrfToken
    },
    payload: {
      registrationId: registrationPayload.registrationId,
      credentialId,
      publicKey: "integration-public-key",
      transports: ["internal"],
      signCount: 0
    }
  });

  assert.equal(finishRegistration.statusCode, 200);

  const beginLogin = await app.inject({
    method: "POST",
    url: "/auth/login/webauthn/begin",
    payload: {
      identifier: admin.email,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(beginLogin.statusCode, 200);
  const beginLoginPayload = beginLogin.json() as { loginId: string };

  const finishLogin = await app.inject({
    method: "POST",
    url: "/auth/login/webauthn/finish",
    payload: {
      loginId: beginLoginPayload.loginId,
      credentialId,
      signCount: 1
    }
  });

  assert.equal(finishLogin.statusCode, 200);

  const listCredentials = await app.inject({
    method: "GET",
    url: "/api/account/mfa/webauthn/credentials",
    headers: {
      cookie: authCookie
    }
  });

  assert.equal(listCredentials.statusCode, 200);
  const listPayload = listCredentials.json() as Array<{ credentialId: string; signCount: number }>;
  assert.equal(listPayload.length, 1);
  assert.equal(listPayload[0]?.credentialId, credentialId);
  assert.equal(listPayload[0]?.signCount, 1);
});
