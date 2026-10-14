import test from "node:test";
import assert from "node:assert/strict";
import { SecurityService } from "../../src/services/security-service.js";

const createNoopDeps = () => {
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
      loginLockoutThreshold: 5,
      loginLockoutDurationMs: 15 * 60_000,
      sessionAnomalyConcurrencyThreshold: 5
    })
  } as unknown as ConstructorParameters<typeof SecurityService>[2];

  return {
    auditRepository,
    eventHookService,
    instanceSettingsService,
    auditLogs,
    hookEmissions
  };
};

test("endpoint rate limit blocks the noisy client once over the limit", async () => {
  const deps = createNoopDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  const noisyKey = "client:noisy-app|ip:10.0.0.1";

  for (let i = 0; i < 5; i += 1) {
    const result = await service.enforceEndpointRateLimit({
      endpointKey: "auth_recovery_request",
      actorKey: noisyKey,
      limit: 5,
      windowMs: 60_000
    });
    assert.equal(result.blocked, false);
  }

  const blocked = await service.enforceEndpointRateLimit({
    endpointKey: "auth_recovery_request",
    actorKey: noisyKey,
    limit: 5,
    windowMs: 60_000
  });

  assert.equal(blocked.blocked, true);
});

test("endpoint rate limit isolates buckets per client even from the same IP", async () => {
  const deps = createNoopDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  const sharedIp = "10.0.0.1";
  const noisyKey = `client:noisy-app|ip:${sharedIp}`;
  const wellBehavedKey = `client:well-behaved-app|ip:${sharedIp}`;

  // Exhaust the noisy client's quota.
  for (let i = 0; i < 6; i += 1) {
    await service.enforceEndpointRateLimit({
      endpointKey: "auth_recovery_request",
      actorKey: noisyKey,
      limit: 5,
      windowMs: 60_000
    });
  }

  const noisyBlocked = await service.enforceEndpointRateLimit({
    endpointKey: "auth_recovery_request",
    actorKey: noisyKey,
    limit: 5,
    windowMs: 60_000
  });
  assert.equal(noisyBlocked.blocked, true);

  // A different client sharing the same IP must remain unaffected.
  const otherClient = await service.enforceEndpointRateLimit({
    endpointKey: "auth_recovery_request",
    actorKey: wellBehavedKey,
    limit: 5,
    windowMs: 60_000
  });
  assert.equal(otherClient.blocked, false);
});

test("endpoint rate limit isolates buckets per endpoint within the same client", async () => {
  const deps = createNoopDeps();
  const service = new SecurityService(deps.auditRepository, deps.eventHookService, deps.instanceSettingsService);

  const actor = "client:app|ip:10.0.0.1";

  for (let i = 0; i < 6; i += 1) {
    await service.enforceEndpointRateLimit({
      endpointKey: "auth_recovery_request",
      actorKey: actor,
      limit: 5,
      windowMs: 60_000
    });
  }

  const recoveryBlocked = await service.enforceEndpointRateLimit({
    endpointKey: "auth_recovery_request",
    actorKey: actor,
    limit: 5,
    windowMs: 60_000
  });
  assert.equal(recoveryBlocked.blocked, true);

  const loginResult = await service.enforceEndpointRateLimit({
    endpointKey: "auth_login",
    actorKey: actor,
    limit: 10,
    windowMs: 60_000
  });
  assert.equal(loginResult.blocked, false);
});
