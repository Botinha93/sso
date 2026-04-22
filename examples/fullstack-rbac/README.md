# Frontend Login -> Backend OAuth Check -> RBAC Route Guard Example

This example demonstrates the full flow you asked for:

1. User logs in from the frontend.
2. Frontend sends the access token to a backend route.
3. Backend validates token state against OAuth introspection.
4. Backend fetches user identity claims from UserInfo.
5. Backend applies role and permission checks before allowing route access.

## Files

- `frontend.html`: browser UI to login and call backend routes.
- `backend.js`: Node HTTP server with OAuth checks and RBAC middleware.

## Prerequisites

- SSO platform running at `http://127.0.0.1:4000` (or override with `SSO_ISSUER`).
- A confidential OAuth client to call introspection from backend.
  - Set credentials through environment variables:
    - `BACKEND_OAUTH_CLIENT_ID`
    - `BACKEND_OAUTH_CLIENT_SECRET`

## Run

```bash
BACKEND_OAUTH_CLIENT_ID=backend-api \
BACKEND_OAUTH_CLIENT_SECRET=replace-me \
node examples/fullstack-rbac/backend.js
```

Then open:

- `http://127.0.0.1:3100`

## What gets protected

The example backend exposes:

- `GET /api/me`
  - Requires a valid active token only.
- `GET /api/admin/reports`
  - Requires role: `admin`
  - Requires permission: `reports:read`
- `GET /api/finance/payouts`
  - Requires role: `finance_admin`
  - Requires permission: `payouts:approve`

If role/permission checks fail, backend returns `403` with missing requirements listed.

## Important notes

- The frontend keeps the access token in memory only for demo simplicity.
- In production, use secure session handling patterns and avoid exposing privileged tokens to browser JavaScript when possible.
- Introspection requires backend-held credentials; never expose those credentials to the frontend.
