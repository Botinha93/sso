import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../../src/core/config.js";
import { getPrismaClient } from "../../src/repositories/prisma-factory.js";
import { createPrismaRepositories } from "../../src/repositories/prisma-repositories.js";

test("managed Hub OAuth credential stages with overlap, retries safely, then atomically retires the old verifier", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nexusid-managed-client-credential-"));
  const previous = Object.fromEntries(["DATABASE_PROVIDER", "DATABASE_URL", "DATABASE_PATH", "ISSUER"].map((key) => [key, process.env[key]]));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_PATH = join(directory, "nexusid.sqlite");
  process.env.ISSUER = "http://localhost:4000";
  let prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
  let peer: { $disconnect(): Promise<void> } | undefined;
  try {
    prisma = await getPrismaClient(loadConfig());
    const repository = createPrismaRepositories(prisma as never).clientRepository;
    const sqliteModule = await import("../../src/generated/prisma/sqlite/client.js");
    peer = new sqliteModule.PrismaClient();
    const peerRepository = createPrismaRepositories(peer as never).clientRepository;
    await repository.create({ id: "nh_stable-id", name: "NexusHub", secret: "old-active-secret", redirectUris: [], allowedScopes: [], grants: ["authorization_code"], requirePkce: true, resources: [], flowIds: [] });
    const binding = { clientId: "nh_stable-id", installationId: "installation-a", profileId: "nexushub" as const, profileVersion: 1 as const };
    await repository.ensureManagedProfileCredential!({ ...binding, secret: "old-active-secret" });
    assert.notEqual((await repository.findById(binding.clientId))?.secret, "old-active-secret", "managed enrollment must scrub the OAuth plaintext verifier after seeding the managed verifier");
    // Leave a different legacy verifier in oauth_clients to prove it can no
    // longer authenticate once the managed-only marker exists.
    await repository.update(binding.clientId, { secret: "legacy-old-secret" });
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "old-active-secret"), true);
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "legacy-old-secret"), false, "managed marker must disable legacy OAuth secret bypass");

    const expiry = new Date(Date.now() + 60_000);
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "too-long-rotation", secret: "overlong-candidate-secret", expiresAt: new Date(Date.now() + 16 * 60 * 1000) })).state, "conflict", "pending overlap is capped at 15 minutes");
    const staged = await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-1", secret: "new-candidate-secret", expiresAt: expiry });
    assert.equal(staged.state, "staged");
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "old-active-secret"), true, "active secret stays usable during overlap");
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "new-candidate-secret"), true, "candidate can be validated before activation");

    const replay = await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-1", secret: "new-candidate-secret", expiresAt: expiry });
    assert.equal(replay.state, "replayed");
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-1", secret: "different-candidate-secret", expiresAt: expiry })).state, "conflict");
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-other", secret: "another-candidate-secret", expiresAt: expiry })).state, "conflict", "a second operation cannot replace a live pending verifier");
    assert.equal(await repository.abortManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-1" }), true);
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "new-candidate-secret"), false, "aborted pending verifier is no longer accepted");
    assert.deepEqual(await Promise.all([
      repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-2", secret: "another-candidate-secret", expiresAt: expiry }),
      peerRepository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-2", secret: "another-candidate-secret", expiresAt: expiry })
    ]).then((outcomes) => outcomes.map((outcome) => outcome.state).sort()), ["replayed", "staged"]);

    const activated = await repository.activateManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-2" });
    assert.equal(activated.state, "activated");
    assert.equal(activated.generation, 2);
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "another-candidate-secret"), true);
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "old-active-secret"), false, "activation retires old verifier immediately");
    assert.equal((await repository.activateManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-2" })).state, "replayed", "lost activation response is recoverable by operation ID");
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-op-2", secret: "another-candidate-secret", expiresAt: expiry })).state, "replayed", "stage retry after activation remains idempotent");
    assert.equal((await repository.managedProfileCredentialStatus!(binding.clientId))?.activatedOperationId, "rotation-op-2");

    const shortExpiry = new Date(Date.now() + 2_500);
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-expiring-001", secret: "expiring-candidate-secret", expiresAt: shortExpiry })).state, "staged");
    await new Promise((resolve) => setTimeout(resolve, 2_600));
    assert.equal(await repository.authenticateManagedProfileSecret!(binding.clientId, "expiring-candidate-secret"), false, "expired pending verifier stops authenticating automatically");
    assert.equal((await repository.activateManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-expiring-001" })).state, "conflict");
    assert.equal((await repository.managedProfileCredentialStatus!(binding.clientId, new Date(), "rotation-expiring-001"))?.operationState, "expired");
    assert.equal((await repository.stageManagedProfileCredential!({ clientId: binding.clientId, operationId: "rotation-expiring-001", secret: "different-expired-candidate", expiresAt: new Date(Date.now() + 60_000) })).state, "conflict", "expired idempotency keys cannot be recycled with another candidate");
  } finally {
    await peer?.$disconnect();
    await prisma?.$disconnect();
    for (const key of ["DATABASE_PROVIDER", "DATABASE_URL", "DATABASE_PATH", "ISSUER"]) {
      const value = previous[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
