# Project Management Recommendations Checklist

This checklist turns the IAM gap analysis into a concrete, prioritized implementation backlog for the current codebase.

## Implementation progress

- [x] Epic 1 slice delivered: policy simulation endpoint, backend evaluator, admin simulator UI, and integration test.
- [x] Admin frontend documentation updated for policy simulator usage and API contract.
- [x] Epic 1 slice delivered: policy decision history endpoint and audit-backed persistence for simulator runs.
- [x] Frontend concern split: policy simulator extracted from `Policies.tsx` into a dedicated component.
- [x] Epic 1 slice delivered: dedicated `/api/admin/authorization/check` endpoint with frontend simulator mode.
- [x] Epic 1 slice delivered: policy `category` support across storage, APIs, and admin UI.
- [x] Cross-provider persistence validated: policy category now persists for Prisma-backed providers (PostgreSQL/MySQL) and SQLite.
- [x] Epic 1 slice delivered: dedicated decision log repository/storage (beyond audit-backed history) with SQLite + Prisma support.
- [x] Build stability pass: async contract/type regressions fixed across routes, auth service, SQLite decision-log repository, and database adapters/factory.
- [x] Epic 1 slice delivered: evaluator now supports assignment `effect`/`priority` plus request-level `decisionStrategy` (`deny_overrides`, `allow_overrides`, `first_applicable`) with simulator UI support and integration coverage.
- [x] Epic 1 slice delivered: assignment-level `resourcePattern` / `actionPattern` filtering in ABAC evaluator, simulator guidance, and integration coverage.
- [x] Build stability follow-up: fixed `PolicyEffect` typing regression after evaluator modularization refactor.
- [x] Epic 1 slice delivered: runtime admin-route authorization enforcement now uses dedicated authorization service with RBAC prefilter + ABAC decision and integration coverage.
- [x] Epic 1 slice delivered: unit coverage added for authorization evaluator semantics and policy script safety guardrails (VM timeout + restricted globals).
- [x] Backend concern split: admin authorization mapping/permission logic extracted from `routes.ts` into dedicated HTTP helper module.
- [x] Epic 1 slice delivered: explicit `deny_overrides` precedence integration coverage with competing allow/deny policies and priority assertions.
- [x] Epic 1 slice delivered: E2E admin authorization journey (create policy -> simulate decision -> live `/api/admin/*` enforcement).
- [x] Epic 2 foundation slice delivered: SCIM metadata endpoints (`/scim/v2/ServiceProviderConfig`, `/scim/v2/Schemas`, `/scim/v2/ResourceTypes`) with dedicated SCIM service and route module.
- [x] Admin documentation view updated with SCIM endpoint catalog and response examples.
- [x] Integration coverage added for SCIM metadata endpoint contracts.
- [x] Epic 1 schema/model closure: policy definition now has first-class `effect`, `resourcePattern`, `actionPattern`; policy assignment now has first-class `priority`, `decisionStrategy` across domain models, APIs, SQLite, and Prisma persistence.
- [x] Epic 1 frontend docs update: admin API documentation examples now include the new policy definition and assignment fields.
- [x] Epic 2 slice delivered: SCIM Users/Groups lifecycle endpoints (`GET/POST/PATCH/PUT/DELETE`) with dedicated SCIM payload schemas and route/service decomposition.
- [x] Epic 2 slice delivered: SCIM resources now map to existing user/group services for create, list, update, membership patch, and delete flows.
- [x] Integration coverage added for SCIM Users/Groups lifecycle behavior.
- [x] Epic 2 security slice delivered: SCIM bearer-token auth now enforced for all `/scim/v2/*` routes with persisted hashed provisioning tokens and revocation/expiry handling.
- [x] Epic 2 admin API slice delivered: provisioning token management endpoints (`GET/POST/DELETE /api/admin/provisioning/tokens*`) plus admin docs and OpenAPI updates.
- [x] Epic 2 provisioning slice delivered: attribute mapping APIs (`GET/POST/DELETE /api/admin/provisioning/mappings`) and reconciliation APIs (`GET /api/admin/provisioning/jobs`, `POST /api/admin/provisioning/jobs/reconcile`) with service/repository support.
- [x] Epic 2 frontend slice delivered: administration view now includes provisioning token management, mapping management, and dry-run reconciliation controls.
- [x] Epic 3 slice delivered: access request intake/listing plus approve/reject transitions with admin UI actions and workflow tests.
- [x] EPIC 6 slice delivered: PAM-lite elevation controls with request/session lifecycle, approval workflows, and hard-expiry sessions.
- [x] EPIC 6 slice delivered: emergency break-glass elevation for admins to bypass approvals with full audit trail and metadata tracking.
- [x] EPIC 4 OpenAPI slice delivered: SAML admin endpoints (`/api/admin/saml/service-providers`, `/api/admin/saml/assertions`) with schema definitions.
- [x] EPIC 4 foundation slice delivered: SAML protocol endpoints (`GET /saml/metadata`, `POST /saml/sso`, `POST /saml/slo`, `POST /saml/acs/:spId`) with XML helper utilities, assertion audience/destination validation, and integration coverage.
- [x] EPIC 4 hardening slice delivered: extracted SAML assertion security validation and replay-protection service with dedicated unit coverage for SAML response parsing/validation primitives.
- [x] EPIC 4 hardening follow-up: deterministic SAML integration coverage now verifies ACS replay blocking and SLO session invalidation propagation.
- [x] EPIC 4 security slice delivered: SAML response XML signing on `/saml/sso` plus signature verification enforcement on `/saml/acs/:spId`, including tamper-rejection integration coverage.
- [x] EPIC 4 admin slice delivered: metadata upload (`POST /api/admin/saml/service-providers/:id/metadata`) and targeted certificate rotation (`POST /api/admin/saml/service-providers/:id/certificates/rotate`) with integration coverage.
- [x] EPIC 4 security hardening follow-up: ACS now rejects ambiguous assertion structures (signature-wrapping defense), and coverage explicitly verifies destination/audience and skew-aware validation checks.
- [x] EPIC 4 foundation: SAML 2.0 service provider registration, metadata endpoints, and assertion auditing.
- [x] EPIC 5 foundation slice delivered: admin security telemetry endpoint (`GET /api/admin/security/risk-events`) with integration coverage and admin documentation/OpenAPI updates.
- [x] EPIC 5 slice delivered: WebAuthn/passkey backend foundation (`register begin/finish`, `login begin/finish`), repository persistence for SQLite+Prisma paths, and authentication stage support for `mfa_webauthn`.
- [x] EPIC 5 frontend/docs slice delivered: portal account security view now manages passkey credentials and admin documentation view catalogs new WebAuthn endpoints.
- [x] EPIC 5 coverage slice delivered: unit + integration tests added for WebAuthn challenge lifecycle and register/login flows.
- [x] EPIC 5 follow-up slice delivered: `risk_events` persistence model and repository/service foundations added for adaptive risk scoring.
- [x] EPIC 7 slice delivered: workload identity admin APIs (`service-identities` CRUD + credential issue/rotate/revoke + usage), OAuth token exchange endpoint support, admin UI page, admin documentation view updates, and OpenAPI coverage.
- [x] EPIC 7 coverage slice delivered: integration tests added for service identity lifecycle and token exchange success/failure paths.
- [x] EPIC 7 quality follow-up: unit coverage added for service identity credential rotation behavior and expired/revoked credential validation.
- [x] EPIC 5 adaptive-auth follow-up: login pre-credential enforcement now evaluates risk scoring during `risk_check`, records risk events, and requires explicit acknowledgement on challenged risk outcomes.

## Planning assumptions

- Current strengths are OAuth2/OIDC core, admin APIs, policy hooks, audit events, federation (OIDC-style providers), and tenant/group/role management.
- This backlog focuses on making the platform "full IAM" for enterprise use.
- Priority order is P0 (must-have), P1 (high), P2 (medium), P3 (later).

## Priority roadmap

1. P0: ABAC authorization engine and policy decision API
2. P0: SCIM 2.0 provisioning and lifecycle automation
3. P1: Access governance (requests, approvals, recertification)
4. P1: SAML 2.0 enterprise federation
5. P1: WebAuthn/Passkeys and adaptive authentication
6. P2: Privileged access controls (PAM-lite)
7. P2: Workload identity and machine credential governance
8. P3: Connector framework and operational maturity

---

## EPIC 1 (P0): ABAC Authorization Engine

### Outcomes

- Keep OAuth scopes for coarse grants.
- Add ABAC for resource-level and context-aware decisions.
- Avoid scope explosion by moving fine-grained checks to policy evaluation.

### API backlog

- [x] Extend existing policy APIs to support authz policy category.
- [x] `POST /api/admin/policies/evaluate` for dry-run decision simulation.
- [x] `GET /api/admin/policies/decisions` to inspect recent allow/deny outcomes.
- [x] `POST /api/admin/authorization/check` for service-to-service internal checks.

### Schema and model backlog

- [x] Add `category` to `policy_definitions` (`authentication` | `authorization`).
- [x] Add `effect` (`allow` | `deny`) to `policy_definitions`.
- [x] Add `resource_pattern` and `action_pattern` to `policy_definitions`.
- [x] Add `priority` and `decision_strategy` to `policy_assignments`.
- [x] Add `decision_logs` table (subject, resource, action, context, decision, policy_id, latency_ms).
- [x] Update `src/domain/models.ts` with ABAC policy and decision log types.
- [x] Extend `src/repositories/contracts.ts` with decision log repository interfaces.

### Code implementation backlog

- [x] Create `src/services/authorization-service.ts` with `evaluate(subject, resource, action, context)`.
- [x] Invoke authorization service from route handlers after token/session resolution.
- [x] Keep existing RBAC checks as fast prefilter, then ABAC decision.
- [x] Add admin UI screens in `admin/src/pages/Policies.tsx` for ABAC fields and simulation.

### Test plan

- [x] Unit: policy parser and evaluator semantics (allow/deny precedence, priority handling).
- [x] Unit: condition safety guardrails (no dangerous expression execution).
- [x] Integration: policy simulation endpoint evaluates allow/deny decision paths.
- [x] Integration: endpoint authorization with mixed RBAC + ABAC.
- [x] Integration: deny overrides allow for higher-priority policies.
- [x] E2E: admin creates policy, simulation returns expected decision, live API enforces decision.

### Suggested files to touch

- `src/http/routes.ts`
- `src/http/schemas.ts`
- `src/services/policy-service.ts`
- `src/services/security-service.ts`
- `src/domain/models.ts`
- `src/repositories/contracts.ts`
- `prisma/schema.prisma`
- `tests/unit/*`
- `tests/integration/*`

---

## EPIC 2 (P0): SCIM 2.0 Provisioning and Identity Lifecycle

### Outcomes

- Enterprise directories can provision/deprovision users and groups automatically.
- Joiner/mover/leaver events become policy-driven and auditable.

### API backlog

- [x] `GET /scim/v2/ServiceProviderConfig`
- [x] `GET /scim/v2/Schemas`
- [x] `GET /scim/v2/ResourceTypes`
- [x] `GET/POST/PATCH/PUT/DELETE /scim/v2/Users`
- [x] `GET/POST/PATCH/PUT/DELETE /scim/v2/Groups`
- [x] `GET /api/admin/provisioning/tokens`
- [x] `POST /api/admin/provisioning/tokens`
- [x] `DELETE /api/admin/provisioning/tokens/:id`
- [x] `POST /api/admin/provisioning/mappings` for attribute mapping configuration.
- [x] `POST /api/admin/provisioning/jobs/reconcile` for reconciliation runs.

### Schema and model backlog

- [x] Add `external_source` and `external_id` to users/groups linkage model.
- [x] Add `scim_tokens` table for bearer token auth and rotation.
- [x] Add `provisioning_mappings` table for source-to-attribute mapping rules.
- [x] Add `provisioning_jobs` table for reconciliation and status tracking.
- [x] Add `deprovisioning_queue` table for downstream revoke/offboarding tasks.

### Code implementation backlog

- [x] Create `src/http/scim-routes.ts` and register under `/scim/v2`.
- [x] Create `src/services/scim-service.ts` for protocol handling and patch ops.
- [x] Map SCIM resources to existing user/group services.
- [x] Add SCIM token service and enforce bearer auth on SCIM routes.
- [x] Emit audit and event hooks for SCIM mutations.
- [x] Add admin pages for token management and provisioning mappings.

### Test plan

- [x] Unit: SCIM PATCH operation handling.
- [x] Unit: mapping engine (source attributes -> customAttributes).
- [x] Integration: create/update/deactivate/delete users via SCIM.
- [x] Integration: group membership sync and idempotency.
- [x] Integration: SCIM bearer token auth accepts valid tokens and rejects missing/invalid/revoked tokens.
- [x] Integration: reconciliation detects and reports drift.
- [x] Security: SCIM token auth and malformed payload behavior.

### Suggested files to touch

- `src/http/routes.ts`
- `src/http/schemas.ts`
- `src/services/user-service.ts`
- `src/services/group-service.ts`
- `src/services/event-hook-service.ts`
- `src/services/security-service.ts`
- `prisma/schema.prisma`
- `openapi.yaml`
- `tests/integration/*`

---

## EPIC 3 (P1): Access Governance (IGA-lite)

### Outcomes

- Managed access request/approval flow.
- Periodic recertification campaigns for compliance.

### API backlog

- [x] `POST /api/admin/access-requests`
- [x] `GET /api/admin/access-requests`
- [x] `POST /api/admin/access-requests/:id/approve`
- [x] `POST /api/admin/access-requests/:id/reject`
- [x] `POST /api/admin/access-reviews/campaigns`
- [x] `GET /api/admin/access-reviews/campaigns/:id`
- [x] `POST /api/admin/access-reviews/items/:id/decision`

### Schema and model backlog

- [x] Add `access_requests` table (requester, subject, entitlement, status, justification, expires_at).
- [x] Add `access_request_approvals` table (approver, decision, rationale, timestamp).
- [x] Add `review_campaigns` and `review_items` tables.
- [x] Add attestation metadata to audit events for evidence export.

### Code implementation backlog

- [x] Create `src/services/access-governance-service.ts`.
- [x] Add SLA/escalation logic for stalled approvals.
- [x] Auto-create assignments on approval, auto-revoke on expiry.
- [x] Add campaign UI pages in admin app.

### Test plan

- [x] Unit: approval workflow transitions and invalid transitions.
- [x] Integration: create request -> approval -> entitlement assignment.
- [x] Integration: expiration revokes assignment.
- [x] Integration: campaign generation includes in-scope assignments.
- [x] E2E: reviewer certifies/revokes access and audit evidence is generated.

---

## EPIC 4 (P1): SAML 2.0 Federation

### Outcomes

- Support enterprises that require SAML federation.
- Enable NexusID as SAML IdP for legacy/enterprise SaaS.

### API backlog

- [x] `GET /saml/metadata`
- [x] `POST /saml/sso`
- [x] `POST /saml/slo`
- [x] `POST /saml/acs/:spId`
- [x] Admin endpoints for SP metadata upload and certificate rotation.
- [x] `GET /api/admin/saml/service-providers` (list)
- [x] `POST /api/admin/saml/service-providers` (create)
- [x] `GET /api/admin/saml/service-providers/:id` (get)
- [x] `PATCH /api/admin/saml/service-providers/:id` (update)
- [x] `DELETE /api/admin/saml/service-providers/:id` (delete)
- [x] `GET /api/admin/saml/assertions` (audit list)

### Schema and model backlog

- [x] Add `saml_service_providers` table (entity_id, acs_url, slo_url, cert, algorithms, enabled).
- [x] Add `saml_name_id_mappings` table.
- [x] Add `saml_assertion_audits` table for response IDs, audience, session correlation.
- [x] Added SAML models to domain/models.ts.
- [x] Added Prisma schema models for SAML tables.

### Code implementation backlog

- [x] Create `src/services/saml-service.ts` with full CRUD and audit operations.
- [x] SQLite repository implementation for SAML service providers, name ID mappings, assertion audits.
- [x] Prisma repository implementations for SAML entities.
- [x] Create `src/http/samllib.ts` for XML signing and assertion generation utilities.
- [x] Create `src/http/saml-routes.ts` with metadata, SSO, SLO, ACS flows.
- [x] Implement XML signing, assertion generation, and audience validation.
- [x] Implement SAML audience/destination validation, replay detection guard, and skew-aware expiry checks for ACS processing.
- [x] Bridge SAML session lifecycle to existing session repository and logout flows.
- [x] Add metadata parsing/upload and targeted certificate rotation operations for service providers.

### Test plan

- [x] Unit: SAML response builder and signature validation helpers.
- [x] Unit: SAML response parsing and assertion security guardrails (audience/destination/expiry/replay).
- [x] Integration: service provider CRUD operations.
- [x] Integration: metadata upload + certificate rotation admin flows.
- [x] Integration: IdP-initiated and SP-initiated SSO.
- [x] Integration: logout propagation and replay protection.
- [x] Security: signature wrapping, clock skew, and destination checks.

---

## EPIC 5 (P1): WebAuthn/Passkeys and Adaptive Auth

### Outcomes

- Strong phishing-resistant MFA and passwordless paths.
- Risk-adaptive step-up integrated with existing stage/policy framework.

### API backlog

- [x] `POST /api/account/mfa/webauthn/register/begin`
- [x] `POST /api/account/mfa/webauthn/register/finish`
- [x] `POST /auth/login/webauthn/begin`
- [x] `POST /auth/login/webauthn/finish`
- [x] `GET /api/admin/security/risk-events`

### Schema and model backlog

- [x] Add `webauthn_credentials` table (user_id, credential_id, public_key, sign_count, transports, aaguid).
- [x] Add `risk_events` table (ip, device fingerprint hash, geo, confidence, reason, decision).
- [x] Extend `authentication_flows` stage support with `mfa_webauthn`.

### Code implementation backlog

- [x] Create `src/services/webauthn-service.ts`.
- [x] Add challenge store and replay protection.
- [x] Integrate risk score into stage policy checks.
- [x] Add admin and portal UI for credential management.

### Test plan

- [x] Unit: challenge lifecycle and sign count logic.
- [x] Integration: registration and authentication ceremony success/failure cases.
- [x] Integration: high-risk login triggers step-up requirement.
- [ ] E2E: passwordless login for enrolled user.

---

## EPIC 6 (P2): Privileged Access Controls (PAM-lite)

### Outcomes

- Time-bound elevation and approvals for high-risk actions.
- Better control over admin-level operations.
- Emergency break-glass paths with full audit compliance.

### API backlog

- [x] `POST /api/admin/elevations`
- [x] `POST /api/admin/elevations/:id/approve`
- [x] `POST /api/admin/elevations/:id/activate`
- [x] `POST /api/admin/elevations/:id/revoke`
- [x] `GET /api/admin/elevations`
- [x] `GET /api/admin/elevations/:id`
- [x] `GET /api/admin/elevations/sessions`
- [x] `POST /api/admin/elevations/process-expirations`
- [x] `POST /api/admin/elevations/check`
- [x] `POST /api/admin/elevations/break-glass` (emergency override)
- [x] `GET /api/admin/access-requests/stalled`

### Schema and model backlog

- [x] Add `elevation_requests` table.
- [x] Add `elevation_sessions` table with hard expiry.
- [x] Add command/action audit correlation IDs for privileged operations.
- [x] Add emergency break-glass audit event type.

### Test plan

- [x] Integration: elevation request lifecycle (create → approve → activate → revoke).
- [x] Integration: privileged action denied without active elevation.
- [x] Integration: approved elevation enables action until expiry.
- [x] Security: emergency break-glass path is fully audited with justification requirements.

---

## EPIC 7 (P2): Workload Identity and Machine Credential Governance

### Outcomes

- Better management of non-human identities.
- Reduced secret sprawl and improved rotation posture.

### API backlog

- [x] `POST /api/admin/service-identities`
- [x] `POST /api/admin/service-identities/:id/credentials/rotate`
- [x] `GET /api/admin/service-identities/:id/usage`
- [x] Add OAuth token exchange endpoint support (`urn:ietf:params:oauth:grant-type:token-exchange`).

### Schema and model backlog

- [x] Add `service_identities` table with owner and lifecycle metadata.
- [x] Add `service_identity_credentials` table with rotation history.
- [ ] Add usage telemetry linkage from access tokens to service identity.

### Test plan

- [x] Unit: rotation policy and expiration validation.
- [x] Integration: token exchange flow and audience restrictions.
- [ ] Integration: automated expiry alerts and revocation behavior.

---

## EPIC 8 (P3): Connector Framework and Operations Maturity

### Outcomes

- Faster integration with downstream SaaS and enterprise systems.
- Improved reliability and operability for production IAM workloads.

### API backlog

- [x] `POST /api/admin/connectors`
- [x] `POST /api/admin/connectors/:id/sync`
- [x] `GET /api/admin/connectors/:id/runs`
- [x] `GET /api/admin/metrics/auth`

### Schema and model backlog

- [x] Add `connectors`, `connector_runs`, `connector_mappings` tables.
- [x] Add metrics rollup tables for auth outcomes and policy latency.

### Test plan

- [ ] Integration: connector sync retries, backoff, and dead-letter handling.
- [ ] Integration: audit and notification generation on connector failures.
- [ ] Non-functional: load test token and policy decision throughput.

---

## Cross-cutting work items (apply to all epics)

- [ ] Update OpenAPI spec (`openapi.yaml`) for each endpoint increment.
- [ ] Add schema validation in `src/http/schemas.ts` for all new request payloads.
- [ ] Ensure every write path emits `auditRepository.log` and event hooks.
- [ ] Add migration scripts and rollout docs in `docs/` for each DB change.
- [ ] Add tenant-awareness checks for all new resources and operations.
- [ ] Add rate limiting and CSRF/auth checks for all new admin and account routes.
- [ ] Add feature flags for risky protocol additions (SAML, token exchange, passkeys).

## Delivery milestones (recommended)

1. Milestone A (4-6 weeks): Epic 1 + Epic 2 foundation endpoints and schema.
2. Milestone B (4-6 weeks): Epic 1/2 hardening + Epic 3 workflows.
3. Milestone C (4-6 weeks): Epic 4 + Epic 5 rollout.
4. Milestone D (3-5 weeks): Epic 6 + Epic 7.
5. Milestone E (ongoing): Epic 8 reliability, observability, and connector expansion.

## Definition of done per epic

- [ ] API endpoints implemented and documented in `openapi.yaml`.
- [ ] Prisma schema changes migrated and backward compatibility reviewed.
- [ ] Unit + integration coverage added under `tests/unit` and `tests/integration`.
- [ ] At least one end-to-end happy path added when user-facing.
- [ ] Audit events and event hooks verified.
- [ ] Security review completed (authz bypass, injection, replay, rate limit).
- [ ] Admin/portal UI support completed where applicable.
