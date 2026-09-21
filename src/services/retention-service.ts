import {
  RETENTION_POLICIES,
  findRetentionPolicy,
  type RetentionPolicyKey,
  type RetentionSettings
} from "../domain/retention.js";
import type { RetentionRepository } from "../repositories/contracts.js";

export interface RetentionRunnerOptions {
  /** How often a sweep tick fires. */
  intervalMs: number;
  /** Maximum rows deleted per tick, across the single policy that tick works on. */
  batchSize: number;
  /**
   * Ticks to skip after a policy fails. Keeps a broken table (missing column,
   * locked database) from burning every tick.
   */
  backoffTicks: number;
}

export interface RetentionPolicyStatus {
  key: RetentionPolicyKey;
  label: string;
  description: string;
  basis: "expiry" | "creation";
  days: number;
  minDays: number;
  maxDays: number;
  defaultDays: number;
  /** False when the policy is set to keep rows forever, or the table is unavailable. */
  active: boolean;
  supported: boolean;
  deletedSinceStart: number;
  lastSweptAt?: Date;
  lastError?: string;
}

export interface RetentionStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  batchSize: number;
  startedAt?: Date;
  lastTickAt?: Date;
  nextPolicy?: RetentionPolicyKey;
  deletedSinceStart: number;
  policies: RetentionPolicyStatus[];
}

interface PolicyState {
  deletedSinceStart: number;
  lastSweptAt?: Date;
  lastError?: string;
  skipTicks: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const readEnvNumber = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
};

export const resolveRetentionRunnerOptions = (): RetentionRunnerOptions => ({
  intervalMs: readEnvNumber("RETENTION_SWEEP_INTERVAL_MS", 60_000, 1_000, 24 * 60 * 60 * 1000),
  batchSize: readEnvNumber("RETENTION_SWEEP_BATCH_SIZE", 200, 1, 10_000),
  backoffTicks: readEnvNumber("RETENTION_SWEEP_BACKOFF_TICKS", 10, 0, 1_000)
});

/**
 * Deletes aged rows a little at a time.
 *
 * The runner is deliberately passive: one tick touches one policy and deletes
 * at most `batchSize` rows, so no sweep ever holds a long transaction or a
 * table-wide lock. A backlog drains over many ticks rather than in one pass,
 * which is the point — an instance that has never been swept should not stall
 * on its first run.
 */
export class RetentionService {
  private readonly state = new Map<RetentionPolicyKey, PolicyState>();
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private cursor = 0;
  private startedAt?: Date;
  private lastTickAt?: Date;
  private deletedSinceStart = 0;

  constructor(
    private readonly repository: RetentionRepository,
    private readonly readSettings: () => Promise<RetentionSettings>,
    private readonly options: RetentionRunnerOptions = resolveRetentionRunnerOptions(),
    private readonly onError: (message: string, error: unknown) => void = (message, error) => {
      console.warn(`[retention] ${message}`, error);
    }
  ) {}

  start() {
    if (this.timer) {
      return;
    }

    this.startedAt = new Date();
    // The first tick is one interval out so a sweep never competes with startup.
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private stateFor(key: RetentionPolicyKey): PolicyState {
    const existing = this.state.get(key);
    if (existing) {
      return existing;
    }

    const created: PolicyState = { deletedSinceStart: 0, skipTicks: 0 };
    this.state.set(key, created);
    return created;
  }

  /**
   * One unit of work: advance to the next policy that has something to do and
   * delete a single batch from it. Returns what it deleted so callers (and
   * tests) can drive the sweep manually.
   */
  async tick(): Promise<{ policy?: RetentionPolicyKey; deleted: number }> {
    if (this.ticking) {
      return { deleted: 0 };
    }

    this.ticking = true;
    try {
      this.lastTickAt = new Date();

      let settings: RetentionSettings;
      try {
        settings = await this.readSettings();
      } catch (error) {
        this.onError("failed to read retention settings; skipping tick", error);
        return { deleted: 0 };
      }

      if (!settings.enabled) {
        return { deleted: 0 };
      }

      const supported = new Set(this.repository.supportedPolicies());
      const candidates = RETENTION_POLICIES.filter(
        (policy) => supported.has(policy.key) && (settings.policies[policy.key] ?? 0) > 0
      );

      if (candidates.length === 0) {
        return { deleted: 0 };
      }

      // Round-robin so no single table can starve the others, and so a tick is
      // bounded by one batch no matter how many policies are configured.
      for (let attempt = 0; attempt < candidates.length; attempt += 1) {
        const policy = candidates[this.cursor % candidates.length];
        this.cursor = (this.cursor + 1) % candidates.length;

        const state = this.stateFor(policy.key);
        if (state.skipTicks > 0) {
          state.skipTicks -= 1;
          continue;
        }

        const days = settings.policies[policy.key];
        const cutoff = new Date(Date.now() - days * DAY_MS);

        try {
          const ids = await this.repository.collectExpired(policy.key, cutoff, this.options.batchSize);
          if (ids.length === 0) {
            state.lastError = undefined;
            continue;
          }

          const deleted = await this.repository.deleteByIds(policy.key, ids);
          state.deletedSinceStart += deleted;
          state.lastSweptAt = new Date();
          state.lastError = undefined;
          this.deletedSinceStart += deleted;

          if (ids.length === this.options.batchSize) {
            // More to do here. Come back to this policy on the next tick
            // instead of advancing, so a backlog drains steadily.
            this.cursor = (this.cursor + candidates.length - 1) % candidates.length;
          }

          return { policy: policy.key, deleted };
        } catch (error) {
          state.lastError = error instanceof Error ? error.message : String(error);
          state.skipTicks = this.options.backoffTicks;
          this.onError(`sweep failed for ${policy.key}; backing off`, error);
          return { policy: policy.key, deleted: 0 };
        }
      }

      return { deleted: 0 };
    } finally {
      this.ticking = false;
    }
  }

  async getStatus(): Promise<RetentionStatus> {
    const settings = await this.readSettings();
    const supported = new Set(this.repository.supportedPolicies());

    const policies: RetentionPolicyStatus[] = RETENTION_POLICIES.map((policy) => {
      const state = this.state.get(policy.key);
      const days = settings.policies[policy.key] ?? policy.defaultDays;

      return {
        key: policy.key,
        label: policy.label,
        description: policy.description,
        basis: policy.basis,
        days,
        minDays: policy.minDays,
        maxDays: policy.maxDays,
        defaultDays: policy.defaultDays,
        supported: supported.has(policy.key),
        active: settings.enabled && days > 0 && supported.has(policy.key),
        deletedSinceStart: state?.deletedSinceStart ?? 0,
        lastSweptAt: state?.lastSweptAt,
        lastError: state?.lastError
      };
    });

    const activeKeys = policies.filter((policy) => policy.active).map((policy) => policy.key);

    return {
      enabled: settings.enabled,
      running: Boolean(this.timer),
      intervalMs: this.options.intervalMs,
      batchSize: this.options.batchSize,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      nextPolicy: activeKeys.length > 0 ? activeKeys[this.cursor % activeKeys.length] : undefined,
      deletedSinceStart: this.deletedSinceStart,
      policies
    };
  }

  /**
   * Rows currently past their retention window, per policy. Read-only, and
   * intentionally separate from the sweep so the console can show a backlog
   * without triggering deletion.
   */
  async getBacklog(): Promise<Array<{ key: RetentionPolicyKey; expired: number }>> {
    const settings = await this.readSettings();
    const supported = new Set(this.repository.supportedPolicies());
    const results: Array<{ key: RetentionPolicyKey; expired: number }> = [];

    for (const policy of RETENTION_POLICIES) {
      const days = settings.policies[policy.key] ?? 0;
      if (!supported.has(policy.key) || days <= 0) {
        results.push({ key: policy.key, expired: 0 });
        continue;
      }

      try {
        const cutoff = new Date(Date.now() - days * DAY_MS);
        results.push({ key: policy.key, expired: await this.repository.countExpired(policy.key, cutoff) });
      } catch {
        results.push({ key: policy.key, expired: 0 });
      }
    }

    return results;
  }

  describePolicy(key: RetentionPolicyKey) {
    return findRetentionPolicy(key);
  }
}
