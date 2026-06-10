# @nexusid/sdk

Typed TypeScript client for the SSO/IAM platform.

This SDK is a client library over the existing platform APIs. It is intended to help application developers authenticate users, exchange tokens, and consume public or admin endpoints without writing raw request plumbing.

Additional docs:

- `GETTING_STARTED.md`
- `API_REFERENCE.md` (generated from `src/index.ts`)
- `MIGRATION_AND_VERSIONING.md`
- `FRAMEWORK_RECIPES.md`
- `DEPRECATION_POLICY.md`
- `CHANGELOG.md`

## Install

This package is currently developed in-repo under `sdk/`.

```bash
npm run check:sdk
npm run build:sdk
```

## Core Setup

Use `createClient` for token and public endpoint work, and `createAdminClient` for admin APIs.

```ts
import { createAdminClient, createClient } from "@nexusid/sdk";
const client = createClient({
  baseUrl: "https://iam.example.com"
});

const admin = createAdminClient({
  baseUrl: "https://iam.example.com",
  auth: {
    type: "bearer",
    token: process.env.NEXUSID_ADMIN_TOKEN!
  }
});
```

## Governance Polling Helper

Use workflow polling helpers for asynchronous approval-style flows.

```ts
import {
  createAdminClient,
  waitForAccessRequestTerminalState,
  waitForElevationTerminalState
} from "@nexusid/sdk";

const admin = createAdminClient({
  baseUrl: "https://iam.example.com",
  auth: { type: "bearer", token: process.env.NEXUSID_ADMIN_TOKEN! }
});

const request = await admin.accessRequests.create({
  subjectUserId: "user_123",
  entitlementType: "role",
  entitlementValue: "role_connector_operator",
  justification: "Temporary incident response access"
});

const resolvedRequest = await waitForAccessRequestTerminalState(admin.accessRequests, request.id, {
  timeoutMs: 120_000,
  intervalMs: 2_000
});

const elevation = await admin.elevations.create({
  resource: "connectors",
  action: "sync",
  justification: "Run incident mitigation sync"
});

const resolvedElevation = await waitForElevationTerminalState(admin.elevations, elevation.id, {
  timeoutMs: 60_000,
  intervalMs: 1_500
});
```

## Token Exchange Helpers

```ts
import { createAuthAPI, createClient } from "@nexusid/sdk";

const auth = createAuthAPI(createClient({
  baseUrl: "https://iam.example.com"
}));

const token = await auth.exchangeAuthorizationCode({
  clientId: "portal-web",
  clientSecret: process.env.NEXUSID_CLIENT_SECRET!,
  code: "authorization-code",
  codeVerifier: "pkce-code-verifier",
  redirectUri: "https://app.example.com/callback"
});

const refreshed = await auth.exchangeRefreshToken({
  clientId: "portal-web",
  clientSecret: process.env.NEXUSID_CLIENT_SECRET!,
  refreshToken: token.refresh_token!
});

const exchanged = await auth.exchangeToken({
  subjectToken: refreshed.access_token,
  subjectTokenType: "urn:ietf:params:oauth:token-type:access_token",
  audience: ["https://api.example.com"],
  scope: ["tickets.read"]
});

await auth.revokeToken({
  token: refreshed.refresh_token ?? token.refresh_token!,
  tokenTypeHint: "refresh_token"
});
```

## OAuth Authorize URL And PKCE

```ts
import { buildAuthorizeUrl, generatePKCEPair } from "@nexusid/sdk";

const pkce = await generatePKCEPair();

const authorizeUrl = buildAuthorizeUrl("https://iam.example.com", {
  clientId: "portal-web",
  redirectUri: "https://app.example.com/callback",
  responseType: "code",
  scope: ["openid", "profile", "email"],
  state: "request-state",
  codeChallenge: pkce.codeChallenge,
  codeChallengeMethod: pkce.codeChallengeMethod
});
```

## Interactive Login, Recovery, And Federation

```ts
import { createAuthAPI, createClient, buildFederationStartUrl } from "@nexusid/sdk";

const auth = createAuthAPI(createClient({ baseUrl: "https://iam.example.com" }));

const login = await auth.login({
  email: "admin@example.com",
  password: process.env.NEXUSID_PASSWORD!,
  clientId: "sso-admin-ui"
});

if ("mfaRequired" in login && login.mfaRequired) {
  const completed = await auth.loginMfa({
    mfaTicket: login.mfaTicket,
    code: "123456"
  });
}

await auth.requestRecovery({ identifier: "admin@example.com" });

await auth.recover({
  recoveryTicket: "recovery_ticket",
  newPassword: "NewStrongPass123!"
});

const providers = await auth.listFederationProviders();
const federationUrl = buildFederationStartUrl("https://iam.example.com", providers[0].id, "/portal");
```

## OIDC Protocol Helpers

```ts
const discovery = await auth.getDiscoveryDocument();
const jwks = await auth.getJwks();

const introspection = await auth.introspectToken({
  token: accessToken,
  clientId: "portal-web",
  clientSecret: process.env.NEXUSID_CLIENT_SECRET!
});

const device = await auth.startDeviceAuthorization({
  clientId: "tv-client",
  clientSecret: process.env.NEXUSID_TV_SECRET!
});

await auth.verifyDeviceCode({
  userCode: device.user_code,
  username: "admin@example.com",
  password: process.env.NEXUSID_PASSWORD!
});

const deviceToken = await auth.exchangeDeviceCode({
  clientId: "tv-client",
  clientSecret: process.env.NEXUSID_TV_SECRET!,
  deviceCode: device.device_code
});

const registered = await auth.registerClient({
  clientName: "Example SPA",
  redirectUris: ["https://app.example.com/callback"]
});
```

## Account Self-Service MFA

```ts
import { createAccountAPI, createClient } from "@nexusid/sdk";

const account = createAccountAPI(createClient({
  baseUrl: "https://iam.example.com",
  auth: { type: "session", cookie: "sid=..." }
}));

const totpStatus = await account.getTotp();
const enrollment = await account.enrollTotp();
await account.verifyTotp({ enrollmentId: enrollment.enrollmentId, code: "123456" });

const credentials = await account.listWebauthnCredentials();
const registration = await account.beginWebauthnRegistration({ displayName: "Work Laptop" });
```

## Portal Language And Profile

```ts
import { createPortalAPI, createClient } from "@nexusid/sdk";

const portal = createPortalAPI(createClient({ baseUrl: "https://iam.example.com" }));

const language = await portal.getDefaultLanguage();
const me = await portal.getMe();
```

## Service Identity Credentials

Pass the issued `clientId` and one-time `plainClientSecret` to `/oauth/token` with `grant_type=client_credentials` to mint a service identity access token. Keep requested `scope` within that identity policy (`allowedScopes`); issued tokens are constrained to the identity audiences (`allowedAudiences`).

## Session Cookie Auth

```ts
import { createClient } from "@nexusid/sdk";

const sessionClient = createClient({
  baseUrl: "https://iam.example.com",
  auth: {
    type: "session",
    cookie: "sid=..."
  }
});

const me = await sessionClient.get("/api/portal/me");
```

## UserInfo And Current User Claims

OAuth UserInfo and the admin/portal `me` endpoints always include effective `roles`, `groups`, and a flattened `permissions` array (direct role assignments plus roles inherited via group membership).

```ts
import { createClient, createAuthAPI, createAdminClient } from "@nexusid/sdk";

const bearerClient = createClient({
  baseUrl: "https://iam.example.com",
  auth: { type: "bearer", token: accessToken }
});

const auth = createAuthAPI(bearerClient);
const userinfo = await auth.getUserInfo();
// userinfo.roles, userinfo.groups, userinfo.permissions

const signedJwt = await auth.getUserInfoSigned();

const admin = createAdminClient({
  baseUrl: "https://iam.example.com",
  auth: { type: "session", cookie: "sid=..." }
});

const adminMe = await admin.me.get();
// adminMe.roles, adminMe.groups, adminMe.permissions
```

## Admin Clients, Scopes, Apps, And Users

```ts
const scope = await admin.scopes.create({
  name: "tickets.read",
  description: "Read ticket data"
});

const oauthClient = await admin.clients.create({
  id: "support-console",
  name: "Support Console",
  secret: process.env.NEXUSID_SUPPORT_SECRET!,
  redirectUris: ["https://support.example.com/callback"],
  allowedScopes: [scope.name],
  grants: ["authorization_code", "refresh_token"],
  requirePkce: true
});

const app = await admin.apps.create({
  name: "Support",
  description: "Support operations app",
  url: "https://support.example.com"
});

const user = await admin.users.create({
  appId: app.id,
  email: "analyst@example.com",
  username: "analyst",
  password: "ChangeMe123!",
  givenName: "Case",
  familyName: "Analyst"
});

const firstSupportApps = await admin.apps.list({
  search: "support",
  page: 1,
  pageSize: 10
});

const activeSupportUsers = await admin.users.list({
  appId: app.id,
  active: true,
  search: "analyst"
});
```

## Roles And Groups

```ts
const role = await admin.roles.create({
  name: "connector-operator",
  description: "Can run connector sync jobs",
  permissions: ["connectors.read", "connectors.sync"],
  scope: "platform"
});

const group = await admin.groups.create({
  name: "Operations",
  description: "Operations team"
});

await admin.groups.assignRole({
  groupId: group.id,
  roleId: role.id
});
```

## Access Requests

```ts
const request = await admin.accessRequests.create({
  subjectUserId: user.id,
  entitlementType: "role",
  entitlementValue: role.id,
  justification: "Temporary access for connector incident response"
});

await admin.accessRequests.approve(request.id, {
  rationale: "Approved for incident window"
});
```

## Elevations

```ts
const elevation = await admin.elevations.create({
  resource: "connectors",
  action: "sync",
  justification: "Need temporary access to rerun failed sync",
  durationMinutes: 30
});

await admin.elevations.approve(elevation.id);
await admin.elevations.activate(elevation.id);

const access = await admin.elevations.check({
  resource: "connectors",
  action: "sync"
});
```

## Access Reviews

```ts
const campaign = await admin.accessReviews.createCampaign({
  name: "Quarterly connector access review",
  description: "Review connector operator entitlements",
  dueAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
});

const details = await admin.accessReviews.getCampaign(campaign.campaign.id);
const firstItem = details.items[0];

if (firstItem) {
  await admin.accessReviews.decideItem(firstItem.id, {
    decision: "certified",
    rationale: "Still required for operations coverage"
  });
}
```

## Workload Identity

```ts
const serviceIdentity = await admin.serviceIdentities.createServiceIdentity({
  name: "connector-runner",
  description: "Machine identity for scheduled connector runs",
  allowedScopes: ["connectors.sync", "connectors.read"]
});

const issued = await admin.serviceIdentities.issueCredential(serviceIdentity.id, {
  expiresInDays: 30
});

const workloadToken = await auth.exchangeClientCredentials({
  clientId: issued.credential.clientId,
  clientSecret: issued.plainClientSecret,
  scope: ["connectors.sync"]
});

const usage = await admin.serviceIdentities.getUsage(serviceIdentity.id);
```

## SCIM Provisioning

```ts
const token = await admin.provisioning.tokens.create({
  label: "Production Provisioning",
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString()
});

const mapping = await admin.provisioning.mappings.create({
  name: "Department to OU",
  sourceAttribute: "department",
  targetAttribute: "ou",
  enabled: true
});

const dryRun = await admin.provisioning.reconciliation.runReconcile({
  dryRun: true
});

const job = await admin.provisioning.reconciliation.runReconcile({
  dryRun: false
});

const jobs = await admin.provisioning.reconciliation.listJobs(20);
```

## SAML Administration

```ts
const serviceProvider = await admin.saml.serviceProviders.create({
  entityId: "https://app.example.com/saml",
  acsUrl: "https://app.example.com/saml/acs",
  nameIdFormat: "emailAddress"
});

const uploaded = await admin.saml.serviceProviders.uploadMetadata(serviceProvider.id, {
  metadata: "<EntityDescriptor>...</EntityDescriptor>",
  overwriteManualFields: true
});

await admin.saml.serviceProviders.rotateCertificate(serviceProvider.id, {
  certificateType: "signing",
  certificate: "-----BEGIN CERTIFICATE-----..."
});

const spDetails = await admin.saml.serviceProviders.get(serviceProvider.id);
const allSPs = await admin.saml.serviceProviders.list({
  enabled: "true",
  limit: 20
});

const assertions = await admin.saml.assertions.list({
  spId: serviceProvider.id,
  startDate: "2025-01-01",
  endDate: "2025-12-31"
});
```

## Connectors

```ts
const connector = await admin.connectors.create({
  name: "HR Sync",
  type: "scim",
  config: { baseUrl: "https://partner.example.com/scim" }
});

await admin.connectors.createMapping(connector.id, {
  sourceField: "department",
  targetField: "ou"
});

const run = await admin.connectors.triggerSync(connector.id);
const runs = await admin.connectors.listRuns(connector.id, { limit: 20 });
const mappings = await admin.connectors.listMappings(connector.id);
```

## Admin User Sub-Resources, Settings Tests, Metrics, And Plugins

```ts
const user = await admin.users.get("user_123");
const groups = await admin.users.getGroups(user.id);
const roles = await admin.users.getRoles(user.id);
const permissions = await admin.users.getPermissions(user.id);

const groupMembers = await admin.groups.listUsers("group_ops");

await admin.settings.testEmail({
  to: "admin@example.com",
  subject: "SMTP test"
});

const authMetrics = await admin.metrics.auth({
  startHour: "2026-06-10T08",
  endHour: "2026-06-10T12",
  event: "login.succeeded"
});

const plugins = await admin.plugins.list();
const validation = await admin.plugins.validate({
  manifest: {
    id: "example-plugin",
    name: "Example Plugin",
    version: "1.0.0",
    entrypoint: "index.js"
  }
});

const decision = await admin.policies.authorizationCheck({
  userId: user.id,
  resource: "connectors",
  action: "sync"
});

const queue = await admin.provisioning.deprovisioningQueue({ limit: 50 });
```

## Examples

See the usage-oriented files in `sdk/examples/`:

- `auth-flow.ts`
- `browser-spa-auth.ts`
- `server-express-auth.ts`
- `admin-apps-users.ts`
- `admin-roles-groups.ts`
- `escalation-approval-break-glass.ts`
- `enterprise-scim-onboarding.ts`
- `enterprise-saml-onboarding.ts`

## Current Surface

Implemented today:

- base typed HTTP client
- bearer, session, and custom-header auth configuration
- authorize URL, PKCE, federation start, and logout URL helpers
- token endpoint helpers for authorization code, refresh token, client credentials, password grant, device code, JWT/SAML bearer, CIBA, token exchange, introspection, and revoke
- interactive login, MFA login, WebAuthn login, recovery, federation provider listing, and OIDC discovery/JWKS
- account self-service MFA (TOTP and WebAuthn enrollment)
- portal self-service profile/password/avatar/language helpers
- admin modules for apps, users (including groups/roles/permissions/avatar), roles, groups (including members), clients, scopes, access requests, access reviews, elevations, connectors, metrics, and plugins
- SCIM provisioning methods for token management, mapping CRUD, reconciliation jobs, and deprovisioning queue
- SAML admin methods for service provider CRUD, metadata upload, certificate rotation, and assertion audits
- workload identity methods for service identities, credential lifecycle, and usage inspection
- settings test helpers for email and database migration workflows
- authorization check helper for policy evaluation against a user/resource/action

Multi-app notes:

- The SDK still uses the same OAuth token endpoint, `POST /oauth/token`.
- Multi-app support is reflected in the admin and portal types through `appIds` and, for portal identity responses, `directAppIds` and `inheritedAppIds`.
- App access is resolved from user and group assignments; it is not selected by switching to a different token endpoint.

Still planned:

- connector-focused enterprise examples beyond onboarding snippets
- dedicated SCIM client module for direct `/scim/v2` provisioning calls

## Admin Permissions And Failure Modes

Expected permission posture for successful calls:

- Access request decisions and elevation approvals should be called by privileged admin identities.
- Break-glass operations should be restricted to high-trust administrative principals.
- Resource CRUD endpoints (apps, users, roles, groups, clients, scopes, connectors, service identities) should be gated behind admin policies.

Common failure modes to handle in integrations:

- `401` or `403`: missing or insufficient auth/authorization for the operation.
- `404`: target resource does not exist or is not visible to the caller context.
- `400`: validation failure or malformed request payload.
- `409`: conflicting state transition (for example, approving an already terminal workflow item).
- `429` or `5xx`: transient server-side conditions; use retries with backoff where safe.

For elevation and access governance flows, prefer explicit state checks and workflow polling so admin UIs can handle pending-to-terminal transitions safely.
