# Multi-Database Support Status

## Overview

The SSO platform has multi-database migration scaffolding for SQLite, PostgreSQL, and MySQL, but the active runtime repository layer is still SQLite-native.

## Supported Databases

- **SQLite** (default, file-based, no server needed)
- **PostgreSQL** (recommended for production)
- **MySQL** (alternative for production)

## Configuration

### Environment Variables

```bash
# Database provider (sqlite, postgresql, or mysql)
DATABASE_PROVIDER=sqlite

# For SQLite: local file path
DATABASE_PATH=./data/sso.sqlite

# For PostgreSQL/MySQL: full connection string
DATABASE_URL=postgresql://user:password@localhost:5432/sso
DATABASE_URL=mysql://user:password@localhost:3306/sso
```

## Usage

### Current Runtime Status

- `DATABASE_PROVIDER=sqlite`: supported for live runtime
- `DATABASE_PROVIDER=postgresql`: migration/test tooling supported, live runtime not yet wired
- `DATABASE_PROVIDER=mysql`: migration/test tooling supported, live runtime not yet wired

If you set `DATABASE_PROVIDER` to `postgresql` or `mysql`, the server now fails fast instead of silently falling back to SQLite.

### Planned Bootstrap Path

```typescript
import { createPrismaRepositoryBundle } from "./repositories/prisma-factory.js";
import { AppConfig } from "./core/config.js";

const config: AppConfig = {
  databaseProvider: "postgresql", // or "sqlite", "mysql"
  databasePath: "./data/sso.sqlite", // for sqlite
  externalDatabaseUrl: "postgresql://...", // for postgresql/mysql
  // ... other config
};

const repositories = await createPrismaRepositoryBundle(config);
```

### Migration from SQLite to Production Database

1. **Export SQLite data** using the database migration endpoint:
   ```
   POST /api/admin/settings/database/migrate
   ```

2. **Update environment variables**:
   ```bash
   DATABASE_PROVIDER=postgresql
   DATABASE_URL=postgresql://user:password@localhost:5432/sso
   ```

3. **Run Prisma migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Keep runtime on SQLite for now** until the active repository factory is fully rewritten

## Implementation Details

### Repository Pattern with Prisma

Repositories now leverage Prisma Client for database operations. The `PrismaUserRepository` example shows the pattern:

```typescript
export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    // Use Prisma Client - it adapts to any database
    await this.prisma.users.create({
      data: { /* ... */ }
    });
  }
}
```

### Schema Configuration

The Prisma schema (`prisma/schema.prisma`) automatically selects the correct database provider:

```prisma
datasource db {
  provider = env("DATABASE_PROVIDER")
  url      = env("DATABASE_URL")
}
```

## Migration Path

### Phase 1 (Current)
- ✅ Prisma setup complete
- ✅ Prisma factory created
- ⏳ Incrementally rewrite repository implementations to use Prisma
- ⏳ Replace active SQLite repository factory with real multi-database runtime support

### Phase 2
- Implement remaining Prisma repositories (currently using SQLite shim)
- Test with PostgreSQL backend
- Test with MySQL backend
- Update documentation with database-specific configurations

### Phase 3
- Deprecate custom SQLite implementations
- Complete migration to Prisma for all repositories
- Production hardening for PostgreSQL/MySQL

## Switching Databases at Runtime

The live application should remain on SQLite until the repository rewrite is complete.

For PostgreSQL/MySQL today, use the external target for validation and migration:

```bash
# Export current data (if needed)
npm run db:export

# Keep runtime on SQLite, use external provider only for migration/test flows
DATABASE_PROVIDER=sqlite
```

## Benefits of Prisma

1. **Type Safety**: Generated types from schema
2. **Migration Path**: Schema and factory groundwork already exist
3. **Query Portability**: Prisma can remove dialect-specific SQL over time
4. **Built-in Migrations**: `prisma migrate` can handle schema changes once runtime is moved over
5. **Developer Experience**: Intellisense and autocompletion for rewritten repositories

## Troubleshooting

### "DATABASE_PROVIDER=postgresql/mysql is configured, but the active runtime repository layer is still SQLite-only"
This is expected with the current repository implementation. Use the external provider for migration/test tooling only, or switch runtime back to SQLite.

### "DATABASE_URL is required"
For PostgreSQL/MySQL, ensure `DATABASE_URL` is set to a valid connection string

### Prisma Client generation failed
Run: `npx prisma generate`

### Schema conflicts when switching databases
The schema is now provider-agnostic. Clear `prisma/migrations` if adding new migrations.

## See Also

- [Prisma Documentation](https://www.prisma.io/docs)
