import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/services/auth-service.js";
import { ClientService } from "../../src/services/client-service.js";

const client = { id: "nh_managed", name: "Hub", secret: "stale-legacy-value", redirectUris: [], allowedScopes: [], grants: [], requirePkce: true, resources: [], flowIds: [], createdAt: new Date() };

test("shared client authentication never falls back to the stale legacy secret for managed profiles", async () => {
  const repository = {
    findById: async () => client,
    authenticateManagedProfileSecret: async (_id: string, secret: string) => secret === "active-managed-secret"
  };
  const auth = new AuthService({} as any, {} as any, {} as any, {} as any, repository as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  assert.equal((await auth.authenticateClient({ clientId: client.id, clientSecret: "active-managed-secret" })).id, client.id);
  await assert.rejects(auth.authenticateClient({ clientId: client.id, clientSecret: "stale-legacy-value" }), /Invalid client credentials/);
});

test("ordinary clients retain generic OAuth secret authentication", async () => {
  const repository = { findById: async () => ({ ...client, id: "ordinary-client", secret: "generic-secret" }), authenticateManagedProfileSecret: async () => undefined };
  const auth = new AuthService({} as any, {} as any, {} as any, {} as any, repository as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  assert.equal((await auth.authenticateClient({ clientId: "ordinary-client", clientSecret: "generic-secret" })).id, "ordinary-client");
  await assert.rejects(auth.authenticateClient({ clientId: "ordinary-client", clientSecret: "wrong" }), /Invalid client credentials/);
});

test("ClientService shared verifier helper covers token-exchange callers", async () => {
  const service = new ClientService({
    findById: async () => client,
    authenticateManagedProfileSecret: async (_id: string, secret: string) => secret === "pending-managed-secret"
  } as any, {} as any);
  assert.equal(await service.authenticateClientSecret(client.id, "pending-managed-secret"), true);
  assert.equal(await service.authenticateClientSecret(client.id, "stale-legacy-value"), false);
});
