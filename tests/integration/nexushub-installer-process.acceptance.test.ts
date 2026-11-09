import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const enabled = process.env.NEXUSHUB_INSTALLER_PROCESS_ACCEPTANCE === "1";
const issuer = process.env.NEXUSID_RESOURCE_PROCESS_ISSUER;
const hubRoot = process.env.NEXUSHUB_SOURCE_ROOT;
const valid = enabled && Boolean(issuer && hubRoot && process.env.NEXUSID_RESOURCE_PROCESS_DATABASE_URL);

test("Hub self-installer provisions its NexusID client through a live PostgreSQL-backed issuer", { skip: !valid }, async () => {
  const origin = new URL(issuer!);
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(origin.hostname), "issuer must be loopback");
  const existingAdmin = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId: "sso-admin-ui", scope: ["openid", "profile", "email"] });
  if (existingAdmin.status !== 200) assert.equal((await post("/api/setup/initialize", { name: "Disposable Admin", email: "admin@example.test", username: "admin", password: "Disposable-Admin-Pass-42", databaseProvider: "postgresql", externalDatabaseUrl: process.env.NEXUSID_RESOURCE_PROCESS_DATABASE_URL })).status, 201);

  const admin = await adminHeaders();
  const created = await request("/api/admin/service-identities", "POST", {
    name: "NexusHub acceptance installer", description: "Disposable process acceptance", status: "active", allowedScopes: [], allowedAudiences: [], roleIds: [], groupIds: []
  }, admin);
  assert.equal(created.status, 201, created.raw);
  const identityId = created.body.id as string;
  const issued = await request(`/api/admin/service-identities/${encodeURIComponent(identityId)}/credentials`, "POST", { expiresInDays: 1 }, admin);
  assert.equal(issued.status, 201, issued.raw);
  const credentialId = issued.body.credential.clientId as string;
  const credentialRecordId = issued.body.credential.id as string;
  const credentialSecret = issued.body.plainClientSecret as string;
  assert.ok(credentialId && credentialRecordId && credentialSecret);
  const publicOrigin = "https://hub.acceptance.example.test";
  const liberideOrigin = "https://ide.acceptance.example.test";
  const enrollment = await request(`/api/admin/service-identities/${encodeURIComponent(identityId)}/nexushub-enrollment`, "PUT", { credentialId: credentialRecordId, publicOrigin, liberideOrigin }, admin);
  assert.equal(enrollment.status, 201, enrollment.raw);
  assert.deepEqual(enrollment.body.data.profileVersions, ["nexushub:1", "liberide:1"]);
  const hubClientId = `nh_${createHash("sha256").update(`nexushub-installation:${enrollment.body.data.installationId}`).digest("hex").slice(0, 40)}`;
  const runnerScopes = ["nexushub.liberide:build-job:claim", "nexushub.liberide:build-result:import"];
  const runnerCreated = await request("/api/admin/service-identities", "POST", {
    name: "NexusHub acceptance build runner", description: "Disposable audience-bound runner", status: "active",
    allowedScopes: runnerScopes, allowedAudiences: [hubClientId], roleIds: [], groupIds: [],
  }, admin);
  assert.equal(runnerCreated.status, 201, runnerCreated.raw);
  const runnerCredentialResponse = await request(`/api/admin/service-identities/${encodeURIComponent(runnerCreated.body.id)}/credentials`, "POST", { expiresInDays: 1 }, admin);
  assert.equal(runnerCredentialResponse.status, 201, runnerCredentialResponse.raw);
  const runnerCredential = runnerCredentialResponse.body;
  assert.ok(runnerCredential.credential.clientId && runnerCredential.plainClientSecret);
  const runnerReadback = await request(`/api/admin/service-identities/${encodeURIComponent(runnerCreated.body.id)}`, "GET", undefined, admin);
  assert.equal(runnerReadback.status, 200, runnerReadback.raw);
  assert.deepEqual([...runnerReadback.body.allowedScopes].sort(), [...runnerScopes].sort());
  assert.deepEqual(runnerReadback.body.allowedAudiences, [hubClientId]);
  assert.deepEqual(runnerReadback.body.roleIds ?? [], [], "the Hub build runner receives no NexusID roles");

  const root = resolve(hubRoot!);
  // The installer correctly refuses a secret store beneath world-writable
  // /tmp, so create the isolated private root beneath the trusted checkout.
  const installRoot = await mkdtemp(join(root, ".nexushub-issuer-install-"));
  try {
    const privateRoot = join(installRoot, ".nexushub-private");
    await mkdir(privateRoot, { mode: 0o700 });
    const provisioningSecretFile = join(privateRoot, "provisioning-secret");
    await writeFile(provisioningSecretFile, credentialSecret, { mode: 0o600, flag: "wx" });
    const [{ runInstallSelf }, { createPrivateNexusIdSecretStores }, { provisionNexusIdClientProfile, provisionNexusIdLiberIDEClientProfile }] = await Promise.all([
      import(pathToFileURL(join(root, "tools/install-self.ts")).href),
      import(pathToFileURL(join(root, "tools/nexusid-profile-store.ts")).href),
      import(pathToFileURL(join(root, "packages/installer/src/nexusid-client-profile.ts")).href)
    ]);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      NEXUSHUB_DB_PASSWORD: randomBytes(32).toString("base64url"),
      NEXUS_OIDC_FLOW_SIGNING_KEY: randomBytes(32).toString("base64url"),
      NEXUS_OIDC_ISSUER: origin.origin,
      NEXUS_PUBLIC_ORIGIN: publicOrigin,
      NEXUSHUB_NEXUSID_PROVISIONING_ENABLED: "true",
      NEXUSHUB_NEXUSID_PROVISIONING_CLIENT_ID: credentialId,
      NEXUSHUB_NEXUSID_PROVISIONING_CLIENT_SECRET_FILE: provisioningSecretFile,
    };
    const events: string[] = [];
    const stores = createPrivateNexusIdSecretStores({ root: installRoot, provisioningSecretFile });
    const hubIssuerBodies: string[] = [];
    const captureHubIssuer = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      hubIssuerBodies.push(await response.clone().text());
      return response;
    };
    await runInstallSelf("apply", env, installRoot, {
      checkInputs: async (received) => { assert.ok(received.NEXUS_OIDC_CLIENT_ID); assert.ok(received.NEXUS_OIDC_CLIENT_SECRET); events.push(`inputs:${received.NEXUS_OIDC_CLIENT_ID}`); },
      run: async (_program, args) => { events.push(`compose:${args.at(-1)}`); },
      bootstrapHub: async (received) => {
        assert.equal(received.NEXUS_OIDC_ISSUER, origin.origin);
        assert.equal(received.NEXUS_OIDC_CLIENT_ID?.startsWith("nh_"), true);
        assert.ok(received.NEXUS_OIDC_CLIENT_SECRET);
        events.push("bootstrap");
      },
      waitForReady: async () => { events.push("ready"); },
      write: () => undefined,
      hydrateNexusId: async (received) => {
        const metadata = await stores.metadata.read();
        if (metadata) {
          received.NEXUS_OIDC_CLIENT_ID = metadata.clientId;
          received.NEXUS_OIDC_CLIENT_SECRET = await stores.secrets.get(metadata.clientSecretRef);
        }
        events.push("hydrate");
      },
      provisionNexusId: async (received) => {
        const metadata = await provisionNexusIdClientProfile({
          issuer: received.NEXUS_OIDC_ISSUER!, publicOrigin: received.NEXUS_PUBLIC_ORIGIN!, credentialId: received.NEXUSHUB_NEXUSID_PROVISIONING_CLIENT_ID!,
          credentialSecretRef: "file:nexusid-provisioning-credential", clientSecretRef: "file:nexusid-client-secret",
          credentials: stores.credentials, secrets: stores.secrets, metadata: stores.metadata, allowLoopbackHttp: true, fetch: captureHubIssuer
        });
        received.NEXUS_OIDC_CLIENT_ID = metadata.clientId;
        received.NEXUS_OIDC_CLIENT_SECRET = (await stores.secrets.get(metadata.clientSecretRef))!;
        events.push("issuer-profile-provisioned");
      }
    });
    assert.ok(events.indexOf("issuer-profile-provisioned") < events.indexOf("compose:database"), "issuer profile provisioning must finish before Compose mutation");
    assert.ok(events.includes("bootstrap") && events.includes("ready"));
    const metadata = await stores.metadata.read();
    assert.ok(metadata);
    assert.equal(metadata.installationId, enrollment.body.data.installationId);
    assert.equal(metadata.clientId, `nh_${(await import("node:crypto")).createHash("sha256").update(`nexushub-installation:${metadata.installationId}`).digest("hex").slice(0, 40)}`);
    assert.deepEqual(metadata.scopes, ["openid", "profile", "email", "nexushub.installations:write", "nexushub.operations:read", "nexushub.operations:resume", "nexushub.organizations:read", "nexushub.organizations:write", "nexushub.projects:read", "nexushub.projects:write", "nexushub.project-membership:check", "nexushub.applications:read", "nexushub.applications:write"]);
    const clientSecret = await stores.secrets.get(metadata.clientSecretRef);
    assert.ok(clientSecret && clientSecret !== credentialSecret);
    const secretStat = await stat(join(privateRoot, "nexusid-client-secret"));
    assert.equal(secretStat.mode & 0o077, 0, "client secret is persisted with owner-only permissions");
    assert.equal((await readFile(join(privateRoot, "nexusid-client-secret"), "utf8")).trimEnd(), clientSecret);

    const replay = await provisionNexusIdClientProfile({
      issuer: origin.origin, publicOrigin, credentialId, credentialSecretRef: "file:nexusid-provisioning-credential",
      clientSecretRef: metadata.clientSecretRef, credentials: stores.credentials, secrets: stores.secrets, metadata: stores.metadata,
      allowLoopbackHttp: true, fetch: captureHubIssuer
    });
    assert.equal(replay.clientId, metadata.clientId, "installer replay converges on one issuer-owned client");
    assert.ok(hubIssuerBodies.every((body) => !body.includes(clientSecret)), "Hub issuer responses never echo its client secret");
    const ambiguousTokenRequest = new URLSearchParams({ grant_type: "client_credentials", client_id: credentialId, client_secret: credentialSecret, audience: "urn:nexusid:nexushub:client-provisioning" });
    ambiguousTokenRequest.append("client_secret", "attacker-controlled-second-value");
    const duplicate = await fetch(new URL("/oauth/token", origin), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: ambiguousTokenRequest });
    assert.equal(duplicate.status, 400, "duplicate OAuth form fields are rejected as ambiguous");
    const serviceToken = await post("/oauth/token", {
      grant_type: "client_credentials", client_id: credentialId, client_secret: credentialSecret,
      audience: "urn:nexusid:nexushub:client-provisioning",
    });
    assert.equal(serviceToken.status, 200, serviceToken.raw);
    const bearer = { authorization: `Bearer ${serviceToken.body.access_token}` };

    // Rotate the actual Hub login client too. The candidate is committed to
    // the private installation store before activation, so a lost activation
    // response can be recovered from durable local state and issuer operation
    // status without asking the issuer to reveal secret material.
    const hubRotationSecret = randomBytes(32).toString("base64url");
    const hubRotationOperationId = `hub_rotate_${randomBytes(18).toString("hex")}`;
    const hubStage = await request("/api/nexushub/v1/client-profile/credential-rotation", "PUT", {
      profileId: "nexushub", profileVersion: 1, operationId: hubRotationOperationId, clientSecret: hubRotationSecret
    }, bearer);
    assert.equal(hubStage.status, 201, hubStage.raw);
    assert.ok(!hubStage.raw.includes(hubRotationSecret));
    assert.equal((await revokeWithClient(metadata.clientId, clientSecret!)).status, 200, "old Hub secret authenticates during overlap");
    assert.equal((await revokeWithClient(metadata.clientId, hubRotationSecret)).status, 200, "staged Hub secret authenticates during overlap");
    assert.equal((await revokeWithClient(metadata.clientId, randomBytes(32).toString("base64url"))).status, 401, "unrelated Hub secret is rejected during overlap");
    const hubPendingStatus = await request(`/api/nexushub/v1/client-profile/nexushub/credential-rotation?operationId=${hubRotationOperationId}`, "GET", undefined, bearer);
    assert.equal(hubPendingStatus.body.data.operationState, "pending");
    assert.ok(!hubPendingStatus.raw.includes(hubRotationSecret));
    await stores.secrets.put(metadata.clientSecretRef, hubRotationSecret);
    assert.equal((await stat(join(privateRoot, "nexusid-client-secret"))).mode & 0o077, 0);
    assert.equal((await readFile(join(privateRoot, "nexusid-client-secret"), "utf8")).trimEnd(), hubRotationSecret);
    const hubActivation = await request("/api/nexushub/v1/client-profile/credential-rotation/activate", "POST", {
      profileId: "nexushub", profileVersion: 1, operationId: hubRotationOperationId
    }, bearer);
    assert.equal(hubActivation.status, 200, hubActivation.raw);
    assert.ok(!hubActivation.raw.includes(hubRotationSecret));
    assert.equal((await revokeWithClient(metadata.clientId, clientSecret!)).status, 401, "old Hub secret is rejected after activation");
    assert.equal((await revokeWithClient(metadata.clientId, hubRotationSecret)).status, 200, "new Hub secret authenticates after activation");
    const hubActivationReplay = await request("/api/nexushub/v1/client-profile/credential-rotation/activate", "POST", {
      profileId: "nexushub", profileVersion: 1, operationId: hubRotationOperationId
    }, bearer);
    assert.equal(hubActivationReplay.status, 200, "activation response loss is recoverable by replaying the operation ID");
    const hubStageReplayAfterActivation = await request("/api/nexushub/v1/client-profile/credential-rotation", "PUT", {
      profileId: "nexushub", profileVersion: 1, operationId: hubRotationOperationId, clientSecret: hubRotationSecret
    }, bearer);
    assert.equal(hubStageReplayAfterActivation.status, 200, hubStageReplayAfterActivation.raw);
    assert.equal(hubStageReplayAfterActivation.body.data.state, "active", "a lost stage response replay after activation reports the durable completed state");
    assert.equal(hubStageReplayAfterActivation.body.data.operationState, "activated");
    assert.ok(!hubStageReplayAfterActivation.raw.includes(hubRotationSecret));
    const hubActivatedStatus = await request(`/api/nexushub/v1/client-profile/nexushub/credential-rotation?operationId=${hubRotationOperationId}`, "GET", undefined, bearer);
    assert.equal(hubActivatedStatus.body.data.operationState, "activated");
    assert.ok(!hubActivatedStatus.raw.includes(hubRotationSecret));

    // Exercise Hub-managed LiberIDE provisioning against the same live issuer.
    const liberideInstallRoot = join(installRoot, "liberide-install");
    await mkdir(liberideInstallRoot, { mode: 0o700 });
    const liberideStores = createPrivateNexusIdSecretStores({ root: liberideInstallRoot, provisioningSecretFile, profile: "liberide" });
    const issuerBodies: string[] = [];
    const captureIssuer = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      issuerBodies.push(await response.clone().text());
      return response;
    };
    const liberideOptions = {
      issuer: origin.origin, liberideOrigin, credentialId, credentialSecretRef: "file:nexusid-provisioning-credential",
      clientSecretRef: "file:liberide-nexusid-client-secret", credentials: liberideStores.credentials, secrets: liberideStores.secrets,
      metadata: liberideStores.metadata, allowLoopbackHttp: true, fetch: captureIssuer,
    };
    const liberide = await provisionNexusIdLiberIDEClientProfile(liberideOptions);
    assert.equal(liberide.installationId, enrollment.body.data.installationId);
    assert.equal(liberide.profileId, "liberide");
    assert.equal(liberide.clientId, `li_${createHash("sha256").update(`liberide-installation:${liberide.installationId}`).digest("hex").slice(0, 40)}`);
    assert.notEqual(liberide.clientId, metadata.clientId, "LiberIDE and NexusHub receive separate client identities");
    assert.equal(liberide.redirectUri, `${liberideOrigin}/api/auth/nexusid/callback`);
    assert.deepEqual(liberide.grants, ["authorization_code"]);
    assert.equal(liberide.adopted, false);
    const liberideSecret = await liberideStores.secrets.get(liberide.clientSecretRef);
    assert.ok(liberideSecret && liberideSecret !== clientSecret && liberideSecret !== credentialSecret);
    const liberideSecretPath = liberideStores.clientSecretPath;
    assert.equal((await stat(liberideSecretPath)).mode & 0o077, 0, "LiberIDE client secret is owner-only");
    assert.equal((await readFile(liberideSecretPath, "utf8")).trimEnd(), liberideSecret);
    assert.ok(issuerBodies.every((body) => !body.includes(liberideSecret!)), "issuer responses never echo the LiberIDE secret");

    // Explicit adoption must use the already stored secret and converge on the
    // installation-derived identity without disclosing that secret to callers.
    const adoptStoreRoot = join(installRoot, "liberide-adopt");
    await mkdir(adoptStoreRoot, { mode: 0o700 });
    const adoptStores = createPrivateNexusIdSecretStores({ root: adoptStoreRoot, provisioningSecretFile, profile: "liberide" });
    await adoptStores.secrets.put("file:liberide-nexusid-client-secret", liberideSecret!);
    const adopted = await provisionNexusIdLiberIDEClientProfile({
      ...liberideOptions, credentials: adoptStores.credentials, secrets: adoptStores.secrets, metadata: adoptStores.metadata,
      mode: "adopt-existing", clientId: liberide.clientId,
    });
    assert.equal(adopted.clientId, liberide.clientId);
    assert.equal(adopted.adopted, true);
    assert.ok(issuerBodies.every((body) => !body.includes(liberideSecret!)), "adoption responses never echo the existing secret");

    // Exercise real issuer rotation state transitions for LiberIDE. The issuer
    // exposes operation metadata only; neither staged secret is returned.
    const pendingSecret = randomBytes(32).toString("base64url");
    const operationId = `accept_${randomBytes(18).toString("hex")}`;
    const staged = await request("/api/nexushub/v1/client-profile/credential-rotation", "PUT", { profileId: "liberide", profileVersion: 1, operationId, clientSecret: pendingSecret }, bearer);
    assert.equal(staged.status, 201, staged.raw);
    assert.equal(staged.body.data.state, "pending");
    assert.ok(!staged.raw.includes(pendingSecret));
    // Test actual client authentication through the issuer's OAuth revocation
    // route. An intentionally malformed token is acknowledged only after the
    // client authenticates, making 200 vs 401 a direct credential oracle that
    // does not require creating or revoking a real user token.
    assert.equal((await revokeWithClient(liberide.clientId, liberideSecret!)).status, 200, "active credential authenticates during overlap");
    assert.equal((await revokeWithClient(liberide.clientId, pendingSecret)).status, 200, "staged credential authenticates during overlap");
    assert.equal((await revokeWithClient(liberide.clientId, randomBytes(32).toString("base64url"))).status, 401, "unrelated credential is rejected during overlap");
    const overlapPkce = await redeemLiberIDEAuthorizationCode(liberide.clientId, liberide.redirectUri, liberideSecret!);
    assert.equal(overlapPkce.status, 200, overlapPkce.raw);
    assert.equal(overlapPkce.body.scope, "openid profile email");
    assert.ok(overlapPkce.body.access_token && overlapPkce.body.id_token, "the active credential redeems a real user authorization code during rotation overlap");
    const status = await request(`/api/nexushub/v1/client-profile/liberide/credential-rotation?operationId=${operationId}`, "GET", undefined, bearer);
    assert.equal(status.status, 200, status.raw);
    assert.equal(status.body.data.pendingOperationId, operationId);
    assert.equal(status.body.data.operationState, "pending");
    assert.ok(!status.raw.includes(pendingSecret));
    const activation = await request("/api/nexushub/v1/client-profile/credential-rotation/activate", "POST", { profileId: "liberide", profileVersion: 1, operationId }, bearer);
    assert.equal(activation.status, 200, activation.raw);
    assert.equal(activation.body.data.state, "active");
    assert.ok(!activation.raw.includes(pendingSecret));
    assert.equal((await revokeWithClient(liberide.clientId, liberideSecret!)).status, 401, "previous active credential stops authenticating after activation");
    assert.equal((await revokeWithClient(liberide.clientId, pendingSecret)).status, 200, "activated credential authenticates after activation");
    const activatedPkce = await redeemLiberIDEAuthorizationCode(liberide.clientId, liberide.redirectUri, pendingSecret);
    assert.equal(activatedPkce.status, 200, activatedPkce.raw);
    assert.equal(activatedPkce.body.scope, "openid profile email");
    assert.ok(activatedPkce.body.access_token && activatedPkce.body.id_token, "the activated credential redeems a real user authorization code after rotation");
    const activeStatus = await request(`/api/nexushub/v1/client-profile/liberide/credential-rotation?operationId=${operationId}`, "GET", undefined, bearer);
    assert.equal(activeStatus.body.data.operationState, "activated");

    const abortSecret = randomBytes(32).toString("base64url");
    const abortOperationId = `abort_${randomBytes(18).toString("hex")}`;
    const abortStage = await request("/api/nexushub/v1/client-profile/credential-rotation", "PUT", { profileId: "liberide", profileVersion: 1, operationId: abortOperationId, clientSecret: abortSecret }, bearer);
    assert.equal(abortStage.status, 201, abortStage.raw);
    const aborted = await request(`/api/nexushub/v1/client-profile/liberide/credential-rotation/${abortOperationId}`, "DELETE", undefined, bearer);
    assert.equal(aborted.status, 204, aborted.raw);
    const abortStatus = await request(`/api/nexushub/v1/client-profile/liberide/credential-rotation?operationId=${abortOperationId}`, "GET", undefined, bearer);
    assert.equal(abortStatus.body.data.operationState, "aborted");
    assert.ok(![staged.raw, status.raw, activation.raw, abortStage.raw, abortStatus.raw].some((body) => body.includes(abortSecret)));
  } finally {
    await rm(installRoot, { recursive: true, force: true });
  }
});

async function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(new URL(path, issuer), { method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let parsed: any;
  try { parsed = raw ? JSON.parse(raw) : undefined; } catch { /* preserve response text */ }
  return { status: response.status, body: parsed, raw, headers: response.headers };
}
const post = (path: string, body: unknown) => request(path, "POST", body);
const revokeWithClient = (clientId: string, clientSecret: string) => post("/oauth/token/revoke", {
  token: "intentionally-invalid-acceptance-token", client_id: clientId, client_secret: clientSecret,
});

async function redeemLiberIDEAuthorizationCode(clientId: string, redirectUri: string, clientSecret: string) {
  const browserHeaders = await adminHeaders();
  const browserCookie = browserHeaders.cookie;

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("/oauth/authorize", issuer);
  authorize.search = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    scope: "openid profile email", state, nonce: randomBytes(24).toString("base64url"),
    code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  const firstAuthorize = await fetch(authorize, { headers: { cookie: browserCookie }, redirect: "manual" });
  assert.equal(firstAuthorize.status, 302, await firstAuthorize.clone().text());
  const firstLocation = new URL(firstAuthorize.headers.get("location")!, issuer);
  if (firstLocation.pathname === "/consent") {
    const consent = await request("/oauth/consent", "POST", {
      client_id: clientId, redirect_uri: redirectUri, scope: "openid profile email", decision: "approve",
    }, browserHeaders);
    assert.equal(consent.status, 200, consent.raw);
  }
  const authorized = await fetch(authorize, { headers: { cookie: browserCookie }, redirect: "manual" });
  assert.equal(authorized.status, 302, await authorized.clone().text());
  const callback = new URL(authorized.headers.get("location")!);
  assert.equal(`${callback.origin}${callback.pathname}`, redirectUri);
  assert.equal(callback.searchParams.get("state"), state, "the real issuer returns the exact browser state");
  const code = callback.searchParams.get("code");
  assert.ok(code, "the browser receives an authorization code");
  const response = await fetch(new URL("/oauth/token", issuer), {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: code!, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code_verifier: verifier }),
  });
  const raw = await response.text();
  let body: any;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { /* keep raw for assertion diagnostics */ }
  return { status: response.status, raw, body };
}

async function adminHeaders() {
  const login = await post("/auth/login", { email: "admin", password: "Disposable-Admin-Pass-42", clientId: "sso-admin-ui", scope: ["openid", "profile", "email"] });
  assert.equal(login.status, 200, login.raw);
  const sid = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie") ?? ""]).map((cookie) => cookie.split(";")[0]).find((cookie) => cookie.startsWith("sid="));
  assert.ok(sid);
  const csrf = await request("/api/csrf-token", "GET", undefined, { cookie: sid! });
  assert.equal(csrf.status, 200, csrf.raw);
  const csrfCookie = csrf.headers.get("set-cookie")?.split(";")[0];
  assert.ok(csrfCookie && csrf.body?.csrf_token);
  return { cookie: `${sid}; ${csrfCookie}`, "x-csrf-token": csrf.body.csrf_token as string };
}
