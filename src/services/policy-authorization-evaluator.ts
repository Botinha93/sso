import type { PolicyDecisionStrategy, PolicyEffect } from "../domain/models.js";

export type AuthorizationAssignmentConfig = Record<string, unknown>;

export type AuthorizationDecision = {
  key: string;
  allow: boolean;
  applied: boolean;
};

const wildcardToRegex = (pattern: string) => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveDecisionStrategy = (value: unknown): PolicyDecisionStrategy | undefined => {
  if (value === "deny_overrides" || value === "allow_overrides" || value === "first_applicable") {
    return value;
  }
  return undefined;
};

export const resolvePolicyEffect = (
  config: AuthorizationAssignmentConfig,
  fallbackEffect?: PolicyEffect
): PolicyEffect => {
  if (config.effect === "allow" || config.effect === "deny") {
    return config.effect;
  }
  return fallbackEffect === "allow" ? "allow" : "deny";
};

export const resolvePolicyPriority = (
  config: AuthorizationAssignmentConfig,
  fallbackPriority = 0
): number => {
  const raw = config.priority ?? fallbackPriority;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return 0;
};

export const resolvePolicyDecisionStrategy = (
  strategy: PolicyDecisionStrategy | undefined,
  fallback?: PolicyDecisionStrategy
): PolicyDecisionStrategy => {
  const resolved = resolveDecisionStrategy(strategy) ?? resolveDecisionStrategy(fallback);
  if (resolved) {
    return resolved;
  }
  return "deny_overrides";
};

export const matchesAuthorizationRequest = (
  config: AuthorizationAssignmentConfig,
  resource: string,
  action: string,
  fallback?: { resourcePattern?: string; actionPattern?: string }
): { matches: boolean; reason?: string } => {
  const resourcePattern = readString(config.resourcePattern ?? config.resource_pattern ?? fallback?.resourcePattern);
  if (resourcePattern && !wildcardToRegex(resourcePattern).test(resource)) {
    return {
      matches: false,
      reason: `Skipped by resourcePattern: ${resourcePattern}`
    };
  }

  const actionPattern = readString(config.actionPattern ?? config.action_pattern ?? fallback?.actionPattern);
  if (actionPattern && !wildcardToRegex(actionPattern).test(action)) {
    return {
      matches: false,
      reason: `Skipped by actionPattern: ${actionPattern}`
    };
  }

  return { matches: true };
};

export const summarizeAuthorizationDecision = (
  strategy: PolicyDecisionStrategy,
  decisions: AuthorizationDecision[]
): { allow: boolean; deniedBy: string[] } => {
  const applied = decisions.filter((decision) => decision.applied);
  const deniedApplied = applied.filter((decision) => !decision.allow);
  const allowedApplied = applied.filter((decision) => decision.allow);

  let allow = true;
  if (strategy === "deny_overrides") {
    allow = deniedApplied.length === 0;
  } else if (strategy === "allow_overrides") {
    allow = allowedApplied.length > 0 || deniedApplied.length === 0;
  } else {
    const firstApplied = applied[0];
    allow = firstApplied ? firstApplied.allow : true;
  }

  const deniedBy = allow
    ? []
    : strategy === "first_applicable"
      ? deniedApplied.slice(0, 1).map((decision) => decision.key)
      : deniedApplied.map((decision) => decision.key);

  return { allow, deniedBy };
};
