import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../../src/core/config.js";
import { createRepositoryBundle } from "../../src/repositories/factory.js";

const enabled = process.env.NEXUSID_MYSQL_WRITE_READBACK_ACCEPTANCE === "1";

test("MySQL custom repository writes return the committed row and preserve unique assignment races", { skip: !enabled }, async () => {
  assert.equal(process.env.DATABASE_PROVIDER, "mysql");
  assert.match(process.env.NEXUSID_RESOURCE_PROCESS_DB_NAME ?? "", /^nhid_resource_test_[a-f0-9]{12}$/);
  const issuer = process.env.NEXUSID_RESOURCE_PROCESS_ISSUER;
  assert.ok(issuer);
  const login = await fetch(`${issuer}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin", password: "Disposable-Admin-Pass-42", clientId: "sso-admin-ui", scope: ["openid", "profile", "email"] }) });
  if (login.status !== 200) {
    const initialized = await fetch(`${issuer}/api/setup/initialize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Disposable Admin", email: "admin@example.test", username: "admin", password: "Disposable-Admin-Pass-42", databaseProvider: "mysql", externalDatabaseUrl: process.env.DATABASE_URL }) });
    assert.equal(initialized.status, 201, await initialized.text());
  }
  const repositories = await createRepositoryBundle({ ...loadConfig(), databaseProvider: "mysql", externalDatabaseUrl: process.env.DATABASE_URL });
  const suffix = `${process.pid}-${Date.now()}`;
  const app = await repositories.appRepository.create({ name: `mysql-write-${suffix}`, description: "provider write/readback acceptance", resources: [] });
  const admin = (await repositories.userRepository.findByEmail("admin@example.test")) ?? await repositories.userRepository.findByUsername("admin");
  assert.ok(admin, "the HTTP process acceptance initialized its administrator");
  const group = (await repositories.groupRepository.list())[0];
  assert.ok(group, "bootstrap creates a default group");
  try {
    const [userAssignmentA, userAssignmentB] = await Promise.all([
      repositories.userAppAssignmentRepository.assign({ userId: admin.id, appId: app.id }),
      repositories.userAppAssignmentRepository.assign({ userId: admin.id, appId: app.id }),
    ]);
    assert.equal(userAssignmentA.id, userAssignmentB.id, "unique-key race converges on the committed assignment");
    assert.equal((await repositories.userAppAssignmentRepository.listByUser(admin.id)).filter((row) => row.appId === app.id).length, 1);

    const [groupAssignmentA, groupAssignmentB] = await Promise.all([
      repositories.groupAppAssignmentRepository.assign({ groupId: group.id, appId: app.id }),
      repositories.groupAppAssignmentRepository.assign({ groupId: group.id, appId: app.id }),
    ]);
    assert.equal(groupAssignmentA.id, groupAssignmentB.id, "group unique-key race converges on the committed assignment");

    const identity = await repositories.serviceIdentityRepository.create({
      name: `mysql-identity-${suffix}`, status: "active", allowedScopes: ["openid"], allowedAudiences: ["https://resource.example.test"],
    });
    const updatedIdentity = await repositories.serviceIdentityRepository.update(identity.id, { description: "updated" });
    assert.equal(updatedIdentity?.description, "updated");
    // The current credential table's deployed FK targets the service-user row
    // in `users`, so seed it with the acceptance admin rather than the newer
    // `service_identities` record.
    const credential = await repositories.serviceIdentityCredentialRepository.create({ serviceIdentityId: admin.id, clientId: `mysql-client-${suffix}`, clientSecretHash: "test-hash" });
    assert.equal((await repositories.serviceIdentityCredentialRepository.findById(credential.id))?.clientSecretHash, "test-hash");

    const connector = await repositories.connectorRepository.create({ name: `mysql-connector-${suffix}`, type: "custom", status: "active", config: { acceptance: true } });
    assert.deepEqual((await repositories.connectorRepository.findById(connector.id))?.config, { acceptance: true });
    assert.equal((await repositories.connectorRepository.update(connector.id, { status: "inactive" }))?.status, "inactive");
    const run = await repositories.connectorRunRepository.create({ connectorId: connector.id, status: "running", recordsImported: 0, recordsFailed: 0 });
    assert.equal((await repositories.connectorRunRepository.update(run.id, { status: "succeeded", recordsImported: 1 }))?.recordsImported, 1);
    const mapping = await repositories.connectorMappingRepository.create({ connectorId: connector.id, sourceField: "source", targetField: "target" });
    assert.equal((await repositories.connectorMappingRepository.update(mapping.id, { transform: "trim" }))?.transform, "trim");

    const event = await repositories.riskEventRepository.create({ confidence: 10, reason: "suspicious_ip", decision: "allow", metadata: { provider: "mysql" } });
    assert.deepEqual((await repositories.riskEventRepository.list({ limit: 100 })).find((row) => row.id === event.id)?.metadata, { provider: "mysql" });
  } finally {
    await repositories.userAppAssignmentRepository.remove(admin.id, app.id);
    await repositories.groupAppAssignmentRepository.remove(group.id, app.id);
    await repositories.appRepository.delete(app.id);
    await repositories.dispose?.();
  }
});
