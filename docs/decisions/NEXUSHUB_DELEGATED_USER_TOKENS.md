# NexusHub delegated user tokens

**Status:** Implemented as an opt-in `nexushub:1` profile. Generic RFC 8693 behavior remains separate. The profile requires NexusID operator configuration of the Hub OAuth client resource allowlist and is covered by provider-backed grant persistence and exchange tests.

## Decision

NexusHub must not use NexusID client credentials as a substitute for a user's authority, forward the Hub's client secret to an application, or assume that the existing RFC 8693 token-exchange endpoint provides cross-application user consent.

NexusID currently exposes `POST /oauth/token/exchange`. It authenticates an OAuth client or service identity, verifies the subject access token, permits scope narrowing, applies the requesting actor's scope and audience allowlists, and mints a new access token. The endpoint does not verify that the authenticated actor is the client to which the user token was issued, does not check a durable consent for the target application/audience, and does not accept a resource-specific consent grant. Existing generic exchange tests prove its current behavior, not suitability for NexusHub global search or cross-app actions.

Until the contract below is implemented, NexusHub must treat delegated-user search/actions as unavailable. Existing interactive OIDC login and independent app authentication remain supported.

## Required v1 contract

Use authorization code with PKCE to authenticate the user to NexusHub. The NexusID consent screen must identify each target application/resource and the exact scopes and permitted actions being granted. A grant is bound to `(issuer, subject, Hub client, Hub installation, resource audience, scopes, expiry)` and can be revoked by the user or administrator. No permission is inferred from email, groups, Hub organization membership, an app registration manifest, or possession of a user token.

The Hub then calls a dedicated token-exchange contract. NexusID authenticates the Hub client using its existing confidential-client authentication, validates the active client and its explicit `token_exchange` grant, verifies the user subject token and revocation state, and requires that the subject token's `client_id` matches the requesting Hub client. It checks the stored consent for that subject, installation, resource, and requested scopes. Effective scopes are the intersection of the user grant, original token scopes, Hub profile allowlist, and resource policy. The requested audience must be one explicitly granted to this Hub installation and user. The output token has the user subject, the single target resource audience, bounded lifetime no greater than the source token or grant, a fresh `jti`, and an actor/client claim identifying NexusHub. It must not carry unrelated roles, groups, or permissions from the Hub's client-credentials token.

The response must not include a refresh token. Access tokens are short lived and revocation must be checked on every exchange. Audit records include issuer subject reference, Hub client/installation, target resource, granted scopes, outcome, and correlation ID, but no tokens or secrets. Rate limits and a bounded request schema apply.

## NexusID changes required

1. Add a resource indicator and consent model that binds user, Hub client/installation, resource audience, exact scopes/actions, grant time, expiry, and revocation state. Reuse the existing consent UX only if it can display the target application and meaningful action descriptions; scope-only consent is insufficient.
2. Extend authorization and consent persistence with provider-backed migrations and uniqueness/transaction rules. The browser authorization request must carry a resource chosen from issuer-owned application metadata; a caller-provided audience alone is never authority.
3. Add a versioned exchange endpoint or versioned contract on `/oauth/token/exchange` that requires the consent record and same-client binding. Existing generic exchange behavior must remain explicitly documented and must not be advertised as Hub delegation until migration and compatibility decisions are reviewed.
4. Bind Hub installation enrollment to approved resource audiences and scope profiles. The Hub request cannot invent an installation, app, audience, or scope.
5. Add user consent review/revoke UI, admin revocation, audit events, revocation checks, key rotation behavior, abuse limits, and contract/integration tests across SQLite, PostgreSQL, and MySQL.

## Acceptance tests

- A Hub service identity or client-credentials token alone cannot obtain a token whose subject is a user.
- A Hub client cannot exchange a user's token issued to a different OAuth client.
- A request with no resource-specific consent is denied even when the scope appears in the source token and Hub client allowlist.
- A different Hub installation cannot reuse the consent, and a caller-supplied audience cannot create consent.
- Scope or action widening, audience widening, expired/revoked consent, revoked subject tokens, inactive clients, and unsupported profiles are denied.
- The result has exactly the consented user subject and resource audience, carries only the granted scopes, has a bounded expiry, and has no refresh token.
- User revocation prevents the next exchange; audit output contains no bearer token, client secret, or raw authorization code.
- Existing authorization-code login and standalone NexusID clients continue to work when the Hub delegation feature is disabled.

## Current evidence

Implementation is in `src/http/routes.ts`, `src/services/oidc-service.ts`, and `src/repositories/prisma-repositories.ts`. A profile request carries `nexushub_profile=nexushub:1`, the NexusID-issued client ID as installation ID, and exactly one resource audience. Authorization and consent require that resource to exist in the administrator-configured `OAuthClient.resources`; consent also requires the authenticated session and CSRF protection. Durable consent binds user, client, installation, resource, exact granted scopes, expiry, and revocation state. The exchange verifies the user's source access token, revocation state, same-client binding, resource allowlist, active consent, and scope subset. The resulting access token preserves the subject, limits expiry to the source token and consent lifetime, has a fresh `jti`, one audience, and an `act.sub` identifying the Hub client. No refresh token is returned. Generic exchange requests without the NexusHub profile retain the generic RFC 8693 path.

The consent UI presents the registered client and requested scopes. Resource identity is shown as the explicitly selected audience; human-readable resource/action descriptions still depend on the Hub client's administrator-managed metadata and should be added before broad third-party onboarding. The profile deliberately does not accept a caller-created audience or installation as authority. Database startup creates the table and upgrades prior tuple-only tables with a scope column; older rows default to no scopes and therefore cannot exchange any privileges until the user re-consents.

The contract's remaining rollout work is operational: define a trusted per-resource display-name/action metadata source, add administrator-facing grant revocation, and exercise the complete profile on SQLite, PostgreSQL, and MySQL in CI. This implementation provides user revocation and audit records; it does not claim those rollout checks are complete.
