import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { ServiceIdentity } from "../../src/domain/models.js";
import { registerServiceIdentityRoutes } from "../../src/http/routes/service-identities.js";
import { deriveNexusHubClientProfile } from "../../src/services/nexushub-client-profile.js";

const HUB_AUDIENCE = "urn:nexusid:nexushub:client-provisioning";
const ORIGIN = "https://hub.example.test";

function createRig(enabled: boolean) {
  const app = Fastify();
  const originalFlag = process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED;
  const originalBusFlag = process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED;
  const originalBusBindings = process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON;
  const originalProducerFlag = process.env.NEXUSID_NEXUSBUS_PRODUCER_ENABLED;
  if (enabled) process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED = "true";
  else delete process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED;
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON = JSON.stringify([{ organizationId: "org-1", projectId: "project-2", tenant: "tenant-a", app: "nexusbus", roles: ["nexusbus.installation.read", "nexusbus.installation.apply"] }]);

  const identity: ServiceIdentity & { credentials: Array<Record<string, unknown>> } = {
    id: "si-hub",
    name: "nexushub-installer",
    description: "test identity",
    status: "active",
    allowedScopes: [],
    allowedAudiences: ["api.example.test"],
    metadata: { owner: "platform" },
    createdAt: new Date(),
    updatedAt: new Date(),
    credentials: [
      { id: "credential-1", serviceIdentityId: "si-hub", clientId: "hub-client-1", clientSecretHash: "hash", createdAt: new Date() },
      { id: "credential-2", serviceIdentityId: "si-hub", clientId: "hub-client-2", clientSecretHash: "hash", createdAt: new Date() }
    ]
  };
  const updates: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const claimsByToken = new Map<string, Record<string, unknown>>();
  const busEnrollments = new Map<string, any>();
  const oauthClients = new Map<string, any>();
  const managedCredentials = new Map<string, any>();
  let failAfterClientWrite = false;
  const clientService = {
    findClientById: async (id: string) => oauthClients.get(id),
    authenticateClientSecret: async (id: string, secret: string) => {
      const managed = managedCredentials.get(id);
      return managed ? managed.active === secret || (managed.pending === secret && managed.expiresAt > Date.now()) : oauthClients.get(id)?.secret === secret;
    },
    ensureManagedProfileCredential: async (input: any) => {
      const managed = managedCredentials.get(input.clientId);
      if (!managed) { managedCredentials.set(input.clientId, { ...input, active: input.secret, generation: 1, operations: new Map() }); return { generation: 1 }; }
      if (managed.installationId !== input.installationId || managed.profileId !== input.profileId || ![managed.active, ...(managed.pending && managed.expiresAt > Date.now() ? [managed.pending] : [])].includes(input.secret)) throw new Error("managed profile conflict");
      return { generation: managed.generation };
    },
    stageManagedProfileCredential: async (input: any) => {
      const managed = managedCredentials.get(input.clientId);
      if (!managed) return { state: "conflict" };
      if (managed.pending) return managed.operationId === input.operationId && managed.pending === input.secret ? { state: "replayed", generation: managed.generation, pendingExpiresAt: new Date(managed.expiresAt) } : { state: "conflict" };
      if (managed.activatedOperationId === input.operationId && managed.active === input.secret) return { state: "replayed", generation: managed.generation };
      if (managed.active === input.secret) return { state: "conflict" };
      Object.assign(managed, { operationId: input.operationId, pending: input.secret, expiresAt: input.expiresAt.getTime() });
      managed.operations.set(input.operationId, { state: "pending", generation: managed.generation, expiresAt: input.expiresAt.getTime() });
      return { state: "staged", generation: managed.generation, pendingExpiresAt: input.expiresAt };
    },
    activateManagedProfileCredential: async (input: any) => {
      const managed = managedCredentials.get(input.clientId);
      if (managed?.operationId === input.operationId && managed.pending && managed.expiresAt > Date.now()) {
        managed.active = managed.pending; managed.pending = undefined; managed.expiresAt = undefined; managed.operationId = undefined; managed.activatedOperationId = input.operationId; managed.operations.get(input.operationId).state = "activated"; managed.generation++;
        return { state: "activated", generation: managed.generation };
      }
      return managed?.activatedOperationId === input.operationId ? { state: "replayed", generation: managed.generation } : { state: "conflict" };
    },
    abortManagedProfileCredential: async (input: any) => {
      const managed = managedCredentials.get(input.clientId);
      if (managed?.operationId !== input.operationId) return false;
      managed.pending = undefined; managed.expiresAt = undefined; managed.operationId = undefined; return true;
    },
    managedProfileCredentialStatus: async (id: string, _now?: Date, operationId?: string) => {
      const managed = managedCredentials.get(id);
      if (!managed) return undefined;
      if (operationId) {
        const operation = managed.operations.get(operationId);
        if (!operation) return { generation: managed.generation, operationState: "conflict" };
        if (operation.state === "pending" && operation.expiresAt <= (_now ?? new Date()).getTime()) operation.state = "expired";
        return { generation: operation.state === "activated" ? operation.generation + 1 : operation.generation, operationState: operation.state, ...(operation.state === "pending" ? { pendingOperationId: operationId, pendingExpiresAt: new Date(operation.expiresAt) } : {}) };
      }
      return { generation: managed.generation, ...(managed.pending && managed.expiresAt > Date.now() ? { pendingOperationId: managed.operationId, pendingExpiresAt: new Date(managed.expiresAt) } : {}), ...(managed.activatedOperationId ? { activatedOperationId: managed.activatedOperationId } : {}) };
    },
    createClient: async (input: any) => {
      if (oauthClients.has(input.id)) throw new Error("duplicate client id");
      const client = { ...input, createdAt: new Date() };
      oauthClients.set(input.id, client);
      if (failAfterClientWrite) { failAfterClientWrite = false; throw new Error("simulated lost write acknowledgement"); }
      return client;
    }
  };
  const busManagementEnrollmentRepository = {
    create: async (input: any) => {
      if (busEnrollments.has(input.serviceIdentityId)) throw new Error("unique enrollment");
      const row = { ...input, status: "active", createdAt: new Date() };
      busEnrollments.set(input.serviceIdentityId, row);
      return row;
    },
    findByServiceIdentity: async (id: string) => busEnrollments.get(id),
    findByCredential: async (credentialId: string) => [...busEnrollments.values()].find((row) => row.credentialId === credentialId),
    findByProducerCredential: async (credentialId: string) => [...busEnrollments.values()].find((row) => row.producerCredentialId === credentialId),
    revoke: async (id: string) => { const row = busEnrollments.get(id); if (!row || row.status !== "active") return false; row.status = "revoked"; row.revokedAt = new Date(); return true; }
  };

  const serviceIdentityService = {
    getServiceIdentity: async (id: string) => id === identity.id ? identity : undefined,
    listServiceIdentities: async () => [identity],
    updateServiceIdentity: async (_id: string, changes: Record<string, unknown>) => {
      updates.push(changes);
      Object.assign(identity, changes);
      return identity;
    }
  };
  registerServiceIdentityRoutes(
    app,
    serviceIdentityService as any,
    { listAssignmentsForUser: async () => [] } as any,
    { listGroupIdsForUser: async () => [] } as any,
    { jwtService: { verifyAccessToken: async (token: string) => {
      if (token === "invalid") throw new Error("invalid token");
      const claims = claimsByToken.get(token);
      if (!claims) throw new Error("unknown token");
      return claims;
    } } } as any,
    { log: async (event: Record<string, unknown>) => { auditEvents.push(event); } } as any,
    async () => ({ actorId: "admin-1", actorType: "user" }),
    {
      issueNexusBusManagementToken: async (params: Record<string, unknown>) => { claimsByToken.set("minted", params); return "minted.jwt"; },
      issueNexusBusProducerToken: async (params: Record<string, unknown>) => { claimsByToken.set("producer", params); return "producer.jwt"; },
      issueNexusBusManagementEnrollmentProof: async (params: Record<string, unknown>) => { claimsByToken.set("management-proof", params); return "signed.management-proof.jwt"; }
    } as any,
    busManagementEnrollmentRepository as any,
    clientService as any
  );

  return {
    app, identity, updates, auditEvents, claimsByToken, busEnrollments, oauthClients, managedCredentials, clientService,
    failNextClientWriteAcknowledgement() { failAfterClientWrite = true; },
    async close() {
      await app.close();
      if (originalFlag === undefined) delete process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED;
      else process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED = originalFlag;
      if (originalBusFlag === undefined) delete process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED;
      else process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED = originalBusFlag;
      if (originalBusBindings === undefined) delete process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON;
      else process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON = originalBusBindings;
      if (originalProducerFlag === undefined) delete process.env.NEXUSID_NEXUSBUS_PRODUCER_ENABLED;
      else process.env.NEXUSID_NEXUSBUS_PRODUCER_ENABLED = originalProducerFlag;
    }
  };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test("NexusHub enrollment endpoints are hidden while the opt-in feature is off", async (t) => {
  const rig = createRig(false);
  t.after(() => rig.close());
  const enroll = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  const read = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer("valid") });
  const revoke = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexushub-enrollment" });
  const proof = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/management-enrollment-proof", payload: { client_id: "client", client_secret: "secret", challenge: "A".repeat(43) } });
  assert.equal(enroll.statusCode, 404);
  assert.equal(read.statusCode, 404);
  assert.equal(revoke.statusCode, 404);
  assert.equal(proof.statusCode, 404);
  assert.equal(rig.updates.length, 0);
});

test("NexusHub enrollment rejects bootstrap and ungated superuser service identities", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  for (const flag of ["bootstrap_admin", "ungated_admin"]) {
    rig.identity.metadata = { ...(rig.identity.metadata ?? {}), [flag]: true };
    const response = await rig.app.inject({
      method: "PUT",
      url: "/api/admin/service-identities/si-hub/nexushub-enrollment",
      payload: { credentialId: "credential-1", publicOrigin: ORIGIN }
    });
    assert.equal(response.statusCode, 409, flag);
    assert.equal(response.json().error, "privileged_service_identity_cannot_be_enrolled");
    assert.equal(rig.identity.metadata?.nexushub_enrollment, undefined);
    assert.equal(rig.updates.length, 0);
  }
});

test("NexusBus management enrollment mints only bound role subsets and revocation blocks future minting", async (t) => {
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED = "true";
  const rig = createRig(true);
  t.after(() => rig.close());
  const enroll = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment", payload: {
    organizationId: "org-1", projectId: "project-2", tenant: "tenant-a", app: "nexusbus", roles: ["nexusbus.installation.read", "nexusbus.installation.apply"]
  } });
  assert.equal(enroll.statusCode, 201, enroll.body);
  const binding = enroll.json().data;
  assert.equal(binding.audience, "nexusbus-management");
  assert.ok(binding.clientSecret);
  const persisted = rig.busEnrollments.get("si-hub");
  assert.equal(persisted.credentialHash.length, 64);
  assert.equal(JSON.stringify(persisted).includes(binding.clientSecret), false);

  const minted = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/token", payload: {
    grant_type: "nexusbus_management", client_id: binding.clientId, client_secret: binding.clientSecret, roles: ["nexusbus.installation.read"]
  } });
  assert.equal(minted.statusCode, 200, minted.body);
  assert.equal(minted.json().access_token, "minted.jwt");
  assert.deepEqual(rig.claimsByToken.get("minted"), {
    subject: persisted.installationId, tenant: "tenant-a", app: "nexusbus",
    hubScope: { organizationId: "org-1", projectId: "project-2" }, roles: ["nexusbus.installation.read"],
    tokenId: (rig.claimsByToken.get("minted") as any).tokenId, lifetimeSeconds: 300
  });

  const escalated = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/token", payload: {
    grant_type: "nexusbus_management", client_id: binding.clientId, client_secret: binding.clientSecret, roles: ["nexusbus.admin"]
  } });
  assert.equal(escalated.statusCode, 401);
  const approvedBindings = process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON;
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON = "[]";
  const mappingRemoved = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/token", payload: {
    grant_type: "nexusbus_management", client_id: binding.clientId, client_secret: binding.clientSecret, roles: ["nexusbus.installation.read"]
  } });
  assert.equal(mappingRemoved.statusCode, 401);
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON = approvedBindings;
  const revoked = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment" });
  assert.equal(revoked.statusCode, 204);
  const denied = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/token", payload: {
    grant_type: "nexusbus_management", client_id: binding.clientId, client_secret: binding.clientSecret, roles: ["nexusbus.installation.read"]
  } });
  assert.equal(denied.statusCode, 401);
});

test("management enrollment proof is short-lived, challenge-bound, and never asserts Hub owner consent", async (t) => {
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED = "true";
  const rig = createRig(true);
  t.after(() => rig.close());
  await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  const enroll = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment", payload: {
    organizationId: "org-1", projectId: "project-2", tenant: "tenant-a", app: "nexusbus", roles: ["nexusbus.installation.read", "nexusbus.installation.apply"]
  } });
  const binding = enroll.json().data;
  const challenge = "A".repeat(43);
  const hubInstanceId = "8c52fe50-0d98-49c6-8dd5-1ee09271d213";
  const response = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/management-enrollment-proof", payload: { client_id: binding.clientId, client_secret: binding.clientSecret, challenge, hub_instance_id: hubInstanceId } });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { assertion: "signed.management-proof.jwt", token_type: "Bearer", expires_in: 60, audience: "nexushub-nexusbus-management-proof" });
  assert.deepEqual(rig.claimsByToken.get("management-proof"), {
    subject: "si-hub", challenge, hubInstanceId, hubInstallationId: (rig.identity.metadata?.nexushub_enrollment as any).installationId,
    enrollment: {
      enrollmentId: rig.busEnrollments.get("si-hub").enrollmentId, revision: 1, status: "active",
      credentialId: binding.credentialId, installationId: binding.installationId, organizationId: "org-1",
      projectId: "project-2", tenant: "tenant-a", app: "nexusbus", roles: binding.roles
    }
  });
  const callerClaimedAnotherProject = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/management-enrollment-proof", payload: { client_id: binding.clientId, client_secret: binding.clientSecret, challenge, hub_instance_id: hubInstanceId, projectId: "other-project" } });
  assert.equal(callerClaimedAnotherProject.statusCode, 400);
  const revoked = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment" });
  assert.equal(revoked.statusCode, 204);
  const afterRevoke = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/management-enrollment-proof", payload: { client_id: binding.clientId, client_secret: binding.clientSecret, challenge, hub_instance_id: hubInstanceId } });
  assert.equal(afterRevoke.statusCode, 401);
});

test("NexusBus publisher credentials are purpose-separated, tenant/app-bound, short-lived, and revoked with the issuer enrollment", async (t) => {
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED = "true";
  process.env.NEXUSID_NEXUSBUS_PRODUCER_ENABLED = "true";
  const rig = createRig(true);
  t.after(() => rig.close());
  process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON = JSON.stringify([{ organizationId: "org-1", projectId: "project-2", tenant: "tenant-a", app: "gitflow", roles: ["nexusbus.installation.read"] }]);
  const enroll = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment", payload: {
    organizationId: "org-1", projectId: "project-2", tenant: "tenant-a", app: "gitflow", roles: ["nexusbus.installation.read"]
  } });
  assert.equal(enroll.statusCode, 201, enroll.body);
  const issued = enroll.json().data;
  assert.equal(issued.audience, "nexusbus-management");
  assert.equal(issued.producerCredential.audience, "nexusbus");
  assert.notEqual(issued.producerCredential.credentialId, issued.credentialId);
  assert.notEqual(issued.producerCredential.clientSecret, issued.clientSecret);
  const row = rig.busEnrollments.get("si-hub");
  assert.equal(row.producerCredentialHash.length, 64);
  assert.equal(JSON.stringify(row).includes(issued.producerCredential.clientSecret), false);

  const token = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/producer-token", payload: {
    grant_type: "nexusbus_producer", client_id: issued.producerCredential.credentialId, client_secret: issued.producerCredential.clientSecret
  } });
  assert.equal(token.statusCode, 200, token.body);
  assert.deepEqual(token.json(), { access_token: "producer.jwt", token_type: "Bearer", expires_in: 60, audience: "nexusbus" });
  assert.deepEqual(rig.claimsByToken.get("producer"), { subject: "si-hub", installationId: row.installationId, tenant: "tenant-a", app: "gitflow", tokenId: (rig.claimsByToken.get("producer") as any).tokenId, lifetimeSeconds: 60 });

  const managementSecretCannotPublish = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/producer-token", payload: {
    grant_type: "nexusbus_producer", client_id: issued.credentialId, client_secret: issued.clientSecret
  } });
  assert.equal(managementSecretCannotPublish.statusCode, 401);
  const unknownCredential = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/producer-token", payload: {
    grant_type: "nexusbus_producer", client_id: "unknown", client_secret: "x".repeat(43)
  } });
  assert.equal(unknownCredential.statusCode, 401);

  const revoked = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexusbus-management-enrollment" });
  assert.equal(revoked.statusCode, 204);
  const afterRevoke = await rig.app.inject({ method: "POST", url: "/api/nexusbus/v1/producer-token", payload: {
    grant_type: "nexusbus_producer", client_id: issued.producerCredential.credentialId, client_secret: issued.producerCredential.clientSecret
  } });
  assert.equal(afterRevoke.statusCode, 401);
});

test("issuer enrollment binds one active credential and canonical Hub origin; same binding is idempotent", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const first = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  assert.equal(first.statusCode, 201, first.body);
  const initial = first.json().data;
  assert.match(initial.installationId, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(initial.profileVersions, ["nexushub:1"]);
  assert.ok(rig.identity.allowedAudiences.includes(HUB_AUDIENCE));
  assert.equal((rig.identity.metadata?.nexushub_enrollment as any).credentialClientId, "hub-client-1");
  assert.equal(rig.auditEvents.length, 1);

  const replay = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().data.installationId, initial.installationId);
  assert.equal(rig.updates.length, 1);
  assert.equal(rig.auditEvents.length, 1);

  const changed = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-2", publicOrigin: ORIGIN } });
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.json().error, "installation_already_enrolled");
  // The active binding stays attached to credential-1; there is no overlap
  // window or partial replacement when the issuer rejects credential-2.
  assert.equal((rig.identity.metadata?.nexushub_enrollment as any).installationId, initial.installationId);
  assert.equal((rig.identity.metadata?.nexushub_enrollment as any).credentialId, "credential-1");
  assert.equal((rig.identity.metadata?.nexushub_enrollment as any).credentialClientId, "hub-client-1");
  assert.equal(rig.updates.length, 1);
  rig.claimsByToken.set("old-credential", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const oldCredentialStillReadsEnrollment = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer("old-credential") });
  assert.equal(oldCredentialStillReadsEnrollment.statusCode, 200, oldCredentialStillReadsEnrollment.body);
  assert.equal(oldCredentialStillReadsEnrollment.json().data.installationId, initial.installationId);
  const invalidOrigin = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: "https://hub.example.test/other" } });
  assert.equal(invalidOrigin.statusCode, 400);
  const invalidScheme = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: "http://hub.example.test" } });
  assert.equal(invalidScheme.statusCode, 400);
});

test("enrollment rejects unknown, revoked, expired credentials and inactive identities", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  rig.identity.credentials[1].revokedAt = new Date();
  rig.identity.credentials.push({ id: "credential-expired", serviceIdentityId: rig.identity.id, clientId: "expired-client", createdAt: new Date(), expiresAt: new Date(Date.now() - 1000) });
  for (const credentialId of ["missing", "credential-2", "credential-expired"]) {
    const response = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId, publicOrigin: ORIGIN } });
    assert.equal(response.statusCode, 400, credentialId);
  }
  rig.identity.status = "suspended";
  const inactive = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  assert.equal(inactive.statusCode, 404);
  assert.equal(rig.updates.length, 0);
});

test("enrollment read requires valid service-identity claims, dedicated audience, exact credential binding, and active enrollment", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const enrolled = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  assert.equal(enrolled.statusCode, 201);

  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  rig.claimsByToken.set("wrong-aud", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: ["api.example.test"] });
  rig.claimsByToken.set("wrong-actor", { actor_type: "client", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  rig.claimsByToken.set("wrong-subject", { actor_type: "service_identity", service_identity_id: "other-identity", client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  rig.claimsByToken.set("wrong-client", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "other-client", aud: [HUB_AUDIENCE] });
  rig.claimsByToken.set("wrong-shape-aud", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: 4 });

  const success = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer("good") });
  assert.equal(success.statusCode, 200, success.body);
  assert.equal(success.json().data.installationId, enrolled.json().data.installationId);
  assert.equal(success.json().data.publicOrigin, ORIGIN);
  assert.equal((await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment" })).statusCode, 401);
  assert.equal((await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer("invalid") })).statusCode, 401);
  for (const token of ["wrong-aud", "wrong-actor", "wrong-subject", "wrong-client", "wrong-shape-aud"]) {
    const response = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer(token) });
    assert.equal(response.statusCode, 403, token);
  }
});

test("NexusHub client profile ensure is installation-bound, idempotent, and never returns stored secrets", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const enrolled = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  const installationId = enrolled.json().data.installationId;
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  rig.claimsByToken.set("wrong-client", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "other-client", aud: [HUB_AUDIENCE] });
  const url = "/api/nexushub/v1/client-profile";
  const payload = { profileId: "nexushub", profileVersion: 1, mode: "ensure", clientSecret: "Hub_generated_secret_0123456789ABCDEF" };
  const first = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().data.redirectUris[0], `${ORIGIN}/auth/callback`);
  assert.equal(first.json().data.adopted, false);
  assert.equal(first.body.includes(payload.clientSecret), false);
  const clientId = first.json().data.clientId;
  assert.equal(rig.oauthClients.get(clientId).secret, payload.clientSecret);

  const replay = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().data.clientId, clientId);
  assert.equal(replay.body.includes(payload.clientSecret), false);
  assert.equal(rig.oauthClients.size, 1);

  const adopted = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, mode: "adopt-existing" } });
  assert.equal(adopted.statusCode, 200, adopted.body);
  assert.equal(adopted.json().data.adopted, true);
  assert.equal(adopted.body.includes(payload.clientSecret), false);

  const changedSecret = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, clientSecret: "different_secret_0123456789ABCDEF" } });
  assert.equal(changedSecret.statusCode, 409);
  assert.equal(rig.oauthClients.get(clientId).secret, payload.clientSecret);
  const oldProfileStillAuthenticates = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(oldProfileStillAuthenticates.statusCode, 200, oldProfileStillAuthenticates.body);
  assert.equal(oldProfileStillAuthenticates.json().data.clientId, clientId);
  const foreignId = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, clientId: "some-other-client" } });
  assert.equal(foreignId.statusCode, 409);
  const wrongOwner = await rig.app.inject({ method: "PUT", url, headers: bearer("wrong-client"), payload });
  assert.equal(wrongOwner.statusCode, 403);

  const revoked = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexushub-enrollment" });
  assert.equal(revoked.statusCode, 204);
  const afterRevoke = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(afterRevoke.statusCode, 403);
  assert.equal(rig.oauthClients.get(clientId).secret, payload.clientSecret);
  assert.equal(typeof installationId, "string");
});

test("managed NexusHub profile rotation stages an overlap, reports status only, and activates idempotently", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const setupSecret = "Hub_generated_secret_0123456789ABCDEF";
  const setup = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, clientSecret: setupSecret } });
  assert.equal(setup.statusCode, 201, setup.body);
  const clientId = setup.json().data.clientId;
  const operationId = "rotation-op-0000001";
  const nextSecret = "Hub_next_secret_0123456789ABCDEF";
  const stagePayload = { profileId: "nexushub", profileVersion: 1, operationId, clientSecret: nextSecret };
  const stage = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile/credential-rotation", headers: bearer("good"), payload: stagePayload });
  assert.equal(stage.statusCode, 201, stage.body);
  assert.equal(stage.body.includes(nextSecret), false);
  assert.equal(await (rig.clientService as any).authenticateClientSecret(clientId, setupSecret), true);
  assert.equal(await (rig.clientService as any).authenticateClientSecret(clientId, nextSecret), true);
  const retry = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile/credential-rotation", headers: bearer("good"), payload: stagePayload });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.body.includes(nextSecret), false);
  const status = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/client-profile/nexushub/credential-rotation", headers: bearer("good") });
  assert.equal(status.statusCode, 200, status.body);
  assert.equal(status.json().data.pendingOperationId, operationId);
  assert.equal(status.body.includes(nextSecret), false);
  const operationStatus = await rig.app.inject({ method: "GET", url: `/api/nexushub/v1/client-profile/nexushub/credential-rotation?operationId=${operationId}`, headers: bearer("good") });
  assert.equal(operationStatus.json().data.operationState, "pending");

  const activatePayload = { profileId: "nexushub", profileVersion: 1, operationId };
  const activated = await rig.app.inject({ method: "POST", url: "/api/nexushub/v1/client-profile/credential-rotation/activate", headers: bearer("good"), payload: activatePayload });
  assert.equal(activated.statusCode, 200, activated.body);
  const activationRetry = await rig.app.inject({ method: "POST", url: "/api/nexushub/v1/client-profile/credential-rotation/activate", headers: bearer("good"), payload: activatePayload });
  assert.equal(activationRetry.statusCode, 200, activationRetry.body);
  assert.equal(await (rig.clientService as any).authenticateClientSecret(clientId, setupSecret), false);
  assert.equal(await (rig.clientService as any).authenticateClientSecret(clientId, nextSecret), true);
  const activatedStatus = await rig.app.inject({ method: "GET", url: `/api/nexushub/v1/client-profile/nexushub/credential-rotation?operationId=${operationId}`, headers: bearer("good") });
  assert.equal(activatedStatus.json().data.operationState, "activated");
  const lostStageResponseReplay = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile/credential-rotation", headers: bearer("good"), payload: stagePayload });
  assert.equal(lostStageResponseReplay.statusCode, 200, lostStageResponseReplay.body);
  assert.equal(lostStageResponseReplay.json().data.state, "active", "stage retry after a lost activation response reports the completed state");
  assert.equal(lostStageResponseReplay.json().data.operationState, "activated");
  assert.equal(lostStageResponseReplay.body.includes(nextSecret), false);

  const laterOperationId = "rotation-op-0000002";
  const laterSecret = "Hub_later_secret_0123456789ABCDEF";
  const laterStage = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile/credential-rotation", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, operationId: laterOperationId, clientSecret: laterSecret } });
  assert.equal(laterStage.statusCode, 201, laterStage.body);
  const laterActivation = await rig.app.inject({ method: "POST", url: "/api/nexushub/v1/client-profile/credential-rotation/activate", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, operationId: laterOperationId } });
  assert.equal(laterActivation.statusCode, 200, laterActivation.body);
  const priorOperationReadback = await rig.app.inject({ method: "GET", url: `/api/nexushub/v1/client-profile/nexushub/credential-rotation?operationId=${operationId}`, headers: bearer("good") });
  assert.equal(priorOperationReadback.statusCode, 200, priorOperationReadback.body);
  assert.equal(priorOperationReadback.json().data.operationState, "activated", "operation history remains queryable after a newer rotation completes");
  assert.equal(priorOperationReadback.json().data.generation, activatedStatus.json().data.generation);
  assert.equal(priorOperationReadback.body.includes(laterSecret), false);
});

test("LiberIDE client ensure/adopt is bound to issuer-enrolled origin and fixed profile", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const enrolled = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: {
    credentialId: "credential-1", publicOrigin: ORIGIN, liberideOrigin: "https://ide.example.test"
  } });
  assert.equal(enrolled.statusCode, 201, enrolled.body);
  assert.deepEqual(enrolled.json().data.profileVersions, ["nexushub:1", "liberide:1"]);
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const hub = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload: {
    profileId: "nexushub", profileVersion: 1, clientSecret: "Hub_profile_secret_0123456789ABCDEF"
  } });
  assert.equal(hub.statusCode, 201, hub.body);
  (rig.identity.metadata as Record<string, any>).nexushub_enrollment.clientId = hub.json().data.clientId;
  (rig.identity.metadata as Record<string, any>).nexushub_enrollment.adoptedExisting = true;
  rig.oauthClients.delete(hub.json().data.clientId);
  const secret = "LiberIDE_generated_secret_0123456789ABCDEF";
  const url = "/api/nexushub/v1/client-profile";
  const payload = { profileId: "liberide", profileVersion: 1, clientSecret: secret };
  const first = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(first.statusCode, 201, first.body);
  assert.notEqual(first.json().data.clientId, hub.json().data.clientId);
  assert.deepEqual(first.json().data.redirectUris, ["https://ide.example.test/api/auth/nexusid/callback"]);
  assert.deepEqual(first.json().data.scopes, ["openid", "profile", "email"]);
  assert.deepEqual(first.json().data.grants, ["authorization_code"]);
  assert.equal(first.body.includes(secret), false);
  const replay = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().data.clientId, first.json().data.clientId);
  const adopted = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, mode: "adopt-existing" } });
  assert.equal(adopted.statusCode, 200, adopted.body);
  assert.equal(adopted.json().data.adopted, true);
  const widened = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, redirectUris: ["https://attacker.test/callback"] } });
  assert.equal(widened.statusCode, 400);
  const changedSecret = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: { ...payload, clientSecret: "Other_LiberIDE_secret_0123456789ABCDEF" } });
  assert.equal(changedSecret.statusCode, 409);
  assert.equal(rig.oauthClients.size, 1);
  const hubRetry = await rig.app.inject({ method: "PUT", url, headers: bearer("good"), payload: {
    profileId: "nexushub", profileVersion: 1, clientSecret: "Hub_profile_secret_0123456789ABCDEF"
  } });
  assert.equal(hubRetry.statusCode, 404);
  assert.equal(hubRetry.json().error, "adopted_client_not_found");
});

test("NexusHub adopt-existing requires the installation-reserved ID and an exact profile", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const response = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, mode: "adopt-existing", clientSecret: "Hub_generated_secret_0123456789ABCDEF" } });
  assert.equal(response.statusCode, 404);
  assert.equal(rig.oauthClients.size, 0);
});

test("deployment admin can explicitly bind an exact existing client for adopt-existing", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const profile = deriveNexusHubClientProfile({ profileId: "nexushub", profileVersion: 1, publicOrigin: ORIGIN });
  rig.oauthClients.set("legacy-hub-client", { id: "legacy-hub-client", name: profile.name, secret: "Hub_generated_secret_0123456789ABCDEF", redirectUris: profile.redirectUris, allowedScopes: profile.allowedScopes, grants: profile.grants, requirePkce: profile.requirePkce });
  const enroll = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN, adoptClientId: "legacy-hub-client" } });
  assert.equal(enroll.statusCode, 201, enroll.body);
  assert.equal(enroll.json().data.adoptedClientId, "legacy-hub-client");
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const wrongSecret = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, mode: "adopt-existing", clientSecret: "Wrong_Hub_secret_0123456789ABCDEF" } });
  assert.equal(wrongSecret.statusCode, 409);
  assert.equal(rig.managedCredentials.has("legacy-hub-client"), false, "a managed marker is not seeded from an unproven replacement secret");
  const adopted = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload: { profileId: "nexushub", profileVersion: 1, mode: "adopt-existing", clientSecret: "Hub_generated_secret_0123456789ABCDEF" } });
  assert.equal(adopted.statusCode, 200, adopted.body);
  assert.equal(adopted.json().data.clientId, "legacy-hub-client");
  assert.equal(adopted.json().data.adopted, true);
  assert.equal(adopted.body.includes("Hub_generated_secret_0123456789ABCDEF"), false);
  assert.equal(rig.oauthClients.size, 1);
});

test("NexusHub profile retry recovers after the client row committed but its write acknowledgement was lost", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: [HUB_AUDIENCE] });
  const payload = { profileId: "nexushub", profileVersion: 1, clientSecret: "Hub_generated_secret_0123456789ABCDEF" };
  rig.failNextClientWriteAcknowledgement();
  const first = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload });
  assert.equal(first.statusCode, 200, first.body);
  const retry = await rig.app.inject({ method: "PUT", url: "/api/nexushub/v1/client-profile", headers: bearer("good"), payload });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(rig.oauthClients.size, 1);
  assert.equal(first.body.includes(payload.clientSecret), false);
  assert.equal(retry.body.includes(payload.clientSecret), false);
});

test("revocation disables readback, and ordinary metadata edits cannot replace the protected enrollment", async (t) => {
  const rig = createRig(true);
  t.after(() => rig.close());
  const enrolled = await rig.app.inject({ method: "PUT", url: "/api/admin/service-identities/si-hub/nexushub-enrollment", payload: { credentialId: "credential-1", publicOrigin: ORIGIN } });
  assert.equal(enrolled.statusCode, 201);
  const originalEnrollment = structuredClone(rig.identity.metadata?.nexushub_enrollment);

  const patch = await rig.app.inject({
    method: "PATCH", url: "/api/admin/service-identities/si-hub",
    payload: { metadata: { ordinary: "changed", nexushub_enrollment: { status: "active", installationId: "attacker-chosen", credentialClientId: "attacker" }, bootstrap_admin: true } }
  });
  assert.equal(patch.statusCode, 200, patch.body);
  assert.deepEqual(rig.identity.metadata?.nexushub_enrollment, originalEnrollment);
  assert.equal(rig.identity.metadata?.ordinary, "changed");
  assert.equal(rig.identity.metadata?.bootstrap_admin, undefined);

  rig.claimsByToken.set("good", { actor_type: "service_identity", service_identity_id: rig.identity.id, client_id: "hub-client-1", aud: HUB_AUDIENCE });
  const revoke = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexushub-enrollment" });
  assert.equal(revoke.statusCode, 204);
  assert.equal(rig.auditEvents.length, 2);
  const readAfterRevoke = await rig.app.inject({ method: "GET", url: "/api/nexushub/v1/enrollment", headers: bearer("good") });
  assert.equal(readAfterRevoke.statusCode, 403);
  const repeatedRevoke = await rig.app.inject({ method: "DELETE", url: "/api/admin/service-identities/si-hub/nexushub-enrollment" });
  assert.equal(repeatedRevoke.statusCode, 404);
});
