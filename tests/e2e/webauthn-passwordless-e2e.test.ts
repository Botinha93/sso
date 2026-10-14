import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("E2E: enrolled user can complete passwordless WebAuthn login", async (t) => {
  const { app, admin } = await createTestContext("e2e-webauthn-passwordless");

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
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(login.statusCode, 200);
  const sid = extractCookie(login.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid },
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
      "x-csrf-token": csrfToken,
    },
    payload: {},
  });

  assert.equal(beginRegistration.statusCode, 200);
  const registration = beginRegistration.json() as { registrationId: string };

  const credentialId = "e2e-passkey-credential-0001";

  const finishRegistration = await app.inject({
    method: "POST",
    url: "/api/account/mfa/webauthn/register/finish",
    headers: {
      cookie: authCookie,
      "x-csrf-token": csrfToken,
    },
    payload: {
      registrationId: registration.registrationId,
      credentialId,
      publicKey: "e2e-public-key-material-0001",
      transports: ["internal"],
      signCount: 0,
    },
  });

  assert.equal(finishRegistration.statusCode, 200);

  const beginPasswordless = await app.inject({
    method: "POST",
    url: "/auth/login/webauthn/begin",
    payload: {
      identifier: admin.email,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(beginPasswordless.statusCode, 200);
  const beginPayload = beginPasswordless.json() as { loginId: string };

  const finishPasswordless = await app.inject({
    method: "POST",
    url: "/auth/login/webauthn/finish",
    payload: {
      loginId: beginPayload.loginId,
      credentialId,
      signCount: 1,
    },
  });

  assert.equal(finishPasswordless.statusCode, 200);
  const tokenPayload = finishPasswordless.json() as { accessToken?: string; access_token?: string };
  const accessToken = tokenPayload.accessToken ?? tokenPayload.access_token;
  assert.ok(typeof accessToken === "string" && accessToken.length > 20);

  const userInfo = await app.inject({
    method: "GET",
    url: "/oauth/userinfo",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(userInfo.statusCode, 200);
  const userInfoPayload = userInfo.json() as { email?: string };
  assert.equal(userInfoPayload.email, admin.email);
});
