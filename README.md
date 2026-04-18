# SSO Platform Foundation

This repository starts a first-party identity platform aligned with OAuth 2.0 and OpenID Connect concepts.

## Included in this foundation

- OIDC discovery endpoint
- JWKS endpoint for public signing keys
- JWT issuance for access, ID, and refresh tokens
- Password hashing with `scrypt`
- File-backed SQLite database in WAL mode for local persistence and concurrent access
- Role and user management APIs
- Authorization code + PKCE oriented flow skeleton
- Consent persistence, refresh token rotation, token revocation tracking, and tenant-aware role assignments
- Seeded admin account for local development

## Planned next milestones

- Token introspection endpoint
- MFA / WebAuthn
- Audit logs and admin console

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

## Seeded admin

- Email: `admin@example.com`
- Password: `change-me-now`

Update both in `.env` before using this anywhere beyond local development.
