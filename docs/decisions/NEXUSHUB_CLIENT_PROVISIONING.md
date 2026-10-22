# Decision: NexusHub OAuth client provisioning

**Status:** Blocked on NexusID authorization and ownership primitives  
**Date:** 2026-10-22

## Decision

NexusID does not currently expose a safe, narrowly scoped machine API for NexusHub OAuth client provisioning. The NexusHub installer must continue to use the documented, operator-authorized RFC 7591 registration flow when adopting an existing NexusID issuer. That flow is additive, but it requires NexusID's broad `clients:add` permission and creates a new client on every successful request. It is not an idempotent Hub provisioning API.

Do not add a Hub-specific exception to `/connect/register`, infer Hub ownership from `client_name`, `app_id`, callback URL, requested scopes, or a caller-supplied profile string, or write OAuth clients directly to the database. Do not broaden `clients:add` into an application permission. The existing endpoint and standalone registration modes remain unchanged.

## Evidence in the current implementation

- `POST /connect/register` authorizes admin mode with a user permission (`clients:add`), an ungated admin client, or a service identity carrying that same permission (`src/http/routes.ts`). It has no NexusHub-specific authorization branch.
- The endpoint generates a random client ID and secret for each accepted request. There is no idempotency key, named-profile lookup, or repeatable secret recovery operation.
- `OAuthClient` records an optional `appId`, but no owner service identity, issuer-enrolled Hub identity, tenant/organization ownership, provisioning profile, or idempotency key (`src/domain/models.ts`). The optional app association is not proof that the caller owns that app.
- The existing adoption script uses the standard endpoint and documents the broad permission and operator recovery procedure (`scripts/nexushub-register-client.mjs`, `docs/NEXUSHUB_ADOPTION.md`).

These gaps make an API that accepts a Hub name or declared `profileId` unsafe: any caller with access to the proposed route could claim the Hub namespace, and retry after an ambiguous response could create duplicate clients or lose the one-time secret.

## Required upstream primitives

Before NexusHub can provision clients without a human administrator, NexusID must provide all of the following:

1. **A dedicated machine authority.** Define a permission such as `nexushub:clients:provision` and a non-user service identity credential that can receive only this permission. The authority must be granted by a NexusID administrator through the supported admin interface. It must not imply `clients:add`, role/user management, app assignment, signing-key control, or arbitrary OAuth-client mutation.
2. **Issuer-established ownership.** NexusID must bind the provisioning principal to an approved Hub installation (or to an explicit NexusID tenant and Hub installation). The API must derive that binding from authenticated server-side state. A caller-provided client name, profile ID, app ID, redirect URI, organization ID, or tenant ID alone is not ownership evidence. If NexusID cannot attest a Hub installation, provisioning remains operator-only.
3. **A transactional named-profile lifecycle.** Accept a versioned profile under the bound installation and atomically create-or-return the same client for the same installation/profile/version. Reusing the key with a different normalized registration body must return a conflict, not mutate an existing client. A retry must not create a second client.
4. **Safe credential recovery.** Define how a retry handles the client secret after a lost response. Either return a secret only once and provide an explicit authenticated rotate-and-return operation, or retain it using a documented secret-at-rest design that permits recovery. Never return a stored secret merely because a caller knows a client ID/profile name. Rotation must invalidate the prior secret atomically and be auditable.
5. **Lifecycle and audit controls.** Specify revocation/deprovisioning, profile-version upgrades, collision behavior, audit actor/target fields, and rate limits. Emit audit events for create, idempotent replay, conflict, rotation, and revoke without logging credentials.

The API should live under a versioned NexusID administration namespace, be disabled unless the scoped authority and Hub installation binding are explicitly configured, validate the issuer/audience and authenticated service identity, and accept only a bounded schema. Its allowlist must constrain grants to `authorization_code` and `refresh_token`, require PKCE, use `client_secret_post`, and constrain scopes and redirect origins to a reviewed Hub profile. Existing OAuth validation rules remain authoritative.

## Acceptance criteria to unblock

- A service identity with only the dedicated permission can provision a bound Hub profile; one with `clients:add` alone cannot call the new endpoint unless explicitly granted the new authority.
- The server derives installation ownership from its enrollment record and rejects caller-selected identities outside that binding.
- Concurrent identical requests create exactly one client; an identical retry returns the defined stable result; a changed body under the same profile key conflicts without mutation.
- A lost first response has a documented, authenticated, auditable recovery path that does not expose the secret to another Hub installation.
- Existing `/connect/register` behavior and deployments with dynamic registration disabled remain unchanged.

Until these criteria are implemented and reviewed, the Hub installer must require an operator-provided NexusID admin credential for the existing additive adoption flow and must retain its ambiguous-outcome reconciliation behavior.
