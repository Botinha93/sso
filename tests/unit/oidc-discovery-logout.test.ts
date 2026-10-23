import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../../src/core/config.js";
import { OidcService } from "../../src/services/oidc-service.js";

test("OIDC discovery advertises the issuer-relative RP-initiated logout endpoint", async () => {
  const issuer = "https://identity.example.test/tenant-a";
  const service = new OidcService(
    { issuer } as AppConfig,
    {} as ConstructorParameters<typeof OidcService>[1],
    { listScopes: async () => [] } as ConstructorParameters<typeof OidcService>[2]
  );

  const discovery = await service.discoveryDocument();

  assert.equal(discovery.end_session_endpoint, "https://identity.example.test/tenant-a/oauth/logout");
});
