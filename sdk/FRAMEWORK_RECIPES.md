# Framework Usage Recipes

This document provides practical integration patterns for common frameworks.

## Express (Server Route With Session Cookie)

```ts
import express from "express";
import { createClient } from "@nexusid/sdk";

const app = express();
const sdk = createClient({ baseUrl: process.env.NEXUSID_BASE_URL! });

app.get("/me", async (req, res) => {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return res.status(401).json({ error: "missing_session_cookie" });
  }

  const sessionClient = sdk.withAuth({ type: "session", cookie });
  const me = await sessionClient.get("/api/portal/me");
  return res.json(me);
});
```

## Fastify (Bearer Admin Route)

```ts
import Fastify from "fastify";
import { createAdminClient } from "@nexusid/sdk";

const app = Fastify();
const admin = createAdminClient({
  baseUrl: process.env.NEXUSID_BASE_URL!,
  auth: {
    type: "bearer",
    token: process.env.NEXUSID_ADMIN_TOKEN!
  }
});

app.get("/admin/users", async () => {
  return admin.users.list({ page: 1, pageSize: 50 });
});
```

## Next.js Route Handler (Server-Side Session)

```ts
import { cookies } from "next/headers";
import { createClient } from "@nexusid/sdk";

export async function GET() {
  const sid = cookies().get("sid")?.value;
  if (!sid) {
    return Response.json({ error: "missing_session_cookie" }, { status: 401 });
  }

  const sdk = createClient({
    baseUrl: process.env.NEXUSID_BASE_URL!,
    auth: { type: "session", cookie: `sid=${sid}` }
  });

  const profile = await sdk.get("/api/portal/me");
  return Response.json(profile);
}
```

## Browser SPA (PKCE)

```ts
import { buildAuthorizeUrl, generatePKCEPair } from "@nexusid/sdk";

const pkce = await generatePKCEPair();
sessionStorage.setItem("pkce_verifier", pkce.codeVerifier);

const authorizeUrl = buildAuthorizeUrl(process.env.NEXUSID_BASE_URL!, {
  clientId: "portal-spa",
  redirectUri: `${window.location.origin}/callback`,
  responseType: "code",
  scope: ["openid", "profile", "email"],
  codeChallenge: pkce.codeChallenge,
  codeChallengeMethod: pkce.codeChallengeMethod
});

window.location.assign(authorizeUrl);
```

## Notes

- For browser apps, avoid storing long-lived secrets in client code.
- For server endpoints, propagate caller session cookies when preserving end-user context.
- For backend jobs/automation, use bearer tokens with least-privilege scopes.
