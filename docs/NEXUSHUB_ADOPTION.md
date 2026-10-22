# Adopt NexusID into NexusHub

NexusHub can use an existing NexusID deployment through its standard OpenID Connect issuer. Adoption is additive: it registers one dedicated confidential OAuth client for Hub sign-in. It does not provision, migrate, reset, or delete user accounts; change signing keys; create user roles or app assignments; or replace NexusID's standalone authorization and token endpoints.

## What the installer can configure

The installer can check the configured issuer's authorization, token, JWKS, and registration endpoints through `/.well-known/openid-configuration` before receiving any operator credential. Discovery responses are limited to 256 KiB and registration responses to 64 KiB, with actual streamed bytes checked even when `Content-Length` is absent or inaccurate. Run `npm run nexushub:preflight` with `NEXUSID_ISSUER` and `NEXUS_PUBLIC_ORIGIN` set. This is a read-only discovery request: it sends no bearer token, creates no local reservation, and makes no client change. It also requires discovery to explicitly advertise the `client_secret_post` method used by Hub; absent metadata is treated as incompatible rather than assuming an OAuth default the Hub does not use. Registration requires NexusID's dynamic registration mode to be `admin`. The request uses NexusID's existing broad `clients:add` permission, and requests only `authorization_code` and `refresh_token` grants. That permission can register arbitrary OAuth clients; NexusID currently has no narrower Hub-only provisioning permission, registration profile type, or profile lookup. Use a dedicated, short-lived operator credential, enable admin registration only for the provisioning window, and revoke the credential/disable registration afterward. The CLI does not request user, role, application assignment, or signing-key administration. Version 1 of [`config/nexushub-oidc-profile.json`](../config/nexushub-oidc-profile.json) is the scope source of truth: it grants identity scopes `openid profile email` plus nine individually named Hub scopes under `hubScopes`. The registration script validates the profile identifier/version and sends exactly those names; it grants no wildcard or NexusID administration scope. Authorization code flow is PKCE-required by NexusID.

The registration produces an opaque client ID and secret. Save them as Hub server-side credentials; do not put the secret in browser code, source control, a public app manifest, or a URL. NexusHub must use the exact callback URL registered here. NexusID validates redirect URLs against its normal client/instance policy. Existing deployments that reject the callback should be fixed by an administrator through the supported policy; do not weaken redirect validation for Hub. After read-only discovery succeeds, the CLI reserves the private output path with exclusive creation. A completed config prevents accidental duplicate registration on a repeated invocation. The registration endpoint must share the issuer origin because the operator bearer token is sent to it. Redirects are rejected so the bearer credential cannot be forwarded to a different origin. A network error, timeout, server error, incomplete response, or local credential-write failure retains a `registration_in_progress` marker; inspect NexusID Admin and either recover/configure the issued client or remove it before deleting the marker and retrying. The current NexusID handler returns 400/401/403 before client creation, so these explicit rejections remove the reservation and can be corrected and retried. This is safe retry classification, not automatic retry.

Example, run from this repository on a trusted operator machine:

```sh
export NEXUSID_ISSUER='https://id.example.com'
export NEXUSID_ADMIN_ACCESS_TOKEN='…'
export NEXUS_PUBLIC_ORIGIN='https://hub.example.com'
export NEXUSHUB_OIDC_CONFIG_OUT='/etc/nexushub/nexusid-oidc.json'
npm run nexushub:adopt
```

Preflight example (no operator token and no output path required):

```sh
export NEXUSID_ISSUER='https://id.example.com'
export NEXUS_PUBLIC_ORIGIN='https://hub.example.com'
npm run nexushub:preflight
```

The callback is derived as `${NEXUS_PUBLIC_ORIGIN}/auth/callback`, matching the Hub server configuration. The output is created exclusively (an existing path is never overwritten) with owner-only permissions. It contains the discovered OIDC endpoints, registered client ID and secret, exact callback, and requested scopes. The script does not print the secret. If the client registration succeeds but the local config cannot be written, the command reports that the new client must be removed in NexusID Admin before retrying.

NexusID's registration handler stores the client-allowed scope names as supplied; it does not require the names to exist in the scope catalog. Before provisioning, an operator should add each entry in the profile's `hubScopes` array to NexusID Admin → Scopes, using its `name` and `description`. These exact nine entries make the custom scopes visible in discovery and the catalog. Scope catalog management is session/CSRF based, so the CLI deliberately does not try to create entries with its client-registration bearer token. Keep the identity scopes in `identityScopes` and the custom Hub entries in `hubScopes`; do not replace them with broad or wildcard scope grants. When the consumed Hub API permissions change, update the versioned profile and coordinate a client re-registration/rotation plan rather than silently widening an existing deployment.

### Identity and claim mapping contract

The v1 profile scopes are OAuth permissions, not organization or project membership claims. NexusID's `profile` scope may return `name`, `preferred_username`, `given_name`, `family_name`, and `picture`; `email` may return `email` and `email_verified`. Hub does not use these mutable profile fields as account keys or authorization inputs. Its login flow validates the ID token and access token and requires both `sub` values to match; Hub stores and authorizes the resulting subject against Hub-owned organization and project membership records. A registered client, requested Hub scope, email domain, or profile claim does not create that membership.

This profile does not define or issue a NexusID tenant, organization, project, or application-installation claim, nor a mapping from NexusID tenants/groups to Hub membership. Operators must provision Hub membership through Hub's supported organization administration. Do not add a custom claim mapping or infer memberships from `groups`, `roles`, or email until a versioned claim contract specifies its issuer, meaning, stability, and authorization semantics. This keeps direct NexusID clients and existing OIDC claim behavior unchanged while making the current Hub mapping explicit.

The client registration API issues a fresh client on each request and does not implement a Hub-specific idempotency key or lookup-by-profile operation. The local output reservation prevents routine repeat runs but cannot make a remote HTTP operation transactional or recover a lost one-time secret. If the outcome is ambiguous, operator reconciliation in NexusID Admin is required; remove obsolete Hub clients only after confirming they are unused. NexusID has no supported machine-readable client profile provisioning seam beyond RFC 7591 registration, so do not script direct database writes or invent a private endpoint. The concrete blocker and acceptance criteria for a future safe API are recorded in [the NexusHub client provisioning decision](./decisions/NEXUSHUB_CLIENT_PROVISIONING.md): NexusID needs a dedicated machine authority, issuer-established installation ownership, transactional named-profile semantics, and a safe secret recovery lifecycle. Do not treat `client_name` as an idempotency key because names are not unique identifiers.

## Operator and installer responsibilities

An operator must provide a reachable NexusID issuer and an administrator access token authorized to register clients. The installer must verify the discovery issuer matches the operator-supplied issuer, request only the required scopes/grants, persist the one-time returned secret privately, and fail without weakening OIDC validation if registration is unavailable. Configure the Hub server with the saved issuer, client ID, client secret, and callback. Keep the NexusID client secret on the Hub server.

The current NexusID APIs do not provide a Hub-specific enrollment endpoint or a transactional operation covering OAuth client creation and Hub secret storage. Therefore an installer can safely adopt OIDC using the existing admin-gated dynamic-registration endpoint, but it cannot autonomously bootstrap NexusID administrator credentials, users, app assignments, signing keys, or policies. Those remain explicit NexusID operator setup. This is intentional: NexusHub must not silently assume control of an existing identity tenant.

## Standalone compatibility

The issuer's existing discovery, authorize, token, JWKS, UserInfo, logout, and client-management interfaces remain in place. Dynamic registration remains disabled by default and retains its existing `disabled`, `admin`, and `open` modes. Hub adoption only requires `admin` mode for the registration step; after registration the regular OIDC client flow does not depend on dynamic registration staying enabled.
