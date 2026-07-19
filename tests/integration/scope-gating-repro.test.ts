import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const decodeJwtPayload = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;

test("repro: permissions must not appear when scope not requested", async (t) => {
  const { app, admin } = await createTestContext("scope-gating-repro");
  t.after(async () => {
    await app.close();
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: {
      client_name: "Repro Client",
      redirect_uris: ["http://localhost:3000/callback"],
      grant_types: ["authorization_code", "refresh_token", "password"],
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
      email: admin.username,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const codeVerifier = "code-verifier-for-scope-gating-repro";
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  // Request ONLY openid profile email — no roles/groups/permissions.
  const authorizeCodeResponse = await app.inject({
    method: "GET",
    url: `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=abc123&consent=approve&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
    headers: { cookie: sid }
  });
  assert.equal(authorizeCodeResponse.statusCode, 302);
  const code = new URL(String(authorizeCodeResponse.headers.location)).searchParams.get("code");
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
  const tokens = tokenResponse.json();
  const accessToken = String(tokens.accessToken ?? tokens.access_token);
  const idToken = String(tokens.idToken ?? tokens.id_token);

  const accessPayload = decodeJwtPayload(accessToken);
  console.log("access token claims:", Object.keys(accessPayload), "permissions:", accessPayload.permissions);
  const idPayload = decodeJwtPayload(idToken);
  console.log("id token claims:", Object.keys(idPayload), "permissions:", idPayload.permissions);

  const userInfoResponse = await app.inject({
    method: "GET",
    url: "/oauth/userinfo",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  assert.equal(userInfoResponse.statusCode, 200);
  const userInfo = userInfoResponse.json() as Record<string, unknown>;
  console.log("userinfo claims:", Object.keys(userInfo), "permissions:", userInfo.permissions);

  assert.equal(accessPayload.permissions, undefined, "access token leaked permissions");
  assert.equal(idPayload.permissions, undefined, "id token leaked permissions");
  assert.equal(userInfo.permissions, undefined, "userinfo leaked permissions");
  assert.equal(accessPayload.roles, undefined, "access token leaked roles");
  assert.equal(userInfo.roles, undefined, "userinfo leaked roles");
});
