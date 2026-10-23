import assert from "node:assert/strict";
import test from "node:test";
import { jwtVerify } from "jose";
import { createSigningKeys } from "../../src/security/keys.js";
import { JwtService } from "../../src/security/jwt.js";
import type { AppConfig } from "../../src/core/config.js";

test("NexusBus management JWT has only the issuer-derived scope claims and a five-minute cap", async () => {
  const issuer = "https://identity.example.test";
  const jwt = new JwtService(await createSigningKeys(), { issuer } as AppConfig);
  const token = await jwt.issueNexusBusManagementToken({
    subject: "hub-installation-1", tenant: "bus-tenant-1", app: "nexusbus",
    hubScope: { organizationId: "org-1", projectId: "project-1" },
    roles: ["nexusbus.installation.read"], tokenId: "jti-1", lifetimeSeconds: 3_600
  });
  const { payload, protectedHeader } = await jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexusbus-management", algorithms: ["RS256"] });
  assert.equal(protectedHeader.alg, "RS256");
  assert.equal(payload.sub, "hub-installation-1");
  assert.equal(payload.jti, "jti-1");
  assert.deepEqual(payload.aud, "nexusbus-management");
  assert.deepEqual(payload.roles, ["nexusbus.installation.read"]);
  assert.deepEqual(payload.hub_scope, { organizationId: "org-1", projectId: "project-1" });
  assert.equal(payload.tenant, "bus-tenant-1");
  assert.equal(payload.app, "nexusbus");
  assert.ok(Number(payload.exp) - Number(payload.iat) <= 300);
  assert.deepEqual(Object.keys(payload).sort(), ["app", "aud", "exp", "hub_scope", "iat", "iss", "jti", "roles", "sub", "tenant"].sort());
});
