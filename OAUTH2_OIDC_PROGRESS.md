# OAuth2 & OpenID Connect Implementation Progress

This document tracks implementation progress for OAuth2/OIDC features.

## Recently Completed
- [x] Authorization endpoint supports `response_type=token` (implicit flow)
- [x] Authorization endpoint accepts optional OIDC params: `acr_values`, `ui_locales`, `id_token_hint`
- [x] Authorization endpoint accepts legacy `approval_prompt` (`auto`/`force`) behavior
- [x] Device Authorization Grant (`/oauth/device/authorize` + token polling)
- [x] Dynamic client registration supports optional app linkage via `app_id`
- [x] Unit/integration test coverage for OAuth/OIDC grant flows
- [x] End-to-end OIDC happy-path tests
- [x] Events expansion: broader system event catalog, additional admin/auth emit points, and per-hook test dispatch
- [x] Security hardening: account lockout, endpoint-specific throttling, expanded security events, and session anomaly auditing
- [x] Database rewrite groundwork: centralized repository factory for runtime provider wiring
- [x] External migration schema now preserves SQLite unique indexes for PostgreSQL/MySQL targets
- [x] External migration schema now preserves SQLite foreign-key constraints for PostgreSQL/MySQL targets
- [x] Compatibility runtime mode for external provider config (warn + continue on SQLite while provider-specific repositories are completed)

## Remaining Items (from checklist)

### Token Endpoint (/oauth/token)
- [x] Support for password grant — optional, deprecated
- [x] Support for device code grant — optional, advanced

### UserInfo Endpoint (/oauth/userinfo)
- [x] Support for signed/encrypted responses — optional

### Discovery & JWKS
- [x] Support for dynamic client registration (RFC 7591) — optional

### Logout
- [x] Front-channel and back-channel logout — optional, advanced

### Security
- [x] HTTPS enforcement in production (reverse-proxy recommended)

### Tests & Docs
- [x] Unit and integration tests for all flows
- [x] API documentation (README, OpenAPI)
- [x] End-to-end (E2E) tests
- [x] Example client apps (SPA, mobile, server)

---

Reference status source: OAUTH2_OIDC_CHECKLIST.md
