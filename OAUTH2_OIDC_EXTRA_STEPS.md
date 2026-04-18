# Additional OAuth2 & OpenID Connect Steps

This section lists additional steps and requirements not yet covered in the main checklist, based on the official specifications and best practices.

## Authorization Endpoint (/oauth/authorize)
- [x] Support for response_mode (query, fragment, form_post)
- [ ] Support for response_type=token (implicit, optional)
- [x] Support for nonce (OIDC)
- [ ] Support for acr_values, ui_locales, id_token_hint (optional OIDC params)
- [x] Support for login_hint
- [x] Support for redirect_uri validation (exact match, required by spec)
- [x] Support for code_challenge_method=plain (optional, but some clients use it)
- [ ] Support for approval_prompt (legacy, optional)

## Token Endpoint (/oauth/token)
- [ ] Support for password grant (optional, deprecated)
- [ ] Support for device code grant (optional, advanced)
- [x] Token introspection endpoint (RFC 7662)
- [x] Token revocation endpoint (RFC 7009)
- [x] Support for JWT access tokens (opaque vs JWT)
- [x] Support for custom claims in ID/access tokens

## UserInfo Endpoint (/oauth/userinfo)
- [ ] Support for signed/encrypted responses (optional)

## Discovery & JWKS
- [ ] Support for dynamic client registration (RFC 7591, optional)

## Logout
- [ ] Support for front-channel and back-channel logout (OIDC advanced)

## Admin UI
- [x] User management (CRUD)
- [x] Role management (CRUD)
- [x] Tenant management (CRUD)
- [x] Audit log (view)

## Security
- [x] CORS configuration for all endpoints
- [ ] HTTPS enforcement in production
- [x] Secure headers (CSP, X-Frame-Options, etc.)
- [x] Session fixation protection
- [x] CSRF protection for all POST endpoints
- [x] Logging and monitoring for all auth events

## Tests & Docs
- [ ] End-to-end (E2E) tests for all flows
- [ ] Example client apps (SPA, mobile, server)

---

These steps should be added to the main checklist and implemented for full compliance and best practices.
