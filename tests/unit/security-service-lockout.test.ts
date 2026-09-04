import test from "node:test";
import assert from "node:assert/strict";
import { SecurityService } from "../../src/services/security-service.js";
import { AccountLockedError } from "../../src/core/errors.js";

const createDeps = () => {
  const auditLogs: Array<Record<string, unknown>> = [];
  const hookEmissions: Array<{ event: string; payload: Record<string, unknown> }> = [];

  const auditRepository = {
    log: async (entry: Record<string, unknown>) => {
      auditLogs.push(entry);
    }
  } as unknown as ConstructorParameters<typeof SecurityService>[0];

  const eventHookService = {
    emit: async (event: string, payload: Record<string, unknown>) => {
      hookEmissions.push({ event, payload });
    }
  } as unknown as ConstructorParameters<typeof SecurityService>[1];

  const instanceSettingsService = {
    getSecuritySettings: async () => ({
      loginFailureWindowMs: 15 * 60_000,
      loginLockoutThreshold: 3,
      loginLockoutDurationMs: 15 * 60_000,
      sessionAnomalyConcurrencyThreshold: 5
    })
  } as unknown as ConstructorParameters<typeof SecurityService>[2];

  return { auditRepository, eventHookService, instanceSettingsService, auditLogs, hookEmissions };
};

const userId = "user-davi";
const email = "davi@jcdecor.com.br";
const username = "davi.ribeiro";

test("lockout reached through the email also blocks the username of the same account", async () => {
  const deps = createDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await service.recordLoginFailure({ identifier: email, userIds: [userId] });
  }

  assert.throws(() => service.assertLoginAllowed(email, [userId]), (error: unknown) => {
    assert.ok(error instanceof AccountLockedError);
    assert.match(error.message, /temporarily locked/i);
    assert.match(error.message, /try again in 15 minutes/i);
    assert.ok(error.retryAfterSeconds > 14 * 60 && error.retryAfterSeconds <= 15 * 60);
    return true;
  });
  assert.throws(() => service.assertLoginAllowed(username, [userId]), AccountLockedError);
  assert.throws(() => service.assertLoginAllowed("DAVI.RIBEIRO", [userId]), AccountLockedError);

  const lockoutEvents = deps.hookEmissions.filter((entry) => entry.event === "auth.lockout.triggered");
  assert.equal(lockoutEvents.length, 1);
  assert.equal(lockoutEvents[0]?.payload.identifier, email);
  assert.deepEqual(lockoutEvents[0]?.payload.userIds, [userId]);
  assert.equal(deps.auditLogs.filter((entry) => entry.type === "account_lockout").length, 1);
});

test("failures split across email and username add up for the same account", async () => {
  const deps = createDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  await service.recordLoginFailure({ identifier: email, userIds: [userId] });
  await service.recordLoginFailure({ identifier: username, userIds: [userId] });
  assert.doesNotThrow(() => service.assertLoginAllowed(email, [userId]));
  assert.doesNotThrow(() => service.assertLoginAllowed(username, [userId]));

  await service.recordLoginFailure({ identifier: email, userIds: [userId] });
  assert.throws(() => service.assertLoginAllowed(username, [userId]));
  assert.throws(() => service.assertLoginAllowed(email, [userId]));
});

test("further failures while locked do not emit duplicate lockout events", async () => {
  const deps = createDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await service.recordLoginFailure({ identifier: email, userIds: [userId] });
  }
  await service.recordLoginFailure({ identifier: username, userIds: [userId] });

  assert.equal(deps.hookEmissions.filter((entry) => entry.event === "auth.lockout.triggered").length, 1);
});

test("clearing failures for one identifier unlocks the whole account", async () => {
  const deps = createDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await service.recordLoginFailure({ identifier: email, userIds: [userId] });
  }
  assert.throws(() => service.assertLoginAllowed(username, [userId]));

  service.clearLoginFailures(username, [userId]);
  assert.doesNotThrow(() => service.assertLoginAllowed(email, [userId]));
  assert.doesNotThrow(() => service.assertLoginAllowed(username, [userId]));
});

test("unknown identifiers still lock on their own without affecting real accounts", async () => {
  const deps = createDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await service.recordLoginFailure({ identifier: "nobody@example.com" });
  }

  assert.throws(() => service.assertLoginAllowed("nobody@example.com"));
  assert.doesNotThrow(() => service.assertLoginAllowed(email, [userId]));
});
