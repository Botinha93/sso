/**
 * Data retention catalog.
 *
 * Every table in this platform that accumulates a row per request, per login or
 * per background job is listed here exactly once. A policy says how many days a
 * row is kept; the retention runner sweeps them out in small batches over time.
 *
 * `days: 0` means "keep forever" and is the escape hatch for deployments with a
 * compliance floor on audit-grade tables.
 */

export type RetentionPolicyKey =
  | "authorizationCodes"
  | "accessTokens"
  | "refreshTokens"
  | "sessions"
  | "federationTransactions"
  | "elevationRequests"
  | "elevationSessions"
  | "auditEvents"
  | "samlAssertionAudits"
  | "policyDecisionLogs"
  | "riskEvents"
  | "eventNotifications"
  | "connectorRuns"
  | "provisioningJobs"
  | "deprovisioningQueue";

/**
 * `expiry` policies age a row from the moment it stopped being usable, so the
 * configured window reads as "keep N days past expiry". `creation` policies age
 * from when the row was written, which is what an operator means by "keep 90
 * days of logs".
 */
export type RetentionBasis = "expiry" | "creation";

export interface RetentionPolicyDefinition {
  key: RetentionPolicyKey;
  label: string;
  description: string;
  basis: RetentionBasis;
  defaultDays: number;
  /**
   * Floor enforced on admin input. Credentials may be swept aggressively;
   * audit-grade tables keep a longer floor so a stray zero-adjacent value
   * cannot quietly discard a compliance record.
   */
  minDays: number;
  maxDays: number;
}

const definition = (
  key: RetentionPolicyKey,
  label: string,
  description: string,
  basis: RetentionBasis,
  defaultDays: number,
  minDays: number
): RetentionPolicyDefinition => ({ key, label, description, basis, defaultDays, minDays, maxDays: 3650 });

export const RETENTION_POLICIES: readonly RetentionPolicyDefinition[] = Object.freeze([
  definition(
    "authorizationCodes",
    "Authorization codes",
    "Single-use OAuth codes. Consumed codes are deleted immediately; this sweeps codes that were issued and never redeemed.",
    "expiry",
    7,
    1
  ),
  definition(
    "accessTokens",
    "Access token records",
    "One row per issued access token, used for revocation checks. Expired tokens can no longer be presented.",
    "expiry",
    30,
    1
  ),
  definition(
    "refreshTokens",
    "Refresh token records",
    "One row per issued refresh token plus one per rotation. Expired rows cannot be redeemed and are no longer needed for reuse detection.",
    "expiry",
    30,
    7
  ),
  definition(
    "sessions",
    "Sessions",
    "Login sessions. Kept past expiry so recent session history stays visible in the console.",
    "expiry",
    30,
    1
  ),
  definition(
    "federationTransactions",
    "Federation transactions",
    "Short-lived state for in-flight external identity provider logins.",
    "expiry",
    7,
    1
  ),
  definition(
    "elevationRequests",
    "Elevation requests",
    "Just-in-time privilege elevation requests and their approval trail.",
    "creation",
    365,
    30
  ),
  definition(
    "elevationSessions",
    "Elevation sessions",
    "Activated privilege elevation windows.",
    "expiry",
    365,
    30
  ),
  definition(
    "auditEvents",
    "Audit events",
    "The primary audit trail. Raise this to match your retention obligation, or set 0 to keep it forever.",
    "creation",
    365,
    90
  ),
  definition(
    "samlAssertionAudits",
    "SAML assertion audits",
    "One row per issued SAML assertion.",
    "creation",
    365,
    30
  ),
  definition(
    "policyDecisionLogs",
    "Policy decision logs",
    "One row per authorization decision. The fastest-growing table on a busy instance.",
    "creation",
    90,
    7
  ),
  definition(
    "riskEvents",
    "Risk events",
    "Risk engine evaluations behind adaptive authentication decisions.",
    "creation",
    90,
    7
  ),
  definition(
    "eventNotifications",
    "Event notification deliveries",
    "Webhook delivery attempts, including the full request payload and response body.",
    "creation",
    30,
    7
  ),
  definition(
    "connectorRuns",
    "Connector runs",
    "Directory connector sync run history.",
    "creation",
    90,
    7
  ),
  definition(
    "provisioningJobs",
    "Provisioning jobs",
    "Completed provisioning job records.",
    "creation",
    90,
    7
  ),
  definition(
    "deprovisioningQueue",
    "Deprovisioning queue",
    "Processed deprovisioning queue entries.",
    "creation",
    90,
    7
  )
]);

export const RETENTION_POLICY_KEYS: readonly RetentionPolicyKey[] = Object.freeze(
  RETENTION_POLICIES.map((policy) => policy.key)
);

const POLICY_BY_KEY = new Map<RetentionPolicyKey, RetentionPolicyDefinition>(
  RETENTION_POLICIES.map((policy) => [policy.key, policy])
);

export const findRetentionPolicy = (key: RetentionPolicyKey) => POLICY_BY_KEY.get(key);

export const isRetentionPolicyKey = (value: unknown): value is RetentionPolicyKey =>
  typeof value === "string" && POLICY_BY_KEY.has(value as RetentionPolicyKey);

export type RetentionPolicyDays = Record<RetentionPolicyKey, number>;

export interface RetentionSettings {
  /** Master switch. When false the runner stays idle and nothing is deleted. */
  enabled: boolean;
  /** Days to keep per policy. 0 keeps rows forever. */
  policies: RetentionPolicyDays;
}

export const defaultRetentionPolicyDays = (): RetentionPolicyDays =>
  Object.fromEntries(RETENTION_POLICIES.map((policy) => [policy.key, policy.defaultDays])) as RetentionPolicyDays;

export const defaultRetentionSettings = (): RetentionSettings => ({
  enabled: true,
  policies: defaultRetentionPolicyDays()
});

/**
 * Coerce whatever was persisted (or submitted) into a complete, in-range
 * settings object. Unknown keys are dropped and missing keys fall back to the
 * policy default, so adding a policy to the catalog does not require a data
 * migration.
 */
export const normalizeRetentionSettings = (input: unknown): RetentionSettings => {
  const defaults = defaultRetentionSettings();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const source = input as Partial<RetentionSettings>;
  const rawPolicies = (source.policies && typeof source.policies === "object" ? source.policies : {}) as Record<string, unknown>;
  const policies = { ...defaults.policies };

  for (const policy of RETENTION_POLICIES) {
    const raw = rawPolicies[policy.key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }

    const days = Math.trunc(raw);
    if (days <= 0) {
      policies[policy.key] = 0;
      continue;
    }

    policies[policy.key] = Math.min(policy.maxDays, Math.max(policy.minDays, days));
  }

  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaults.enabled,
    policies
  };
};

/**
 * What an admin console or API client may send. Every field is optional so a
 * caller can adjust one window without restating the rest.
 */
export interface RetentionSettingsInput {
  enabled?: boolean;
  policies?: Partial<Record<RetentionPolicyKey, number>>;
}
