# Adopt NexusID into NexusHub

NexusHub can use an existing NexusID deployment through its standard OpenID Connect issuer. Adoption is additive: it registers one dedicated confidential OAuth client for Hub sign-in. It does not provision, migrate, reset, or delete user accounts; change signing keys; create user roles or app assignments; or replace NexusID's standalone authorization and token endpoints.

## What the installer can configure

The Hub installer can discover the configured issuer's authorization, token, and JWKS endpoints through `/.well-known/openid-configuration`, then register a NexusHub client through the advertised registration endpoint. NexusID's existing dynamic client registration endpoint must be enabled in `admin` mode (`DYNAMIC_CLIENT_REGISTRATION=admin`). The registration request uses a bearer access token authorized for NexusID's `clients:add` permission and requests only `authorization_code` and `refresh_token` grants. That permission can register arbitrary OAuth clients; NexusID currently has no narrower Hub-only provisioning permission or profile endpoint. Use a dedicated, short-lived operator credential, enable admin registration only for the provisioning window, and revoke the credential/disable registration afterward. The CLI does not request user, role, application assignment, or signing-key administration. The profile in [`config/nexushub-oidc-profile.json`](../config/nexushub-oidc-profile.json) is the source of truth for callback path, grants, authentication method, and requested scopes: identity scopes `openid profile email` and Hub API scopes `nexushub.installations:write`, `nexushub.operations:read`, `nexushub.operations:resume`, `nexushub.organizations:read`, `nexushub.organizations:write`, `nexushub.projects:read`, `nexushub.projects:write`, `nexushub.applications:read`, and `nexushub.applications:write`. Authorization code flow is PKCE-required by NexusID.

The registration produces an opaque client ID and secret. Save them as Hub server-side credentials; do not put the secret in browser code, source control, a public app manifest, or a URL. NexusHub must use the exact callback URL registered here. NexusID validates redirect URLs against its normal client/instance policy. Existing deployments that reject the callback should be fixed by an administrator through the supported policy; do not weaken redirect validation for Hub. Before making the remote registration request, the CLI reserves the private output path with exclusive creation. A completed config prevents accidental duplicate registration on a repeated invocation. If the CLI cannot determine whether a request reached NexusID, it keeps a `registration_in_progress` marker; inspect NexusID Admin and either recover/configure the issued client or remove it before deleting the marker and retrying.

Example, run from this repository on a trusted operator machine:

```sh
export NEXUSID_ISSUER='https://id.example.com'
export NEXUSID_ADMIN_ACCESS_TOKEN='…'
export NEXUS_PUBLIC_ORIGIN='https://hub.example.com'
export NEXUSHUB_OIDC_CONFIG_OUT='/etc/nexushub/nexusid-oidc.json'
npm run nexushub:adopt
```

The callback is derived as `${NEXUS_PUBLIC_ORIGIN}/auth/callback`, matching the Hub server configuration. The output is created exclusively (an existing path is never overwritten) with owner-only permissions. It contains the discovered OIDC endpoints, registered client ID and secret, exact callback, and requested scopes. The script does not print the secret. If the client registration succeeds but the local config cannot be written, the command reports that the new client must be removed in NexusID Admin before retrying.

NexusID stores client-allowed scope names and the authorization flow will issue them when requested, so the Hub client can receive the custom scope strings from registration. For the discovery document and administrator scope catalog to expose these custom values, an administrator should also add the nine `nexushub.*` scopes through NexusID Admin → Scopes. The current scope-management API is session/CSRF based; the CLI does not try to create catalog entries with its client-registration bearer token.

The client registration API issues a fresh client on each request and does not implement a Hub-specific idempotency key or lookup-by-profile operation. The local output reservation prevents routine repeat runs but cannot make a remote HTTP operation transactional or recover a lost one-time secret. If the outcome is ambiguous, operator reconciliation in NexusID Admin is required; remove obsolete Hub clients only after confirming they are unused. NexusID has no supported machine-readable client profile provisioning seam beyond RFC 7591 registration, so do not script direct database writes or invent a private endpoint.

## Operator and installer responsibilities

An operator must provide a reachable NexusID issuer and an administrator access token authorized to register clients. The installer must verify the discovery issuer matches the operator-supplied issuer, request only the required scopes/grants, persist the one-time returned secret privately, and fail without weakening OIDC validation if registration is unavailable. Configure the Hub server with the saved issuer, client ID, client secret, and callback. Keep the NexusID client secret on the Hub server.

The current NexusID APIs do not provide a Hub-specific enrollment endpoint or a transactional operation covering OAuth client creation and Hub secret storage. Therefore an installer can safely adopt OIDC using the existing admin-gated dynamic-registration endpoint, but it cannot autonomously bootstrap NexusID administrator credentials, users, app assignments, signing keys, or policies. Those remain explicit NexusID operator setup. This is intentional: NexusHub must not silently assume control of an existing identity tenant.

## Standalone compatibility

The issuer's existing discovery, authorize, token, JWKS, UserInfo, logout, and client-management interfaces remain in place. Dynamic registration remains disabled by default and retains its existing `disabled`, `admin`, and `open` modes. Hub adoption only requires `admin` mode for the registration step; after registration the regular OIDC client flow does not depend on dynamic registration staying enabled.
