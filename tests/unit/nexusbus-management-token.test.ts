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

test("NexusBus producer JWT is audience-separated, issuer-bound to app and tenant, and expires within one minute", async () => {
  const issuer = "https://identity.example.test";
  const jwt = new JwtService(await createSigningKeys(), { issuer } as AppConfig);
  const token = await jwt.issueNexusBusProducerToken({ subject: "service-identity-1", installationId: "publisher-installation-1", tenant: "org-tenant-1", app: "gitflow", tokenId: "producer-jti-1", lifetimeSeconds: 3_600 });
  const { payload, protectedHeader } = await jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexusbus", algorithms: ["RS256"] });
  assert.equal(protectedHeader.alg, "RS256");
  assert.equal(payload.sub, "service-identity-1");
  assert.equal(payload.jti, "producer-jti-1");
  assert.equal(payload.tenant, "org-tenant-1");
  assert.equal(payload.app, "gitflow");
  assert.equal(payload.installation_id, "publisher-installation-1");
  assert.ok(Number(payload.exp) - Number(payload.iat) <= 60);
  assert.deepEqual(Object.keys(payload).sort(), ["app", "aud", "exp", "iat", "installation_id", "iss", "jti", "sub", "tenant"].sort());
  await assert.rejects(jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexusbus-management", algorithms: ["RS256"] }));
  await assert.rejects(jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexusbus", algorithms: ["RS256"], currentDate: new Date((Number(payload.iat) + 61) * 1000) }));
});

test("NexusBus enrollment proof signs exact immutable binding and expires after one minute", async () => {
  const issuer = "https://identity.example.test";
  const jwt = new JwtService(await createSigningKeys(), { issuer } as AppConfig);
  const token = await jwt.issueNexusBusManagementEnrollmentProof({
    subject: "service-identity-1", challenge: "a".repeat(43), hubInstanceId: "8c52fe50-0d98-49c6-8dd5-1ee09271d213", hubInstallationId: "hub-installation-1",
    enrollment: { enrollmentId: "enrollment-1", revision: 1, status: "active", credentialId: "credential-1", installationId: "bus-installation-1", organizationId: "org-1", projectId: "project-1", tenant: "tenant-1", app: "nexusbus", roles: ["nexusbus.installation.apply", "nexusbus.installation.read"] }
  });
  const { payload, protectedHeader } = await jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexushub-nexusbus-management-proof", algorithms: ["RS256"] });
  assert.equal(protectedHeader.typ, "nexusbus-management-enrollment-proof.v1+jwt");
  assert.equal(payload.sub, "service-identity-1");
  assert.equal(payload.challenge, "a".repeat(43));
  assert.equal(payload.hub_installation_id, "hub-installation-1");
  assert.equal(payload.hub_instance_id, "8c52fe50-0d98-49c6-8dd5-1ee09271d213");
  assert.equal(payload.owner_consent, "not_asserted");
  assert.deepEqual(payload.enrollment, { enrollmentId: "enrollment-1", revision: 1, status: "active", credentialId: "credential-1", installationId: "bus-installation-1", organizationId: "org-1", projectId: "project-1", tenant: "tenant-1", app: "nexusbus", roles: ["nexusbus.installation.apply", "nexusbus.installation.read"] });
  assert.ok(Number(payload.exp) - Number(payload.iat) <= 60);
  await assert.rejects(jwtVerify(token, jwt.getSigningKeys().publicKey, { issuer, audience: "nexushub-nexusbus-management-proof", algorithms: ["RS256"], currentDate: new Date((Number(payload.iat) + 61) * 1000) }));
  const repeated = await jwt.issueNexusBusManagementEnrollmentProof({
    subject: "service-identity-1", challenge: "a".repeat(43), hubInstanceId: "8c52fe50-0d98-49c6-8dd5-1ee09271d213", hubInstallationId: "hub-installation-1",
    enrollment: { enrollmentId: "enrollment-1", revision: 1, status: "active", credentialId: "credential-1", installationId: "bus-installation-1", organizationId: "org-1", projectId: "project-1", tenant: "tenant-1", app: "nexusbus", roles: ["nexusbus.installation.apply", "nexusbus.installation.read"] }
  });
  const replay = await jwtVerify(repeated, jwt.getSigningKeys().publicKey, { issuer, audience: "nexushub-nexusbus-management-proof", algorithms: ["RS256"] });
  assert.equal(replay.payload.challenge, payload.challenge);
  assert.notEqual(replay.payload.jti, payload.jti);
});
