# SDK Getting Started

This guide helps you integrate the SDK quickly for browser clients, server-side apps, and admin automation.

## 1. Create A Client

For public and token-oriented calls:

```ts
import { createClient } from "@nexusid/sdk";

const client = createClient({
  baseUrl: "https://iam.example.com"
});
```

For admin endpoints:

```ts
import { createAdminClient } from "@nexusid/sdk";

const admin = createAdminClient({
  baseUrl: "https://iam.example.com",
  auth: {
    type: "bearer",
    token: process.env.NEXUSID_ADMIN_TOKEN!
  }
});
```

## 2. Browser App Auth (OAuth + PKCE)

In browser apps, the browser handles user interaction while the SDK builds auth URLs and exchanges callback codes.

```ts
import { buildAuthorizeUrl, createAuthAPI, createClient, generatePKCEPair } from "@nexusid/sdk";

const baseUrl = "https://iam.example.com";
const redirectUri = "https://app.example.com/callback";
const clientId = "portal-spa";

const sdkClient = createClient({ baseUrl });
const auth = createAuthAPI(sdkClient);
const pkce = await generatePKCEPair();

sessionStorage.setItem("pkce_verifier", pkce.codeVerifier);

const authorizeUrl = buildAuthorizeUrl(baseUrl, {
  clientId,
  redirectUri,
  responseType: "code",
  scope: ["openid", "profile", "email"],
  state: "spa-state",
  codeChallenge: pkce.codeChallenge,
  codeChallengeMethod: pkce.codeChallengeMethod
});

// Redirect user to authorizeUrl.

const code = "authorization-code-from-callback";
const token = await auth.exchangeAuthorizationCode({
  clientId,
  clientSecret: "replace-with-client-secret",
  code,
  redirectUri,
  codeVerifier: sessionStorage.getItem("pkce_verifier")!
});
```

## 3. Server App Auth (Session Cookie)

In server-side apps, your backend receives a session cookie from the client request, then uses the SDK with `type: "session"`.

```ts
import express from "express";
import { createClient } from "@nexusid/sdk";

const app = express();
const sdkClient = createClient({ baseUrl: "https://iam.example.com" });

app.get("/profile", async (req, res) => {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return res.status(401).json({ error: "missing_session_cookie" });
  }

  const sessionClient = sdkClient.withAuth({
    type: "session",
    cookie
  });

  const profile = await sessionClient.get("/api/portal/me");
  return res.json(profile);
});
```

## 4. Client And Server Ends: Who Authenticates What?

- Browser client end:
  - Builds authorize URL and handles user redirect/callback.
  - Uses PKCE verifier/challenge to bind callback code.
- Server end:
  - Uses bearer tokens for admin automation and service-to-service calls.
  - Uses session cookie auth for user-context API calls from backend routes.

## 5. First Admin Calls

```ts
const apps = await admin.apps.list({ search: "support", page: 1, pageSize: 20 });
const users = await admin.users.list({ active: true, page: 1, pageSize: 20 });
```

## 6. Governance Flow Example

```ts
const request = await admin.accessRequests.create({
  subjectUserId: "user_123",
  entitlementType: "role",
  entitlementValue: "role_connector_operator",
  justification: "Incident response"
});

await admin.accessRequests.approve(request.id, {
  rationale: "Approved for incident window"
});
```

## 7. Next Documents

- API symbols: `sdk/API_REFERENCE.md`
- Migration/versioning policy: `sdk/MIGRATION_AND_VERSIONING.md`
- Usage examples: `sdk/examples/`
