import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { loadConfig } from "../../src/core/config.js";
import { getPrismaClient } from "../../src/repositories/prisma-factory.js";
import { createPrismaRepositories } from "../../src/repositories/prisma-repositories.js";

test("SQLite upgrades the legacy Hub-consent table and persists exact resource-bound scopes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nexusid-hub-consent-"));
  const databasePath = join(directory, "nexusid.sqlite");
  const previousProvider = process.env.DATABASE_PROVIDER;
  const previousUrl = process.env.DATABASE_URL;
  const previousPath = process.env.DATABASE_PATH;
  const previousIssuer = process.env.ISSUER;
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_PATH = databasePath;
  process.env.ISSUER = "http://localhost:4000";

  let prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;
  try {
    // Reproduce the first-generation table that did not persist approved scopes.
    const legacy = new Database(databasePath);
    legacy.exec(`CREATE TABLE nexushub_delegation_consents (
      id TEXT PRIMARY KEY,
      tuple_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      installation_id TEXT NOT NULL,
      resource TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    legacy.close();

    prisma = await getPrismaClient(loadConfig());
    const repositories = createPrismaRepositories(prisma as never);
    const columns = await (prisma as any).$queryRawUnsafe("PRAGMA table_info(nexushub_delegation_consents)") as Array<{ name: string }>;
    assert.ok(columns.some((column) => column.name === "scopes_json"), "startup must upgrade legacy storage");

    const tuple = { userId: "user-1", clientId: "hub-client-1", installationId: "hub-client-1", resource: "https://gitflow.example" };
    const expiry = new Date(Date.now() + 60_000);
    const approved = await repositories.nexusHubDelegationConsentRepository.upsert({ ...tuple, scopes: ["openid", "profile"] , expiresAt: expiry });
    assert.deepEqual((await repositories.nexusHubDelegationConsentRepository.findActive(tuple))?.scopes, ["openid", "profile"]);

    const delegatedToken = { tokenId: "delegated-jti-1", userId: tuple.userId, clientId: tuple.clientId, installationId: tuple.installationId, resource: tuple.resource, expiresAt: expiry };
    await repositories.nexusHubDelegationTokenRepository.record(delegatedToken);
    assert.deepEqual(await repositories.nexusHubDelegationTokenRepository.findActive(delegatedToken.tokenId), delegatedToken);
    assert.equal(await repositories.nexusHubDelegationTokenRepository.findActive(delegatedToken.tokenId, expiry), undefined, "expired delegated tokens are inactive");
    const staleIssue = { ...delegatedToken, tokenId: "delegated-jti-after-revoke", userId: "already-revoked-user" };
    assert.equal(await repositories.nexusHubDelegationTokenRepository.record(staleIssue), false, "a token racing behind consent revocation is stored inactive");
    assert.equal(await repositories.nexusHubDelegationTokenRepository.findActive(staleIssue.tokenId), undefined);

    // Re-consenting to fewer scopes replaces the grant; it does not union old
    // scopes or inherit consent from another resource/client tuple.
    await repositories.nexusHubDelegationConsentRepository.upsert({ ...tuple, scopes: ["openid"], expiresAt: expiry });
    assert.deepEqual((await repositories.nexusHubDelegationConsentRepository.findActive(tuple))?.scopes, ["openid"]);
    assert.equal(await repositories.nexusHubDelegationConsentRepository.findActive({ ...tuple, resource: "https://deploy.example" }), undefined);
    assert.equal(await repositories.nexusHubDelegationConsentRepository.findActive({ ...tuple, clientId: "other-client" }), undefined);

    const concurrent = await Promise.all([
      repositories.nexusHubDelegationConsentRepository.upsert({ ...tuple, scopes: ["openid"], expiresAt: expiry }),
      repositories.nexusHubDelegationConsentRepository.upsert({ ...tuple, scopes: ["email"], expiresAt: expiry })
    ]);
    const persisted = await repositories.nexusHubDelegationConsentRepository.findActive(tuple);
    assert.ok(persisted);
    assert.ok([["openid"], ["email"]].some((scopes) => JSON.stringify(scopes) === JSON.stringify(persisted.scopes)), "concurrent upserts must leave one exact grant, never a union");
    assert.equal(new Set(concurrent.map((grant) => grant.id)).size >= 1, true);
    assert.equal((await repositories.nexusHubDelegationConsentRepository.listByUser(tuple.userId)).length, 1);

    assert.deepEqual(await repositories.nexusHubDelegationTokenRepository.revokeGrant(tuple), [delegatedToken.tokenId]);
    assert.equal(await repositories.nexusHubDelegationTokenRepository.findActive(delegatedToken.tokenId), undefined);
    assert.deepEqual(await repositories.nexusHubDelegationTokenRepository.revokeGrant(tuple), [], "a repeated revoke is idempotent");
    await repositories.nexusHubDelegationConsentRepository.revoke(tuple);
    await repositories.nexusHubDelegationConsentRepository.revoke(tuple);
    assert.equal(await repositories.nexusHubDelegationConsentRepository.findActive(tuple), undefined);
    assert.equal((await repositories.nexusHubDelegationConsentRepository.listByUser(tuple.userId)).length, 0);
    const reapproved = await repositories.nexusHubDelegationConsentRepository.upsert({ ...tuple, scopes: ["openid"], expiresAt: expiry });
    assert.notEqual(reapproved.id, approved.id);
    assert.deepEqual(reapproved.scopes, ["openid"]);
  } finally {
    await prisma?.$disconnect();
    if (previousProvider === undefined) delete process.env.DATABASE_PROVIDER; else process.env.DATABASE_PROVIDER = previousProvider;
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = previousPath;
    if (previousIssuer === undefined) delete process.env.ISSUER; else process.env.ISSUER = previousIssuer;
    rmSync(directory, { recursive: true, force: true });
  }
});
