import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import Fastify from "fastify";
import { createServer, request as httpRequest } from "node:http";
import { createServer as createHttpsServer, request as httpsRequest } from "node:https";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const enabled = process.env.NEXUSID_RESOURCE_PROCESS_ACCEPTANCE === "1";
const issuer = process.env.NEXUSID_RESOURCE_PROCESS_ISSUER;
const provider = process.env.NEXUSID_RESOURCE_PROCESS_PROVIDER;
const dbName = process.env.NEXUSID_RESOURCE_PROCESS_DB_NAME;
const valid = enabled && Boolean(issuer && dbName) && (provider === "postgresql" || provider === "mysql");

test("joined browser HTTPS adapter serializes form bodies and selects session cookies exactly", () => {
  assert.equal(serializeHttpsBody(new URLSearchParams({ grant_type: "authorization_code", code: "sample" })),
    "grant_type=authorization_code&code=sample");
  assert.equal(httpsBodyContentLength(JSON.stringify({ client_id: "client", installation_id: "install", resource: "https://resource.example" })),
    Buffer.byteLength(JSON.stringify({ client_id: "client", installation_id: "install", resource: "https://resource.example" })));
  assert.equal(httpsResponseBody(204, Buffer.alloc(0)), null);
  assert.equal(httpsResponseBody(200, Buffer.from("ok"))?.toString(), "ok");
  assert.equal(exactCookieNameIs("__Host-nexus_hub_session_flow=opaque", "nexus_hub_session"), false);
  assert.equal(exactCookieNameIs("__Host-nexus_hub_session=eyJhbGciOiJub25lIn0", "nexus_hub_session"), true);
  assert.equal(cookieNameIs("__Host-nexus_hub_delegated_abc=token", "nexus_hub_delegated_"), true);
});

test("NexusID delegated resource token works through live HTTP routes and disposable SQL storage", { skip: !valid, timeout: 240_000 }, async () => {
  assert.match(dbName!, /^nhid_resource_test_[a-f0-9]{12}$/);
  const origin = new URL(issuer!);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.hostname.endsWith(".localhost")) return nativeFetch(input, init);
    return fetchLoopbackHttps(url, input, init);
  };
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(origin.hostname) ||
    (process.env.NEXUSHUB_CONTEXT_BROWSER_ACCEPTANCE === "1" && /^id-[a-f0-9]+\.localhost$/.test(origin.hostname)),
    "issuer must be loopback or the isolated joined-browser localhost hostname");
  const jwksUri = new URL("/.well-known/jwks.json", origin);
  const metadata = await get("/.well-known/openid-configuration");
  assert.equal(metadata.issuer, origin.toString().replace(/\/$/, ""));
  assert.equal(new URL(metadata.jwks_uri).href, jwksUri.href);
  assert.equal(new URL(metadata.token_exchange_endpoint).href, new URL("/oauth/token/exchange", origin).href);
  const jwks = createRemoteJWKSet(jwksUri);

  const existingAdmin = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId: "sso-admin-ui", scope: ["openid", "profile", "email"] });
  if (existingAdmin.status !== 200) {
    const initialized = await post("/api/setup/initialize", { name: "Disposable Admin", email: "admin@example.test", username: "admin", password: "Disposable-Admin-Pass-42", databaseProvider: provider, externalDatabaseUrl: process.env.NEXUSID_RESOURCE_PROCESS_DATABASE_URL });
    assert.equal(initialized.status, 201, await bodyText(initialized));
  }

  const hub = await register("NexusHub installation", ["authorization_code", "token_exchange"], "openid profile email nexuscontext.search nexuscontext.document.preview nexushub.applications:read nexushub.applications:write nexushub.project-membership:check", ["http://127.0.0.1/auth/callback"]);
  const crm = "https://context.example/resources";
  const docs = "https://docs.example/resources";
  const hubUpdate = await updateClient(hub.client_id, { grants: ["authorization_code", "token_exchange"], resources: [crm], resourceMetadata: { [crm]: { label: "Context documents", description: "Read documents the user permits." } } });
  assert.equal(hubUpdate.status, 200, await bodyText(hubUpdate));
  const resource = await register("NexusContext resource server", ["client_credentials"], "", ["http://127.0.0.1/callback"]);
  const resourceUpdate = await updateClient(resource.client_id, { grants: ["client_credentials"], resources: [crm] });
  assert.equal(resourceUpdate.status, 200, await bodyText(resourceUpdate));
  const wrongResource = await register("Other resource server", ["client_credentials"], "", ["http://127.0.0.1/callback"]);
  assert.equal((await updateClient(wrongResource.client_id, { grants: ["client_credentials"], resources: [docs] })).status, 200);

  const sid = await loginCookie(hub.client_id);
  const login = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId: hub.client_id, scope: ["openid", "profile", "email", "nexuscontext.search", "nexuscontext.document.preview", "nexushub.applications:read", "nexushub.project-membership:check"] });
  assert.equal(login.status, 200, await bodyText(login));
  const subjectToken = login.body.accessToken ?? login.body.access_token;
  assert.equal(typeof subjectToken, "string");
  const { payload: subjectClaims } = await jwtVerify(subjectToken, jwks, { issuer: origin.toString().replace(/\/$/, "") });
  assert.equal(typeof subjectClaims.sub, "string");
  assert.equal(subjectClaims.client_id, hub.client_id, "primary Hub session token is bound to the registered Hub client");
  assert.ok(String(subjectClaims.scope).split(" ").includes("nexuscontext.search"), "Hub session token includes the user-authorized source search scope");

  const installation = hub.client_id;
  const csrf = await csrfFor(sid);
  const tuple = { client_id: hub.client_id, redirect_uri: "http://127.0.0.1/auth/callback", scope: "openid profile nexuscontext.search nexuscontext.document.preview nexushub.project-membership:check", decision: "approve", nexushub_profile: "nexushub:1", nexushub_installation_id: installation, resource_audience: crm };
  const consent = await post("/oauth/consent", tuple, csrf.headers);
  assert.equal(consent.status, 200, await bodyText(consent));
  const actorBinding = { appId: "io.nexus.context", registrationId: randomUUID(), organizationId: randomUUID(), projectId: randomUUID() };
  const incompleteActor = await post("/oauth/token/exchange", { grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken, subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: crm, scope: "openid profile nexuscontext.search", nexushub_profile: "nexushub:1", nexushub_installation_id: installation, nexushub_actor_app_id: actorBinding.appId, client_id: hub.client_id, client_secret: hub.client_secret });
  assert.equal(incompleteActor.status, 400, "partial app actor chains are rejected");
  const wrongSelectedResource = await post("/oauth/token/exchange", { grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken, subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: docs, scope: "openid profile nexuscontext.search nexuscontext.document.preview", nexushub_profile: "nexushub:1", nexushub_installation_id: installation, nexushub_actor_app_id: actorBinding.appId, nexushub_actor_registration_id: actorBinding.registrationId, nexushub_actor_organization_id: actorBinding.organizationId, nexushub_actor_project_id: actorBinding.projectId, client_id: hub.client_id, client_secret: hub.client_secret });
  assert.equal(wrongSelectedResource.status, 400, "the issuer rejects an otherwise-valid app actor chain when the resource is not selected for the Hub client");
  assert.equal(wrongSelectedResource.body.error, "invalid_target");
  const unapprovedAppScope = await post("/oauth/token/exchange", { grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken, subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: crm, scope: "openid profile nexuscontext.search nexuscontext.document.delete", nexushub_profile: "nexushub:1", nexushub_installation_id: installation, nexushub_actor_app_id: actorBinding.appId, nexushub_actor_registration_id: actorBinding.registrationId, nexushub_actor_organization_id: actorBinding.organizationId, nexushub_actor_project_id: actorBinding.projectId, client_id: hub.client_id, client_secret: hub.client_secret });
  assert.equal(unapprovedAppScope.status, 400, "the selected app cannot broaden the user-consented resource scopes");
  assert.equal(unapprovedAppScope.body.error, "invalid_scope");
  const exchange = await post("/oauth/token/exchange", { grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subjectToken, subject_token_type: "urn:ietf:params:oauth:token-type:access_token", audience: crm, scope: "openid profile nexuscontext.search nexuscontext.document.preview", nexushub_profile: "nexushub:1", nexushub_installation_id: installation, nexushub_actor_app_id: actorBinding.appId, nexushub_actor_registration_id: actorBinding.registrationId, nexushub_actor_organization_id: actorBinding.organizationId, nexushub_actor_project_id: actorBinding.projectId, client_id: hub.client_id, client_secret: hub.client_secret });
  assert.equal(exchange.status, 200, await bodyText(exchange));
  assert.ok(exchange.body.expires_in <= 600, "NexusHub delegated resource token lifetime is capped at ten minutes");
  const delegated = exchange.body.access_token;
  const { payload: delegatedClaims } = await jwtVerify(delegated, jwks, { issuer: origin.toString().replace(/\/$/, ""), audience: crm });
  assert.deepEqual(delegatedClaims.aud, [crm]);
  assert.equal(delegatedClaims.nexushub_profile, "nexushub:1");
  assert.equal(delegatedClaims.nexushub_installation_id, installation);
  assert.deepEqual(delegatedClaims.act, { sub: actorBinding.appId, registration_id: actorBinding.registrationId, organization_id: actorBinding.organizationId, project_id: actorBinding.projectId, act: { sub: hub.client_id } });
  assert.ok(String(delegatedClaims.scope).split(" ").includes("nexuscontext.search"), "NexusID issues the exact delegated source search scope after consent");
  const introspect = (client, audience = crm, token = delegated) => post("/oauth/nexushub/delegation/resource-introspect", { token, client_id: client.client_id, client_secret: client.client_secret, resource_audience: audience });

  const joinedBrowser = process.env.NEXUSHUB_CONTEXT_BROWSER_ACCEPTANCE === "1";
  if (joinedBrowser) assert.equal(process.env.NEXUSHUB_CROSS_SITE_SESSION_COOKIES_ENABLED, "true",
    "joined Context browser flow explicitly opts Hub into exact-origin cross-site session cookies");
  const contextScope = "openid profile email nexushub.project-membership:check";
  const contextWebOrigin = process.env.NEXUSHUB_CONTEXT_BROWSER_WEB_ORIGIN;
  if (joinedBrowser) assert.ok(contextWebOrigin, "joined Context web origin is configured before public client registration");
  const contextClient = joinedBrowser
    ? await register("NexusContext browser login", ["authorization_code"], contextScope,
        [`${contextWebOrigin}/auth/callback`], "none")
    : undefined;
  let hubBrokeredToken: string | undefined;
  if (process.env.NEXUSHUB_SOURCE_ROOT) {
    const hubOidcModule = await import(pathToFileURL(`${process.env.NEXUSHUB_SOURCE_ROOT}/services/hub-api/src/oidc.ts`).href) as {
      createNexusIdAuth(config: { issuer: string; clientId: string; clientSecret: string; flowCookieSigningKey: string; redirectUri: string; membershipCheckpointAudiences?: readonly string[]; crossSiteBrowserOrigins?: readonly string[] }): {
        authorizer: { authorize(input: { headers: Record<string, unknown>; action: "application:read" }): Promise<{ status: string }> };
      exchangeDelegatedSearchToken(input: { headers: Record<string, unknown>; audience: string; scopes: readonly string[]; binding: string; actor?: { appId: string; registrationId: string; organizationId: string; projectId: string } }): Promise<{ status: string; accessToken?: string; expiresIn?: number }>;
      };
    };
    const hubOidc = hubOidcModule.createNexusIdAuth({
      issuer: origin.toString().replace(/\/$/, ""), clientId: hub.client_id, clientSecret: hub.client_secret,
      flowCookieSigningKey: "nexusid-live-broker-acceptance-signing-key",
      redirectUri: "http://127.0.0.1/auth/callback",
    });
    assert.deepEqual(await hubOidc.authorizer.authorize({
      headers: { authorization: `Bearer ${subjectToken}` }, action: "application:read",
    }), { status: "authorized", principal: { subject: subjectClaims.sub, actorType: "user", clientId: hub.client_id } });
    let contextHubInstanceId: string | undefined;
    if (process.env.NEXUSHUB_CONTEXT_ACCEPTANCE === "1") {
      const sourceRoot = process.env.NEXUSHUB_SOURCE_ROOT;
      const hubDatabaseUrl = process.env.NEXUSHUB_HUB_DATABASE_URL;
      assert.ok(sourceRoot && hubDatabaseUrl, "combined Context acceptance requires the disposable Hub database");
      const { Pool } = await import("pg");
      const { applyMigrations } = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/migrate.ts`).href) as {
        applyMigrations(pool: import("pg").Pool): Promise<void>;
      };
      const hubDatabase = new Pool({ connectionString: hubDatabaseUrl });
      try {
        await applyMigrations(hubDatabase);
        const identity = await hubDatabase.query<{ instance_id: string }>(
          "SELECT instance_id FROM hub_instance_identity WHERE singleton=true",
        );
        assert.ok(identity.rows[0]?.instance_id, "Hub migrations provision one immutable instance identity");
        contextHubInstanceId = identity.rows[0].instance_id;
      } finally {
        await hubDatabase.end();
      }
    }
    const liveHubIds = { organizationId: randomUUID(), projectId: randomUUID(), registrationId: randomUUID() };
    const goldenHubProjectIds: { beta?: string; gamma?: string } = {};
    const projectBinding = JSON.stringify([liveHubIds.organizationId, liveHubIds.projectId, liveHubIds.registrationId, "io.nexus.context"]);
    const hubApp = Fastify();
    await hubOidc.registerRoutes(hubApp);
    // Exercise Hub's normal browser login entry point through NexusID's real
    // authorize, consent and token routes. The issuer session is the browser's
    // existing SSO cookie; Hub's callback owns the PKCE verifier and validates
    // state, nonce, issuer, audience and the matching access-token subject.
    const joinedHubOrigin = process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN;
    const browserRedirectUri = joinedBrowser ? `${joinedHubOrigin}/auth/callback` : "http://127.0.0.1/auth/callback";
    const browserClient = await register("NexusHub browser PKCE acceptance", ["authorization_code", "token_exchange"], "openid profile nexushub.organizations:read nexushub.organizations:write nexushub.projects:read nexushub.projects:write nexushub.applications:read nexushub.applications:write nexushub.project-membership:check nexuscontext.document.preview nexuscontext.search", [browserRedirectUri]);
    assert.equal((await updateClient(browserClient.client_id, {
      grant_types: ["authorization_code", "token_exchange"],
      resources: [crm],
      resourceMetadata: { [crm]: { label: "Context documents", description: "Read document metadata the user permits." } },
    })).status, 200, "the Hub browser client is explicitly allowlisted for the Context resource audience");
    let contextOwnerHubBearer: string | undefined;
    if (joinedBrowser) {
      const ownerHubLogin = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42",
        clientId: browserClient.client_id, scope: ["openid", "profile", "nexushub.project-membership:check",
          "nexushub.applications:read", "nexushub.applications:write", "nexushub.organizations:write", "nexushub.projects:write"] });
      assert.equal(ownerHubLogin.status, 200, ownerHubLogin.raw);
      contextOwnerHubBearer = String(ownerHubLogin.body.accessToken ?? ownerHubLogin.body.access_token ?? "");
      assert.ok(contextOwnerHubBearer, "Context owner has a distinct scoped Hub API bearer for checkpoint issuance");
    }
    const browserOidc = hubOidcModule.createNexusIdAuth({
      issuer: origin.toString().replace(/\/$/, ""), clientId: browserClient.client_id, clientSecret: browserClient.client_secret,
      flowCookieSigningKey: "nexusid-live-browser-pkce-acceptance-signing-key",
      redirectUri: browserRedirectUri, loginScopes: ["openid", "profile", "nexushub.organizations:read", "nexushub.organizations:write", "nexushub.projects:read", "nexushub.projects:write", "nexushub.applications:read", "nexushub.applications:write", "nexushub.project-membership:check"],
      membershipCheckpointAudiences: contextClient ? [contextClient.client_id] : [],
      crossSiteBrowserOrigins: process.env.NEXUSHUB_CROSS_SITE_SESSION_COOKIES_ENABLED === "true" && joinedBrowser && contextWebOrigin
        ? [contextWebOrigin] : [],
    });
    const browserApp = Fastify();
    await browserOidc.registerRoutes(browserApp);
    const browserLogin = await browserApp.inject({ method: "GET", url: "/auth/login?returnTo=%2Fbrowser-login-accepted" });
    assert.equal(browserLogin.statusCode, 302, browserLogin.body);
    const browserAuthorizeUrl = new URL(browserLogin.headers.location!);
    assert.equal(browserAuthorizeUrl.origin, origin.origin);
    assert.equal(browserAuthorizeUrl.pathname, "/oauth/authorize");
    const browserState = browserAuthorizeUrl.searchParams.get("state");
    const browserNonce = browserAuthorizeUrl.searchParams.get("nonce");
    const browserChallenge = browserAuthorizeUrl.searchParams.get("code_challenge");
    assert.ok(browserState && browserState.length >= 32);
    assert.ok(browserNonce && browserNonce.length >= 32);
    assert.ok(browserChallenge && /^[A-Za-z0-9_-]{43}$/.test(browserChallenge));
    assert.equal(browserAuthorizeUrl.searchParams.get("code_challenge_method"), "S256");
    assert.equal(browserAuthorizeUrl.searchParams.get("client_id"), browserClient.client_id);
    assert.equal(browserAuthorizeUrl.searchParams.get("redirect_uri"), browserRedirectUri);
    const hubFlowCookie = setCookieValues(browserLogin.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_session_flow"));
    assert.ok(hubFlowCookie, `Hub keeps the state, nonce and PKCE verifier in its signed HttpOnly flow cookie (${JSON.stringify({ status: browserLogin.statusCode, location: browserLogin.headers.location, setCookie: browserLogin.headers["set-cookie"] })})`);
    const browserSid = await loginCookie(browserClient.client_id);
    const browserCsrf = await csrfFor(browserSid);
    const firstAuthorize = await fetch(browserAuthorizeUrl, { headers: { cookie: browserSid }, redirect: "manual" });
    assert.equal(firstAuthorize.status, 302, await firstAuthorize.clone().text());
    const consentLocation = new URL(firstAuthorize.headers.get("location")!, origin);
    assert.equal(consentLocation.pathname, "/consent", "first visit requires explicit user consent");
    const consented = await post("/oauth/consent", {
      client_id: browserClient.client_id,
      redirect_uri: browserAuthorizeUrl.searchParams.get("redirect_uri"),
      scope: browserAuthorizeUrl.searchParams.get("scope"),
      decision: "approve",
    }, browserCsrf.headers);
    assert.equal(consented.status, 200, await bodyText(consented));
    const secondAuthorize = await fetch(browserAuthorizeUrl, { headers: { cookie: browserSid }, redirect: "manual" });
    assert.equal(secondAuthorize.status, 302, await secondAuthorize.clone().text());
    const browserCallbackUrl = new URL(secondAuthorize.headers.get("location")!);
    assert.equal(browserCallbackUrl.origin + browserCallbackUrl.pathname, browserRedirectUri);
    assert.equal(browserCallbackUrl.searchParams.get("state"), browserState, "NexusID returns the exact one-time state to Hub");
    assert.ok(browserCallbackUrl.searchParams.get("code"), "NexusID returns an authorization code, not tokens, through the browser");
    const badStateCallback = await browserApp.inject({
      method: "GET", url: `/auth/callback?code=${encodeURIComponent(browserCallbackUrl.searchParams.get("code")!)}&state=${encodeURIComponent(`${browserState}-wrong`)}`,
      headers: { cookie: hubFlowCookie! },
    });
    assert.equal(badStateCallback.statusCode, 400, "Hub rejects a callback with altered state before exchanging the code");
    const acceptedBrowserCallback = await browserApp.inject({
      method: "GET", url: `/auth/callback${browserCallbackUrl.search}`,
      headers: { cookie: hubFlowCookie! },
    });
    assert.equal(acceptedBrowserCallback.statusCode, 302, acceptedBrowserCallback.body);
    assert.equal(acceptedBrowserCallback.headers.location, "/browser-login-accepted");
    const browserSessionCookie = setCookieValues(acceptedBrowserCallback.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => exactCookieNameIs(cookie, "nexus_hub_session"));
    assert.ok(browserSessionCookie, "successful PKCE callback establishes the Hub's HttpOnly session cookie");
    const browserSessionToken = decodeURIComponent(browserSessionCookie.slice(browserSessionCookie.indexOf("=") + 1));
    // The completed real NexusID→Hub PKCE session is also the bearer used by
    // the production Hub checkpoint route. The browser-only managed topology
    // may replace it with its independently issued Hub login token below.
    contextOwnerHubBearer ??= browserSessionToken;
    contextOwnerHubBearer = browserSessionToken;
    assert.ok(String(decodeJwt(browserSessionToken).scope).split(" ").includes("nexushub.project-membership:check"),
      "Hub browser session includes the project membership checkpoint scope needed for Context preview");
    assert.ok(String(decodeJwt(browserSessionToken).scope).split(" ").includes("nexushub.applications:write"),
      "Hub browser session includes the application-write scope needed for source binding proof");
        assert.ok(String(decodeJwt(browserSessionToken).scope).split(" ").includes("nexushub.organizations:write"),
          `Hub browser session includes organization administration scope (${String(decodeJwt(browserSessionToken).scope)})`);
    assert.equal((await browserOidc.authorizer.authorize({ headers: { cookie: browserSessionCookie }, action: "application:read" })).status, "authorized");
    let contextPreviewToken: string | undefined;
    let contextSearchToken: string | undefined;
    let contextPreviewCookie = "";
    let contextAcceptanceDocumentId = "";
    let contextPreviewClient = browserClient.client_id;
    let contextWireProjectId = liveHubIds.projectId;
    let contextWireHubCookie = "";
    if (process.env.NEXUSHUB_CONTEXT_ACCEPTANCE === "1") {
      contextAcceptanceDocumentId = randomUUID();
      const sourceRoot = process.env.NEXUSHUB_SOURCE_ROOT!;
      const hubDatabaseUrl = process.env.NEXUSHUB_HUB_DATABASE_URL!;
      const { Pool } = await import("pg");
      const { buildHubApi } = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/app.ts`).href) as { buildHubApi(options: any): ReturnType<typeof Fastify> };
      const { PostgresApplicationRegistrationRepository } = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/applications.ts`).href) as { PostgresApplicationRegistrationRepository: new (pool: import("pg").Pool) => any };
      const { PostgresOrganizationRepository } = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/organizations.ts`).href) as { PostgresOrganizationRepository: new (pool: import("pg").Pool) => any };
      const { PostgresInstallationRepository } = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/repository.ts`).href) as { PostgresInstallationRepository: new (pool: import("pg").Pool) => any };
      let liveHubTlsProxy: Awaited<ReturnType<typeof startTlsProxy>> | undefined;
      let contextFixture: ReturnType<typeof spawn> | undefined;
      let contextWeb: ReturnType<typeof spawn> | undefined;
      let contextFixtureOutput = "";
      let contextFixtureError = "";
      let contextFixtureRecords: ReturnType<typeof readJsonRecords> | undefined;
      let joinedContext: any;
      let joinedProofVerifier: ((input: { publicOrigin: string; manifest: unknown }) => Promise<boolean>) | undefined;
      const joinedProofDiagnostic: Record<string, unknown> = {};
      let liveHubApi: ReturnType<typeof Fastify> | undefined;
      const hubPool = new Pool({ connectionString: hubDatabaseUrl });
      const hubRepository = new PostgresApplicationRegistrationRepository(hubPool);
      let contextManifest: any = {
        manifestVersion: 1, appId: "io.nexus.context", version: "1.0.0", name: "NexusContext acceptance",
        description: "Local live consent and metadata preview acceptance.",
        publisher: { id: "io.nexus", name: "Nexus", url: "https://nexus.example.test" },
        compatibility: { hubApiMajor: 1, sdkContractMajor: 1 },
        endpoints: { api: "/api/v1", health: "/health", discovery: "/.well-known/nexus-app.json" },
        navigation: [{ id: "home", label: "Home", pathTemplate: "/", requiresProjectBinding: false }],
        resourceTypes: [{ type: "document", name: "Document", resolve: true, preview: true,
          pathTemplate: "/integrations/nexushub/resources/{resourceId}",
          previewDelegation: { audience: crm, scopes: ["nexuscontext.document.preview"] } }],
        capabilities: [], events: [], permissions: [],
        search: { contractMajor: 1, mode: "federated", path: "/integrations/nexussearch/v1/search", delegation: { audience: crm, scopes: ["nexuscontext.search"] } },
      };
      try {
        // Use the same production repositories and HTTP routes as Hub owners.
        // This deliberately avoids SQL-seeding organization, membership,
        // project, registration, or project enablement state.
        if (joinedBrowser) {
          const contextRoot = process.env.NEXUSHUB_CONTEXT_ROOT!;
          const serviceRoot = `${contextRoot}/services/context`;
          const webRoot = `${contextRoot}/apps/web`;
          const issuerOrigin = process.env.NEXUSHUB_CONTEXT_BROWSER_ISSUER_ORIGIN!;
          assert.ok(contextClient, "joined Context browser flow registered its public PKCE OAuth client");
          const hubApiOrigin = process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!;
          const membershipBrokerOrigin = `http://127.0.0.1:${process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_HTTP_PORT}`;
          const browserHome = process.env.NEXUSHUB_CONTEXT_BROWSER_HOME!;
          const caCertPath = process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT!;
          const contextApiPort = Number(process.env.NEXUSHUB_CONTEXT_BROWSER_API_PORT);
          const contextWebPort = Number(process.env.NEXUSHUB_CONTEXT_BROWSER_WEB_PORT);
          const adminSid = await loginCookie("sso-admin-ui");
          const adminCsrf = await csrfFor(adminSid);
          const memberPassword = `Nexus-Member-${randomBytes(8).toString("hex")}-Aa1!`;
          const memberCreated = await post("/api/admin/users", { email: "context-member@example.test", username: "context-member", password: memberPassword, givenName: "Context", familyName: "Member" }, adminCsrf.headers);
          assert.equal(memberCreated.status, 201, memberCreated.raw);
          const ownerLogin = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId: contextClient.client_id, scope: ["openid", "profile", "email", "nexushub.project-membership:check"] });
          assert.equal(ownerLogin.status, 200, ownerLogin.raw);
          const memberLogin = await post("/auth/login", { email: "context-member@example.test", password: memberPassword, clientId: contextClient.client_id, scope: ["openid", "profile", "email", "nexushub.project-membership:check"] });
          assert.equal(memberLogin.status, 200, memberLogin.raw);
          const ownerToken = ownerLogin.body.accessToken ?? ownerLogin.body.access_token;
          const memberToken = memberLogin.body.accessToken ?? memberLogin.body.access_token;
          const ownerSubject = decodeJwt(ownerToken).sub as string;
          const memberSubject = decodeJwt(memberToken).sub as string;
          assert.notEqual(ownerSubject, memberSubject, "Context fixture owner and browser member are distinct NexusID principals");
          const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
          const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
          const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
          const hubIdentity = await hubPool.query<{ instance_id: string }>("SELECT instance_id FROM hub_instance_identity WHERE singleton=true");
          assert.ok(hubIdentity.rows[0]?.instance_id, "Hub instance identity exists before Context is configured");
          const { chmod: chmodSync } = await import("node:fs/promises");
          const scratch = join(browserHome, "nh050");
          await mkdir(scratch, { recursive: true, mode: 0o700 });
          const contextConfigPath = join(scratch, "context-fixture.json");
          const runtimeDatabaseUrl = process.env.NEXUSHUB_CONTEXT_APP_DATABASE_URL!;
          const config = { adminDatabaseUrl: process.env.NEXUSHUB_CONTEXT_DATABASE_URL!, runtimeDatabaseUrl,
            oidcIssuer: issuerOrigin, oidcJwksUrl: new URL("/.well-known/jwks.json", issuerOrigin).href,
            oidcClientId: contextClient.client_id, oidcAudience: contextClient.client_id, oidcScope: contextScope,
            ownerSubject, ownerToken, memberSubject, webOrigin: contextWebOrigin, hubApiOrigin, membershipBrokerOrigin,
            hubInstanceId: hubIdentity.rows[0].instance_id, contextInstanceId: randomUUID(),
            hubMembershipIssuer: hubApiOrigin, hubMembershipVerificationKey: publicKeyPem,
            hubBindingCommandVerificationKey: publicKeyPem,
            resourceClientId: resource.client_id, resourceClientSecret: resource.client_secret,
            searchCursorKey: randomBytes(32).toString("base64url"),
            resourceAudience: crm, delegationIntrospectionUrl: new URL("/oauth/nexushub/delegation/resource-introspect", issuerOrigin).href,
            apiPort: contextApiPort };
          joinedContext = { privateKeyPem };
          await writeFile(contextConfigPath, `${JSON.stringify(config)}\n`, { mode: 0o600 });
          await chmodSync(contextConfigPath, 0o600);
          const migration = spawnSync(`${serviceRoot}/.venv/bin/python`, ["-c", "import os; from pathlib import Path; from sqlalchemy import create_engine, text; from alembic import command; from alembic.config import Config; u=os.environ['NEXUS_TEST_DATABASE_URL']; e=create_engine(u); c=e.connect(); c.execute(text(\"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nexus_app') THEN CREATE ROLE nexus_app LOGIN PASSWORD 'test-only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nexus_worker') THEN CREATE ROLE nexus_worker LOGIN PASSWORD 'worker-test-only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT; END IF; END $$\")); c.commit(); c.close(); e.dispose(); cfg=Config(str(Path('alembic.ini').resolve())); cfg.set_main_option('sqlalchemy.url',u.replace('%','%%')); cfg.attributes['nexus_test_migrations']=True; command.upgrade(cfg,'head')"], {
            cwd: serviceRoot, encoding: "utf8", env: { ...process.env, NEXUS_TEST_DATABASE_URL: process.env.NEXUSHUB_CONTEXT_DATABASE_URL! },
          });
          assert.equal(migration.status, 0, `Context disposable DB migrations failed: ${migration.stderr || migration.stdout}`);
          const fixturePath = `${serviceRoot}/tests/live_browser_fixture.py`;
          contextFixture = spawn(`${serviceRoot}/.venv/bin/python`, [fixturePath, "--config", contextConfigPath], {
            cwd: serviceRoot, env: { ...process.env, SSL_CERT_FILE: caCertPath, REQUESTS_CA_BUNDLE: caCertPath, NODE_EXTRA_CA_CERTS: caCertPath }, stdio: ["pipe", "pipe", "pipe"],
          });
          contextFixture.stdout.on("data", (chunk) => { contextFixtureOutput += chunk.toString(); });
          contextFixture.stderr.on("data", (chunk) => { contextFixtureError += chunk.toString(); });
          contextFixtureRecords = readJsonRecords(contextFixture);
          const fixtureReady = await contextFixtureRecords.waitFor("ready", 90_000);
          joinedContext = { ...fixtureReady, privateKeyPem, ownerToken, ownerHubBearer: contextOwnerHubBearer, memberPassword, configPath: contextConfigPath };
          assert.equal(decodeJwt(contextOwnerHubBearer!).sub, joinedContext.ownerSubject,
            "the owner-only Hub checkpoint bearer and Context owner credential resolve to the same federated subject");
          assert.equal(joinedContext.webOrigin, contextWebOrigin);
          contextFixture.stdin!.write(`${JSON.stringify({ cmd: "grant-member" })}\n`);
          joinedContext.membershipGrant = await contextFixtureRecords!.waitFor("member-granted", 30_000);
          assert.equal(joinedContext.membershipGrant.status, 200,
            "Context owner grants the exact browser principal through the live membership API before Hub binding activation");
          contextManifest = joinedContext.manifest;
          const vite = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(contextWebPort), "--strictPort"], {
            cwd: webRoot, env: { ...process.env, NEXUS_CONTEXT_DEV_TLS_KEY: process.env.NEXUSHUB_CONTEXT_BROWSER_TLS_KEY!,
              NEXUS_CONTEXT_DEV_TLS_CERT: process.env.NEXUSHUB_CONTEXT_BROWSER_TLS_CERT!, NEXUS_CONTEXT_API_PROXY: joinedContext.apiOrigin,
              NODE_EXTRA_CA_CERTS: caCertPath, SSL_CERT_FILE: caCertPath }, stdio: ["ignore", "pipe", "pipe"],
          });
          contextWeb = vite;
          vite.stdout.on("data", (chunk) => { contextFixtureOutput += chunk.toString(); });
          vite.stderr.on("data", (chunk) => { contextFixtureError += chunk.toString(); });
          try {
            await waitForHttpsOrigin(contextWebOrigin, caCertPath, vite, 60_000);
          } catch (error) {
            throw new Error(`${error instanceof Error ? error.message : String(error)}\nContext web proxy output:\n${contextFixtureOutput.slice(-6000)}`);
          }
          const proofModule = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/origin-manifest-proof.ts`).href) as {
            createDnsTxtManifestProofVerifier(options: any): (input: { publicOrigin: string; manifest: unknown }) => Promise<boolean>;
            manifestProofValue(manifest: unknown): string;
          };
          const hostname = new URL(contextWebOrigin).hostname;
          joinedProofVerifier = proofModule.createDnsTxtManifestProofVerifier({
            lookupTxtForTests: async (name: string) => {
              const matched = name === `_nexushub-manifest.${hostname}`;
              joinedProofDiagnostic.txtMatched = matched;
              return matched ? [[proofModule.manifestProofValue(contextManifest)]] : [];
            },
            lookupAddressesForTests: async (host: string) => {
              const matched = host === hostname;
              joinedProofDiagnostic.hostnameMatched = matched;
              joinedProofDiagnostic.publicAnswerAccepted = matched;
              return matched ? [{ address: "8.8.8.8", family: 4 }] : [];
            },
            requestManifestForTests: async ({ url }: { url: URL }) => new Promise((resolve, reject) => {
              const request = httpsRequest(new URL("/.well-known/nexus-app.json", url), { ca: readFileSync(caCertPath), servername: hostname,
                lookup: (_host, options, callback) => options?.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) }, response => {
                const chunks: Buffer[] = []; let size = 0;
                response.on("data", chunk => { size += chunk.length; if (size > 256 * 1024) { joinedProofDiagnostic.fetchError = "response_too_large"; request.destroy(new Error("manifest too large")); return; } chunks.push(Buffer.from(chunk)); });
                response.on("end", () => {
                  const body = Buffer.concat(chunks);
                  joinedProofDiagnostic.fetchStatus = response.statusCode ?? 0;
                  joinedProofDiagnostic.fetchBytes = body.byteLength;
                  try {
                    joinedProofDiagnostic.digestMatches = proofModule.manifestProofValue(JSON.parse(body.toString("utf8"))) === proofModule.manifestProofValue(contextManifest);
                  } catch (error) {
                    joinedProofDiagnostic.digestErrorType = error instanceof Error ? error.name : typeof error;
                  }
                  resolve({ statusCode: response.statusCode ?? 0, body });
                });
              });
              request.on("error", error => { joinedProofDiagnostic.fetchErrorType = error instanceof Error ? error.name : typeof error; reject(error); }); request.end();
            }),
          });
          const proofAccepted = await joinedProofVerifier({ publicOrigin: contextWebOrigin, manifest: contextManifest });
          assert.equal(proofAccepted, true,
            `production manifest verifier accepts the exact served Context manifest through trusted TLS and its DNS proof adapter; diagnostics=${JSON.stringify(joinedProofDiagnostic)}`);
        }
        const legacyManifestVerifier = async () => true;
        const api = buildHubApi({ repository: new PostgresInstallationRepository(hubPool), organizations: new PostgresOrganizationRepository(hubPool), applications: hubRepository, authorizer: browserOidc.authorizer, delegatedSearchExchange: browserOidc, originManifestProofVerifier: joinedBrowser ? joinedProofVerifier! : legacyManifestVerifier,
          ...(joinedBrowser ? { browserOrigins: [process.env.NEXUSHUB_CONTEXT_BROWSER_WEB_ORIGIN!], contextBindingsPool: hubPool,
            membershipCheckpointIssuer: { pool: hubPool, issuer: process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!, memberIssuer: issuer.toString().replace(/\/$/, ""), privateKeyPem: joinedContext.privateKeyPem },
            contextResourcePreviewCheckpointEnabled: true } : {}) });
        liveHubApi = api;
        if (joinedBrowser) {
          await browserOidc.registerRoutes(api);
          await api.listen({ host: "127.0.0.1", port: Number(process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_HTTP_PORT) });
          liveHubTlsProxy = await startTlsProxy(process.env.NEXUSHUB_CONTEXT_BROWSER_TLS_KEY!, process.env.NEXUSHUB_CONTEXT_BROWSER_TLS_CERT!,
            Number(process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_TLS_PORT), Number(process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_HTTP_PORT));
        }
        const browserCookies = setCookieValues(acceptedBrowserCallback.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]);
        const csrfCookie = browserCookies.find((cookie) => cookieNameIs(cookie, "nexus_hub_session_csrf"));
        assert.ok(csrfCookie, "Hub browser login returned a matching CSRF cookie");
        const csrfToken = decodeURIComponent(csrfCookie.slice(csrfCookie.indexOf("=") + 1));
        const sessionCookies = `${browserSessionCookie}; ${csrfCookie}`;
        const ownerHeaders = { cookie: sessionCookies, "x-csrf-token": csrfToken };
        const createOrganization = await api.inject({ method: "POST", url: "/api/v1/organizations", headers: ownerHeaders, payload: { slug: `context-${randomUUID().slice(0, 8)}`, name: "Context consent acceptance" } });
        assert.equal(createOrganization.statusCode, 201, createOrganization.body);
        const organization = createOrganization.json().organization;
        liveHubIds.organizationId = organization.id;
        assert.equal(organization.role, "owner", "the creator is granted owner role");
        const organizationList = await api.inject({ method: "GET", url: "/api/v1/organizations", headers: ownerHeaders });
        assert.equal(organizationList.statusCode, 200, organizationList.body);
        assert.ok(organizationList.json().organizations.some((entry: any) => entry.id === organization.id && entry.role === "owner"), "owner can read back organization membership through Hub API");
        const createProject = await api.inject({ method: "POST", url: `/api/v1/organizations/${organization.id}/projects`, headers: ownerHeaders, payload: { slug: "preview", name: "Context preview" } });
        assert.equal(createProject.statusCode, 201, createProject.body);
        const project = createProject.json().project;
        liveHubIds.projectId = project.id;
        // `contextWireProjectId` is passed to the downstream Context process
        // acceptance. Replace its initial placeholder with the project ID
        // returned by Hub's authenticated owner route before spawning it.
        contextWireProjectId = project.id;
        assert.equal(project.organizationId, organization.id);
        if (joinedBrowser) {
          const organizationMemberships = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/memberships`, headers: ownerHeaders });
          assert.equal(organizationMemberships.statusCode, 200, organizationMemberships.body);
          const orgSubjects = new Set((organizationMemberships.json().members as Array<{ subject: string }>).map((member) => member.subject));
          for (const subject of new Set([joinedContext.memberSubject, joinedContext.ownerSubject, subjectClaims.sub])) {
            if (!orgSubjects.has(subject)) {
              const added = await api.inject({ method: "POST", url: `/api/v1/organizations/${organization.id}/memberships`,
                headers: ownerHeaders, payload: { subject, role: "member" } });
              assert.equal(added.statusCode, 201, `organization membership for ${JSON.stringify(subject)} failed: ${added.body}`);
              orgSubjects.add(subject);
            }
          }
          const projectMemberships = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/projects/${project.id}/memberships`, headers: ownerHeaders });
          assert.equal(projectMemberships.statusCode, 200, projectMemberships.body);
          const projectSubjects = new Set((projectMemberships.json().members as Array<{ subject: string }>).map((member) => member.subject));
          for (const subject of new Set([joinedContext.memberSubject, joinedContext.ownerSubject, subjectClaims.sub])) {
            if (!projectSubjects.has(subject)) {
              const added = await api.inject({ method: "POST", url: `/api/v1/organizations/${organization.id}/projects/${project.id}/memberships`,
                headers: ownerHeaders, payload: { subject } });
              assert.equal(added.statusCode, 201, `project membership for ${JSON.stringify(subject)} failed: ${added.body}`);
              projectSubjects.add(subject);
            }
          }
        }
        const creatorReadback = await hubPool.query("SELECT o.created_by AS organization_creator, p.created_by AS project_creator FROM hub_organizations o JOIN hub_projects p ON p.organization_id=o.id WHERE o.id=$1 AND p.id=$2", [organization.id, project.id]);
        assert.equal(creatorReadback.rows[0]?.organization_creator, subjectClaims.sub, "organization creator is persisted from the authenticated owner");
        assert.equal(creatorReadback.rows[0]?.project_creator, subjectClaims.sub, "project creator is persisted from the authenticated owner");
        const projectReadback = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/projects`, headers: ownerHeaders });
        assert.equal(projectReadback.statusCode, 200, projectReadback.body);
        assert.ok(projectReadback.json().projects.some((entry: any) => entry.id === project.id), "owner can read back the persisted project through Hub API");
        const applicationPayload = { publicOrigin: joinedBrowser ? joinedContext.webOrigin : "https://context.example", manifest: contextManifest };
        const registeredResponse = joinedBrowser
          ? await liveHubRequest(process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!, `/api/v1/organizations/${organization.id}/applications`, "POST", applicationPayload, ownerHeaders)
          : await api.inject({ method: "POST", url: `/api/v1/organizations/${organization.id}/applications`, headers: ownerHeaders, payload: applicationPayload });
        assert.equal(registeredResponse.statusCode, 201, registeredResponse.body);
        const registered = registeredResponse.json().application;
        liveHubIds.registrationId = registered.id;
        assert.equal(registered.organizationId, organization.id);
        assert.equal(registered.appId, "io.nexus.context");
        const appReadback = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/applications`, headers: ownerHeaders });
        assert.equal(appReadback.statusCode, 200, appReadback.body);
        assert.ok(appReadback.json().applications.some((entry: any) => entry.id === registered.id && entry.appId === "io.nexus.context"), "owner can read back the registered application through Hub API");
        const enabled = await api.inject({ method: "PUT", url: `/api/v1/organizations/${organization.id}/projects/${project.id}/applications/${registered.id}`, headers: ownerHeaders });
        assert.equal(enabled.statusCode, 200, enabled.body);
        const enabledReadback = await hubPool.query<{ enabled: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM hub_project_applications
            WHERE organization_id=$1 AND project_id=$2 AND application_registration_id=$3) AS enabled`,
          [organization.id, project.id, registered.id],
        );
        assert.equal(enabledReadback.rows[0]?.enabled, true,
          "owner enablement route persists the exact organization/project/registration tuple");
        if (process.env.NEXUSHUB_GOLDEN_SPACES_ACCEPTANCE === "1") {
          for (const [name, slug] of [["Beta", "golden-beta"], ["Gamma", "golden-gamma"]] as const) {
            const created = await api.inject({ method: "POST", url: `/api/v1/organizations/${organization.id}/projects`,
              headers: ownerHeaders, payload: { slug, name: `Golden ${name}` } });
            assert.equal(created.statusCode, 201, `owner-created ${name} golden project: ${created.body}`);
            const projectId = created.json().project.id as string;
            const appEnabled = await api.inject({ method: "PUT",
              url: `/api/v1/organizations/${organization.id}/projects/${projectId}/applications/${registered.id}`,
              headers: ownerHeaders });
            assert.equal(appEnabled.statusCode, 200, `owner-enabled Context in ${name}: ${appEnabled.body}`);
            goldenHubProjectIds[name.toLowerCase() as "beta" | "gamma"] = projectId;
          }
          const projectList = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/projects`, headers: ownerHeaders });
          assert.equal(projectList.statusCode, 200, projectList.body);
          for (const id of Object.values(goldenHubProjectIds)) {
            assert.ok(projectList.json().projects.some((entry: any) => entry.id === id), "golden project is persisted and owner-readable");
          }
        }
        if (joinedBrowser) {
          contextFixture!.stdin!.write(`${JSON.stringify({ cmd: "bind", hubOrganizationId: organization.id,
            hubProjectId: project.id, hubInstallationClientId: browserClient.client_id, registrationId: registered.id })}\n`);
          const bound = await contextFixtureRecords!.waitFor("bound", 30_000);
          joinedContext.bound = bound;
          const bindingResponse = await liveHubRequest(process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!,
            `/api/v1/organizations/${organization.id}/projects/${project.id}/context-binding`, "POST",
            { contextBindingId: bound.bindingId, contextInstanceId: joinedContext.contextInstanceId,
              contextTenantId: joinedContext.tenantId, contextSpaceId: joinedContext.spaceId,
              confirmation: "I have verified this Context instance, tenant, and space" }, ownerHeaders);
          assert.equal(bindingResponse.statusCode, 201, JSON.stringify(bindingResponse.body));
          joinedContext.hubBindingId = bindingResponse.body.binding?.bindingId;
          assert.ok(joinedContext.hubBindingId, "Hub binding API returns the binding identifier required for live owner membership checkpoints");
          const outboxModule = await import(pathToFileURL(`${sourceRoot}/services/hub-api/src/context-binding-outbox.ts`).href) as {
            dispatchContextBindingCommand(options: any): Promise<boolean>;
          };
          assert.equal(await outboxModule.dispatchContextBindingCommand({ pool: hubPool,
            config: { issuer: process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!, privateKeyPem: joinedContext.privateKeyPem,
              targets: { [joinedContext.contextInstanceId]: joinedContext.apiOrigin } } }), true,
          "Hub signs and delivers the pending binding command to the live Context API");
        }
        const enablementReadback = await api.inject({ method: "GET", url: `/api/v1/organizations/${organization.id}/projects/${project.id}/applications`, headers: ownerHeaders });
        assert.equal(enablementReadback.statusCode, 200, enablementReadback.body);
        assert.ok(enablementReadback.json().applications.some((entry: any) => entry.application.id === registered.id && entry.enabledBy === subjectClaims.sub), "authenticated owner enablement is durably visible through Hub API");
        const resourceRef = `nexus://${liveHubIds.organizationId}/${liveHubIds.projectId}/io.nexus.context/document/${contextAcceptanceDocumentId}`;
        const consentStart = await api.inject({
          method: "POST", url: `/api/v1/organizations/${liveHubIds.organizationId}/resources/delegated-consent`,
          headers: ownerHeaders,
          payload: { projectId: liveHubIds.projectId, registrationId: liveHubIds.registrationId, resourceRef, returnTo: "/?preview=accepted" },
        });
        assert.equal(consentStart.statusCode, 200, consentStart.body);
        const consentBody = consentStart.json() as { authorizationUrl: string };
        const delegatedFlowCookie = setCookieValues(consentStart.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_session_flow"));
        assert.ok(delegatedFlowCookie, "production Hub consent route returns a signed callback flow cookie");
        const issuerAuthorization = await fetch(consentBody.authorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
        assert.equal(issuerAuthorization.status, 302, await issuerAuthorization.clone().text());
        const issuerConsentUrl = new URL(issuerAuthorization.headers.get("location")!, origin);
        assert.equal(issuerConsentUrl.pathname, "/consent", "first resource consent requires the NexusID approval screen");
        const resourceConsentPreview = await fetch(new URL(`/oauth/consent/request${issuerConsentUrl.search}`, origin), {
          headers: { cookie: browserSid },
        });
        assert.equal(resourceConsentPreview.status, 200, await bodyText(resourceConsentPreview));
        const resourceConsentTicket = await resourceConsentPreview.json() as { requestId: string; authorization: Record<string, string> };
        const resourceApproved = await post("/oauth/consent", {
          consent_request_id: resourceConsentTicket.requestId,
          client_id: browserClient.client_id,
          redirect_uri: resourceConsentTicket.authorization.redirect_uri,
          scope: resourceConsentTicket.authorization.scope,
          state: resourceConsentTicket.authorization.state,
          nonce: resourceConsentTicket.authorization.nonce,
          decision: "approve", nexushub_profile: resourceConsentTicket.authorization.nexushub_profile,
          nexushub_installation_id: resourceConsentTicket.authorization.nexushub_installation_id,
          resource_audience: resourceConsentTicket.authorization.resource_audience,
        }, browserCsrf.headers);
        assert.equal(resourceApproved.status, 200, resourceApproved.raw);
        const issuerCallbackRedirect = await fetch(consentBody.authorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
        assert.equal(issuerCallbackRedirect.status, 302, await issuerCallbackRedirect.clone().text());
        const delegatedCallback = new URL(issuerCallbackRedirect.headers.get("location")!);
        assert.equal(delegatedCallback.origin + delegatedCallback.pathname, browserRedirectUri);
        const callback = await browserApp.inject({ method: "GET", url: `/auth/callback${delegatedCallback.search}`, headers: { cookie: `${sessionCookies}; ${delegatedFlowCookie}` } });
        assert.equal(callback.statusCode, 302, callback.body);
        assert.equal(callback.headers.location, "/?preview=accepted");
        const delegatedCookie = setCookieValues(callback.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_delegated_"));
        assert.ok(delegatedCookie, "NexusID code returns through the production Hub callback and is stored as a bound delegated cookie");
        const managedCookie = `${sessionCookies}; ${delegatedCookie}`;
        contextPreviewCookie = managedCookie;
        const tokenResponse = await api.inject({
          method: "POST", url: `/api/v1/organizations/${liveHubIds.organizationId}/resources/delegated-token`,
          headers: { cookie: managedCookie, "x-csrf-token": csrfToken },
          payload: { projectId: liveHubIds.projectId, registrationId: liveHubIds.registrationId, resourceRef },
        });
        assert.equal(tokenResponse.statusCode, 200, tokenResponse.body);
        const tokenBody = tokenResponse.json() as { accessToken: string; audience: string; scopes: string[] };
        assert.equal(tokenBody.audience, crm);
        assert.deepEqual(tokenBody.scopes, ["nexuscontext.document.preview"]);
        assert.deepEqual((await introspect(resource, crm, tokenBody.accessToken)).body, { active: true }, "Context resource client recognizes the Hub-brokered token");
        contextPreviewToken = tokenBody.accessToken;
        // The same live acceptance also uses Hub federated search. Obtain its
        // narrower search grant through Hub's production consent route rather
        // than broadening the metadata preview grant.
        const searchStart = await api.inject({ method: "POST", url: `/api/v1/organizations/${liveHubIds.organizationId}/search/delegated-consent`,
          headers: { cookie: sessionCookies, "x-csrf-token": csrfToken },
          payload: { projectId: liveHubIds.projectId, registrationId: liveHubIds.registrationId, returnTo: "/?search=accepted" } });
        assert.equal(searchStart.statusCode, 200, searchStart.body);
        const searchFlowCookie = setCookieValues(searchStart.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_session_flow"));
        assert.ok(searchFlowCookie, "Hub's search consent route starts a distinct signed issuer flow");
        const searchAuthorizationUrl = searchStart.json<{ authorizationUrl: string }>().authorizationUrl;
        const searchAuthorization = await fetch(searchAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
        assert.equal(searchAuthorization.status, 302, await searchAuthorization.clone().text());
        const searchAuthorizationDestination = new URL(searchAuthorization.headers.get("location")!, origin);
        assert.equal(searchAuthorizationDestination.pathname, "/consent", "a newly requested search scope requires explicit consent");
        if (searchAuthorizationDestination.pathname === "/consent") {
          const reviewScopes = searchAuthorizationDestination.searchParams.get("scope");
          assert.equal(reviewScopes, "openid profile nexuscontext.document.preview nexuscontext.search",
            "the screen makes clear that approval replaces the full resource grant");
          const searchConsentPreview = await fetch(new URL(`/oauth/consent/request${searchAuthorizationDestination.search}`, origin), {
            headers: { cookie: browserSid },
          });
          assert.equal(searchConsentPreview.status, 200, await bodyText(searchConsentPreview));
          const searchConsentTicket = await searchConsentPreview.json() as { requestId: string; authorization: Record<string, string> };
          const searchApproved = await post("/oauth/consent", { client_id: browserClient.client_id,
            consent_request_id: searchConsentTicket.requestId,
            redirect_uri: searchConsentTicket.authorization.redirect_uri, scope: searchConsentTicket.authorization.scope,
            state: searchConsentTicket.authorization.state, nonce: searchConsentTicket.authorization.nonce,
            nexushub_profile: searchConsentTicket.authorization.nexushub_profile,
            nexushub_installation_id: searchConsentTicket.authorization.nexushub_installation_id,
            resource_audience: searchConsentTicket.authorization.resource_audience,
            decision: "approve" }, browserCsrf.headers);
          assert.equal(searchApproved.status, 200, searchApproved.raw);
        }
        const searchRedirect = await fetch(searchAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
        assert.equal(searchRedirect.status, 302, await searchRedirect.clone().text());
        const searchCallbackUrl = new URL(searchRedirect.headers.get("location")!);
        const searchCallback = await browserApp.inject({ method: "GET", url: `/auth/callback${searchCallbackUrl.search}`, headers: { cookie: `${sessionCookies}; ${searchFlowCookie}` } });
        assert.equal(searchCallback.statusCode, 302, searchCallback.body);
        const searchDelegatedCookie = setCookieValues(searchCallback.headers["set-cookie"]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_delegated_"));
        assert.ok(searchDelegatedCookie, "NexusID search authorization returns through the Hub callback");
        contextPreviewCookie = `${contextPreviewCookie}; ${searchDelegatedCookie}`;
        const searchToken = await api.inject({ method: "POST", url: `/api/v1/organizations/${liveHubIds.organizationId}/search/delegated-token`,
          headers: { cookie: contextPreviewCookie, "x-csrf-token": csrfToken }, payload: { projectId: liveHubIds.projectId, registrationId: liveHubIds.registrationId } });
        assert.equal(searchToken.statusCode, 200, searchToken.body);
        assert.deepEqual(searchToken.json().scopes, ["nexuscontext.search"]);
        contextSearchToken = searchToken.json<{ accessToken: string }>().accessToken;
        contextWireHubCookie = contextPreviewCookie;
        if (joinedBrowser) {
          // The wire acceptance has its own Context space and therefore needs
          // a distinct active Hub binding. Create that project through the
          // owner API and obtain a real project-bound search consent rather
          // than reusing the browser project's delegated cookie.
          const wireProjectResponse = await api.inject({ method: "POST",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/projects`, headers: ownerHeaders,
            payload: { slug: `context-wire-${randomUUID().slice(0, 8)}`, name: "Context wire acceptance" } });
          assert.equal(wireProjectResponse.statusCode, 201, wireProjectResponse.body);
          contextWireProjectId = wireProjectResponse.json().project.id;
          const wireEnablement = await api.inject({ method: "PUT",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/projects/${contextWireProjectId}/applications/${liveHubIds.registrationId}`,
            headers: ownerHeaders });
          assert.equal(wireEnablement.statusCode, 200, wireEnablement.body);
          const wireResourceRef = `nexus://${liveHubIds.organizationId}/${contextWireProjectId}/io.nexus.context/document/${contextAcceptanceDocumentId}`;
          const wireResourceStart = await api.inject({ method: "POST",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/resources/delegated-consent`,
            headers: ownerHeaders,
            payload: { projectId: contextWireProjectId, registrationId: liveHubIds.registrationId,
              resourceRef: wireResourceRef, returnTo: "/?wire-preview=accepted" } });
          assert.equal(wireResourceStart.statusCode, 200, wireResourceStart.body);
          const wireResourceFlowCookie = setCookieValues(wireResourceStart.headers["set-cookie"])
            .map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_session_flow"));
          assert.ok(wireResourceFlowCookie, "distinct wire project receives its own signed resource consent flow");
          const wireResourceAuthorizationUrl = wireResourceStart.json<{ authorizationUrl: string }>().authorizationUrl;
          let wireResourceRedirect = await fetch(wireResourceAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
          assert.equal(wireResourceRedirect.status, 302, await wireResourceRedirect.clone().text());
          let wireResourceCallbackUrl = new URL(wireResourceRedirect.headers.get("location")!, origin);
          if (wireResourceCallbackUrl.pathname === "/consent") {
            const wireResourceConsentPreview = await fetch(new URL(`/oauth/consent/request${wireResourceCallbackUrl.search}`, origin), {
              headers: { cookie: browserSid },
            });
            assert.equal(wireResourceConsentPreview.status, 200, await bodyText(wireResourceConsentPreview));
            const ticket = await wireResourceConsentPreview.json() as { requestId: string; authorization: Record<string, string> };
            const approved = await post("/oauth/consent", {
              client_id: browserClient.client_id, consent_request_id: ticket.requestId,
              redirect_uri: ticket.authorization.redirect_uri, scope: ticket.authorization.scope,
              state: ticket.authorization.state, nonce: ticket.authorization.nonce,
              nexushub_profile: ticket.authorization.nexushub_profile,
              nexushub_installation_id: ticket.authorization.nexushub_installation_id,
              resource_audience: ticket.authorization.resource_audience, decision: "approve",
            }, browserCsrf.headers);
            assert.equal(approved.status, 200, approved.raw);
            wireResourceRedirect = await fetch(wireResourceAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
            assert.equal(wireResourceRedirect.status, 302, await wireResourceRedirect.clone().text());
            wireResourceCallbackUrl = new URL(wireResourceRedirect.headers.get("location")!, origin);
          }
          assert.equal(wireResourceCallbackUrl.origin + wireResourceCallbackUrl.pathname, browserRedirectUri);
          const wireResourceCallback = await browserApp.inject({ method: "GET", url: `/auth/callback${wireResourceCallbackUrl.search}`,
            headers: { cookie: `${sessionCookies}; ${wireResourceFlowCookie}` } });
          assert.equal(wireResourceCallback.statusCode, 302, wireResourceCallback.body);
          const wireResourceDelegatedCookie = setCookieValues(wireResourceCallback.headers["set-cookie"])
            .map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_delegated_"));
          assert.ok(wireResourceDelegatedCookie, "NexusID returns the distinct project's preview consent through Hub callback");
          contextWireHubCookie = `${sessionCookies}; ${wireResourceDelegatedCookie}`;
          const wireResourceToken = await api.inject({ method: "POST",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/resources/delegated-token`,
            headers: { cookie: contextWireHubCookie, "x-csrf-token": csrfToken },
            payload: { projectId: contextWireProjectId, registrationId: liveHubIds.registrationId, resourceRef: wireResourceRef } });
          assert.equal(wireResourceToken.statusCode, 200, wireResourceToken.body);
          assert.deepEqual(wireResourceToken.json().scopes, ["nexuscontext.document.preview"]);
          contextPreviewToken = wireResourceToken.json<{ accessToken: string }>().accessToken;
          const wireSearchStart = await api.inject({ method: "POST",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/search/delegated-consent`,
            headers: ownerHeaders,
            payload: { projectId: contextWireProjectId, registrationId: liveHubIds.registrationId, returnTo: "/?wire-search=accepted" } });
          assert.equal(wireSearchStart.statusCode, 200, wireSearchStart.body);
          const wireFlowCookie = setCookieValues(wireSearchStart.headers["set-cookie"])
            .map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_session_flow"));
          assert.ok(wireFlowCookie, "distinct wire project receives its own signed Hub consent flow");
          const wireAuthorizationUrl = wireSearchStart.json<{ authorizationUrl: string }>().authorizationUrl;
          let wireRedirect = await fetch(wireAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
          assert.equal(wireRedirect.status, 302, await wireRedirect.clone().text());
          let wireCallbackUrl = new URL(wireRedirect.headers.get("location")!, origin);
          if (wireCallbackUrl.pathname === "/consent") {
            const wireConsentPreview = await fetch(new URL(`/oauth/consent/request${wireCallbackUrl.search}`, origin), {
              headers: { cookie: browserSid },
            });
            assert.equal(wireConsentPreview.status, 200, await bodyText(wireConsentPreview));
            const ticket = await wireConsentPreview.json() as { requestId: string; authorization: Record<string, string> };
            const approved = await post("/oauth/consent", {
              client_id: browserClient.client_id, consent_request_id: ticket.requestId,
              redirect_uri: ticket.authorization.redirect_uri, scope: ticket.authorization.scope,
              state: ticket.authorization.state, nonce: ticket.authorization.nonce,
              nexushub_profile: ticket.authorization.nexushub_profile,
              nexushub_installation_id: ticket.authorization.nexushub_installation_id,
              resource_audience: ticket.authorization.resource_audience, decision: "approve",
            }, browserCsrf.headers);
            assert.equal(approved.status, 200, approved.raw);
            wireRedirect = await fetch(wireAuthorizationUrl, { headers: { cookie: browserSid }, redirect: "manual" });
            assert.equal(wireRedirect.status, 302, await wireRedirect.clone().text());
            wireCallbackUrl = new URL(wireRedirect.headers.get("location")!, origin);
          }
          assert.equal(wireCallbackUrl.origin + wireCallbackUrl.pathname, browserRedirectUri);
          const wireCallback = await browserApp.inject({ method: "GET", url: `/auth/callback${wireCallbackUrl.search}`,
            headers: { cookie: `${sessionCookies}; ${wireFlowCookie}` } });
          assert.equal(wireCallback.statusCode, 302, wireCallback.body);
          const wireDelegatedCookie = setCookieValues(wireCallback.headers["set-cookie"])
            .map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_delegated_"));
          assert.ok(wireDelegatedCookie, "NexusID returns the distinct project's search consent through Hub callback");
          contextWireHubCookie = `${contextWireHubCookie}; ${wireDelegatedCookie}`;
          const wireSearchToken = await api.inject({ method: "POST",
            url: `/api/v1/organizations/${liveHubIds.organizationId}/search/delegated-token`,
            headers: { cookie: contextWireHubCookie, "x-csrf-token": csrfToken },
            payload: { projectId: contextWireProjectId, registrationId: liveHubIds.registrationId } });
          assert.equal(wireSearchToken.statusCode, 200, wireSearchToken.body);
          assert.deepEqual(wireSearchToken.json().scopes, ["nexuscontext.search"]);
          contextSearchToken = wireSearchToken.json<{ accessToken: string }>().accessToken;
        }
        contextPreviewClient = browserClient.client_id;
        if (joinedBrowser && process.env.NEXUSHUB_CONTEXT_SEARCH_ONLY_ACCEPTANCE !== "1") {
          const driverPath = `${process.env.NEXUSHUB_CONTEXT_ROOT}/apps/web/e2e/nexushub-live-browser-driver.mjs`;
          const driver = spawn(process.execPath, [driverPath], { cwd: `${process.env.NEXUSHUB_CONTEXT_ROOT}/apps/web`,
            env: { ...process.env, NODE_EXTRA_CA_CERTS: process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT,
              PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? `${process.env.HOME}/.cache/ms-playwright` },
            stdio: ["pipe", "pipe", "pipe"] });
          const driverInput = { contextWebOrigin: joinedContext.webOrigin, contextApiOrigin: joinedContext.webOrigin,
            hubOrigin: process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN!, issuerOrigin: process.env.NEXUSHUB_CONTEXT_BROWSER_ISSUER_ORIGIN!,
            username: "context-member@example.test", password: joinedContext.memberPassword,
            documentTitle: joinedContext.documentTitle, resourceRef: joinedContext.bound.resourceRef,
            expectedPreviewText: "Live NexusContext resource",
            documentId: joinedContext.documentId,
            spaceId: joinedContext.spaceId, memberPrincipalId: joinedContext.memberPrincipalId,
            memberSubject: joinedContext.memberSubject, ownerBearer: joinedContext.ownerToken,
            membershipGrant: joinedContext.membershipGrant,
            ownerHubBearer: contextOwnerHubBearer,
            hubCheckpointEndpoint: `${process.env.NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN}/api/v1/projects/${liveHubIds.projectId}/context-membership-checkpoints`,
            hubCheckpointRequest: { organizationId: liveHubIds.organizationId, contextBindingId: joinedContext.bound.bindingId,
              contextInstanceId: joinedContext.contextInstanceId, contextTenantId: joinedContext.tenantId, contextSpaceId: joinedContext.spaceId },
            caCertPath: process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT,
            browserHome: process.env.NEXUSHUB_CONTEXT_BROWSER_HOME,
            hostResolverRules: process.env.NEXUSHUB_CONTEXT_BROWSER_HOST_RESOLVER_RULES };
          driver.stdin.end(JSON.stringify(driverInput));
          let driverOutput = "";
          driver.stdout.on("data", (chunk) => { driverOutput += chunk.toString(); });
          driver.stderr.on("data", (chunk) => { driverOutput += chunk.toString(); });
          const [driverExit] = await once(driver, "exit") as [number | null];
          assert.equal(driverExit, 0, `same-browser Context preview/revocation acceptance failed: ${driverOutput}\nContext service error-class diagnostics:\n${contextFixtureError.slice(-4000)}`);
          const driverEvidence = JSON.parse(driverOutput) as { ok: boolean; evidence: { events: string[]; statuses: Array<{ url: string; status: number }> } };
          assert.equal(driverEvidence.ok, true);
          for (const event of ["context_oidc_session_established", "owner_membership_granted_to_browser_principal",
            "hub_oauth_session_established_in_shared_browser_context", "live_resource_preview_rendered",
            "default_markdown_download_remained_reference_only",
            "selected_snapshot_download_required_opt_in_and_fetched_fresh_hub_context_metadata",
            "owner_membership_revoked", "same_browser_member_preview_denied_after_revoke",
            "revoked_selected_snapshot_export_denied_without_download"]) assert.ok(driverEvidence.evidence.events.includes(event), `browser evidence contains ${event}`);
          assert.ok(driverEvidence.evidence.statuses.some(({ url, status }) => url.startsWith(joinedContext.webOrigin) && status === 200),
            "Chromium observed successful Context HTTPS API responses");
        }
        if (!joinedBrowser) await api.close();
      } finally {
        if (contextFixture && contextFixture.exitCode === null) {
          contextFixture.stdin?.write('{"cmd":"stop"}\n');
          await waitForChildExit(contextFixture, 10_000);
          if (contextFixture.exitCode === null) { contextFixture.kill("SIGTERM"); await waitForChildExit(contextFixture, 3_000); }
        }
        if (contextWeb && contextWeb.exitCode === null) {
          contextWeb.kill("SIGTERM");
          await waitForChildExit(contextWeb, 10_000);
          if (contextWeb.exitCode === null) { contextWeb.kill("SIGKILL"); await waitForChildExit(contextWeb, 3_000); }
        }
        if (liveHubApi) await liveHubApi.close().catch(() => undefined);
        if (liveHubTlsProxy) await new Promise<void>((resolveClose) => liveHubTlsProxy!.close(() => resolveClose()));
        if (joinedContext?.configPath) await rm(joinedContext.configPath, { force: true });
        await hubPool.end();
      }
    }
    const replayCallback = await browserApp.inject({
      method: "GET", url: `/auth/callback${browserCallbackUrl.search}`,
      headers: { cookie: hubFlowCookie! },
    });
    assert.equal(replayCallback.statusCode, 401, "NexusID rejects replay of the already-consumed authorization code");
    const started = await hubOidc.beginDelegatedSearchAuthorization({
      headers: {
        cookie: `nexus_hub_session=${encodeURIComponent(subjectToken)}; nexus_hub_session_csrf=csrf`,
        "x-csrf-token": "csrf",
      },
      audience: crm, scopes: ["nexuscontext.search", "nexuscontext.document.preview"], returnTo: "/?search=test", binding: projectBinding,
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") throw new Error("Hub did not start the live delegated authorization flow");
    const authorization = await fetch(started.authorizationUrl, {
      headers: { cookie: csrf.headers.cookie }, redirect: "manual",
    });
    assert.equal(authorization.status, 302, await authorization.clone().text());
    const authorizationRedirect = authorization.headers.get("location");
    assert.ok(authorizationRedirect, "NexusID returned the authorization code to Hub's registered callback");
    const callbackUrl = new URL(authorizationRedirect!);
    assert.equal(callbackUrl.origin + callbackUrl.pathname, "http://127.0.0.1/auth/callback");
    const flowCookie = started.flowCookie.split(";")[0];
    const callback = await hubApp.inject({
      method: "GET", url: `/auth/callback${callbackUrl.search}`,
      headers: { cookie: `nexus_hub_session=${encodeURIComponent(subjectToken)}; nexus_hub_session_csrf=csrf; ${flowCookie}` },
    });
    assert.equal(callback.statusCode, 302, callback.body);
    assert.equal(callback.headers.location, "/?search=test");
    const delegatedCookie = (callback.headers["set-cookie"] as string[]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookieNameIs(cookie, "nexus_hub_delegated_"));
    assert.ok(delegatedCookie, "Hub's production callback stores the live NexusID source token in the exact resource/binding cookie");
    const brokerHeaders = {
      cookie: `nexus_hub_session=${encodeURIComponent(subjectToken)}; nexus_hub_session_csrf=csrf; ${delegatedCookie}`,
      "x-csrf-token": "csrf",
    };
    let brokerExchangeDiagnostic: { status: number; error?: string; description?: string; scope?: string; tokenType?: string; expiresIn?: number; hasAccessToken?: boolean; accessTokenLength?: number } | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (target.pathname === "/oauth/token/exchange" || target.pathname === "/oauth/token") {
        const body = await response.clone().json().catch(() => undefined) as { error?: unknown; error_description?: unknown; scope?: unknown; token_type?: unknown; expires_in?: unknown; access_token?: unknown } | undefined;
        brokerExchangeDiagnostic = {
          status: response.status,
          ...(typeof body?.error === "string" ? { error: body.error } : {}),
          ...(typeof body?.error_description === "string" ? { description: body.error_description } : {}),
          ...(typeof body?.scope === "string" ? { scope: body.scope } : {}),
          ...(typeof body?.token_type === "string" ? { tokenType: body.token_type } : {}),
          ...(typeof body?.expires_in === "number" ? { expiresIn: body.expires_in } : {}),
          ...(typeof body?.access_token === "string" ? { hasAccessToken: true, accessTokenLength: body.access_token.length } : {}),
        };
      }
      return response;
    };
    let brokered;
    try {
      brokered = await hubOidc.exchangeDelegatedSearchToken({
        headers: brokerHeaders, audience: crm, scopes: ["nexuscontext.search", "nexuscontext.document.preview"], binding: projectBinding,
        actor: { appId: "io.nexus.context", registrationId: liveHubIds.registrationId, organizationId: liveHubIds.organizationId, projectId: liveHubIds.projectId },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    if (brokered.status !== "issued") {
      const adminSid = await loginCookie("sso-admin-ui");
      const audit = await request("/api/admin/audit?type=token_exchange_denied&limit=20", "GET", undefined, { cookie: adminSid });
      const entries = Array.isArray(audit.body) ? audit.body : Array.isArray(audit.body?.items) ? audit.body.items : [];
      const brokerAudit = entries.find((entry: any) => entry.metadata?.profile === "nexushub:1" && entry.metadata?.resource === crm);
      brokerExchangeDiagnostic = {
        ...brokerExchangeDiagnostic!,
        ...(typeof brokerAudit?.metadata?.reason === "string" ? { description: `audit:${brokerAudit.metadata.reason}` } : {}),
      };
    }
    assert.equal(brokered.status, "issued", `Hub's production broker re-exchanges the live NexusID delegation only for its exact bound cookie tuple; endpoint=${JSON.stringify(brokerExchangeDiagnostic)}`);
    assert.equal(typeof brokered.accessToken, "string");
    assert.ok((brokered.expiresIn ?? 0) <= 600);
    hubBrokeredToken = brokered.accessToken;
    const { payload: brokeredActorClaims } = await jwtVerify(brokered.accessToken!, jwks, { issuer: origin.toString().replace(/\/$/, ""), audience: crm });
    assert.deepEqual(brokeredActorClaims.act, {
      sub: "io.nexus.context", registration_id: liveHubIds.registrationId, organization_id: liveHubIds.organizationId,
      project_id: liveHubIds.projectId, act: { sub: hub.client_id },
    }, "NexusID's issuer-signed token preserves the Hub-authenticated app-to-installation actor chain");
    assert.deepEqual(String(brokeredActorClaims.scope).split(" ").sort(), ["nexuscontext.document.preview", "nexuscontext.search"].sort());
    assert.deepEqual((await introspect(resource, crm, brokered.accessToken!)).body, { active: true }, "Context's configured NexusID resource client can introspect the token returned by Hub's production broker");
    const wrongBinding = await hubOidc.exchangeDelegatedSearchToken({
      headers: brokerHeaders, audience: crm, scopes: ["nexuscontext.search", "nexuscontext.document.preview"], binding: `${projectBinding}-other`,
      actor: { appId: "io.nexus.context", registrationId: liveHubIds.registrationId, organizationId: liveHubIds.organizationId, projectId: liveHubIds.projectId },
    });
    assert.deepEqual(wrongBinding, { status: "denied" }, "delegated consent cookie cannot be replayed for another binding");
    if (process.env.NEXUSHUB_CONTEXT_ACCEPTANCE === "1") {
      const contextRoot = process.env.NEXUSHUB_CONTEXT_ROOT;
      const contextDatabaseUrl = process.env.NEXUSHUB_CONTEXT_DATABASE_URL;
      const contextAppDatabaseUrl = process.env.NEXUSHUB_CONTEXT_APP_DATABASE_URL;
      assert.ok(contextRoot && contextDatabaseUrl && contextAppDatabaseUrl, "combined acceptance needs the disposable NexusContext test database and source root");
      const callback = createServer(async (incoming, response) => {
        if (incoming.method !== "POST" || incoming.url !== "/revoke-consent") {
          response.writeHead(404).end();
          return;
        }
        const listed = await request("/api/account/nexushub-consents", "GET", undefined, browserCsrf.headers);
        const grants = Array.isArray(listed.body?.consents) ? listed.body.consents as Array<Record<string, unknown>> : [];
        const grant = grants.find((item) => item.clientId === browserClient.client_id &&
          item.installationId === browserClient.client_id && item.resource === crm);
        const result = grant
          ? await post("/api/account/nexushub-consents", {
              client_id: grant.clientId, installation_id: grant.installationId, resource: grant.resource,
            }, browserCsrf.headers, "DELETE")
          : { status: listed.status === 200 ? 404 : listed.status, raw: "", headers: listed.headers };
        if (result.status === 204) {
          response.writeHead(204).end();
          return;
        }
        let errorCode = "unclassified_error";
        let responseShape = "non_json";
        try {
          const parsed = JSON.parse(result.raw) as Record<string, unknown>;
          responseShape = Object.keys(parsed).sort().join(",").slice(0, 120) || "empty_object";
          for (const candidate of [parsed.error, parsed.code, (parsed.error as Record<string, unknown> | undefined)?.code]) {
            if (typeof candidate === "string" && /^[a-z0-9_-]{1,64}$/i.test(candidate)) {
              errorCode = candidate;
              break;
            }
          }
        } catch { /* report only content shape/status when NexusID did not return JSON */ }
        response.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({
          upstreamStatus: result.status,
          errorCode,
          responseShape,
          contentType: result.headers.get("content-type")?.split(";")[0] ?? "missing",
          consentListStatus: listed.status,
          matchingGrantFound: Boolean(grant),
        }));
      });
      callback.listen(0, "127.0.0.1");
      await once(callback, "listening");
      const callbackAddress = callback.address();
      assert.ok(callbackAddress && typeof callbackAddress !== "string");
      const contextService = `${contextRoot}/services/context`;
      const python = `${contextService}/.venv/bin/python`;
      // The nested wire acceptance creates its own active Hub binding for a
      // fixture-built Context tuple. Keep that project separate from the
      // joined browser project's already active binding.
      const contextAcceptanceToken = process.env.NEXUSHUB_CONTEXT_SEARCH_ONLY_ACCEPTANCE === "1"
        ? contextSearchToken : contextPreviewToken;
      assert.ok(contextAcceptanceToken, process.env.NEXUSHUB_CONTEXT_SEARCH_ONLY_ACCEPTANCE === "1"
        ? "Context search acceptance is supplied the search-scoped token brokered through Hub's delegated-search route"
        : "Context preview acceptance is supplied the token brokered through Hub's delegated-consent route");
      const child = spawn(python, ["-m", "pytest", "-q", "tests/test_nexushub_preview_checkpoint_wire_acceptance.py"], {
        cwd: contextService,
        env: {
          ...process.env,
          ...(process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT
            ? { SSL_CERT_FILE: process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT }
            : {}),
          NEXUS_TEST_DATABASE_URL: contextDatabaseUrl,
          NEXUS_TEST_APP_DATABASE_URL: contextAppDatabaseUrl,
          NEXUSHUB_CONTEXT_ACCEPTANCE_TOKEN: contextAcceptanceToken,
          NEXUSHUB_CONTEXT_ACCEPTANCE_ISSUER: origin.toString().replace(/\/$/, ""),
          NEXUSHUB_CONTEXT_ACCEPTANCE_AUDIENCE: crm,
          NEXUSHUB_CONTEXT_ACCEPTANCE_INSTALLATION_ID: contextPreviewClient,
          NEXUSHUB_CONTEXT_ACCEPTANCE_DOCUMENT_ID: contextAcceptanceDocumentId,
          NEXUSHUB_CONTEXT_RESOURCE_CLIENT_ID: resource.client_id,
          NEXUSHUB_CONTEXT_RESOURCE_CLIENT_SECRET: resource.client_secret,
          NEXUSHUB_CONTEXT_REVOCATION_CALLBACK: `http://127.0.0.1:${callbackAddress.port}/revoke-consent`,
          NEXUSHUB_HUB_DATABASE_URL: process.env.NEXUSHUB_HUB_DATABASE_URL ?? "",
          NEXUSHUB_HUB_SUBJECT_TOKEN: contextOwnerHubBearer ?? subjectToken,
          NEXUSHUB_HUB_COOKIE: contextWireHubCookie,
          NEXUSHUB_HUB_ORGANIZATION_ID: liveHubIds.organizationId,
          NEXUSHUB_HUB_PROJECT_ID: contextWireProjectId,
          ...(goldenHubProjectIds.beta ? { NEXUSHUB_GOLDEN_BETA_PROJECT_ID: goldenHubProjectIds.beta } : {}),
          ...(goldenHubProjectIds.gamma ? { NEXUSHUB_GOLDEN_GAMMA_PROJECT_ID: goldenHubProjectIds.gamma } : {}),
          NEXUSHUB_HUB_REGISTRATION_ID: liveHubIds.registrationId,
          ...(contextHubInstanceId ? { NEXUSHUB_HUB_INSTANCE_ID: contextHubInstanceId } : {}),
          NEXUSHUB_HUB_CLIENT_ID: contextPreviewClient,
          NEXUSHUB_HUB_CLIENT_SECRET: browserClient.client_secret,
          NEXUSHUB_HUB_FLOW_SIGNING_KEY: "nexusid-live-browser-pkce-acceptance-signing-key",
          ...(process.env.NEXUSID_CUSTOMER_ISSUER_ORIGIN
            ? { NEXUSID_CUSTOMER_ISSUER_ORIGIN: process.env.NEXUSID_CUSTOMER_ISSUER_ORIGIN }
            : {}),
          ...(process.env.NEXUSHUB_GOLDEN_IDENTITY_SEPARATION_ACCEPTANCE === "1"
            ? { NEXUSHUB_GOLDEN_IDENTITY_SEPARATION_ACCEPTANCE: "1" }
            : {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let contextOutput = "";
      child.stdout.on("data", (chunk) => { contextOutput += chunk.toString(); });
      child.stderr.on("data", (chunk) => { contextOutput += chunk.toString(); });
      const [exitCode] = await once(child, "exit") as [number | null];
      await new Promise<void>((resolveClose, rejectClose) => callback.close((error) => error ? rejectClose(error) : resolveClose()));
      assert.equal(exitCode, 0, `combined NexusHub→NexusID→NexusContext acceptance failed: ${contextOutput}`);
      assert.match(contextOutput, /^2 passed(?:,| in)/m,
        "combined Context acceptance requires both the live process test and evidence contract test to pass");
      assert.deepEqual((await introspect(resource, crm, contextAcceptanceToken)).body, { active: false },
        "Context's user-driven revocation removes the Hub browser client's delegated resource consent");
    }
    if (joinedBrowser) {
      // The real Hub listener and Context/Vite processes remain live through Chromium above.
    }
    await hubApp.close();
  }

  assert.deepEqual((await introspect(resource)).body, { active: true }, "the independent Hub installation's token remains active until its own user revocation");
  assert.deepEqual((await introspect(resource, docs)).body, { active: false }, "wrong resource audience is inactive");
  assert.deepEqual((await introspect(wrongResource, crm)).body, { active: false }, "resource client without the exact audience allowlist is denied");
  assert.equal((await post("/oauth/nexushub/delegation/resource-introspect", { token: delegated, client_id: resource.client_id, client_secret: wrongResource.client_secret, resource_audience: crm })).status, 401, "wrong resource-server client credentials are rejected");

  const revoked = await post("/api/account/nexushub-consents", { client_id: hub.client_id, installation_id: installation, resource: crm }, csrf.headers, "DELETE");
  assert.equal(revoked.status, 204, await bodyText(revoked));
  assert.deepEqual((await introspect(resource)).body, { active: false }, "consent revocation is immediately observed by live resource introspection");
  if (hubBrokeredToken) {
    assert.deepEqual((await introspect(resource, crm, hubBrokeredToken)).body, { active: false }, "consent revocation immediately deactivates the token returned by Hub's production broker");
  }
  globalThis.fetch = nativeFetch;
});

async function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  const target = new URL(path, issuer);
  let response: Response;
  try { response = await fetch(target, { method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (error) { throw new Error(`Fetch to ${target.origin}${target.pathname} failed: ${String((error as any)?.cause?.code ?? (error as any)?.cause?.message ?? error)}`); }
  const raw = await response.text();
  let parsed: any = undefined;
  try { parsed = raw ? JSON.parse(raw) : undefined; } catch { /* retain raw text */ }
  return { status: response.status, body: parsed, raw, headers: response.headers };
}
function setCookieValues(value: string | string[] | undefined): string[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function exactCookieNameIs(cookie: string, name: string): boolean { return cookie.startsWith(`${name}=`) || cookie.startsWith(`__Host-${name}=`); }
function cookieNameIs(cookie: string, name: string): boolean {
  if (cookie.startsWith(`${name}=`) || cookie.startsWith(`__Host-${name}=`)) return true;
  return name.endsWith("_") && (cookie.startsWith(name) || cookie.startsWith(`__Host-${name}`));
}
const get = async (path: string) => (await request(path)).body;
const post = (path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") => request(path, method, body, headers);
const bodyText = async (result: { raw: string }) => result.raw;

async function loginCookie(clientId: string) {
  const response = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId, scope: ["openid", "profile"] });
  assert.equal(response.status, 200, response.raw);
  const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const sid = setCookie.map((value) => value.split(";")[0]).find((value) => value.startsWith("sid="));
  assert.ok(sid, "login returns a session cookie");
  return sid!;
}

async function csrfFor(sid: string) {
  const response = await request("/api/csrf-token", "GET", undefined, { cookie: sid });
  assert.equal(response.status, 200, response.raw);
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  const csrfCookie = cookieHeader.split(";")[0];
  const token = response.body.csrf_token;
  return { headers: { cookie: `${sid}; ${csrfCookie}`, "x-csrf-token": token } };
}

async function startTlsProxy(keyPath: string, certPath: string, tlsPort: number, upstreamPort: number) {
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
  const server = createHttpsServer({ key, cert }, (request, response) => {
    const upstream = httpRequest({ hostname: "127.0.0.1", port: upstreamPort, method: request.method,
      path: request.url, headers: { ...request.headers, host: `127.0.0.1:${upstreamPort}` } }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(tlsPort, "127.0.0.1", resolve));
  return server;
}

function readJsonRecords(child: ReturnType<typeof spawn>) {
  const records: any[] = [];
  let buffer = "";
  let failure = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try { records.push(JSON.parse(line)); }
      catch { failure += `\nnon-JSON fixture stdout: ${line.slice(0, 500)}`; }
    }
  });
  child.stderr.on("data", (chunk) => { failure += chunk.toString(); });
  return {
    async waitFor(type: string, timeoutMs: number) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const index = records.findIndex((record) => record?.type === type);
        if (index >= 0) return records.splice(index, 1)[0];
        if (child.exitCode !== null) throw new Error(`Context fixture exited before ${type}: ${failure}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Timed out waiting for Context fixture ${type}: ${failure}`);
    },
    failure: () => failure,
  };
}

async function waitForChildExit(child: ReturnType<typeof spawn>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && child.exitCode === null) await new Promise((resolve) => setTimeout(resolve, 50));
}

async function waitForHttpsOrigin(origin: string, caPath: string, child: ReturnType<typeof spawn>, timeoutMs: number) {
  const ca = await readFile(caPath);
  const url = new URL("/health/ready", origin);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Context Vite exited before HTTPS readiness (${child.exitCode})`);
    try {
      const status = await new Promise<number>((resolve, reject) => {
        const request = httpsRequest(url, { ca, servername: url.hostname,
          lookup: (_hostname, options, callback) => options?.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) }, response => {
          response.resume(); response.once("end", () => resolve(response.statusCode ?? 0));
        });
        request.once("error", reject); request.end();
      });
      if (status === 200) return;
      lastError = new Error(`HTTP ${status}`);
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Context Vite did not become ready over trusted HTTPS: ${String(lastError)}`);
}

async function liveHubRequest(origin: string, path: string, method: string, payload: unknown,
                              headers: Record<string, string>) {
  const response = await fetch(new URL(path, origin), { method,
    headers: { ...headers, "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload), redirect: "manual" });
  const raw = await response.text();
  let parsed: any;
  try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = raw; }
  return { statusCode: response.status, body: parsed, json: <T = any>() => parsed as T };
}

async function fetchLoopbackHttps(url: URL, input: RequestInfo | URL | string, init?: RequestInit): Promise<Response> {
  const source = input instanceof Request ? input : undefined;
  const headers = new Headers(source?.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const rawBody = init?.body ?? (source ? await source.clone().arrayBuffer() : undefined);
  const body = serializeHttpsBody(rawBody);
  const caPath = process.env.NEXUSHUB_CONTEXT_BROWSER_CA_CERT;
  const ca = caPath ? await readFile(caPath) : undefined;
  const bodyLength = httpsBodyContentLength(body);
  return await new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: init?.method ?? source?.method ?? "GET",
      headers: { ...Object.fromEntries(headers.entries()), ...(bodyLength === undefined ? {} : { "content-length": String(bodyLength) }) },
      ...(ca ? { ca } : {}), servername: url.hostname,
      lookup: (_hostname, options, callback) => options?.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve(new Response(httpsResponseBody(response.statusCode ?? 502, Buffer.concat(chunks)), {
        status: response.statusCode ?? 502, statusText: response.statusMessage, headers: response.headers as HeadersInit,
      })));
    });
    request.on("error", reject);
    if (body !== undefined && body !== null) request.write(body as any);
    request.end();
  });
}

function serializeHttpsBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  return body instanceof URLSearchParams ? body.toString() : body;
}

function httpsBodyContentLength(body: BodyInit | null | undefined): number | undefined {
  if (typeof body === "string") return Buffer.byteLength(body);
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return body.byteLength;
  return undefined;
}

function httpsResponseBody(status: number, body: Buffer): Buffer | null {
  return status === 204 || status === 205 || status === 304 ? null : body;
}

async function register(name: string, grants: string[], scope: string, redirectUris: string[], tokenEndpointAuthMethod: "client_secret_post" | "none" = "client_secret_post") {
  const sid = await loginCookie("sso-admin-ui");
  const csrf = await csrfFor(sid);
  const response = await post("/connect/register", { client_name: name, redirect_uris: redirectUris, grant_types: grants, scope, token_endpoint_auth_method: tokenEndpointAuthMethod }, csrf.headers);
  assert.equal(response.status, 201, response.raw);
  assert.equal(response.body.token_endpoint_auth_method, tokenEndpointAuthMethod);
  if (tokenEndpointAuthMethod === "none") assert.equal("client_secret" in response.body, false, "public registration must not issue a client secret");
  return { client_id: response.body.client_id as string, client_secret: response.body.client_secret as string | undefined };
}

async function updateClient(id: string, changes: Record<string, unknown>) {
  const sid = await loginCookie("sso-admin-ui");
  const csrf = await csrfFor(sid);
  return request(`/api/admin/clients/${encodeURIComponent(id)}`, "PUT", changes, csrf.headers);
}
