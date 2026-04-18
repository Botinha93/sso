# OAuth2 & OpenID Connect Implementation Progress

This document tracks all missing and in-progress features for full OAuth2/OIDC compliance. Update this checklist as features are completed.

## Authorization Endpoint (/oauth/authorize)
- [x] Login UI (React)
- [ ] Consent UI (React, fully wired to backend)
- [ ] Session management (cookie-based, persistent login)
- [ ] Support for prompt, max_age, and other OIDC params
- [ ] Error handling and redirects
- [x] User federation login (external OIDC providers with callback flow)

## Token Endpoint (/oauth/token)
- [x] Authorization Code Grant
- [x] Refresh Token Grant
- [ ] Client Credentials Grant
- [ ] Error handling (invalid_grant, etc.)

## UserInfo Endpoint (/oauth/userinfo)
- [x] Basic user info
- [ ] Claims and scopes mapping (profile, email, etc.)
- [ ] Error handling

## Discovery & JWKS
- [x] /.well-known/openid-configuration
- [x] /.well-known/jwks.json

## Logout
- [ ] /logout endpoint (OIDC RP-Initiated Logout)
- [ ] Frontend logout UI

## Admin UI
- [ ] Client registration and management
- [ ] Consent management (view/revoke)
- [ ] Session management (view/revoke)
- [x] User groups with role support (group CRUD + role linking + user membership)
- [x] Federation providers configuration view (list + create/update/delete)
- [x] Authentication flows and stages (flow CRUD + stage ordering + active flow)
- [x] Custom user attributes management (typed definitions + group targeting toggles)
- [x] Policies management (custom definitions + scoped assignments)
- [x] Events and hooks notifications (hook CRUD + delivery logs)

## Security
- [ ] PKCE enforcement for public clients
- [ ] Secure cookie/session handling
- [ ] Scope and claims validation
- [ ] Rate limiting, brute-force protection

## Tests & Docs
- [ ] Unit and integration tests for all flows
- [ ] API documentation (README, OpenAPI)

---

We will follow this checklist until all items are complete.
