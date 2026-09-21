import test from "node:test";
import assert from "node:assert/strict";
import {
  RETENTION_POLICIES,
  defaultRetentionSettings,
  normalizeRetentionSettings,
  type RetentionPolicyKey,
  type RetentionSettings
} from "../../src/domain/retention.js";
import type { RetentionRepository } from "../../src/repositories/contracts.js";
import { RetentionService, type RetentionRunnerOptions } from "../../src/services/retention-service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface FakeRow {
  id: string;
  timestamp: Date;
}

class FakeRetentionRepository implements RetentionRepository {
  readonly rows = new Map<RetentionPolicyKey, FakeRow[]>();
  readonly failFor = new Set<RetentionPolicyKey>();
  collectCalls = 0;

  constructor(private readonly unsupported = new Set<RetentionPolicyKey>()) {}

  seed(policy: RetentionPolicyKey, count: number, ageDays: number) {
    const existing = this.rows.get(policy) ?? [];
    for (let index = 0; index < count; index += 1) {
      existing.push({
        id: `${policy}-${existing.length + index}`,
        timestamp: new Date(Date.now() - ageDays * DAY_MS)
      });
    }
    this.rows.set(policy, existing);
  }

  supportedPolicies(): RetentionPolicyKey[] {
    return RETENTION_POLICIES.map((policy) => policy.key).filter((key) => !this.unsupported.has(key));
  }

  collectExpired(policy: RetentionPolicyKey, cutoff: Date, limit: number): string[] {
    this.collectCalls += 1;
    if (this.failFor.has(policy)) {
      throw new Error(`boom: ${policy}`);
    }

    return (this.rows.get(policy) ?? [])
      .filter((row) => row.timestamp.getTime() < cutoff.getTime())
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
      .slice(0, limit)
      .map((row) => row.id);
  }

  deleteByIds(policy: RetentionPolicyKey, ids: string[]): number {
    const remaining = (this.rows.get(policy) ?? []).filter((row) => !ids.includes(row.id));
    const deleted = (this.rows.get(policy) ?? []).length - remaining.length;
    this.rows.set(policy, remaining);
    return deleted;
  }

  countExpired(policy: RetentionPolicyKey, cutoff: Date): number {
    return (this.rows.get(policy) ?? []).filter((row) => row.timestamp.getTime() < cutoff.getTime()).length;
  }
}

const settingsWith = (overrides: Partial<Record<RetentionPolicyKey, number>>, enabled = true): RetentionSettings => {
  const base = defaultRetentionSettings();
  return {
    enabled,
    policies: { ...base.policies, ...overrides }
  };
};

/** Every policy off except the listed ones, so a test drives exactly what it means to. */
const onlyPolicies = (overrides: Partial<Record<RetentionPolicyKey, number>>, enabled = true): RetentionSettings => {
  const policies = Object.fromEntries(RETENTION_POLICIES.map((policy) => [policy.key, 0])) as Record<RetentionPolicyKey, number>;
  return { enabled, policies: { ...policies, ...overrides } };
};

const makeService = (
  repository: RetentionRepository,
  settings: RetentionSettings,
  options: Partial<RetentionRunnerOptions> = {}
) =>
  new RetentionService(
    repository,
    async () => settings,
    { intervalMs: 60_000, batchSize: 10, backoffTicks: 2, ...options },
    () => undefined
  );

test("a tick deletes only rows past the retention window", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("auditEvents", 3, 400);
  repository.seed("auditEvents", 5, 10);

  const service = makeService(repository, onlyPolicies({ auditEvents: 365 }));
  const result = await service.tick();

  assert.equal(result.policy, "auditEvents");
  assert.equal(result.deleted, 3);
  assert.equal(repository.rows.get("auditEvents")?.length, 5);
});

test("a tick never deletes more than the batch size", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("policyDecisionLogs", 25, 400);

  const service = makeService(repository, onlyPolicies({ policyDecisionLogs: 90 }), { batchSize: 10 });

  assert.equal((await service.tick()).deleted, 10);
  assert.equal(repository.rows.get("policyDecisionLogs")?.length, 15);

  assert.equal((await service.tick()).deleted, 10);
  assert.equal((await service.tick()).deleted, 5);
  assert.equal(repository.rows.get("policyDecisionLogs")?.length, 0);

  // Nothing left: the sweep goes quiet rather than spinning.
  assert.equal((await service.tick()).deleted, 0);
});

test("zero days keeps rows forever", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("auditEvents", 10, 5_000);

  const service = makeService(repository, onlyPolicies({ auditEvents: 0 }));
  const result = await service.tick();

  assert.equal(result.deleted, 0);
  assert.equal(repository.rows.get("auditEvents")?.length, 10);
});

test("disabling retention stops all deletion", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("accessTokens", 10, 400);

  const service = makeService(repository, settingsWith({ accessTokens: 30 }, false));

  assert.equal((await service.tick()).deleted, 0);
  assert.equal(repository.rows.get("accessTokens")?.length, 10);
});

test("a policy with a backlog keeps the next tick rather than starving the others", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("policyDecisionLogs", 100, 400);
  repository.seed("riskEvents", 3, 400);

  const service = makeService(repository, onlyPolicies({ policyDecisionLogs: 90, riskEvents: 90 }), { batchSize: 10 });

  // Full batch on the first policy, so the runner stays with it.
  assert.equal((await service.tick()).policy, "policyDecisionLogs");
  assert.equal((await service.tick()).policy, "policyDecisionLogs");

  // Drain it, then the second policy gets its turn.
  for (let index = 0; index < 8; index += 1) {
    await service.tick();
  }
  assert.equal(repository.rows.get("policyDecisionLogs")?.length, 0);

  await service.tick();
  assert.equal(repository.rows.get("riskEvents")?.length, 0);
});

test("a failing policy backs off and does not block the others", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("auditEvents", 5, 400);
  repository.seed("riskEvents", 5, 400);
  repository.failFor.add("auditEvents");

  const service = makeService(repository, onlyPolicies({ auditEvents: 365, riskEvents: 90 }), { backoffTicks: 2 });

  // First tick hits the broken policy and records the failure.
  const failed = await service.tick();
  assert.equal(failed.policy, "auditEvents");
  assert.equal(failed.deleted, 0);

  // The healthy policy is still swept on the following tick.
  await service.tick();
  assert.equal(repository.rows.get("riskEvents")?.length, 0);

  const status = await service.getStatus();
  const auditStatus = status.policies.find((policy) => policy.key === "auditEvents");
  assert.match(String(auditStatus?.lastError), /boom/);
});

test("unsupported policies are skipped instead of erroring", async () => {
  const repository = new FakeRetentionRepository(new Set<RetentionPolicyKey>(["riskEvents"]));
  repository.seed("riskEvents", 10, 400);

  const service = makeService(repository, onlyPolicies({ riskEvents: 90 }));

  assert.equal((await service.tick()).deleted, 0);
  assert.equal(repository.rows.get("riskEvents")?.length, 10);

  const status = await service.getStatus();
  assert.equal(status.policies.find((policy) => policy.key === "riskEvents")?.supported, false);
});

test("status reports configured windows and what was deleted", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("eventNotifications", 4, 400);

  const service = makeService(repository, onlyPolicies({ eventNotifications: 30 }));
  await service.tick();

  const status = await service.getStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.deletedSinceStart, 4);
  assert.equal(status.policies.length, RETENTION_POLICIES.length);

  const notifications = status.policies.find((policy) => policy.key === "eventNotifications");
  assert.equal(notifications?.days, 30);
  assert.equal(notifications?.active, true);
  assert.equal(notifications?.deletedSinceStart, 4);
  assert.ok(notifications?.lastSweptAt instanceof Date);
});

test("backlog counts rows past the window without deleting them", async () => {
  const repository = new FakeRetentionRepository();
  repository.seed("auditEvents", 7, 400);

  const service = makeService(repository, onlyPolicies({ auditEvents: 365 }));
  const backlog = await service.getBacklog();

  assert.equal(backlog.find((entry) => entry.key === "auditEvents")?.expired, 7);
  assert.equal(repository.rows.get("auditEvents")?.length, 7);
});

test("normalizeRetentionSettings fills gaps, drops unknown keys and clamps to the floor", () => {
  const normalized = normalizeRetentionSettings({
    enabled: false,
    policies: { auditEvents: 5, nonsense: 42, riskEvents: 120 }
  });

  assert.equal(normalized.enabled, false);
  // Below the audit floor, so raised to it rather than honoured.
  assert.equal(normalized.policies.auditEvents, 90);
  assert.equal(normalized.policies.riskEvents, 120);
  // Unspecified policies fall back to their defaults.
  assert.equal(normalized.policies.accessTokens, 30);
  assert.equal((normalized.policies as Record<string, number>).nonsense, undefined);
});

test("normalizeRetentionSettings treats zero and negatives as keep-forever", () => {
  const normalized = normalizeRetentionSettings({ policies: { auditEvents: 0, riskEvents: -5 } });

  assert.equal(normalized.policies.auditEvents, 0);
  assert.equal(normalized.policies.riskEvents, 0);
});

test("every catalog policy has a sane default within its own bounds", () => {
  for (const policy of RETENTION_POLICIES) {
    assert.ok(policy.minDays >= 1, `${policy.key} floor must be at least a day`);
    assert.ok(policy.defaultDays >= policy.minDays, `${policy.key} default is below its own floor`);
    assert.ok(policy.defaultDays <= policy.maxDays, `${policy.key} default exceeds its own ceiling`);
  }
});
