import { AuthenticationError } from "../core/errors.js";
import type { AuditRepository } from "../repositories/contracts.js";
import { EventHookService } from "./event-hook-service.js";
import type { InstanceSettingsService } from "./instance-settings-service.js";

interface LoginFailureRecord {
  count: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  lockedUntil?: Date;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface SessionObservation {
  sessionId: string;
  userId: string;
  clientId: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export class SecurityService {
  private readonly loginFailures = new Map<string, LoginFailureRecord>();
  private readonly endpointCounters = new Map<string, RateLimitRecord>();
  private readonly sessionObservations = new Map<string, SessionObservation>();

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly eventHookService: EventHookService,
    private readonly instanceSettingsService: InstanceSettingsService
  ) {}

  assertLoginAllowed(identifier: string) {
    const key = this.normalizeIdentifier(identifier);
    const record = this.loginFailures.get(key);
    if (!record?.lockedUntil) {
      return;
    }

    if (record.lockedUntil.getTime() <= Date.now()) {
      this.loginFailures.delete(key);
      return;
    }

    throw new AuthenticationError("Account temporarily locked due to repeated failed login attempts");
  }

  async recordLoginFailure(input: { identifier: string; ip?: string; reason?: string }) {
    const key = this.normalizeIdentifier(input.identifier);
    const now = new Date();
    const existing = this.loginFailures.get(key);
    const securitySettings = await this.instanceSettingsService.getSecuritySettings();
    const windowMs = securitySettings.loginFailureWindowMs;
    const maxAttempts = securitySettings.loginLockoutThreshold;
    const lockoutMs = securitySettings.loginLockoutDurationMs;

    const record = existing && now.getTime() - existing.firstAttemptAt.getTime() <= windowMs
      ? {
          ...existing,
          count: existing.count + 1,
          lastAttemptAt: now
        }
      : {
          count: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          lockedUntil: undefined
        };

    let justLocked = false;
    if (record.count >= maxAttempts) {
      record.lockedUntil = new Date(now.getTime() + lockoutMs);
      justLocked = !existing?.lockedUntil || existing.lockedUntil.getTime() <= now.getTime();
    }

    this.loginFailures.set(key, record);

    if (justLocked) {
      await this.auditRepository.log({
        type: "account_lockout",
        actorType: "system",
        ip: input.ip,
        metadata: {
          identifier: key,
          lockedUntil: record.lockedUntil?.toISOString(),
          reason: input.reason ?? "repeated_failed_login"
        }
      });
      await this.eventHookService.emit("auth.lockout.triggered", {
        identifier: key,
        ip: input.ip,
        lockedUntil: record.lockedUntil?.toISOString(),
        reason: input.reason ?? "repeated_failed_login"
      });
    }
  }

  clearLoginFailures(identifier: string) {
    this.loginFailures.delete(this.normalizeIdentifier(identifier));
  }

  async enforceEndpointRateLimit(input: {
    endpointKey: string;
    actorKey: string;
    limit: number;
    windowMs: number;
    ip?: string;
    metadata?: Record<string, unknown>;
  }) {
    const now = Date.now();
    const key = `${input.endpointKey}:${input.actorKey}`;
    const current = this.endpointCounters.get(key);
    const record = !current || current.resetAt <= now
      ? { count: 1, resetAt: now + input.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };

    this.endpointCounters.set(key, record);

    if (record.count <= input.limit) {
      return { blocked: false as const };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    await this.auditRepository.log({
      type: "security_rate_limit_blocked",
      actorType: "system",
      ip: input.ip,
      metadata: {
        endpointKey: input.endpointKey,
        actorKey: input.actorKey,
        retryAfterSeconds,
        ...input.metadata
      }
    });
    await this.eventHookService.emit("security.rate_limit_blocked", {
      endpointKey: input.endpointKey,
      actorKey: input.actorKey,
      retryAfterSeconds,
      ip: input.ip,
      ...input.metadata
    });

    return { blocked: true as const, retryAfterSeconds };
  }

  async observeSessionStart(input: {
    sessionId: string;
    userId: string;
    clientId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const observation: SessionObservation = {
      sessionId: input.sessionId,
      userId: input.userId,
      clientId: input.clientId,
      ip: input.ip,
      userAgent: input.userAgent,
      createdAt: new Date()
    };

    const activeForUser = Array.from(this.sessionObservations.values())
      .filter((item) => item.userId === input.userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const reasons = new Set<string>();
    if (input.ip && activeForUser.some((item) => item.ip && item.ip !== input.ip)) {
      reasons.add("new_ip_for_user");
    }
    if (input.userAgent && activeForUser.some((item) => item.userAgent && item.userAgent !== input.userAgent)) {
      reasons.add("new_user_agent_for_user");
    }

    const concurrencyThreshold = (await this.instanceSettingsService.getSecuritySettings()).sessionAnomalyConcurrencyThreshold;
    if (activeForUser.length >= concurrencyThreshold) {
      reasons.add("high_session_concurrency");
    }

    this.sessionObservations.set(input.sessionId, observation);

    if (reasons.size === 0) {
      return;
    }

    const reasonList = Array.from(reasons);
    await this.auditRepository.log({
      type: "session_anomaly_detected",
      actorId: input.userId,
      actorType: "user",
      clientId: input.clientId,
      ip: input.ip,
      metadata: {
        sessionId: input.sessionId,
        reasons: reasonList,
        userAgent: input.userAgent,
        activeSessionsForUser: activeForUser.length + 1
      }
    });
    await this.eventHookService.emit("auth.session.anomaly_detected", {
      userId: input.userId,
      clientId: input.clientId,
      sessionId: input.sessionId,
      ip: input.ip,
      userAgent: input.userAgent,
      reasons: reasonList,
      activeSessionsForUser: activeForUser.length + 1
    });
  }

  revokeSessionObservation(sessionId: string) {
    this.sessionObservations.delete(sessionId);
  }

  private normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
  }
}