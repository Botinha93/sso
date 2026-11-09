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
    expires_in: number;
  };
  assert.ok(typeof exchanged.access_token === "string" && exchanged.access_token.length > 0);
  assert.equal(exchanged.token_type, "Bearer");
  assert.equal(exchanged.issued_token_type, "urn:ietf:params:oauth:token-type:access_token");
  assert.equal(exchanged.expires_in, 900, "ordinary RFC 8693 exchange keeps the configured client TTL");
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
  const tuple = { client_id: client.client_id, redirect_uri: "http://localhost:3000/callback", scope: "openid profile", decision: "approve", state: "nexushub-consent-state-001", nonce: "nexushub-consent-nonce-001", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id, resource_audience: "https://crm.example" };
  const authorize = await app.inject({ method: "GET", url: `/oauth/authorize?${new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: tuple.redirect_uri, scope: tuple.scope,
    state: tuple.state, nonce: tuple.nonce,
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
  const reviewed = await app.inject({ method: "GET", url: `/oauth/consent/request?${consentQuery}`, headers: { cookie: sid } });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  const reviewedRequest = reviewed.json() as { requestId: string; authorization: Record<string, string> };
  assert.equal(reviewedRequest.authorization.resource_audience, tuple.resource_audience);
  const changedResource = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: {
    consent_request_id: reviewedRequest.requestId, ...tuple, resource_audience: "https://docs.example"
  } });
  assert.equal(changedResource.statusCode, 400, "the browser cannot change the reviewed resource after the server stores the consent ticket");
  assert.equal(changedResource.json().error, "invalid_consent_request");
  const noConsent = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(noConsent.statusCode, 403, noConsent.body);
  assert.equal(noConsent.json().error, "consent_required");
  const silent = await app.inject({ method: "GET", url: `/oauth/authorize?${new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: tuple.redirect_uri, scope: tuple.scope,
    state: tuple.state, nonce: tuple.nonce,
    prompt: "none", nexushub_profile: "nexushub:1", nexushub_installation_id: tuple.nexushub_installation_id,
    resource_audience: tuple.resource_audience,
    code_challenge: createHash("sha256").update("nexushub-delegation-verifier").digest("base64url"), code_challenge_method: "S256"
  })}`, headers: { cookie: sid } });
  assert.equal(silent.statusCode, 302);
  assert.match(String(silent.headers.location), /error=interaction_required/);
  const reviewedAgain = await app.inject({ method: "GET", url: `/oauth/consent/request?${consentQuery}`, headers: { cookie: sid } });
  assert.equal(reviewedAgain.statusCode, 200, reviewedAgain.body);
  const matchingRequestId = (reviewedAgain.json() as { requestId: string }).requestId;
  const matchingConsent = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: {
    consent_request_id: matchingRequestId, ...tuple
  } });
  assert.equal(matchingConsent.statusCode, 200, matchingConsent.body);
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
  assert.equal(delegatedClaims.client_id, client.client_id);
  assert.ok(typeof delegatedClaims.exp === "number" && delegatedClaims.exp <= Number(sourceClaims.exp));
  assert.deepEqual(delegatedClaims.aud, ["https://crm.example"]);
  const actorBinding = { appId: "io.nexus.context", registrationId: "53a66ab7-25d9-4a1e-a62a-3fd5ffab2685", organizationId: "5de29a65-45dd-43e7-9b6e-14d3c5543b29", projectId: "3a87ecac-9f10-4b34-80b3-ecfc8c97d5dc" };
  const partialActor = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    nexushub_actor_app_id: actorBinding.appId,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(partialActor.statusCode, 400, "partial nested actor chains fail before token issuance");
  const attributed = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    nexushub_actor_app_id: actorBinding.appId, nexushub_actor_registration_id: actorBinding.registrationId,
    nexushub_actor_organization_id: actorBinding.organizationId, nexushub_actor_project_id: actorBinding.projectId,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(attributed.statusCode, 200, attributed.body);
  const attributedToken = (attributed.json() as { access_token: string }).access_token;
  const attributedClaims = decodeJwt(attributedToken);
  assert.deepEqual(attributedClaims.act, { sub: actorBinding.appId, registration_id: actorBinding.registrationId,
    organization_id: actorBinding.organizationId, project_id: actorBinding.projectId, act: { sub: client.client_id } });
  assert.deepEqual(attributedClaims.aud, ["https://crm.example"], "actor attribution cannot alter the approved resource audience");
  assert.equal(attributedClaims.scope, "openid profile", "actor attribution preserves only the approved scopes");
  const delegatedToken = (delegated.json() as { access_token: string }).access_token;
  assert.ok((delegated.json() as { expires_in: number }).expires_in <= 600, "NexusHub profile delegation is capped at ten minutes");
  const authorizeForResource = (scope: string, prompt: string) => app.inject({ method: "GET", url: `/oauth/authorize?${new URLSearchParams({
    response_type: "code", client_id: client.client_id, redirect_uri: tuple.redirect_uri, scope, prompt,
    state: tuple.state, nonce: tuple.nonce,
    nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    resource_audience: "https://crm.example", code_challenge: createHash("sha256").update("nexushub-delegation-verifier").digest("base64url"), code_challenge_method: "S256"
  })}`, headers: { cookie: sid } });
  const sameScopes = await authorizeForResource("openid profile", "none");
  assert.equal(sameScopes.statusCode, 302);
  assert.match(String(sameScopes.headers.location), /^http:\/\/localhost:3000\/callback\?code=/,
    "a resource grant skips consent when it already covers every requested scope");
  const newScopeSilent = await authorizeForResource("openid profile email", "none");
  assert.equal(newScopeSilent.statusCode, 302);
  assert.match(String(newScopeSilent.headers.location), /error=interaction_required/,
    "a newly requested resource scope cannot inherit the existing resource consent silently");
  const newScopeInteractive = await authorizeForResource("openid profile email", "consent");
  assert.equal(newScopeInteractive.statusCode, 302);
  assert.match(String(newScopeInteractive.headers.location), /^\/consent\?/,
    "adding a resource scope requires the NexusID consent screen");
  const reconsentQuery = new URLSearchParams(String(newScopeInteractive.headers.location).split("?")[1]);
  assert.equal(reconsentQuery.get("scope"), "openid profile email",
    "the consent screen asks the user to re-approve the whole effective grant before replacing it");
  const expandedGrant = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers,
    payload: { ...tuple, scope: "openid profile email" } });
  assert.equal(expandedGrant.statusCode, 200, expandedGrant.body);
  const expandedGrantList = await app.inject({ method: "GET", url: "/api/account/nexushub-consents", headers: { cookie: sid } });
  assert.deepEqual((expandedGrantList.json() as { consents: Array<{ scopes: string[] }> }).consents[0].scopes, ["openid", "profile", "email"]);
  const approvedNewScope = await authorizeForResource("openid profile email", "none");
  assert.equal(approvedNewScope.statusCode, 302);
  assert.match(String(approvedNewScope.headers.location), /^http:\/\/localhost:3000\/callback\?code=/,
    "the newly approved complete scope set can now use the non-interactive authorize path");
  const expandedDelegation = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile email", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(expandedDelegation.statusCode, 200, expandedDelegation.body);
  assert.equal(decodeJwt((expandedDelegation.json() as { access_token: string }).access_token).scope, "openid profile email",
    "the token exchange can issue newly approved scopes and preserve the earlier approved resource scope");
  const resourceServerRegistration = await registerClientAsAdmin(app, admin, {
    client_name: "NexusContext resource server", redirect_uris: ["http://localhost/callback"], grant_types: ["client_credentials"], scope: ""
  });
  assert.equal(resourceServerRegistration.statusCode, 201, resourceServerRegistration.body);
  const resourceServer = resourceServerRegistration.json() as { client_id: string; client_secret: string };
  const resourceServerUpdate = await app.inject({
    method: "PUT", url: `/api/admin/clients/${resourceServer.client_id}`, headers: csrf.headers,
    payload: { resources: ["https://crm.example", "https://docs.example"] }
  });
  assert.equal(resourceServerUpdate.statusCode, 200, resourceServerUpdate.body);
  const resourceStatus = (resource_audience: string, client_id = resourceServer.client_id, client_secret = resourceServer.client_secret, token = delegatedToken) => app.inject({
    method: "POST", url: "/oauth/nexushub/delegation/resource-introspect",
    payload: { token, client_id, client_secret, resource_audience }
  });
  assert.deepEqual((await resourceStatus("https://crm.example")).json(), { active: true });
  assert.deepEqual((await resourceStatus("https://crm.example", resourceServer.client_id, resourceServer.client_secret, attributedToken)).json(),
    { active: true }, "the resource introspector accepts the issuer-signed nested Hub/app actor chain");
  assert.deepEqual((await resourceStatus("https://docs.example")).json(), { active: false });
  assert.deepEqual((await resourceStatus("https://missing.example")).json(), { active: false });
  assert.equal((await resourceStatus("https://crm.example", resourceServer.client_id, "incorrect-secret")).statusCode, 401);
  assert.deepEqual((await resourceStatus("https://crm.example", client.client_id, client.client_secret)).json(), { active: true });
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
    scope: "openid profile roles", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
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
  assert.deepEqual((await resourceStatus("https://crm.example")).json(), { active: false }, "independent resource introspection observes administrator revocation");
  const adminRevokedExchange = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(adminRevokedExchange.statusCode, 403, adminRevokedExchange.body);

  // Ordinary RFC7009 access-token revocation is also visible to the separate
  // resource-server client, even while the grant remains live.
  const docsConsent = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: { ...tuple, resource_audience: "https://docs.example" } });
  assert.equal(docsConsent.statusCode, 200, docsConsent.body);
  const docsDelegation = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://docs.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(docsDelegation.statusCode, 200, docsDelegation.body);
  const docsToken = (docsDelegation.json() as { access_token: string }).access_token;
  assert.deepEqual((await resourceStatus("https://docs.example", undefined, undefined, docsToken)).json(), { active: true });
  const directRevoke = await app.inject({ method: "POST", url: "/oauth/token/revoke", payload: {
    token: docsToken, client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(directRevoke.statusCode, 200, directRevoke.body);
  assert.deepEqual((await resourceStatus("https://docs.example", undefined, undefined, docsToken)).json(), { active: false });

  const recentConsent = await app.inject({ method: "POST", url: "/oauth/consent", headers: csrf.headers, payload: tuple });
  assert.equal(recentConsent.statusCode, 200, recentConsent.body);
  const { default: Database } = await import("better-sqlite3");
  const testDatabase = new Database(process.env.DATABASE_PATH!);
  try {
    testDatabase.prepare("UPDATE nexushub_delegation_consents SET expires_at = ? WHERE client_id = ? AND resource = ?")
      .run(new Date(Date.now() + 20_000).toISOString(), client.client_id, "https://crm.example");
  } finally {
    testDatabase.close();
  }
  const nearExpiry = await app.inject({ method: "POST", url: "/oauth/token/exchange", payload: {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: "https://crm.example",
    scope: "openid profile", nexushub_profile: "nexushub:1", nexushub_installation_id: client.client_id,
    client_id: client.client_id, client_secret: client.client_secret
  } });
  assert.equal(nearExpiry.statusCode, 400, nearExpiry.body);
  assert.equal(nearExpiry.json().error, "invalid_grant", "delegation fails closed when the user's consent has less than the minimum useful lifetime");
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
