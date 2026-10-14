# SSO Platform Foundation

This repository provides a first-party identity platform aligned with OAuth 2.0 and OpenID Connect.

## Implemented features

- OIDC discovery endpoint and JWKS
- Authorization endpoint with code and implicit token response types
- Token endpoint with authorization_code, refresh_token, client_credentials, and password grants
- Token introspection and revocation
- Dynamic client registration (`/connect/register`)
- UserInfo endpoint with scope-based claims
- RP-initiated logout plus front-channel and back-channel logout support
- JWT issuance for access, ID, and refresh tokens
- Password hashing with `scrypt`
- File-backed SQLite database using `better-sqlite3` with WAL mode
- External database migration tooling for PostgreSQL/MySQL targets (connection test + data copy from SQLite)
- Consent persistence, refresh token rotation, token revocation, tenant-aware role assignments
- Admin console and user portal
- User federation, authentication flows, policies, events/hooks, and audit logs

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment values:

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm run dev
   ```

4. Open the admin console:

   ```text
   http://127.0.0.1:4000/
   ```

## Docker

Build the production image:

```bash
docker build -t sso-platform .
```

Run it with the default SQLite configuration and a persisted data directory:

```bash
docker run --rm -p 4000:4000 \
   -e ISSUER=http://localhost:4000 \
   -e ADMIN_EMAIL=admin@example.com \
   -e ADMIN_PASSWORD=change-me-now \
   -v sso-data:/app/data \
   sso-platform
```

Notes:

- The container listens on `0.0.0.0:4000`.
- SQLite data is stored at `/app/data/sso.sqlite` by default.
- The admin frontend is served from `/` and the account portal is served from `/portal`.
- Set `DATABASE_PROVIDER=postgresql` or `DATABASE_PROVIDER=mysql` together with `DATABASE_URL` to use an external database.
- The container healthcheck targets `GET /health`.
- On first boot, the container can auto-run setup using `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
- For PostgreSQL/MySQL, the entrypoint runs `prisma db push` by default before the server starts. Set `RUN_PRISMA_DB_PUSH=false` to disable that.
- To perform a one-time SQLite import into PostgreSQL/MySQL at startup, set `MIGRATE_FROM_SQLITE_PATH` and keep `INIT_SENTINEL_PATH` on persistent storage so the import is not repeated on restart.
- Set `COOKIE_SECRET` for every deployment. In production, startup now fails if it is missing.
- Set `TRUST_PROXY=true` only when the app is actually behind a trusted reverse proxy or load balancer.

## Node Distribution Bundle

Build a self-contained Node runtime bundle (compiled API, admin/portal assets, Prisma artifacts, and production dependencies):

```bash
npm run bundle:node
```

Bundle output:

- `bundle/node/dist` (compiled server + frontend assets)
- `bundle/node/node_modules` (production dependencies only)
- `bundle/node/prisma` (schema files used by container entrypoint)

Run the bundled distribution directly with Node:

```bash
npm run bundle:node:start
```

## Single Executable

Build a single-file executable for the current platform:

```bash
npm run bundle:exe
```

Output binary:

- `bundle/executable/sso-platform`

Run it directly:

```bash
./bundle/executable/sso-platform
```

Notes:

- The executable embeds the Node runtime and your app bundle, then extracts into `~/.cache/sso-platform` on first launch.
- Rebuild on each target OS/CPU architecture (Linux/macOS/Windows, x64/arm64).
- Set `EXE_REBUILD=true` when running `npm run bundle:exe` if you want the executable build to force a fresh TypeScript/frontend rebuild first.

## API Documentation

- OpenAPI specification: `openapi.yaml`

## Security Notes

- `POST /oauth/introspect` now requires `client_id` and `client_secret` in the request body.
- `POST /oauth/backchannel-logout` now requires `client_id` and `client_secret`, and it only revokes sessions that belong to that client.
- `GET /oauth/logout` and `GET /oauth/frontchannel-logout` only redirect to post-logout URIs already registered on the active client.

## Database Provider Rewrite

The platform is mid-rewrite to support both SQLite and external databases.

- Setup and Administration now persist database provider configuration (`sqlite`, `postgresql`, `mysql`).
- Admin utilities:
   - `POST /api/admin/settings/database/test`
   - `POST /api/admin/settings/database/migrate`
- Current migration utility can test external connectivity and copy data from SQLite into PostgreSQL/MySQL.
- Migration now creates schemas in dependency-safe order (tables, then foreign keys), preserving unique indexes and avoiding FK-order failures during PostgreSQL/MySQL imports.

Transitional runtime behavior:

- Live runtime repositories are still SQLite-native.
- If `DATABASE_PROVIDER` is `postgresql` or `mysql`, startup now fails fast instead of silently falling back to `DATABASE_PATH`.
- The configured external target (`DATABASE_URL`) is currently used by migration/test tooling, not by the live repository layer.

Note: Runtime repository execution is still in migration from SQLite-native repositories to true multi-database repositories.

## Authentication Flows

Authentication behavior is configured through admin-managed flow definitions.

- List flows: `GET /api/admin/authentication/flows`
- Create flow: `POST /api/admin/authentication/flows`
- Update flow: `PUT /api/admin/authentication/flows/:id`
- Delete flow: `DELETE /api/admin/authentication/flows/:id`

Flow payload fields:

- `designation`: `authentication`, `authorization`, `enrollment`, `invalidation`, `recovery`, `stage_configuration`, `unenrollment`
- `grantTypes`: `authorization_code`, `client_credentials`, `refresh_token`, `password`, `device_code`
- `stages[].type`: `password`, `federation`, `consent`, `mfa_totp`, `risk_check`, `identification`, `email_verification`, `captcha`, `prompt`, `user_write`, `user_login`, `user_logout`
- `stages[].required`: boolean
- `stages[].order`: integer, stage execution order

## Example client apps

- SPA example (Authorization Code + PKCE): `examples/spa/index.html`
- Server example (Client Credentials): `examples/server/client-credentials.js`
- Mobile helper example (PKCE utilities): `examples/mobile/pkce.js`

## Seeded admin

- Email: `admin@example.com`
- Password: `change-me-now`

Update both in `.env` before using this anywhere beyond local development.
