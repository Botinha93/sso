import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../../src/core/config.js";
import { getPrismaClient } from "../../src/repositories/prisma-factory.js";
import { createPrismaRepositories } from "../../src/repositories/prisma-repositories.js";

const enabled = process.env.NEXUSID_MANAGED_ROTATION_DB_ACCEPTANCE === "1";
const provider = process.env.NEXUSID_ROTATION_ACCEPTANCE_PROVIDER;
const databaseUrl = process.env.NEXUSID_ROTATION_ACCEPTANCE_DATABASE_URL;
const expectedDbName = process.env.NEXUSID_ROTATION_ACCEPTANCE_DB_NAME;
const validInputs = enabled && (provider === "postgresql" || provider === "mysql") && Boolean(databaseUrl) && Boolean(expectedDbName);

test("managed credential rotation works against an isolated PostgreSQL/MySQL database", { skip: !validInputs }, async () => {
  assert.match(expectedDbName!, /^nhid_rotation_test_[a-f0-9]{12}$/);
  const parsedUrl = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsedUrl.hostname), "acceptance URL must target loopback");
  assert.equal(decodeURIComponent(parsedUrl.pathname.slice(1)), expectedDbName, "database name must be the harness-generated disposable name");

  const config = { ...loadConfig(), databaseProvider: provider as "postgresql" | "mysql", externalDatabaseUrl: databaseUrl! };
  const prisma = await getPrismaClient(config);
  let peer: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
  const repo = createPrismaRepositories(prisma as never).clientRepository;
  try {
    peer = await getPrismaClient(config);
    const peerRepo = createPrismaRepositories(peer as never).clientRepository;
    const clientId = `nh_accept_${Date.now().toString(36)}`;
    await repo.create({ id: clientId, name: "NexusHub disposable acceptance", secret: "old-active-secret", redirectUris: [], allowedScopes: [], grants: ["authorization_code"], requirePkce: true, resources: [], flowIds: [] });
    const binding = { clientId, installationId: "acceptance-installation", profileId: "nexushub" as const, profileVersion: 1 as const };
    await repo.ensureManagedProfileCredential!({ ...binding, secret: "old-active-secret" });

    await createFailureTrigger(prisma, provider!);
    const failedStage = await repo.stageManagedProfileCredential!({ clientId, operationId: "failure-stage-operation", secret: "stage-candidate-secret", expiresAt: new Date(Date.now() + 60_000) });
    assert.equal(failedStage.state, "conflict");
    await dropFailureTrigger(prisma, provider!);
    assert.equal((await repo.managedProfileCredentialStatus!(clientId, new Date(), "failure-stage-operation"))?.operationState, "conflict", "failed stage transaction cannot leave staging history");
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "stage-candidate-secret"), false, "failed stage transaction cannot leave a pending verifier");

    const expiry = new Date(Date.now() + 60_000);
    const staged = await repo.stageManagedProfileCredential!({ clientId, operationId: "acceptance-rotation-op", secret: "new-active-secret", expiresAt: expiry });
    assert.equal(staged.state, "staged");
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "old-active-secret"), true);
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "new-active-secret"), true);
    assert.equal((await peerRepo.stageManagedProfileCredential!({ clientId, operationId: "acceptance-rotation-op", secret: "new-active-secret", expiresAt: expiry })).state, "replayed", "independent Prisma connection observes committed operation");
    assert.equal((await peerRepo.stageManagedProfileCredential!({ clientId, operationId: "acceptance-rotation-op", secret: "different-candidate-secret", expiresAt: expiry })).state, "conflict");

    await createAbortFailureTrigger(prisma, provider!);
    await assert.rejects(repo.abortManagedProfileCredential!({ clientId, operationId: "acceptance-rotation-op" }));
    await dropAbortFailureTrigger(prisma, provider!);
    assert.equal((await repo.managedProfileCredentialStatus!(clientId, new Date(), "acceptance-rotation-op"))?.operationState, "pending", "failed abort transaction preserves both pending credential and pending history");
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "new-active-secret"), true);

    assert.equal(await repo.abortManagedProfileCredential!({ clientId, operationId: "acceptance-rotation-op" }), true);
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "new-active-secret"), false);
    assert.equal((await repo.managedProfileCredentialStatus!(clientId, new Date(), "acceptance-rotation-op"))?.operationState, "aborted");

    const activatedOp = "acceptance-activation-op";
    assert.equal((await repo.stageManagedProfileCredential!({ clientId, operationId: activatedOp, secret: "final-active-secret", expiresAt: expiry })).state, "staged");
    assert.deepEqual(await Promise.all([
      repo.activateManagedProfileCredential!({ clientId, operationId: activatedOp }),
      peerRepo.activateManagedProfileCredential!({ clientId, operationId: activatedOp })
    ]).then((results) => results.map((result) => result.state).sort()), ["activated", "replayed"]);
    assert.equal((await repo.managedProfileCredentialStatus!(clientId, new Date(), activatedOp))?.operationState, "activated", "concurrent activation replay cannot corrupt operation history");
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "final-active-secret"), true);
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "old-active-secret"), false);
    assert.equal((await peerRepo.managedProfileCredentialStatus!(clientId))?.activatedOperationId, activatedOp);

    const laterOp = "acceptance-rotation-later-op";
    assert.equal((await repo.stageManagedProfileCredential!({ clientId, operationId: laterOp, secret: "later-active-secret", expiresAt: expiry })).state, "staged");
    assert.equal((await repo.activateManagedProfileCredential!({ clientId, operationId: laterOp })).state, "activated");
    const historicActivation = await peerRepo.managedProfileCredentialStatus!(clientId, new Date(), activatedOp);
    assert.equal(historicActivation?.operationState, "activated", "completed operation remains queryable after a later rotation");
    assert.equal(historicActivation?.generation, 2, "historical readback reports that operation's resulting generation");
    assert.equal((await repo.managedProfileCredentialStatus!(clientId, new Date(), "acceptance-rotation-op"))?.operationState, "aborted", "aborted operation remains queryable after later rotations");
    assert.equal((await repo.managedProfileCredentialStatus!(clientId))?.generation, 3, "unqualified status reports current profile generation");

    const expiringOp = "acceptance-rotation-expiring";
    assert.equal((await repo.stageManagedProfileCredential!({ clientId, operationId: expiringOp, secret: "expiring-final-secret", expiresAt: new Date(Date.now() + 2_500) })).state, "staged");
    await new Promise((resolve) => setTimeout(resolve, 2_600));
    assert.equal((await peerRepo.managedProfileCredentialStatus!(clientId, new Date(), expiringOp))?.operationState, "expired");
    assert.equal((await repo.activateManagedProfileCredential!({ clientId, operationId: expiringOp })).state, "conflict", "expired operation is terminal even while its stale pending marker is present");
    assert.equal(await repo.authenticateManagedProfileSecret!(clientId, "expiring-final-secret"), false);
  } finally {
    await peer?.$disconnect();
    await prisma.$disconnect();
  }
});

async function createFailureTrigger(prisma: Awaited<ReturnType<typeof getPrismaClient>>, provider: string) {
  if (provider === "postgresql") {
    await (prisma as any).$executeRawUnsafe("CREATE FUNCTION nhid_accept_fail_pending() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state = 'pending' THEN RAISE EXCEPTION 'injected acceptance failure'; END IF; RETURN NEW; END $$");
    await (prisma as any).$executeRawUnsafe("CREATE TRIGGER nhid_accept_fail_pending BEFORE UPDATE ON nexushub_managed_client_credential_operations FOR EACH ROW EXECUTE FUNCTION nhid_accept_fail_pending()");
  } else {
    await mysqlDdl("CREATE TRIGGER nhid_accept_fail_pending BEFORE UPDATE ON nexushub_managed_client_credential_operations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected acceptance failure'");
  }
}

async function dropFailureTrigger(prisma: Awaited<ReturnType<typeof getPrismaClient>>, provider: string) {
  if (provider === "postgresql") {
    await (prisma as any).$executeRawUnsafe("DROP TRIGGER nhid_accept_fail_pending ON nexushub_managed_client_credential_operations");
    await (prisma as any).$executeRawUnsafe("DROP FUNCTION nhid_accept_fail_pending()");
  } else {
    await mysqlDdl("DROP TRIGGER nhid_accept_fail_pending");
  }
}

async function createAbortFailureTrigger(prisma: Awaited<ReturnType<typeof getPrismaClient>>, provider: string) {
  if (provider === "postgresql") {
    await (prisma as any).$executeRawUnsafe("CREATE FUNCTION nhid_accept_fail_aborted() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state = 'aborted' THEN RAISE EXCEPTION 'injected acceptance failure'; END IF; RETURN NEW; END $$");
    await (prisma as any).$executeRawUnsafe("CREATE TRIGGER nhid_accept_fail_aborted BEFORE UPDATE ON nexushub_managed_client_credential_operations FOR EACH ROW EXECUTE FUNCTION nhid_accept_fail_aborted()");
  } else {
    await mysqlDdl("CREATE TRIGGER nhid_accept_fail_aborted BEFORE UPDATE ON nexushub_managed_client_credential_operations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected acceptance failure'");
  }
}

async function dropAbortFailureTrigger(prisma: Awaited<ReturnType<typeof getPrismaClient>>, provider: string) {
  if (provider === "postgresql") {
    await (prisma as any).$executeRawUnsafe("DROP TRIGGER nhid_accept_fail_aborted ON nexushub_managed_client_credential_operations");
    await (prisma as any).$executeRawUnsafe("DROP FUNCTION nhid_accept_fail_aborted()");
  } else {
    await mysqlDdl("DROP TRIGGER nhid_accept_fail_aborted");
  }
}

async function mysqlDdl(sql: string) {
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection(databaseUrl!);
  try { await connection.query(sql); }
  finally { await connection.end(); }
}
