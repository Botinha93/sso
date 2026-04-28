import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("OAuth grant enforcement across authorize/token/device/token-exchange paths", async (t) => {
  const { app, admin } = await createTestContext("integration-grant-enforcement");
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

  const limited = {
    client_id: "sso-admin-ui",
    client_secret: "super-secret-admin-client"
  };

  const codeVerifier = "grant-enforcement-verifier";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const authCodeResponse = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(limited.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=enforce-state&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(authCodeResponse.statusCode, 302);
  const authCodeRedirect = new URL(String(authCodeResponse.headers.location));
  const code = authCodeRedirect.searchParams.get("code");
  assert.ok(code);

  const exchangeResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "authorization_code",
      code,
      client_id: limited.client_id,
      client_secret: limited.client_secret,
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier
    }
  });
  assert.equal(exchangeResponse.statusCode, 200);

  const disallowedClientCredentials = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: limited.client_id,
      client_secret: limited.client_secret
    }
  });
  assert.equal(disallowedClientCredentials.statusCode, 401);

  const disallowedPassword = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: limited.client_id,
      client_secret: limited.client_secret
    }
  });
  assert.equal(disallowedPassword.statusCode, 401);

  const disallowedDeviceAuthorize = await app.inject({
    method: "POST",
    url: "/oauth/device/authorize",
    payload: {
      client_id: limited.client_id,
      client_secret: limited.client_secret
    }
  });
  assert.equal(disallowedDeviceAuthorize.statusCode, 401);

  const machineRegister = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Machine Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["client_credentials"],
      response_types: ["code"],
      scope: "openid profile email"
    }
  });
  assert.equal(machineRegister.statusCode, 201);
  const machine = machineRegister.json() as { client_id: string; client_secret: string };

  const machineAuthorize = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(machine.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile")}&state=machine-state&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(machineAuthorize.statusCode, 401);

  const machineClientCredentials = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: machine.client_id,
      client_secret: machine.client_secret
    }
  });
  assert.equal(machineClientCredentials.statusCode, 200);

  const passwordOnlyRegister = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Password Only Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["password"],
      response_types: ["code"],
      scope: "openid profile email"
    }
  });
  assert.equal(passwordOnlyRegister.statusCode, 201);
  const passwordOnly = passwordOnlyRegister.json() as { client_id: string; client_secret: string };

  const passwordOnlyToken = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: passwordOnly.client_id,
      client_secret: passwordOnly.client_secret,
      scope: "openid profile email"
    }
  });
  assert.equal(passwordOnlyToken.statusCode, 200);
  const passwordOnlyTokens = passwordOnlyToken.json() as { refresh_token?: string };
  assert.ok(passwordOnlyTokens.refresh_token);

  const passwordRefreshDenied = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "refresh_token",
      refresh_token: String(passwordOnlyTokens.refresh_token),
      client_id: passwordOnly.client_id,
      client_secret: passwordOnly.client_secret
    }
  });
  assert.equal(passwordRefreshDenied.statusCode, 401);

  const deviceOnlyRegister = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Device Only Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["device_code"],
      response_types: ["code"],
      scope: "openid profile email"
    }
  });
  assert.equal(deviceOnlyRegister.statusCode, 201);
  const deviceOnly = deviceOnlyRegister.json() as { client_id: string; client_secret: string };

  const deviceOnlyAuthorize = await app.inject({
    method: "POST",
    url: "/oauth/device/authorize",
    payload: {
      client_id: deviceOnly.client_id,
      client_secret: deviceOnly.client_secret,
      scope: "openid profile"
    }
  });
  assert.equal(deviceOnlyAuthorize.statusCode, 200);

  const subjectTokenResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: "sso-password-cli",
      client_secret: "super-secret-password-client",
      scope: "openid profile email"
    }
  });
  assert.equal(subjectTokenResponse.statusCode, 200);
  const subjectTokenPayload = subjectTokenResponse.json() as { access_token: string };

  const exchangeDenied = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: subjectTokenPayload.access_token,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      client_id: machine.client_id,
      client_secret: machine.client_secret,
      scope: "openid profile",
      audience: "internal-api"
    }
  });
  assert.equal(exchangeDenied.statusCode, 401);
  const exchangeDeniedPayload = exchangeDenied.json() as { error: string; error_description?: string };
  assert.equal(exchangeDeniedPayload.error, "invalid_client");
  assert.match(String(exchangeDeniedPayload.error_description), /token_exchange/);
});

test("OAuth endpoint supports hybrid, jwt-bearer, saml2-bearer, and ciba grants", async (t) => {
  const { app, admin } = await createTestContext("integration-advanced-grants");
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

  const advancedRegister = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Advanced Grants Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["authorization_code", "jwt_bearer", "saml2_bearer", "ciba"],
      response_types: ["code", "token", "code token", "code id_token", "id_token token", "code id_token token"],
      scope: "openid profile email"
    }
  });
  assert.equal(advancedRegister.statusCode, 201);
  const advancedClient = advancedRegister.json() as { client_id: string; client_secret: string };

  const codeVerifier = "hybrid-flow-verifier";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const hybridAuthorize = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=${encodeURIComponent("code token")}&response_mode=fragment&client_id=${encodeURIComponent(advancedClient.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=hybrid-state&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(hybridAuthorize.statusCode, 302);
  const hybridRedirect = String(hybridAuthorize.headers.location);
  assert.ok(hybridRedirect.includes("#"));
  const hybridFragment = new URLSearchParams(hybridRedirect.split("#")[1] ?? "");
  assert.ok(hybridFragment.get("code"));
  assert.ok(hybridFragment.get("access_token"));

  const hybridCodeIdToken = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=${encodeURIComponent("code id_token")}&response_mode=fragment&client_id=${encodeURIComponent(advancedClient.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=hybrid-idtoken-state&nonce=n-12345&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(hybridCodeIdToken.statusCode, 302);
  const codeIdTokenFragment = new URLSearchParams(String(hybridCodeIdToken.headers.location).split("#")[1] ?? "");
  assert.ok(codeIdTokenFragment.get("code"));
  assert.ok(codeIdTokenFragment.get("id_token"));

  const hybridIdTokenToken = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=${encodeURIComponent("id_token token")}&response_mode=fragment&client_id=${encodeURIComponent(advancedClient.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=hybrid-idtoken-token-state&nonce=n-67890&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(hybridIdTokenToken.statusCode, 302);
  const idTokenTokenFragment = new URLSearchParams(String(hybridIdTokenToken.headers.location).split("#")[1] ?? "");
  assert.ok(idTokenTokenFragment.get("id_token"));
  assert.ok(idTokenTokenFragment.get("access_token"));

  const hybridAll = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=${encodeURIComponent("code id_token token")}&response_mode=fragment&client_id=${encodeURIComponent(advancedClient.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=hybrid-all-state&nonce=n-abcdef&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(hybridAll.statusCode, 302);
  const allFragment = new URLSearchParams(String(hybridAll.headers.location).split("#")[1] ?? "");
  assert.ok(allFragment.get("code"));
  assert.ok(allFragment.get("id_token"));
  assert.ok(allFragment.get("access_token"));

  const subjectTokenResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: "sso-password-cli",
      client_secret: "super-secret-password-client",
      scope: "openid profile email"
    }
  });
  assert.equal(subjectTokenResponse.statusCode, 200);
  const subjectTokenPayload = subjectTokenResponse.json() as { access_token: string };

  const jwtBearerResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: subjectTokenPayload.access_token,
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret,
      scope: "openid profile"
    }
  });
  assert.equal(jwtBearerResponse.statusCode, 200);
  const jwtBearerPayload = jwtBearerResponse.json() as { access_token?: string };
  assert.ok(jwtBearerPayload.access_token);

  const samlAssertionXml = `<saml:Assertion xmlns:saml=\"urn:oasis:names:tc:SAML:2.0:assertion\"><saml:Subject><saml:NameID>${admin.username}</saml:NameID></saml:Subject></saml:Assertion>`;
  const samlBearerResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:saml2-bearer",
      assertion: Buffer.from(samlAssertionXml, "utf8").toString("base64"),
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret,
      scope: "openid profile"
    }
  });
  assert.equal(samlBearerResponse.statusCode, 200);
  const samlBearerPayload = samlBearerResponse.json() as { access_token?: string };
  assert.ok(samlBearerPayload.access_token);

  const cibaAuthResponse = await app.inject({
    method: "POST",
    url: "/oauth/ciba/authenticate",
    payload: {
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret,
      login_hint: admin.username,
      scope: "openid profile"
    }
  });
  assert.equal(cibaAuthResponse.statusCode, 200);
  const cibaAuthPayload = cibaAuthResponse.json() as { auth_req_id: string };
  assert.ok(cibaAuthPayload.auth_req_id);

  const cibaApproval = await app.inject({
    method: "POST",
    url: "/oauth/ciba/approve",
    payload: {
      auth_req_id: cibaAuthPayload.auth_req_id,
      username: admin.username,
      password: admin.password,
      approve: true
    }
  });
  assert.equal(cibaApproval.statusCode, 200);

  const cibaTokenResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: cibaAuthPayload.auth_req_id,
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret
    }
  });
  assert.equal(cibaTokenResponse.statusCode, 200);
  const cibaTokenPayload = cibaTokenResponse.json() as { access_token?: string };
  assert.ok(cibaTokenPayload.access_token);

  const cibaPingResponse = await app.inject({
    method: "POST",
    url: "/oauth/ciba/authenticate",
    payload: {
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret,
      login_hint: admin.username,
      requested_delivery_mode: "ping",
      client_notification_endpoint: "https://client.example.com/ciba-notify"
    }
  });
  assert.equal(cibaPingResponse.statusCode, 200);
  const cibaPingPayload = cibaPingResponse.json() as { auth_req_id: string };

  const cibaPingApproval = await app.inject({
    method: "POST",
    url: "/oauth/ciba/approve",
    payload: {
      auth_req_id: cibaPingPayload.auth_req_id,
      username: admin.username,
      password: admin.password,
      approve: true
    }
  });
  assert.equal(cibaPingApproval.statusCode, 200);

  const cibaPingToken = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: cibaPingPayload.auth_req_id,
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret
    }
  });
  assert.equal(cibaPingToken.statusCode, 200);

  const cibaPushResponse = await app.inject({
    method: "POST",
    url: "/oauth/ciba/authenticate",
    payload: {
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret,
      login_hint: admin.username,
      requested_delivery_mode: "push",
      client_notification_endpoint: "https://client.example.com/ciba-push"
    }
  });
  assert.equal(cibaPushResponse.statusCode, 200);
  const cibaPushPayload = cibaPushResponse.json() as { auth_req_id: string };

  const cibaPushApproval = await app.inject({
    method: "POST",
    url: "/oauth/ciba/approve",
    payload: {
      auth_req_id: cibaPushPayload.auth_req_id,
      username: admin.username,
      password: admin.password,
      approve: true
    }
  });
  assert.equal(cibaPushApproval.statusCode, 200);

  const cibaPushToken = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: cibaPushPayload.auth_req_id,
      client_id: advancedClient.client_id,
      client_secret: advancedClient.client_secret
    }
  });
  assert.equal(cibaPushToken.statusCode, 400);
  const cibaPushTokenPayload = cibaPushToken.json() as { error: string; error_description?: string };
  assert.equal(cibaPushTokenPayload.error, "invalid_grant");
  assert.match(String(cibaPushTokenPayload.error_description), /push delivery mode/);
});
