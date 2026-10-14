import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "../../src/core/config.js";
import { createRepositoryBundle } from "../../src/repositories/factory.js";

const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig => {
  const tempDir = mkdtempSync(join(tmpdir(), "sso-parity-test-"));

  return {
    port: 4000,
    host: "127.0.0.1",
    databaseProvider: "sqlite",
    databasePath: join(tempDir, "sso.sqlite"),
    externalDatabaseUrl: undefined,
    issuer: "http://localhost:4000",
    ttl: {
      accessTokenSeconds: 900,
      idTokenSeconds: 900,
      refreshTokenSeconds: 60 * 60 * 24 * 30
    },
    admin: {
      email: "admin@example.com",
      password: "change-me-now"
    },
    federation: {
      providers: []
    },
    ...overrides
  };
};

test("risk event repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  // Create test data
  const testData = {
    userId: "user-123",
    ip: "192.168.1.1",
    deviceFingerprintHash: "hash-abc",
    geo: "US",
    confidence: 75,
    reason: "unusual_location" as const,
    decision: "challenge" as const,
    metadata: { details: "test event" }
  };

  // Test create
  const created = await sqliteRepos.riskEventRepository.create(testData);
  assert.ok(created.id);
  assert.equal(created.userId, testData.userId);
  assert.equal(created.ip, testData.ip);
  assert.equal(created.confidence, testData.confidence);

  // Test list
  const listed = await sqliteRepos.riskEventRepository.list({ limit: 10 });
  assert.ok(listed.length > 0);
  assert.ok(listed.some((r) => r.id === created.id));

  // Test countRecentByIp
  const count = await sqliteRepos.riskEventRepository.countRecentByIp(testData.ip, 60000);
  assert.ok(count > 0);
});

test("service identity repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  const testData = {
    name: "test-service-identity",
    description: "Test service",
    ownerId: "owner-123",
    appId: "app-123",
    status: "active" as const,
    allowedScopes: ["read:api", "write:api"],
    allowedAudiences: ["api.example.com"]
  };

  // Test create
  const created = await sqliteRepos.serviceIdentityRepository.create(testData);
  assert.ok(created.id);
  assert.equal(created.name, testData.name);
  assert.deepEqual(created.allowedScopes, testData.allowedScopes);
  assert.deepEqual(created.allowedAudiences, testData.allowedAudiences);

  // Test findById
  const found = await sqliteRepos.serviceIdentityRepository.findById(created.id);
  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.description, testData.description);

  // Test list
  const listed = await sqliteRepos.serviceIdentityRepository.list();
  assert.ok(listed.length > 0);
  assert.ok(listed.some((s) => s.id === created.id));

  // Test update
  const updated = await sqliteRepos.serviceIdentityRepository.update(created.id, {
    description: "Updated description",
    status: "inactive"
  });
  assert.ok(updated);
  assert.equal(updated.description, "Updated description");
  assert.equal(updated.status, "inactive");
  assert.equal(updated.name, testData.name); // Unchanged fields

  // Test delete
  await sqliteRepos.serviceIdentityRepository.delete(created.id);
  const deleted = await sqliteRepos.serviceIdentityRepository.findById(created.id);
  assert.equal(deleted, undefined);
});

test("service identity credential repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  // First create the backing non-human user principal.
  const identity = await sqliteRepos.userRepository.create({
    appIds: [],
    directAppIds: [],
    inheritedAppIds: [],
    isServiceUser: true,
    email: "test-cred-service@service.local",
    username: "test-cred-service",
    passwordHash: "disabled",
    givenName: "test-cred-service",
    familyName: "",
    customAttributes: {
      "si.allowedScopes": "[]",
      "si.allowedAudiences": "[]",
      "si.status": "active"
    },
    active: true
  });

  const credData = {
    serviceIdentityId: identity.id,
    clientId: "client-123",
    clientSecretHash: "hash-xyz",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };

  // Test create
  const created = await sqliteRepos.serviceIdentityCredentialRepository.create(credData);
  assert.ok(created.id);
  assert.equal(created.clientId, credData.clientId);
  assert.equal(created.serviceIdentityId, identity.id);

  // Test findById
  const found = await sqliteRepos.serviceIdentityCredentialRepository.findById(created.id);
  assert.ok(found);
  assert.equal(found.clientId, credData.clientId);

  // Test findByClientId
  const foundByClient = await sqliteRepos.serviceIdentityCredentialRepository.findByClientId(credData.clientId);
  assert.ok(foundByClient);
  assert.equal(foundByClient.id, created.id);

  // Test listByServiceIdentity
  const listed = await sqliteRepos.serviceIdentityCredentialRepository.listByServiceIdentity(identity.id);
  assert.ok(listed.length > 0);
  assert.ok(listed.some((c) => c.id === created.id));

  // Test touchLastUsed
  const now = new Date();
  await sqliteRepos.serviceIdentityCredentialRepository.touchLastUsed(created.id, now);
  const touched = await sqliteRepos.serviceIdentityCredentialRepository.findById(created.id);
  assert.ok(touched?.lastUsedAt);

  // Test revoke
  const revokeTime = new Date();
  await sqliteRepos.serviceIdentityCredentialRepository.revoke(created.id, revokeTime);
  const revoked = await sqliteRepos.serviceIdentityCredentialRepository.findById(created.id);
  assert.ok(revoked?.revokedAt);

  // findByClientId should not return revoked credential
  const notFound = await sqliteRepos.serviceIdentityCredentialRepository.findByClientId(credData.clientId);
  assert.equal(notFound, undefined);
});

test("connector repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  const testData = {
    name: "test-connector",
    type: "scim" as const,
    status: "active" as const,
    config: { endpoint: "https://example.com/scim", auth: "bearer" }
  };

  // Test create
  const created = await sqliteRepos.connectorRepository.create(testData);
  assert.ok(created.id);
  assert.equal(created.name, testData.name);
  assert.equal(created.type, testData.type);
  assert.deepEqual(created.config, testData.config);

  // Test findById
  const found = await sqliteRepos.connectorRepository.findById(created.id);
  assert.ok(found);
  assert.equal(found.name, testData.name);

  // Test list
  const listed = await sqliteRepos.connectorRepository.list();
  assert.ok(listed.length > 0);
  assert.ok(listed.some((c) => c.id === created.id));

  // Test update
  const updated = await sqliteRepos.connectorRepository.update(created.id, {
    status: "inactive",
    schedule: "0 0 * * *"
  });
  assert.ok(updated);
  assert.equal(updated.status, "inactive");
  assert.equal(updated.schedule, "0 0 * * *");

  // Test delete
  await sqliteRepos.connectorRepository.delete(created.id);
  const deleted = await sqliteRepos.connectorRepository.findById(created.id);
  assert.equal(deleted, undefined);
});

test("connector run repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  // Create a connector first
  const connector = await sqliteRepos.connectorRepository.create({
    name: "test-run-connector",
    type: "scim",
    status: "active",
    config: {}
  });

  const runData = {
    connectorId: connector.id,
    status: "completed" as const,
    recordsImported: 100,
    recordsFailed: 5,
    startedAt: new Date(Date.now() - 60000),
    finishedAt: new Date()
  };

  // Test create
  const created = await sqliteRepos.connectorRunRepository.create(runData);
  assert.ok(created.id);
  assert.equal(created.connectorId, connector.id);
  assert.equal(created.recordsImported, 100);

  // Test findById
  const found = await sqliteRepos.connectorRunRepository.findById(created.id);
  assert.ok(found);
  assert.equal(found.recordsFailed, 5);

  // Test listByConnector
  const listed = await sqliteRepos.connectorRunRepository.listByConnector(connector.id);
  assert.ok(listed.length > 0);
  assert.ok(listed.some((r) => r.id === created.id));

  // Test update
  const updated = await sqliteRepos.connectorRunRepository.update(created.id, {
    status: "failed",
    errorMessage: "Test error"
  });
  assert.ok(updated);
  assert.equal(updated.status, "failed");
  assert.equal(updated.errorMessage, "Test error");

  // Test deleteByConnector
  await sqliteRepos.connectorRunRepository.deleteByConnector(connector.id);
  const listed2 = await sqliteRepos.connectorRunRepository.listByConnector(connector.id);
  assert.equal(listed2.length, 0);
});

test("connector mapping repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  // Create a connector first
  const connector = await sqliteRepos.connectorRepository.create({
    name: "test-mapping-connector",
    type: "scim",
    status: "active",
    config: {}
  });

  const mappingData = {
    connectorId: connector.id,
    sourceField: "emails[0].value",
    targetField: "email",
    transform: "trim | lowercase"
  };

  // Test create
  const created = await sqliteRepos.connectorMappingRepository.create(mappingData);
  assert.ok(created.id);
  assert.equal(created.sourceField, mappingData.sourceField);
  assert.equal(created.targetField, mappingData.targetField);

  // Test listByConnector
  const listed = await sqliteRepos.connectorMappingRepository.listByConnector(connector.id);
  assert.ok(listed.length > 0);
  assert.ok(listed.some((m) => m.id === created.id));

  // Test update
  const updated = await sqliteRepos.connectorMappingRepository.update(created.id, {
    transform: "uppercase"
  });
  assert.ok(updated);
  assert.equal(updated.transform, "uppercase");
  assert.equal(updated.sourceField, mappingData.sourceField); // Unchanged

  // Test delete
  await sqliteRepos.connectorMappingRepository.delete(created.id);
  const listed2 = await sqliteRepos.connectorMappingRepository.listByConnector(connector.id);
  assert.equal(listed2.length, 0);
});

test("auth metric repository parity: SQLite vs Prisma", async () => {
  const sqliteConfig = makeConfig({ databaseProvider: "sqlite" });
  const sqliteRepos = await createRepositoryBundle(sqliteConfig);

  const bucket = "2024-01-15";
  const event = "login_success";

  // Test increment
  await sqliteRepos.authMetricRepository.increment(bucket, event, 1);
  await sqliteRepos.authMetricRepository.increment(bucket, event, 2);

  // Test query
  const results = await sqliteRepos.authMetricRepository.query({
    startBucket: bucket,
    endBucket: bucket
  });

  const metric = results.find((r) => r.bucket === bucket && r.event === event);
  assert.ok(metric);
  assert.equal(metric.count, 3); // 1 + 2 increments

  // Test query with event filter
  const filtered = await sqliteRepos.authMetricRepository.query({
    startBucket: bucket,
    endBucket: bucket,
    event: event
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].event, event);
});
