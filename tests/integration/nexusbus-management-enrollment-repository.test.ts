import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../../src/core/config.js";
import { getPrismaClient } from "../../src/repositories/prisma-factory.js";
import { createPrismaRepositories } from "../../src/repositories/prisma-repositories.js";

test("SQLite persists issuer-owned Bus enrollment with unique active authority and durable revocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nexusid-bus-management-"));
  const databasePath = join(directory, "nexusid.sqlite");
  const saved = Object.fromEntries(["DATABASE_PROVIDER", "DATABASE_URL", "DATABASE_PATH", "ISSUER"].map((key) => [key, process.env[key]]));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_PATH = databasePath;
  process.env.ISSUER = "http://localhost:4000";
  let prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
  try {
    prisma = await getPrismaClient(loadConfig());
    const repository = createPrismaRepositories(prisma as never).nexusBusManagementEnrollmentRepository;
    const input = {
      enrollmentId: "enrollment-1", installationId: "installation-1", serviceIdentityId: "service-identity-1",
      credentialId: "credential-1", credentialHash: "a".repeat(64), organizationId: "org-1", projectId: "project-1",
      tenant: "tenant-1", app: "nexusbus", roles: ["nexusbus.installation.read"]
    };
    const outcomes = await Promise.allSettled([repository.create(input), repository.create({ ...input, enrollmentId: "enrollment-2", credentialId: "credential-2" })]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1, "unique service identity must serialize concurrent enrollment attempts");
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
    const stored = await repository.findByServiceIdentity(input.serviceIdentityId);
    assert.ok(stored);
    assert.equal(stored.credentialHash, input.credentialHash);
    assert.deepEqual(stored.roles, input.roles);
    assert.equal((await repository.findByCredential(stored.credentialId))?.installationId, input.installationId);
    assert.equal(await repository.revoke(input.serviceIdentityId), true);
    assert.equal(await repository.revoke(input.serviceIdentityId), false);
    assert.equal((await repository.findByCredential(stored.credentialId))?.status, "revoked");
  } finally {
    await prisma?.$disconnect();
    for (const key of ["DATABASE_PROVIDER", "DATABASE_URL", "DATABASE_PATH", "ISSUER"]) {
      const value = saved[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
