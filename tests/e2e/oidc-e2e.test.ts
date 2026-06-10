import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("E2E: login -> authorization code -> token -> userinfo -> logout", async (t) => {
  const { app, admin } = await createTestContext("e2e-oidc");
  t.after(async () => {
    await app.close();
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "E2E Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email roles groups permissions"
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
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const codeVerifier = "e2e-code-verifier";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const authorizeResponse = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email roles groups permissions")}&state=e2e-state&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: {
      cookie: sid
    }
  });

  assert.equal(authorizeResponse.statusCode, 302);
  const redirect = new URL(String(authorizeResponse.headers.location));
  const code = redirect.searchParams.get("code");
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
  const tokenBody = tokenResponse.json();
  const accessToken = String(tokenBody.accessToken ?? tokenBody.access_token);
  assert.ok(accessToken.length > 20);

  const userInfoResponse = await app.inject({
    method: "GET",
    url: "/oauth/userinfo?format=signed",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  assert.equal(userInfoResponse.statusCode, 200);
  assert.equal(String(userInfoResponse.headers["content-type"]).includes("application/jwt"), true);
  assert.ok(userInfoResponse.body.split(".").length === 3);

  const logoutResponse = await app.inject({
    method: "GET",
    url: "/oauth/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogged-out&state=e2e-logout",
    headers: {
      cookie: sid
    }
  });

  assert.equal(logoutResponse.statusCode, 302);
  const logoutRedirect = String(logoutResponse.headers.location);
  assert.ok(logoutRedirect.includes("state=e2e-logout"));
});
