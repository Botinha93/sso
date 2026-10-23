import test from "node:test";
import assert from "node:assert/strict";
import { decodeJwt } from "jose";
import { createHash } from "node:crypto";
import { createTestContext, extractCookie, getCsrf, loginAsAdmin, registerClientAsAdmin } from "../helpers/test-app.js";

test("OAuth token exchange: valid access token yields new exchanged token", async (t) => {
  const { app, admin } = await createTestContext("integration-token-exchange");

  t.after(async () => {
    await app.close();
  });

  // Obtain a valid access token from interactive login response
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
  const loginPayload = loginResponse.json() as { accessToken?: string; access_token?: string };
  const accessToken = loginPayload.accessToken ?? loginPayload.access_token;
  assert.ok(typeof accessToken === "string" && accessToken.length > 0);

  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "Exchange Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["token_exchange"],
    scope: "openid profile email"
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const exchangeClient = registered.json() as { client_id: string; client_secret: string };

  // Exchange without client authentication must be refused.
  const anonymousExchange = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile"
    }
  });
  assert.equal(anonymousExchange.statusCode, 401);

  // Scope can be narrowed but never widened beyond the subject token.
  const escalatedExchange = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile permissions",
      client_id: exchangeClient.client_id,
      client_secret: exchangeClient.client_secret
    }
  });
  assert.equal(escalatedExchange.statusCode, 400);

  // The caller cannot mint an audience merely by naming another application.
  // NexusHub's user delegation contract needs a user-approved resource grant;
  // an OAuth client's own allowlist is only an additional boundary.
  const unapprovedAudience = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      audience: "https://invoices.example",
      scope: "openid profile",
      client_id: exchangeClient.client_id,
      client_secret: exchangeClient.client_secret
    }
  });
  assert.equal(unapprovedAudience.statusCode, 400);
  assert.equal(unapprovedAudience.json().error, "invalid_target");

  // A profile request still requires a client-configured resource and consent.
  for (const [installation, resource] of [
    ["hub-installation-a", "https://invoices.example"],
    ["hub-installation-b", "https://documents.example"]
  ]) {
    const delegated = await app.inject({
      method: "POST",
      url: "/oauth/token/exchange",
      headers: { "content-type": "application/json" },
      payload: {
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: accessToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
        scope: "openid profile",
        audience: resource,
        nexushub_profile: "nexushub:1",
        nexushub_installation_id: installation,
        client_id: exchangeClient.client_id,
        client_secret: exchangeClient.client_secret
      }
    });
    assert.equal(delegated.statusCode, 400);
    assert.equal(delegated.json().error, "invalid_target");
  }

  // Perform token exchange
  const exchangeResponse = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile",
      client_id: exchangeClient.client_id,
      client_secret: exchangeClient.client_secret
    },
  });

  assert.equal(exchangeResponse.statusCode, 200, exchangeResponse.body);
  const exchanged = exchangeResponse.json() as {
    access_token: string;
    token_type: string;
    issued_token_type: string;
  };
  assert.ok(typeof exchanged.access_token === "string" && exchanged.access_token.length > 0);
  assert.equal(exchanged.token_type, "Bearer");
  assert.equal(exchanged.issued_token_type, "urn:ietf:params:oauth:token-type:access_token");
  assert.notEqual(exchanged.access_token, accessToken, "Exchanged token must differ from original");
});

test("NexusHub delegation requires exact user consent for the Hub client, installation and resource", async (t) => {
  const { app, admin } = await createTestContext("nexushub-delegation-consent");
  t.after(async () => app.close());
  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "NexusHub", redirect_uris: ["http://localhost:3000/callback"], grant_types: ["authorization_code", "token_exchange"], scope: "openid profile email"
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const client = registered.json() as { client_id: string; client_secret: string };
  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  const updated = await app.inject({
    method: "PUT", url: `/api/admin/clients/${client.client_id}`, headers: csrf.headers,
    payload: { grants: ["authorization_code", "token_exchange"], resources: ["https://crm.example", "https://docs.example"], resourceMetadata: {
      "https://crm.example": { label: "Customer conversations", description: "Read and update customer conversations you are permitted to access." },
      "https://docs.example": { label: "Company documents", description: "Read documents you are permitted to access." }
    } }
  });
  assert.equal(updated.statusCode, 200, updated.body);

  const trustedMetadata = await app.inject({ method: "GET", url: `/oauth/nexushub/resource-metadata?${new URLSearchParams({ client_id: client.client_id, resource_audience: "https://crm.example" })}` });
  assert.equal(trustedMetadata.statusCode, 200);
  assert.deepEqual(trustedMetadata.json(), { resource: "https://crm.example", label: "Customer conversations", description: "Read and update customer conversations you are permitted to access." });
  const unknownMetadata = await app.inject({ method: "GET", url: `/oauth/nexushub/resource-metadata?${new URLSearchParams({ client_id: client.client_id, resource_audience: "https://missing.example" })}` });
  assert.equal(unknownMetadata.statusCode, 404);

  const login = await app.inject({ method: "POST", url: "/auth/login", payload: {
    email: admin.username, password: admin.password, clientId: client.client_id, scope: ["openid", "profile", "email"]
  } });
  assert.equal(login.statusCode, 200, login.body);
  const subjectToken = (login.json() as { accessToken?: string; access_token?: string }).accessToken ?? (login.json() as { access_token?: string }).access_token;
  assert.ok(subjectToken);
  const sourceClaims = decodeJwt(subjectToken!);
  const tuple = { client_id: client.client_id, redirect_uri: "http://localhost:3000/callback", scope: "openid profile", decision: "approve", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id, resource_audience: "https://crm.example" };
  const authorize = await app.inject({ method: "GET", url: `/oauth/authorize?${new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: tuple.redirect_uri, scope: tuple.scope,
    prompt: "consent", account_selection: "continue", nexushub_profile: "nexushub:1",
    nexushub_installation_id: tuple.nexushub_installation_id, resource_audience: tuple.resource_audience,
    code_challenge: createHash("sha256").update("nexushub-delegation-verifier").digest("base64url"), code_challenge_method: "S256"
  })}`, headers: { cookie: sid } });
  assert.equal(authorize.statusCode, 302);
  assert.match(String(authorize.headers.location), /^\/consent\?/);
  const consentQuery = new URLSearchParams(String(authorize.headers.location).split("?")[1]);
  assert.equal(consentQuery.get("nexushub_profile"), "nexushub:1");
  assert.equal(consentQuery.get("nexushub_installation_id"), tuple.nexushub_installation_id);
  assert.equal(consentQuery.get("resource_audience"), tuple.resource_audience);
  const silent = await app.inject({ method: "GET", url: `/oauth/authorize?${new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: tuple.redirect_uri, scope: tuple.scope,
    prompt: "none", nexushub_profile: "nexushub:1", nexushub_installation_id: tuple.nexushub_installation_id,
    resource_audience: tuple.resource_audience,
    code_challenge: createHash("sha256").update("nexushub-delegation-verifier").digest("base64url"), code_challenge_method: "S256"
  })}`, headers: { cookie: sid } });
  assert.equal(silent.statusCode, 302);
  assert.match(String(silent.headers.location), /error=interaction_required/);
  const noConsent = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(noConsent.statusCode, 403, noConsent.body);
  assert.equal(noConsent.json().error, "consent_required");

  const csrfDenied = await app.inject({ method: "POST", url: "/oauth/consent", payload: tuple });
  assert.equal(csrfDenied.statusCode, 403);

  const consent = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: tuple });
  assert.equal(consent.statusCode, 200, consent.body);
  const expiresAt = new Date((consent.json() as { expiresAt: string }).expiresAt).getTime();
  assert.ok(expiresAt > Date.now() + 29 * 24 * 60 * 60 * 1000);
  assert.ok(expiresAt <= Date.now() + 30 * 24 * 60 * 60 * 1000);
  const consentList = await app.inject({ method: "GET", url: "/api/account/nexushub-consents", headers: { cookie: sid } });
  assert.equal(consentList.statusCode, 200);
  assert.equal((consentList.json() as { consents: unknown[] }).consents.length, 1);
  const delegated = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(delegated.statusCode, 200, delegated.body);
  const delegatedClaims = decodeJwt((delegated.json() as { access_token: string }).access_token);
  assert.equal(delegatedClaims.nexushub_profile, "nexushub:1");
  assert.equal(delegatedClaims.nexushub_installation_id, client.client_id);
  assert.deepEqual(delegatedClaims.act, { sub: client.client_id });
  assert.ok(typeof delegatedClaims.exp === "number" && delegatedClaims.exp <= Number(sourceClaims.exp));
  assert.deepEqual(delegatedClaims.aud, ["https://crm.example"]);
  const delegatedToken = (delegated.json() as { access_token: string }).access_token;
  const statusCheck = (resource_audience: string, client_id = client.client_id, client_secret = client.client_secret) => app.inject({
    method: "POST", url: "/oauth/nexushub/delegation/introspect",
    payload: { token: delegatedToken, client_id, client_secret, resource_audience }
  });
  assert.deepEqual((await statusCheck("https://crm.example")).json(), { active: true });
  assert.deepEqual((await statusCheck("https://docs.example")).json(), { active: false });
  assert.equal((await statusCheck("https://crm.example", client.client_id, "incorrect-secret")).statusCode, 401);
  assert.ok(Array.isArray((consentList.json() as { consents: Array<{ scopes: string[] }> }).consents[0].scopes));
  assert.deepEqual((consentList.json() as { consents: Array<{ scopes: string[] }> }).consents[0].scopes, ["openid", "profile"]);
  const multipleResources = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example https://docs.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(multipleResources.statusCode, 400, multipleResources.body);
  assert.equal(multipleResources.json().error, "invalid_target");
  const profileWithoutInstallation = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1",
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(profileWithoutInstallation.statusCode, 400);
  assert.equal(profileWithoutInstallation.json().error, "invalid_request");
  const widenedScope = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile email", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(widenedScope.statusCode, 400, widenedScope.body);
  assert.equal(widenedScope.json().error, "invalid_scope");
  const otherResource = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://docs.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(otherResource.statusCode, 403);
  // Exact grant tuple prevents using the consent for another installation.
  const wrongInstall = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: "hub-installation-b",
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(wrongInstall.statusCode, 400);
  assert.equal(wrongInstall.json().error, "invalid_grant");
  const differentSubjectClientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: {
    email: admin.username, password: admin.password, clientId: "sso-admin-ui", scope: ["openid", "profile"]
  } })).json() as { accessToken?: string; access_token?: string };
  const crossClientSubject = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: differentSubjectClientToken.accessToken ?? differentSubjectClientToken.access_token,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: "hub-installation-a",
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(crossClientSubject.statusCode, 400);

  const revoke = await app.inject({ method: "DELETE", url: "/api/account/nexushub-consents", headers: csrf.headers, payload: {
    client_id: client.client_id, installation_id: client.client_id, resource: "https://crm.example"
  } });
  assert.equal(revoke.statusCode, 204, revoke.body);
  assert.deepEqual((await statusCheck("https://crm.example")).json(), { active: false }, "consent revocation immediately invalidates issued delegated tokens");
  const emptyConsentList = await app.inject({ method: "GET", url: "/api/account/nexushub-consents", headers: { cookie: sid } });
  assert.equal((emptyConsentList.json() as { consents: unknown[] }).consents.length, 0);
  const revoked = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(revoked.statusCode, 403);

  // An authorized administrator can revoke the exact tuple after the user
  // re-consents; the route requires the existing consents:delete permission.
  const reconsent = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: tuple });
  assert.equal(reconsent.statusCode, 200, reconsent.body);
  const adminRevoke = await app.inject({ method: "DELETE", url: "/api/admin/consents/nexushub-delegations", headers: csrf.headers, payload: {
    user_id: String(sourceClaims.sub), client_id: client.client_id, installation_id: client.client_id, resource: "https://crm.example"
  } });
  assert.equal(adminRevoke.statusCode, 204, adminRevoke.body);
  const adminRevokedExchange = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(adminRevokedExchange.statusCode, 403, adminRevokedExchange.body);
});

test("OAuth token exchange: invalid subject_token returns 401", async (t) => {
  const { app } = await createTestContext("integration-token-exchange-invalid");

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "invalid.jwt.token",
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
    },
  });

  assert.equal(response.statusCode, 401);
});
