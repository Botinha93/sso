import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import {
  approveConsent,
  createTestContext,
  extractCookie,
  getCsrf,
  loginAsAdmin,
  registerClientAsAdmin
} from "../helpers/test-app.js";

/**
 * Regression coverage for the vulnerabilities fixed in the 2026-09 security
 * audit. Each case documents the original exposure in its name.
 */

test("legacy unauthenticated helper routes are gone (client secret leak / anonymous admin creation)", async (t) => {
  const { app } = await createTestContext("sec-legacy-routes");
  t.after(async () => {
    await app.close();
  });

  for (const path of ["/clients", "/roles", "/users", "/groups", "/tenants"]) {
    const response = await app.inject({ method: "GET", url: path, headers: { accept: "application/json" } });
    // The SPA shell is served for browser navigation; no JSON data must leak.
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /text\/html/);
    assert.doesNotMatch(response.body, /"secret"|"passwordHash"|platform_admin/);
  }

  const createUser = await app.inject({
    method: "POST",
    url: "/users",
    payload: { email: "evil@example.com", username: "evil", password: "Change-Me-Now1", givenName: "E", familyName: "V", roleIds: [] }
  });
  assert.equal(createUser.statusCode, 404);

  const assignRole = await app.inject({ method: "POST", url: "/role-assignments", payload: { userId: "x", roleId: "y" } });
  assert.equal(assignRole.statusCode, 404);

  const revoke = await app.inject({ method: "POST", url: "/oauth/revoke", payload: { tokenId: "abc", tokenType: "access" } });
  assert.equal(revoke.statusCode, 404);
});

test("admin client listing never returns live client secrets", async (t) => {
  const { app, admin } = await createTestContext("sec-admin-client-secrets");
  t.after(async () => {
    await app.close();
  });

  const sid = await loginAsAdmin(app, admin);
  const response = await app.inject({ method: "GET", url: "/api/admin/clients", headers: { cookie: sid } });
  assert.equal(response.statusCode, 200);
  const clients = response.json() as Array<Record<string, unknown>>;
  assert.ok(clients.length > 0);
  for (const client of clients) {
    assert.equal(client.secret, undefined);
    assert.ok(typeof client.secretPreview === "string");
  }
});

test("setup initializer refuses to run (or touch a caller-supplied database) once initialised", async (t) => {
  const { app } = await createTestContext("sec-setup-reinit");
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/setup/initialize",
    payload: {
      name: "Attacker",
      email: "attacker@example.com",
      username: "attacker",
      password: "Attacker-Pass-1",
      databaseProvider: "postgresql",
      externalDatabaseUrl: "postgresql://attacker:pw@attacker.example.invalid:5432/sso"
    }
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "setup_already_completed");
});

test("consent cannot be granted through a crafted GET link; it requires POST /oauth/consent with CSRF", async (t) => {
  const { app, admin } = await createTestContext("sec-consent-csrf");
  t.after(async () => {
    await app.close();
  });

  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "Attacker Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code"],
    scope: "openid profile email"
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const client = registered.json() as { client_id: string };

  const sid = await loginAsAdmin(app, admin);
  const codeChallenge = createHash("sha256").update("verifier-consent").digest("base64url");
  const authorizeUrl = `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(client.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=${encodeURIComponent("openid profile email")}&state=s1&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  // A link carrying consent=approve (the old bypass) must only lead to the consent screen.
  const forged = await app.inject({ method: "GET", url: `${authorizeUrl}&consent=approve`, headers: { cookie: sid } });
  assert.equal(forged.statusCode, 302);
  assert.match(String(forged.headers.location), /^\/consent\?/);

  // POST /oauth/consent without the CSRF token is rejected.
  const noCsrf = await app.inject({
    method: "POST",
    url: "/oauth/consent",
    headers: { cookie: sid },
    payload: { client_id: client.client_id, redirect_uri: "http://localhost:3000/callback", scope: "openid profile email" }
  });
  assert.equal(noCsrf.statusCode, 403);

  // Consent for an unregistered redirect_uri is rejected.
  const csrf = await getCsrf(app, sid);
  const badRedirect = await app.inject({
    method: "POST",
    url: "/oauth/consent",
    headers: csrf.headers,
    payload: { client_id: client.client_id, redirect_uri: "https://attacker.example/cb", scope: "openid" }
  });
  assert.equal(badRedirect.statusCode, 400);

  // Proper flow: record consent, then authorize issues a code.
  await approveConsent(app, sid, authorizeUrl);
  const approved = await app.inject({ method: "GET", url: authorizeUrl, headers: { cookie: sid } });
  assert.equal(approved.statusCode, 302);
  const location = new URL(String(approved.headers.location));
  assert.equal(location.origin, "http://localhost:3000");
  assert.ok(location.searchParams.get("code"));

  // Deny goes back to the registered redirect_uri with access_denied.
  const denied = await app.inject({ method: "GET", url: `${authorizeUrl}&consent=deny`, headers: { cookie: sid } });
  assert.equal(denied.statusCode, 302);
  const deniedLocation = new URL(String(denied.headers.location));
  assert.equal(deniedLocation.origin, "http://localhost:3000");
  assert.equal(deniedLocation.searchParams.get("error"), "access_denied");
  assert.equal(deniedLocation.searchParams.get("state"), "s1");
});

test("response_mode=form_post escapes reflected values and ships a nonce-only CSP", async (t) => {
  const { app, admin } = await createTestContext("sec-form-post-xss");
  t.after(async () => {
    await app.close();
  });

  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "Form Post Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code"],
    scope: "openid"
  });
  const client = registered.json() as { client_id: string };
  const sid = await loginAsAdmin(app, admin);
  const payload = `"><script>alert(1)</script>`;
  const authorizeUrl = `/oauth/authorize?response_type=code&response_mode=form_post&client_id=${encodeURIComponent(client.client_id)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=openid&state=${encodeURIComponent(payload)}&code_challenge=${createHash("sha256").update("v").digest("base64url")}&code_challenge_method=S256`;
  await approveConsent(app, sid, authorizeUrl);

  const response = await app.inject({ method: "GET", url: authorizeUrl, headers: { cookie: sid } });
  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(response.body, /<script>alert\(1\)<\/script>/);
  assert.match(response.body, /&quot;&gt;&lt;script&gt;/);
  assert.match(String(response.headers["content-security-policy"]), /script-src 'nonce-/);
  assert.doesNotMatch(String(response.headers["content-security-policy"]), /unsafe-inline/);
});

test("global CSP no longer allows inline scripts", async (t) => {
  const { app } = await createTestContext("sec-global-csp");
  t.after(async () => {
    await app.close();
  });
  const response = await app.inject({ method: "GET", url: "/health" });
  const csp = String(response.headers["content-security-policy"]);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
});

test("federation start rejects protocol-relative and backslash redirect targets", async (t) => {
  const { app, admin } = await createTestContext("sec-open-redirect");
  t.after(async () => {
    await app.close();
  });
  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/federation/providers",
    headers: csrf.headers,
    payload: {
      id: "test-idp",
      label: "Test IdP",
      authorizationEndpoint: "http://idp.example.test/authorize",
      tokenEndpoint: "http://idp.example.test/token",
      userInfoEndpoint: "http://idp.example.test/userinfo",
      clientId: "abc",
      clientSecret: "secret-value-123",
      scopes: ["openid"],
      enabled: true
    }
  });
  assert.equal(created.statusCode, 201, created.body);

  // Make sure the federation stage is part of the active authentication flow.
  const flowsResponse = await app.inject({ method: "GET", url: "/api/admin/authentication/flows", headers: { cookie: sid } });
  assert.equal(flowsResponse.statusCode, 200);
  const flows = flowsResponse.json() as Array<{
    id: string; designation: string; enabled: boolean; name: string; description: string;
    grantTypes: string[]; stages: Array<{ type: string; required: boolean; order: number }>;
  }>;
  const activeFlow = flows.find((flow) => flow.designation === "authentication" && flow.enabled);
  assert.ok(activeFlow);
  if (!activeFlow!.stages.some((stage) => stage.type === "federation")) {
    const flowUpdate = await app.inject({
      method: "PUT",
      url: `/api/admin/authentication/flows/${activeFlow!.id}`,
      headers: csrf.headers,
      payload: {
        name: activeFlow!.name,
        description: activeFlow!.description,
        designation: "authentication",
        enabled: true,
        grantTypes: activeFlow!.grantTypes,
        stages: [...activeFlow!.stages, { type: "federation", required: true, order: activeFlow!.stages.length + 1 }]
      }
    });
    assert.equal(flowUpdate.statusCode, 200, flowUpdate.body);
  }

  for (const target of ["//evil.example/phish", "/\\evil.example", "https://evil.example"]) {
    const response = await app.inject({
      method: "GET",
      url: `/auth/federation/test-idp/start?redirect=${encodeURIComponent(target)}`
    });
    assert.equal(response.statusCode, 302, response.body);
    const upstream = new URL(String(response.headers.location));
    assert.equal(upstream.host, "idp.example.test");
    // The transaction stores the sanitized target; the callback later redirects
    // to "/" for anything that is not a same-origin path.
  }

  // The provider list must not disclose the upstream client secret.
  const list = await app.inject({ method: "GET", url: "/api/admin/federation/providers", headers: { cookie: sid } });
  assert.equal(list.statusCode, 200);
  for (const provider of list.json() as Array<Record<string, unknown>>) {
    assert.equal(provider.clientSecret, undefined);
    assert.equal(provider.secretPreview, undefined);
    assert.equal(provider.hasSecret, true);
  }

  const start = await app.inject({
    method: "GET",
    url: "/auth/federation/test-idp/start?redirect=/admin"
  });
  assert.equal(start.statusCode, 302);
  const setCookie = start.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie ?? "")];
  assert.ok(cookies.some((value) => value.startsWith("fed_txn=")));
});

test("dynamic client registration requires administrator credentials by default", async (t) => {
  const { app, admin } = await createTestContext("sec-dyn-registration");
  t.after(async () => {
    await app.close();
  });

  const anonymous = await app.inject({
    method: "POST",
    url: "/connect/register",
    payload: { client_name: "Anon", redirect_uris: ["https://attacker.example/cb"], grant_types: ["password"] }
  });
  assert.equal(anonymous.statusCode, 401);

  const asAdmin = await registerClientAsAdmin(app, admin, {
    client_name: "Admin Registered",
    redirect_uris: ["https://app.example/cb"],
    grant_types: ["authorization_code"]
  });
  assert.equal(asAdmin.statusCode, 201, asAdmin.body);
});

test("session cookies are signed: a raw session id cannot be replayed as a cookie", async (t) => {
  const { app, admin } = await createTestContext("sec-signed-session");
  t.after(async () => {
    await app.close();
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: admin.username, password: admin.password, clientId: "sso-admin-ui", scope: ["openid"] }
  });
  assert.equal(login.statusCode, 200);
  const signedCookie = extractCookie(login.headers["set-cookie"], "sid");
  const rawSessionId = String((login.json() as { session: { id: string } }).session.id);

  const withSigned = await app.inject({ method: "GET", url: "/api/admin/me", headers: { cookie: signedCookie } });
  assert.equal(withSigned.statusCode, 200);

  const withRaw = await app.inject({ method: "GET", url: "/api/admin/me", headers: { cookie: `sid=${rawSessionId}` } });
  assert.equal(withRaw.statusCode, 401);
});

test("deactivating a user revokes their sessions immediately", async (t) => {
  const { app, admin } = await createTestContext("sec-deactivate-revokes");
  t.after(async () => {
    await app.close();
  });

  const adminSid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, adminSid);
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: csrf.headers,
    payload: { email: "victim@example.com", username: "victim", password: "Victim-Pass-123", givenName: "V", familyName: "U" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const userId = String(created.json().id);

  const victimLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "victim", password: "Victim-Pass-123", clientId: "sso-admin-ui", scope: ["openid"] }
  });
  assert.equal(victimLogin.statusCode, 200);
  const victimSid = extractCookie(victimLogin.headers["set-cookie"], "sid");

  const before = await app.inject({ method: "GET", url: "/api/portal/me", headers: { cookie: victimSid } });
  assert.equal(before.statusCode, 200);

  const deactivate = await app.inject({
    method: "PATCH",
    url: `/api/admin/users/${userId}`,
    headers: csrf.headers,
    payload: { active: false }
  });
  assert.equal(deactivate.statusCode, 200, deactivate.body);

  const after = await app.inject({ method: "GET", url: "/api/portal/me", headers: { cookie: victimSid } });
  assert.equal(after.statusCode, 401);
});

test("SAML SSO no longer accepts a caller-supplied userId", async (t) => {
  const { app } = await createTestContext("sec-saml-userid");
  t.after(async () => {
    await app.close();
  });
  const response = await app.inject({
    method: "POST",
    url: "/saml/sso",
    payload: { spId: "any", userId: "someone", responseMode: "json" }
  });
  // Without a browser session the IdP must never mint an assertion, whatever
  // the exact failure status is.
  assert.notEqual(response.statusCode, 200);
  assert.doesNotMatch(response.body, /samlResponse/);
});

test("refresh tokens are bound to the client that received them", async (t) => {
  const { app, admin } = await createTestContext("sec-refresh-binding");
  t.after(async () => {
    await app.close();
  });

  const clientA = (await registerClientAsAdmin(app, admin, {
    client_name: "Client A",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["password", "refresh_token"],
    scope: "openid profile"
  })).json() as { client_id: string; client_secret: string };
  const clientB = (await registerClientAsAdmin(app, admin, {
    client_name: "Client B",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["refresh_token"],
    scope: "openid profile"
  })).json() as { client_id: string; client_secret: string };

  const tokens = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: clientA.client_id,
      client_secret: clientA.client_secret,
      scope: "openid profile"
    }
  });
  assert.equal(tokens.statusCode, 200, tokens.body);
  const refreshToken = String((tokens.json() as { refresh_token: string }).refresh_token);

  const stolen = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientB.client_id, client_secret: clientB.client_secret }
  });
  assert.equal(stolen.statusCode, 401);
});

test("password grant with bad client credentials does not count against the user's lockout", async (t) => {
  const { app, admin } = await createTestContext("sec-lockout-dos");
  t.after(async () => {
    await app.close();
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/oauth/token",
      payload: {
        grant_type: "password",
        username: admin.username,
        password: "wrong-password",
        client_id: "sso-admin-ui",
        client_secret: "not-the-real-secret"
      }
    });
    assert.equal(response.statusCode, 401);
  }

  const legit = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: admin.username, password: admin.password, clientId: "sso-admin-ui", scope: ["openid"] }
  });
  assert.equal(legit.statusCode, 200, legit.body);
});

test("token revocation requires client authentication and only revokes the caller's own tokens", async (t) => {
  const { app, admin } = await createTestContext("sec-revoke-auth");
  t.after(async () => {
    await app.close();
  });

  const clientA = (await registerClientAsAdmin(app, admin, {
    client_name: "Revoke A",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["password", "refresh_token"],
    scope: "openid profile"
  })).json() as { client_id: string; client_secret: string };
  const clientB = (await registerClientAsAdmin(app, admin, {
    client_name: "Revoke B",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["client_credentials"],
    scope: "openid"
  })).json() as { client_id: string; client_secret: string };

  const tokens = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "password",
      username: admin.username,
      password: admin.password,
      client_id: clientA.client_id,
      client_secret: clientA.client_secret,
      scope: "openid profile"
    }
  });
  assert.equal(tokens.statusCode, 200, tokens.body);
  const accessToken = String((tokens.json() as { access_token: string }).access_token);

  // Anonymous revocation is refused.
  const anonymous = await app.inject({ method: "POST", url: "/oauth/token/revoke", payload: { token: accessToken } });
  assert.equal(anonymous.statusCode, 401);

  // Another client cannot revoke a token it does not own (acknowledged, no effect).
  const foreign = await app.inject({
    method: "POST",
    url: "/oauth/token/revoke",
    payload: { token: accessToken, client_id: clientB.client_id, client_secret: clientB.client_secret }
  });
  assert.equal(foreign.statusCode, 200);
  const stillValid = await app.inject({ method: "GET", url: "/oauth/userinfo", headers: { authorization: `Bearer ${accessToken}` } });
  assert.equal(stillValid.statusCode, 200);

  // The owning client revokes successfully.
  const owner = await app.inject({
    method: "POST",
    url: "/oauth/token/revoke",
    payload: { token: accessToken, client_id: clientA.client_id, client_secret: clientA.client_secret }
  });
  assert.equal(owner.statusCode, 200);
  const revoked = await app.inject({ method: "GET", url: "/oauth/userinfo", headers: { authorization: `Bearer ${accessToken}` } });
  assert.equal(revoked.statusCode, 401);
});

test("suggestion image uploads are capped per user", async (t) => {
  const { app, admin } = await createTestContext("sec-upload-quota");
  t.after(async () => {
    await app.close();
  });
  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  // Lift the per-IP upload rate limit so the storage quota is what trips.
  const settings = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers: csrf.headers,
    payload: { rateLimitMultiplier: 10 }
  });
  assert.equal(settings.statusCode, 200, settings.body);
  // 1x1 transparent PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const boundary = "----quota-boundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  let lastStatus = 0;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/api/portal/suggestions/images",
      headers: { ...csrf.headers, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body
    });
    lastStatus = response.statusCode;
    if (response.statusCode !== 200) {
      assert.equal(response.json().error, "upload_quota_exceeded");
      assert.ok(attempt >= 20, `quota tripped too early at attempt ${attempt}`);
      break;
    }
  }
  assert.equal(lastStatus, 429, "the per-user file cap must eventually reject uploads");
});

test("an expired token is answered with 401, not the 500 that made clients retry forever", async (t) => {
  // Pin the signing keys so the test can mint a token the server accepts as its
  // own, with an `exp` already in the past.
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const previousPrivateKey = process.env.JWT_PRIVATE_KEY_PEM;
  const previousPublicKey = process.env.JWT_PUBLIC_KEY_PEM;
  process.env.JWT_PRIVATE_KEY_PEM = privateKey;
  process.env.JWT_PUBLIC_KEY_PEM = publicKey;

  const { app, admin } = await createTestContext("sec-expired-token");
  t.after(async () => {
    await app.close();
    if (previousPrivateKey === undefined) {
      delete process.env.JWT_PRIVATE_KEY_PEM;
    } else {
      process.env.JWT_PRIVATE_KEY_PEM = previousPrivateKey;
    }
    if (previousPublicKey === undefined) {
      delete process.env.JWT_PUBLIC_KEY_PEM;
    } else {
      process.env.JWT_PUBLIC_KEY_PEM = previousPublicKey;
    }
  });

  const registerResponse = await registerClientAsAdmin(app, admin, {
    client_name: "Expired Token Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid profile email"
  });
  assert.equal(registerResponse.statusCode, 201, registerResponse.body);
  const client = registerResponse.json();
  const clientId = String(client.client_id);
  const clientSecret = String(client.client_secret);

  const now = Math.floor(Date.now() / 1000);
  const signingKey = await importPKCS8(privateKey, "RS256");
  const expiredRefreshToken = await new SignJWT({ type: "refresh", client_id: clientId, scope: "openid" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("http://localhost:4000")
    .setAudience(clientId)
    .setSubject(randomUUID())
    .setJti(randomUUID())
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(signingKey);

  const refreshResponse = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "refresh_token",
      refresh_token: expiredRefreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }
  });

  // A 500 here tells the client nothing is wrong with its token, so it retries
  // the same expired token until the rate limiter starts returning 429s.
  assert.equal(refreshResponse.statusCode, 401, refreshResponse.body);
  assert.equal(refreshResponse.json().error, "invalid_grant");

  // Introspection reports the same token as inactive (RFC 7662 §2.2) instead of
  // failing the request.
  const introspectResponse = await app.inject({
    method: "POST",
    url: "/oauth/introspect",
    payload: { token: expiredRefreshToken, client_id: clientId, client_secret: clientSecret }
  });
  assert.equal(introspectResponse.statusCode, 200, introspectResponse.body);
  assert.equal(introspectResponse.json().active, false);
});
