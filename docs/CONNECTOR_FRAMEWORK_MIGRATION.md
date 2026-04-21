# Connector Framework Migration and Rollout

This document covers database rollout and operational guidance for the connector framework added in EPIC 8.

## Scope

The following tables are introduced in SQLite migrations:

- `connectors`
- `connector_runs`
- `connector_mappings`
- `auth_metric_rollups`

## Migration behavior

Migrations are executed by `SqliteConnection.ensureSchema()` during application startup.

- New tables are created with `CREATE TABLE IF NOT EXISTS`.
- Existing instances can roll forward without destructive schema changes.
- No data backfill is required for this increment.

## Deletion semantics

Connector deletion is implemented in the service layer with explicit dependency cleanup:

1. Delete all `connector_mappings` rows for the connector.
2. Delete all `connector_runs` rows for the connector.
3. Delete the connector row.

This avoids foreign key violations for existing databases where child foreign keys were created without `ON DELETE CASCADE`.

## Rollout checklist

1. Deploy code with migrations enabled.
2. Verify startup logs show successful schema initialization.
3. Create and sync at least one connector in a non-production environment.
4. Verify runs and mappings are created and listed.
5. Delete a connector and verify HTTP 204 and no orphan rows.

## Backout strategy

If rollback is needed:

1. Revert application deployment.
2. Keep the newly created tables in place (safe additive schema).
3. Disable connector endpoints behind routing or policy if required.

No destructive schema rollback is required for this release.

## Multi-database note

Prisma providers (PostgreSQL/MySQL) currently include repository stubs for connector and metric repositories. Full provider parity should be scheduled before enabling connector endpoints on non-SQLite deployments.
