# Multi-Database Support

## Overview

The SSO platform supports SQLite, PostgreSQL, and MySQL through provider-specific Prisma clients. Database selection is made in the first-run installer or in Admin > Administration > Database, then persisted on the app data volume.

## Supported Databases

- **SQLite**: default local database at `./data/sso.sqlite`.
- **PostgreSQL**: recommended for production.
- **MySQL**: alternative external database.

## Configuration

Database provider, SQLite path, and external connection URL are not configured through deployment env vars. The installer/admin database screen writes them to:

```text
./data/database-config.json
```

On startup, the app reads that file before creating repositories. If the file is missing, the app starts with SQLite at `./data/sso.sqlite` so the installer can run.

For PostgreSQL/MySQL, startup runs the provider schema push before bootstrapping the app.

## Migration from SQLite

Use the admin database migration endpoint:

```text
POST /api/admin/settings/database/migrate
```

The endpoint copies data from the configured SQLite file to the selected external database, updates instance settings, and persists the runtime database config file for subsequent restarts.

## Implementation Notes

- `src/core/runtime-database-config.ts` owns persisted runtime database config.
- `src/core/config.ts` applies persisted database config over the default SQLite bootstrap config.
- `src/repositories/prisma-factory.ts` creates the provider-specific Prisma client.
- Prisma schemas still use `DATABASE_URL` internally because Prisma Client and `prisma db push` require that variable at process level; the app derives it from the persisted install config.

## Troubleshooting

### Missing external database URL

Revisit the installer/admin database form and save a valid PostgreSQL/MySQL connection string.

### Prisma Client generation failed

Run:

```bash
npm run prisma:generate
```

## See Also

- [Prisma Documentation](https://www.prisma.io/docs)
