# NexusBus management tokens from NexusID

## Status

An opt-in issuer endpoint now supports a dedicated `nexusbus_management` grant. It is disabled unless `NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED=true`. NexusID only accepts an enrollment mapping that exactly matches a deployment-admin configured entry in `NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON`; it rechecks that entry before every token mint. Ordinary OAuth client credentials and delegated-user exchange are not accepted by this grant.

## Authority and routes

The approved JSON mapping is a deployment-owned registry. Each entry pins `organizationId`, optional `projectId`, Bus `tenant`, Bus `app`, and the maximum allowed roles (`nexusbus.installation.read` and/or `nexusbus.installation.apply`). The NexusID platform administrator who controls deployment configuration approves the mapping. The NexusID service-identity administrator then creates an enrollment at `PUT /api/admin/service-identities/{id}/nexusbus-management-enrollment`; submitted fields must match the registry exactly and roles may only be a subset. The response contains a generated 256-bit secret once. NexusID stores only its SHA-256 verifier in `nexusbus_management_enrollments`.

The Hub requests a token from `POST /api/nexusbus/v1/token` using `grant_type=nexusbus_management`, the one-time returned credential ID as `client_id`, the generated secret as `client_secret`, and a non-empty subset of enrolled roles. The issuer derives all authority claims from enrollment and the current registry: exactly `aud=nexusbus-management`, a non-empty installation subject, `tenant`, `app`, `roles`, and `hub_scope` with the bound organization and optional project. The token has a fresh `jti` and a five-minute maximum lifetime. Role escalation, unknown grant types, inactive identities, invalid secrets, revoked enrollment, and a removed registry binding fail closed. Enrollment creation, revocation, token success, and denial are audited without recording the secret or bearer token.

Revoke an enrollment with `DELETE /api/admin/service-identities/{id}/nexusbus-management-enrollment`. This prevents future token minting. Already issued tokens can remain valid for up to five minutes unless NexusBus also checks `jti` revocation.

## Persistence limitation

The dedicated `nexusbus_management_enrollments` table is initialized by provider-neutral startup DDL when the Prisma-backed repository bundle starts. It has unique constraints for enrollment, installation, service identity, and management credential IDs. The repository inserts enrollment rows atomically and uses conditional updates for revocation. SQLite, MySQL 8.0, and PostgreSQL 17 startup/create/read/revoke behavior passed focused acceptance; full SQLite unit/integration and MySQL unit/integration/E2E suites passed. The row is intentionally one-time per service identity, including after revocation; re-enrollment/rotation needs an explicit audited lifecycle operation rather than replacing a consumed secret implicitly.

The environment registry is also a deployment trust input: NexusID cannot independently verify that a Bus tenant or app exists. The operator must source these identifiers from the trusted NexusBus identity administration process. This implementation does not infer them from Hub requests, manifests, generic OAuth metadata, or service-identity role assignments.
