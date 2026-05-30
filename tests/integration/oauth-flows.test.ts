import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("OAuth/OIDC grant flows: authorization_code, refresh, client_credentials, password, implicit, device_code", async (t) => {
  const { app, admin } = await createTestContext("integration-flows");
  t.after(async () => {
    await app.close();
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Integration Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: [
        "authorization_code",
        "refresh_token",
        "client_credentials",
        "password",
        "device_code"
      ],
      response_types: ["code", "token"],
      scope: "openid profile email roles"
    }
  });

  assert.equal(registerResponse.statusCode, 201);
  const registeredClient = registerResponse.json();
  const clientId = String(registeredClient.client_id);
  const clientSecret = String(registeredClient.client_secret);

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

  const codeVerifier = "code-verifier-for-integration-tests";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const authorizeCodeResponse = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email roles")}&state=abc123&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: {
      cookie: sid
    }
  });

  assert.equal(authorizeCodeResponse.statusCode, 302);
  const codeRedirect = new URL(String(authorizeCodeResponse.headers.location));
  const code = codeRedirect.searchParams.get("code");
  assert.ok(code);

  const tokenResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier
    }
  });

  assert.equal(tokenResponse.statusCode, 200);
  const authCodeTokens = tokenResponse.json();
  assert.equal(authCodeTokens.tokenType ?? authCodeTokens.token_type, "Bearer");
  const accessToken = String(authCodeTokens.accessToken ?? authCodeTokens.access_token);
  assert.ok(accessToken);
  assert.ok(authCodeTokens.refreshToken ?? authCodeTokens.refresh_token);

  const userInfoResponse = await app.inject({
    method: "GET",
    url: "/oauth/userinfo",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  assert.equal(userInfoResponse.statusCode, 200);
  const userInfo = userInfoResponse.json() as {
    sub?: string;
    roles?: string[];
    groups?: string[];
    permissions?: string[];
  };
  assert.ok(typeof userInfo.sub === "string" && userInfo.sub.length > 0);
  assert.ok(Array.isArray(userInfo.roles));
  assert.ok(userInfo.roles!.length > 0);
  assert.ok(Array.isArray(userInfo.groups));
  assert.ok(Array.isArray(userInfo.permissions));
  assert.ok(userInfo.permissions!.length > 0);

  const refreshTokenValue = String(authCodeTokens.refreshToken ?? authCodeTokens.refresh_token);
  const refreshResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret
    }
  });

  assert.equal(refreshResponse.statusCode, 200);
  const refreshedTokens = refreshResponse.json();
  assert.ok(refreshedTokens.accessToken ?? refreshedTokens.access_token);

  const clientCredentialsResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile"
    }
  });

  assert.equal(clientCredentialsResponse.statusCode, 200);
  const clientCredentialsTokens = clientCredentialsResponse.json();
  assert.ok(clientCredentialsTokens.access_token);

  const passwordGrantResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile email"
    }
  });

  assert.equal(passwordGrantResponse.statusCode, 200);
  const passwordTokens = passwordGrantResponse.json();
  assert.ok(passwordTokens.access_token);

  const implicitResponse = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=token&response_mode=fragment&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile")}&state=state-implicit&consent=approve`,
    headers: {
      cookie: sid
    }
  });

  assert.equal(implicitResponse.statusCode, 302);
  const implicitLocation = String(implicitResponse.headers.location);
  assert.ok(implicitLocation.includes("#"));
  assert.ok(implicitLocation.includes("access_token="));

  const deviceAuthResponse = await app.inject({
    method: "POST",
    url: "/oauth/device/authorize",
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile email"
    }
  });

  assert.equal(deviceAuthResponse.statusCode, 200);
  const deviceAuth = deviceAuthResponse.json();
  assert.ok(deviceAuth.device_code);
  assert.ok(deviceAuth.user_code);

  const pendingPollResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceAuth.device_code,
      client_id: clientId,
      client_secret: clientSecret
    }
  });

  assert.equal(pendingPollResponse.statusCode, 400);
  const pending = pendingPollResponse.json();
  assert.equal(pending.error, "authorization_pending");

  const verifyResponse = await app.inject({
    method: "POST",
    url: "/oauth/device/verify",
    payload: {
      user_code: deviceAuth.user_code,
      username: admin.username,
      password: admin.password,
      approve: true
    }
  });

  assert.equal(verifyResponse.statusCode, 200);
  assert.equal(verifyResponse.json().status, "approved");

  await new Promise((resolve) => setTimeout(resolve, Number(deviceAuth.interval ?? 1) * 1000));

  const approvedPollResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceAuth.device_code,
      client_id: clientId,
      client_secret: clientSecret
    }
  });

  assert.equal(approvedPollResponse.statusCode, 200);
  const deviceTokens = approvedPollResponse.json();
  assert.ok(deviceTokens.access_token);
});
