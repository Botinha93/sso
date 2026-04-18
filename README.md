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

## API Documentation

- OpenAPI specification: `openapi.yaml`

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
