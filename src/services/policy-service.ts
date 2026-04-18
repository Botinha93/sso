import { nanoid } from "nanoid";
import { runInNewContext } from "node:vm";
import { AuthenticationError, ValidationError } from "../core/errors.js";
import type {
  PolicyAssignmentRepository,
  PolicyDefinitionRepository,
  UserGroupAssignmentRepository
} from "../repositories/contracts.js";
import type { AuthenticationStageType, PolicyDefinition, PolicyScopeType, User } from "../domain/models.js";

const BUILT_IN_POLICIES = [
  {
    key: "password_requirements",
    name: "Password requirements",
    description: "Enforce password complexity and minimum length"
  },
  {
    key: "password_expiration_days",
    name: "Password expiration",
    description: "Require users to change passwords after N days"
  },
  {
    key: "unique_email",
    name: "Unique email",
    description: "Prevent duplicated user email addresses"
  },
  {
    key: "two_factor_required",
    name: "2FA required",
    description: "Require users to have MFA enabled to sign in"
  },
  {
    key: "brute_force_lockout",
    name: "Brute-force lockout",
    description: "Throttle repeated failed login attempts and apply temporary lockouts"
  },
  {
    key: "new_device_verification",
    name: "New device verification",
    description: "Require additional verification when sign-in context is unfamiliar"
  },
  {
    key: "impossible_travel_risk",
    name: "Impossible travel risk",
    description: "Flag impossible geo-velocity jumps and trigger challenge/deny decisions"
  },
  {
    key: "restricted_login_hours",
    name: "Restricted login hours",
    description: "Limit login attempts to approved time windows and days"
  },
  {
    key: "ip_allowlist",
    name: "IP allowlist",
    description: "Restrict authentication to allowed network ranges"
  },
  {
    key: "session_concurrency_limit",
    name: "Session concurrency limit",
    description: "Control how many active sessions a user may keep simultaneously"
  },
  {
    key: "reauth_for_sensitive_actions",
    name: "Re-auth for sensitive actions",
    description: "Require recent authentication for high-risk prompts and operations"
  },
  {
    key: "tenant_isolation_guard",
    name: "Tenant isolation guard",
    description: "Prevent cross-tenant authorization context leakage"
  },
  {
    key: "service_user_constraints",
    name: "Service user constraints",
    description: "Constrain machine/service users to non-interactive patterns"
  },
  {
    key: "token_hardening",
    name: "Token hardening",
    description: "Apply stricter scope and token lifetime controls for risky contexts"
  },
  {
    key: "consent_freshness",
    name: "Consent freshness",
    description: "Force consent renewal on age threshold or scope expansion"
  },
  {
    key: "attribute_completeness",
    name: "Attribute completeness",
    description: "Require identity profile fields before completing selected stages"
  }
] as const;

const DEFAULT_POLICY_STAGE_BINDINGS: Partial<Record<string, AuthenticationStageType[]>> = {
  password_requirements: ["user_write"],
  password_expiration_days: ["password"],
  unique_email: ["user_write"],
  two_factor_required: ["mfa_totp"],
  brute_force_lockout: ["password"],
  new_device_verification: ["user_login"],
  impossible_travel_risk: ["risk_check"],
  restricted_login_hours: ["user_login"],
  ip_allowlist: ["user_login"],
  session_concurrency_limit: ["user_login"],
  reauth_for_sensitive_actions: ["prompt"],
  tenant_isolation_guard: ["risk_check"],
  service_user_constraints: ["user_login"],
  token_hardening: ["prompt"],
  consent_freshness: ["consent"],
  attribute_completeness: ["identification", "user_write"]
};

const DEFAULT_POLICY_JAVASCRIPT: Partial<Record<string, string>> = {
  password_requirements: `const minLength = Number(policy.assignment.config.minLength ?? 8)
const requireUppercase = Boolean(policy.assignment.config.requireUppercase ?? false)
const requireLowercase = Boolean(policy.assignment.config.requireLowercase ?? false)
const requireNumber = Boolean(policy.assignment.config.requireNumber ?? false)
const requireSymbol = Boolean(policy.assignment.config.requireSymbol ?? false)

const pendingPassword = policy.request.pendingPassword
if (typeof pendingPassword !== 'string') {
  return true
}

if (pendingPassword.length < minLength) {
  return { allow: false, message: 'Password must be at least ' + minLength + ' characters' }
}
if (requireUppercase && !/[A-Z]/.test(pendingPassword)) {
  return { allow: false, message: 'Password must contain an uppercase character' }
}
if (requireLowercase && !/[a-z]/.test(pendingPassword)) {
  return { allow: false, message: 'Password must contain a lowercase character' }
}
if (requireNumber && !/[0-9]/.test(pendingPassword)) {
  return { allow: false, message: 'Password must contain a number' }
}
if (requireSymbol && !/[^A-Za-z0-9]/.test(pendingPassword)) {
  return { allow: false, message: 'Password must contain a symbol' }
}

return true`,
  password_expiration_days: `const days = Number(policy.assignment.config.days ?? 0)
if (days <= 0) {
  return true
}

const changedAtRaw = policy.user.customAttributes.password_changed_at
if (!changedAtRaw) {
  return true
}

const baseline = new Date(changedAtRaw)
const expiryAt = new Date(baseline.getTime() + days * 24 * 60 * 60 * 1000)

if (expiryAt.getTime() < Date.now()) {
  return { allow: false, message: 'Password has expired. Contact an administrator to reset it.' }
}

return true`,
  unique_email: `// This policy is enforced during user create/update in backend service logic.
// Keep this script as documentation or add extra user_write checks if desired.
return true`,
  two_factor_required: `const required = Boolean(policy.assignment.config.required ?? true)
if (required && policy.user.customAttributes.mfa_enabled !== 'true') {
  return { allow: false, message: 'Two-factor authentication is required for this account' }
}

return true`
,
  brute_force_lockout: `const maxAttempts = Number(policy.assignment.config.maxAttempts ?? 5)
const lockMinutes = Number(policy.assignment.config.lockMinutes ?? 30)

// Provide recent failure count in customAttributes via your risk pipeline.
const failedAttempts = Number(policy.user.customAttributes.failed_login_attempts ?? 0)
if (failedAttempts >= maxAttempts) {
  return {
    allow: false,
    message: 'Account temporarily locked due to repeated failed login attempts. Try again in ' + lockMinutes + ' minutes.'
  }
}

return true`,
  new_device_verification: `const requireStepUp = Boolean(policy.assignment.config.requireStepUp ?? true)
const trustedDeviceTtlDays = Number(policy.assignment.config.trustedDeviceTtlDays ?? 30)

if (!requireStepUp) {
  return true
}

// Populate this marker during device fingerprint or remembered-device checks.
const trusted = policy.user.customAttributes.device_trusted === 'true'
if (!trusted) {
  return { allow: false, message: 'Additional verification is required for this device.' }
}

return true`,
  impossible_travel_risk: `const maxKmPerHour = Number(policy.assignment.config.maxKmPerHour ?? 900)
const action = String(policy.assignment.config.action ?? 'challenge')

// Populate this value from your geo-risk engine before evaluation.
const kmPerHour = Number(policy.user.customAttributes.last_travel_velocity_kmh ?? 0)
if (kmPerHour > maxKmPerHour) {
  if (action === 'deny') {
    return { allow: false, message: 'Sign-in blocked by impossible travel policy.' }
  }
  return { allow: false, message: 'Sign-in requires additional challenge due to location risk.' }
}

return true`,
  restricted_login_hours: `const timezone = String(policy.assignment.config.timezone ?? 'UTC')
const allowedHours = Array.isArray(policy.assignment.config.allowedHours)
  ? policy.assignment.config.allowedHours.map(Number)
  : [8, 20]
const allowedWeekdays = Array.isArray(policy.assignment.config.allowedWeekdays)
  ? policy.assignment.config.allowedWeekdays.map(Number)
  : [1, 2, 3, 4, 5]

// Default implementation uses UTC clock; replace with proper timezone-aware logic if needed.
void timezone
const nowDate = new Date()
const weekday = nowDate.getUTCDay()
const hour = nowDate.getUTCHours()

const inDay = allowedWeekdays.includes(weekday)
const inHour = hour >= Number(allowedHours[0] ?? 0) && hour < Number(allowedHours[1] ?? 24)
if (!inDay || !inHour) {
  return { allow: false, message: 'Login is not allowed at this time.' }
}

return true`,
  ip_allowlist: `const allowedCidrs = Array.isArray(policy.assignment.config.allowCidrs)
  ? policy.assignment.config.allowCidrs.map(String)
  : []
const enforceForAdmins = Boolean(policy.assignment.config.enforceForAdmins ?? true)

if (!enforceForAdmins) {
  return true
}

// policy.request.ip is available; implement CIDR matcher according to your network model.
if (allowedCidrs.length === 0) {
  return true
}

return true`,
  session_concurrency_limit: `const maxActiveSessions = Number(policy.assignment.config.maxActiveSessions ?? 3)
const strategy = String(policy.assignment.config.strategy ?? 'revoke_oldest')

// Fill this marker from your session service before evaluation.
const activeSessions = Number(policy.user.customAttributes.active_sessions_count ?? 0)
if (activeSessions > maxActiveSessions && strategy === 'deny') {
  return { allow: false, message: 'Too many active sessions for this account.' }
}

return true`,
  reauth_for_sensitive_actions: `const reauthMinutes = Number(policy.assignment.config.reauthMinutes ?? 15)

// Store last re-auth timestamp in customAttributes if your app requires prompt step-up.
const reauthAt = policy.user.customAttributes.last_reauth_at
if (!reauthAt) {
  return { allow: false, message: 'Recent re-authentication is required for this action.' }
}

const ageMinutes = (Date.now() - new Date(reauthAt).getTime()) / 60000
if (ageMinutes > reauthMinutes) {
  return { allow: false, message: 'Re-authentication is too old for this action.' }
}

return true`,
  tenant_isolation_guard: `const strictTenantAudience = Boolean(policy.assignment.config.strictTenantAudience ?? true)

if (!strictTenantAudience) {
  return true
}

const userTenant = policy.user.customAttributes.tenant_id
const requestTenant = policy.request.tenantId
if (userTenant && requestTenant && userTenant !== requestTenant) {
  return { allow: false, message: 'Cross-tenant authorization context is not allowed.' }
}

return true`,
  service_user_constraints: `const requireServiceUser = Boolean(policy.assignment.config.requireServiceUser ?? true)
const denyInteractiveLogin = Boolean(policy.assignment.config.denyInteractiveLogin ?? true)

if (!requireServiceUser) {
  return true
}

const isServiceUser = Boolean(policy.user.isServiceUser)
if (denyInteractiveLogin && isServiceUser) {
  return { allow: false, message: 'Service users cannot complete interactive login flows.' }
}

return true`,
  token_hardening: `const requireNarrowScopes = Boolean(policy.assignment.config.requireNarrowScopes ?? true)
const maxAccessTokenMinutes = Number(policy.assignment.config.maxAccessTokenMinutes ?? 10)

if (!requireNarrowScopes) {
  return true
}

// Scope/token-lifetime enforcement should be applied in token issuance services.
// Keep this policy active as governance metadata and optional prompt-time checks.
void maxAccessTokenMinutes
return true`,
  consent_freshness: `const reconsentDays = Number(policy.assignment.config.reconsentDays ?? 180)
const forceOnScopeIncrease = Boolean(policy.assignment.config.forceOnScopeIncrease ?? true)

// Populate last consent timestamp and scope drift markers in customAttributes as needed.
const consentedAt = policy.user.customAttributes.last_consented_at
if (consentedAt) {
  const ageDays = (Date.now() - new Date(consentedAt).getTime()) / (24 * 60 * 60 * 1000)
  if (ageDays > reconsentDays) {
    return { allow: false, message: 'Consent must be refreshed.' }
  }
}

if (forceOnScopeIncrease && policy.user.customAttributes.scope_increase_pending === 'true') {
  return { allow: false, message: 'Consent is required for newly requested scopes.' }
}

return true`,
  attribute_completeness: `const requiredAttributes = Array.isArray(policy.assignment.config.requiredAttributes)
  ? policy.assignment.config.requiredAttributes.map(String)
  : []

for (const key of requiredAttributes) {
  if (!policy.user.customAttributes[key]) {
    return { allow: false, message: 'Missing required identity attribute: ' + key }
  }
}

return true`
};

type EffectivePolicy = {
  definition: PolicyDefinition;
  assignment: { enabled: boolean; config: Record<string, unknown> };
};

export class PolicyService {
  constructor(
    private readonly policyDefinitionRepository: PolicyDefinitionRepository,
    private readonly policyAssignmentRepository: PolicyAssignmentRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository
  ) {}

  async ensureBuiltIns() {
    for (const policy of BUILT_IN_POLICIES) {
      if (!await this.policyDefinitionRepository.findByKey(policy.key)) {
        await this.policyDefinitionRepository.create({
          id: nanoid(),
          key: policy.key,
          name: policy.name,
          description: policy.description,
          stageBindings: this.resolveDefaultStageBindings(policy.key),
          javascriptCode: undefined,
          enabled: true
        });
      }
    }
  }

  async listPolicies() {
    const assignments = await this.policyAssignmentRepository.list();
    return (await this.policyDefinitionRepository.list()).map((policy) => ({
      ...this.withResolvedDefinition(policy),
      javascriptCode: policy.javascriptCode ?? this.resolveDefaultJavascriptCode(policy.key),
      assignments: assignments.filter((assignment) => assignment.policyId === policy.id)
    }));
  }

  async createPolicy(input: {
    key: string;
    name: string;
    description: string;
    stageBindings?: AuthenticationStageType[];
    javascriptCode?: string;
    enabled: boolean;
  }) {
    const key = this.normalizeKey(input.key);
    if (await this.policyDefinitionRepository.findByKey(key)) {
      throw new ValidationError("Policy key already exists");
    }

    const stageBindings = this.normalizeStageBindings(input.stageBindings ?? this.resolveDefaultStageBindings(key));
    const javascriptCode = this.normalizeJavascriptCode(input.javascriptCode);

    return this.policyDefinitionRepository.create({
      id: nanoid(),
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      stageBindings,
      javascriptCode,
      enabled: input.enabled
    });
  }

  async updatePolicy(
    id: string,
    input: {
      key?: string;
      name?: string;
      description?: string;
      stageBindings?: AuthenticationStageType[];
      javascriptCode?: string | null;
      enabled?: boolean;
    }
  ) {
    const existing = await this.policyDefinitionRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Policy not found");
    }

    const normalizedKey = input.key ? this.normalizeKey(input.key) : undefined;
    if (normalizedKey && normalizedKey !== existing.key) {
      const duplicate = await this.policyDefinitionRepository.findByKey(normalizedKey);
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError("Policy key already exists");
      }
    }

    const updated = await this.policyDefinitionRepository.update(id, {
      key: normalizedKey,
      name: input.name?.trim(),
      description: input.description?.trim(),
      stageBindings: input.stageBindings ? this.normalizeStageBindings(input.stageBindings) : undefined,
      javascriptCode: input.javascriptCode === null ? undefined : this.normalizeJavascriptCode(input.javascriptCode),
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Failed to update policy");
    }

    return updated;
  }

  async deletePolicy(id: string) {
    await this.policyDefinitionRepository.delete(id);
  }

  async setAssignment(input: {
    policyId: string;
    scopeType: PolicyScopeType;
    scopeId?: string;
    enabled: boolean;
    config: Record<string, unknown>;
  }) {
    const policy = await this.policyDefinitionRepository.findById(input.policyId);
    if (!policy) {
      throw new ValidationError("Policy not found");
    }

    const scopeId = input.scopeType === "global" ? "global" : input.scopeId;
    if (!scopeId) {
      throw new ValidationError("scopeId is required for non-global scopes");
    }

    return this.policyAssignmentRepository.upsert({
      policyId: input.policyId,
      scopeType: input.scopeType,
      scopeId,
      enabled: input.enabled,
      config: input.config
    });
  }

  async removeAssignment(input: { policyId: string; scopeType: PolicyScopeType; scopeId?: string }) {
    const scopeId = input.scopeType === "global" ? "global" : input.scopeId;
    if (!scopeId) {
      throw new ValidationError("scopeId is required for non-global scopes");
    }
    await this.policyAssignmentRepository.delete(input.policyId, input.scopeType, scopeId);
  }

  async enforceUserCreationPolicies(password: string) {
    const assignment = await this.getTopAssignmentByPolicyKey("password_requirements");
    if (!assignment?.enabled) {
      return;
    }

    const minLength = Number(assignment.config.minLength ?? 8);
    const requireUppercase = Boolean(assignment.config.requireUppercase ?? false);
    const requireLowercase = Boolean(assignment.config.requireLowercase ?? false);
    const requireNumber = Boolean(assignment.config.requireNumber ?? false);
    const requireSymbol = Boolean(assignment.config.requireSymbol ?? false);

    if (password.length < minLength) {
      throw new ValidationError(`Password must be at least ${minLength} characters`);
    }
    if (requireUppercase && !/[A-Z]/.test(password)) {
      throw new ValidationError("Password must contain an uppercase character");
    }
    if (requireLowercase && !/[a-z]/.test(password)) {
      throw new ValidationError("Password must contain a lowercase character");
    }
    if (requireNumber && !/[0-9]/.test(password)) {
      throw new ValidationError("Password must contain a number");
    }
    if (requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      throw new ValidationError("Password must contain a symbol");
    }
  }

  async enforceLoginPolicies(input: { user: User; tenantId?: string }) {
    await this.enforceStagePolicies({
      stage: "password",
      user: input.user,
      tenantId: input.tenantId
    });
  }

  async enforceStagePolicies(input: {
    stage: AuthenticationStageType;
    user: User;
    tenantId?: string;
    clientId?: string;
    ip?: string;
  }) {
    const effectiveByPolicyId = await this.resolveEffectivePolicies(input.user.id, input.tenantId);

    for (const effective of effectiveByPolicyId.values()) {
      const definition = this.withResolvedDefinition(effective.definition);
      if (!definition.stageBindings.includes(input.stage)) {
        continue;
      }

      if (!effective.assignment.enabled) {
        continue;
      }

      const javascriptCode = definition.javascriptCode?.trim();
      if (javascriptCode) {
        this.executeCustomJavascriptPolicy({
          definition,
          assignment: effective.assignment,
          stage: input.stage,
          user: input.user,
          tenantId: input.tenantId,
          clientId: input.clientId,
          ip: input.ip
        });
        continue;
      }

      this.executeBuiltInPolicy({
        definitionKey: definition.key,
        assignment: effective.assignment,
        stage: input.stage,
        user: input.user
      });
    }
  }

  private executeBuiltInPolicy(input: {
    definitionKey: string;
    assignment: { enabled: boolean; config: Record<string, unknown> };
    stage: AuthenticationStageType;
    user: User;
  }) {
    if (input.definitionKey === "password_expiration_days" && input.stage === "password") {
      const days = Number(input.assignment.config.days ?? 0);
      if (days > 0) {
        const changedAtRaw = input.user.customAttributes.password_changed_at;
        const baseline = changedAtRaw ? new Date(changedAtRaw) : input.user.createdAt;
        const expiryAt = new Date(baseline.getTime() + days * 24 * 60 * 60 * 1000);
        if (expiryAt.getTime() < Date.now()) {
          throw new AuthenticationError("Password has expired. Contact an administrator to reset it.");
        }
      }
      return;
    }

    if (input.definitionKey === "two_factor_required" && input.stage === "mfa_totp") {
      const required = Boolean(input.assignment.config.required ?? true);
      if (required && input.user.customAttributes.mfa_enabled !== "true") {
        throw new AuthenticationError("Two-factor authentication is required for this account");
      }
    }
  }

  private executeCustomJavascriptPolicy(input: {
    definition: PolicyDefinition;
    assignment: { enabled: boolean; config: Record<string, unknown> };
    stage: AuthenticationStageType;
    user: User;
    tenantId?: string;
    clientId?: string;
    ip?: string;
  }) {
    const sandbox: {
      policy: Record<string, unknown>;
      result: unknown;
      now: () => string;
    } = {
      policy: {
        key: input.definition.key,
        name: input.definition.name,
        stage: input.stage,
        assignment: {
          enabled: input.assignment.enabled,
          config: input.assignment.config
        },
        user: {
          id: input.user.id,
          email: input.user.email,
          username: input.user.username,
          givenName: input.user.givenName,
          familyName: input.user.familyName,
          active: input.user.active,
          isServiceUser: input.user.isServiceUser,
          customAttributes: input.user.customAttributes
        },
        request: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          ip: input.ip
        }
      },
      result: true,
      now: () => new Date().toISOString()
    };

    const wrappedScript = `
      "use strict";
      result = (function(policy, now) {
${input.definition.javascriptCode ?? ""}
      })(policy, now);
    `;

    try {
      runInNewContext(wrappedScript, sandbox, { timeout: 75 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Policy script execution failed";
      throw new AuthenticationError(`Policy ${input.definition.key} rejected login: ${message}`);
    }

    if (sandbox.result === false) {
      throw new AuthenticationError(`Policy ${input.definition.key} rejected login`);
    }
    if (typeof sandbox.result === "string") {
      throw new AuthenticationError(sandbox.result);
    }
    if (typeof sandbox.result === "object" && sandbox.result !== null && "allow" in sandbox.result) {
      const allow = Boolean((sandbox.result as { allow?: unknown }).allow);
      const message = typeof (sandbox.result as { message?: unknown }).message === "string"
        ? String((sandbox.result as { message?: unknown }).message)
        : `Policy ${input.definition.key} rejected login`;
      if (!allow) {
        throw new AuthenticationError(message);
      }
    }
  }

  private async getTopAssignmentByPolicyKey(policyKey: string) {
    const definition = await this.policyDefinitionRepository.findByKey(policyKey);
    if (!definition || !definition.enabled) {
      return undefined;
    }

    const globalAssignment = (await this.policyAssignmentRepository
      .listByPolicy(definition.id))
      .find((assignment) => assignment.scopeType === "global" && assignment.scopeId === "global");

    return globalAssignment;
  }

  private async resolveEffectivePolicies(userId: string, tenantId?: string) {
    const result = new Map<string, EffectivePolicy>();
    const groupIds = new Set((await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId));

    for (const definition of await this.policyDefinitionRepository.list()) {
      if (!definition.enabled) {
        continue;
      }

      const assignments = (await this.policyAssignmentRepository
        .listByPolicy(definition.id))
        .filter((assignment) => assignment.enabled);

      const userMatch = assignments.find((assignment) => assignment.scopeType === "user" && assignment.scopeId === userId);
      const groupMatch = assignments.find(
        (assignment) => assignment.scopeType === "group" && typeof assignment.scopeId === "string" && groupIds.has(assignment.scopeId)
      );
      const tenantMatch = tenantId
        ? assignments.find((assignment) => assignment.scopeType === "tenant" && assignment.scopeId === tenantId)
        : undefined;
      const globalMatch = assignments.find((assignment) => assignment.scopeType === "global" && assignment.scopeId === "global");

      const effective = userMatch ?? groupMatch ?? tenantMatch ?? globalMatch;
      if (effective) {
        result.set(definition.id, {
          definition,
          assignment: { enabled: effective.enabled, config: effective.config }
        });
      }
    }

    return result;
  }

  private withResolvedDefinition(definition: PolicyDefinition): PolicyDefinition {
    return {
      ...definition,
      stageBindings: definition.stageBindings.length > 0
        ? definition.stageBindings
        : this.resolveDefaultStageBindings(definition.key)
    };
  }

  private resolveDefaultStageBindings(policyKey: string): AuthenticationStageType[] {
    return [...(DEFAULT_POLICY_STAGE_BINDINGS[policyKey] ?? [])];
  }

  private normalizeStageBindings(stageBindings: AuthenticationStageType[]) {
    return Array.from(new Set(stageBindings));
  }

  private normalizeJavascriptCode(javascriptCode: string | undefined) {
    const code = javascriptCode?.trim();
    return code && code.length > 0 ? code : undefined;
  }

  private resolveDefaultJavascriptCode(policyKey: string) {
    return DEFAULT_POLICY_JAVASCRIPT[policyKey];
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!normalized || normalized.length < 2) {
      throw new ValidationError("Policy key must be at least 2 characters");
    }
    return normalized;
  }
}
