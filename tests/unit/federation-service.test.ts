import test from "node:test";
import assert from "node:assert/strict";
import { FederationService } from "../../src/services/federation-service.js";
import { AuthenticationError } from "../../src/core/errors.js";
import type { AppConfig } from "../../src/core/config.js";

process.env.NODE_ENV = "test";

const provider = {
  id: "idp",
  label: "IdP",
  authorizationEndpoint: "https://idp.example.test/authorize",
  tokenEndpoint: "https://idp.example.test/token",
  userInfoEndpoint: "https://idp.example.test/userinfo",
  clientId: "client",
  clientSecret: "super-secret-value",
  scopes: ["openid", "email"],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const createService = (input: {
  findByEmail?: (email: string) => Promise<{ id: string } | undefined>;
  findByProviderSubject?: () => Promise<undefined>;
}) => {
  const transactions = new Map<string, {
    state: string;
    providerId: string;
    codeVerifier: string;
    redirectAfterLogin: string;
    createdAt: Date;
    expiresAt: Date;
  }>();

  const service = new FederationService(
    {
      issuer: "http://localhost:4000",
      federation: { providers: [] }
    } as AppConfig,
    {
      findById: async () => undefined,
      findByEmail: input.findByEmail ?? (async () => undefined),
      create: async () => {
        throw new Error("should not JIT in this test");
      }
    } as any,
    {
      list: async () => [provider],
      findById: async () => provider
    } as any,
    {
      findByProviderSubject: input.findByProviderSubject ?? (async () => undefined),
      create: async () => {
        throw new Error("should not link in this test");
      },
      touchLogin: async () => undefined
    } as any,
    {
      purgeExpired: async () => undefined,
      create: async (txn: typeof transactions extends Map<string, infer T> ? T : never) => {
        transactions.set(txn.state, { ...txn, createdAt: new Date() });
        return txn;
      },
      consume: async (state: string) => {
        const txn = transactions.get(state);
        transactions.delete(state);
        return txn;
      }
    } as any,
    {
      assertStageEnabled: async () => undefined
    } as any
  );

  return { service, transactions };
};

test("listConfiguredProviders never includes clientSecret", async () => {
  const { service } = createService({});
  const listed = await service.listConfiguredProviders();
  assert.equal(listed.length, 1);
  assert.equal("clientSecret" in listed[0], false);
  assert.equal((listed[0] as { hasSecret: boolean }).hasSecret, true);
  assert.equal((listed[0] as { secretPreview?: string }).secretPreview, undefined);
});

test("completeLogin rejects login CSRF without the browser binding cookie", async () => {
  const { service } = createService({});
  const started = await service.getAuthorizationRedirect("idp", "/");
  await assert.rejects(
    () => service.completeLogin({ providerId: "idp", code: "code", state: started.state }),
    (error: unknown) => error instanceof AuthenticationError && /binding/i.test(error.message)
  );
});

test("completeLogin does not attach a foreign subject to an existing local email", async () => {
  const { service } = createService({
    findByEmail: async () => ({ id: "victim" })
  });
  const started = await service.getAuthorizationRedirect("idp", "/");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url) => {
    const href = String(url);
    if (href.includes("/token")) {
      return new Response(JSON.stringify({ access_token: "tok", token_type: "Bearer" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      sub: "attacker",
      email: "victim@example.com",
      email_verified: true
    }), { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => service.completeLogin({
        providerId: "idp",
        code: "code",
        state: started.state,
        binding: started.state
      }),
      (error: unknown) => error instanceof AuthenticationError && /already exists/i.test(error.message)
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
