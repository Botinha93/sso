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
- Multi-app assignments for users and groups, including user app access inherited from group membership

## SDKs

- TypeScript SDK: `sdk/`
- Python SDK: `sdk-python/`

Quick checks:

```bash
npm run check:sdk
npm run check:sdk:python
```

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

## Token lifetimes

Access and refresh token expirations are configured per OAuth client. Open **Admin → Clients**, edit a client, and set:

- **Access token TTL (seconds)** — defaults to `900` (15 minutes) when blank. Allowed range: 60 – 86,400.
- **Refresh token TTL (seconds)** — defaults to `2,592,000` (30 days) when blank. Allowed range: 300 – 31,536,000.

Tokens issued via flows without a client (e.g. service identity client credentials) fall back to the same default lifetimes.

## Docker

Build the production image:

```bash
docker build -t sso-platform .
```

Run it with the default SQLite configuration and a persisted data directory:

```bash
docker run --rm -p 8080:80 -p 8443:8443 \
   -e ISSUER=https://localhost:8443 \
   -e COOKIE_SECRET="$(openssl rand -hex 32)" \
   -v sso-data:/app/data \
   sso-platform
```

Notes:

- `nginx` listens on `80` and redirects all HTTP traffic to `https://...:8443`.
- The TLS endpoint is served on `8443` with a self-signed certificate when no cert/key is provided.
- The Node app listens only on the internal loopback interface at `127.0.0.1:4001`.
- SQLite data is stored at `/app/data/sso.sqlite` by default until the first-run installer saves a different database target.
- Database provider, path, and external connection URL are configured by the installer/admin database screen and persisted at `/app/data/database-config.json`.
- The admin frontend is served from `/` and the account portal is served from `/portal`.
- The container healthcheck targets `GET /health`.
- On first boot, the image defaults to the first-run installer (`AUTO_SETUP=false`).
- To auto-run setup instead, set `AUTO_SETUP=true` and provide `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
- For PostgreSQL/MySQL, the entrypoint runs `prisma db push` by default before the server starts.
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

The platform provides a comprehensive OpenAPI 3.0.3 specification with complete request/response schemas and real-world examples for all endpoints.

### Accessing the API Documentation

- **OpenAPI specification:** [`openapi.yaml`](./openapi.yaml)
- **Interactive documentation:** Use any OpenAPI viewer to render `openapi.yaml` for interactive exploration
  - [SwaggerUI](https://swagger.io/tools/swagger-ui/) can be self-hosted or accessed via online editors
  - [ReDoc](https://redoc.ly/) provides a clean, reader-friendly view
  - [Postman](https://www.postman.com/) can import the specification directly for testing

### Covered API Areas

**OAuth 2.0 & OIDC**
- Authorization endpoint with code/token response types
- Token endpoint (authorization_code, refresh_token, client_credentials, password, device_code)
- Token introspection and revocation
- Dynamic client registration
- UserInfo endpoint
- JWKS and discovery endpoints

**User Management & Provisioning**
- SCIM 2.0 user and group management
- SCIM provisioning tokens and attribute mappings
- Connector framework (LDAP, SCIM, CSV, SQL, custom)
- Connector sync jobs and drift detection

**Access Control & Governance**
- Role-based access control (RBAC) with multi-app support
- Access requests with approval workflows
- Access review campaigns with attestation
- Privileged access management (PAM) with elevation requests
- Break-glass emergency access
- Security risk event detection and SLA monitoring

**Authentication**
- WebAuthn passwordless registration and authentication
- TOTP multi-factor authentication
- Authentication flow definitions and stage configuration
- Risk-based adaptive authentication

**Workload Identity**
- Service identity management
- Machine-to-machine OAuth client ID/secret issuance and rotation
- Credential usage telemetry

**SAML**
- Service provider configuration and metadata management
- Assertion signing and encryption
- Assertion audit logs

**Federation & Sessions**
- External identity provider integration
- Session management with anomaly detection
- Front-channel and back-channel logout

**Portal & User APIs**
- Current user profile with app assignments
- Avatar management
- Password and account management
- Custom user attributes

Every endpoint includes:
- Complete request/response payload schemas
- Real-world example data with valid values
- HTTP status codes and error descriptions
- Required parameters and query filters
- Security requirements (bearer token, client credentials)

## Multi-App Behavior

- Users and groups can now be assigned to multiple apps.
- A user's effective app access is the union of:
  - apps assigned directly to the user
  - apps inherited from the groups the user belongs to
- The portal launcher consumes `GET /api/portal/me` and renders the full `apps` array, so it can display multiple assigned apps for the same user.
- For compatibility, legacy records that only have a single `appId` still work and are treated as having one direct app assignment until they are updated.

## Token Endpoint And Apps

- The token endpoint remains `POST /oauth/token`.
- Multi-app support does not introduce an app-specific token endpoint.
- App context is still modeled through the client, roles, permissions, and the effective app assignments on the user.
- In other words, clients continue to exchange tokens through `/oauth/token`, while app visibility in the portal and admin APIs is resolved from the user's effective app assignments.

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

Runtime database behavior:

- The first-run installer persists the selected database target before startup switches to it.
- The live repository layer uses the persisted database target on restart; database env vars are no longer required for normal deployments.

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
- Fullstack example (frontend login -> backend OAuth check -> role/permission route guard): `sdk/examples/fullstack-rbac/README.md`

## Seeded admin

- Email: `admin@example.com`
- Password: `change-me-now`

Update both in `.env` before using this anywhere beyond local development.
