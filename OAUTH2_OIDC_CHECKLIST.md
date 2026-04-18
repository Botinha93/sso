# OAuth2 & OpenID Connect Implementation Checklist

## Authorization Endpoint (/oauth/authorize)
- [x] Login UI (React)
- [x] Consent UI (React, fully wired to backend)
- [x] Session management (cookie-based, persistent login with httpOnly `sid` cookie)
- [x] Support for prompt, max_age, nonce, login_hint (OIDC params)
- [x] Support for redirect_uri validation (exact match, required by spec)
- [x] Support for code_challenge_method=plain and S256 (PKCE)
- [x] Error handling and redirects (interaction_required, access_denied)
- [x] Support for response_mode (query, fragment, form_post)
- [ ] Support for response_type=token (implicit) — optional/deprecated
- [ ] Support for acr_values, ui_locales, id_token_hint — optional

## Token Endpoint (/oauth/token)
- [x] Authorization Code Grant
- [x] Refresh Token Grant (with rotation and family revocation)
- [x] Client Credentials Grant
- [x] Token introspection endpoint (RFC 7662) - /oauth/introspect
- [x] Token revocation endpoint (RFC 7009) - /oauth/token/revoke
- [x] JWT access tokens (RS256 with JWK set)
- [x] Custom claims in ID/access tokens (roles, tenant_id)
- [x] Error handling (invalid_grant, unsupported_grant_type)
- [ ] Support for password grant — optional, deprecated
- [ ] Support for device code grant — optional, advanced

## UserInfo Endpoint (/oauth/userinfo)
- [x] Basic user info
- [x] Claims and scopes mapping (profile → name fields; email → email; roles scope)
- [x] Proper error handling (401 with Bearer challenge)
- [ ] Support for signed/encrypted responses — optional

## Discovery & JWKS
- [x] /.well-known/openid-configuration
- [x] /.well-known/jwks.json
- [ ] Support for dynamic client registration (RFC 7591) — optional

## Logout
- [x] /oauth/logout endpoint (OIDC RP-Initiated Logout with post_logout_redirect_uri)
- [x] /auth/logout (session cookie clear + redirect)
- [x] Sidebar logout button (React admin UI)
- [ ] Front-channel and back-channel logout — optional, advanced

## Admin API & UI
- [x] Client registration and management (GET/POST/PUT/DELETE /api/admin/clients)
- [x] Consent management — view (/api/admin/consents) and revoke (DELETE)
- [x] Session management — view (/api/admin/sessions) and revoke (DELETE)
- [x] User management (GET /api/admin/users, POST /api/admin/users)
- [x] User groups with role support (group CRUD, group-role assignment, user-group assignment)
- [x] Role management (GET /api/admin/roles, POST /api/admin/roles)
- [x] Tenant management (GET /api/admin/tenants, POST /api/admin/tenants)
- [x] Role assignment (/api/admin/role-assignments)
- [x] Audit log view in Admin UI — live feed with event types, actor, metadata, timestamps
- [x] User federation (external OIDC provider login, identity linking, auto-provisioning)
- [x] Federation provider admin view (list configured providers, create/update/delete DB-backed providers)
- [x] Authentication flows and stages (DB-backed flow definitions, ordered stages, active-flow enforcement)
- [x] Custom user attributes management (typed attributes, global enable/disable, per-group apply/disable)
- [x] Policies management (custom policies, scope assignments: global/tenant/group/user)
- [x] Events and hooks notifications (webhook targets + delivery log)

## Security
- [x] PKCE enforcement for public clients (requirePkce flag on client)
- [x] Secure cookie/session handling (httpOnly, secure-in-prod, sameSite=lax)
- [x] Scope and claims validation in authz code flow
- [x] Rate limiting (100 req/min/IP via @fastify/rate-limit)
- [x] CORS configuration (@fastify/cors with credentials support)
- [x] Secure HTTP headers (@fastify/helmet — CSP, X-Frame-Options, HSTS, etc.)
- [x] Refresh token family revocation (detect token replay attacks)
- [x] Token expiry enforcement (access: 15min, refresh: 30d, session: 8h)
- [x] CSRF protection for POST endpoints — double-submit cookie pattern (X-CSRF-Token header + csrf_token cookie)
- [x] Session fixation protection — new session ID generated on every login (nanoid, no session reuse)
- [x] Structured audit logging for all auth events (login, logout, tokens, consents, sessions)
- [ ] HTTPS enforcement in production (reverse-proxy recommended)

## Tests & Docs
- [ ] Unit and integration tests for all flows
- [ ] API documentation (README, OpenAPI)
- [ ] End-to-end (E2E) tests
- [ ] Example client apps (SPA, mobile, server)

---

We will check off each item as it is completed.
