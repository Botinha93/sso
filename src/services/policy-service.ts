import { nanoid } from "nanoid";
import { AuthenticationError, ValidationError } from "../core/errors.js";
import type {
  PolicyAssignmentRepository,
  PolicyDefinitionRepository,
  UserGroupAssignmentRepository
} from "../repositories/contracts.js";
import type { PolicyScopeType, User } from "../domain/models.js";

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
  }
] as const;

export class PolicyService {
  constructor(
    private readonly policyDefinitionRepository: PolicyDefinitionRepository,
    private readonly policyAssignmentRepository: PolicyAssignmentRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository
  ) {}

  ensureBuiltIns() {
    for (const policy of BUILT_IN_POLICIES) {
      if (!this.policyDefinitionRepository.findByKey(policy.key)) {
        this.policyDefinitionRepository.create({
          id: nanoid(),
          key: policy.key,
          name: policy.name,
          description: policy.description,
          enabled: true
        });
      }
    }
  }

  listPolicies() {
    const assignments = this.policyAssignmentRepository.list();
    return this.policyDefinitionRepository.list().map((policy) => ({
      ...policy,
      assignments: assignments.filter((assignment) => assignment.policyId === policy.id)
    }));
  }

  createPolicy(input: { key: string; name: string; description: string; enabled: boolean }) {
    const key = this.normalizeKey(input.key);
    if (this.policyDefinitionRepository.findByKey(key)) {
      throw new ValidationError("Policy key already exists");
    }

    return this.policyDefinitionRepository.create({
      id: nanoid(),
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      enabled: input.enabled
    });
  }

  updatePolicy(id: string, input: { key?: string; name?: string; description?: string; enabled?: boolean }) {
    const existing = this.policyDefinitionRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Policy not found");
    }

    const normalizedKey = input.key ? this.normalizeKey(input.key) : undefined;
    if (normalizedKey && normalizedKey !== existing.key) {
      const duplicate = this.policyDefinitionRepository.findByKey(normalizedKey);
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError("Policy key already exists");
      }
    }

    const updated = this.policyDefinitionRepository.update(id, {
      key: normalizedKey,
      name: input.name?.trim(),
      description: input.description?.trim(),
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Failed to update policy");
    }

    return updated;
  }

  deletePolicy(id: string) {
    this.policyDefinitionRepository.delete(id);
  }

  setAssignment(input: {
    policyId: string;
    scopeType: PolicyScopeType;
    scopeId?: string;
    enabled: boolean;
    config: Record<string, unknown>;
  }) {
    const policy = this.policyDefinitionRepository.findById(input.policyId);
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

  removeAssignment(input: { policyId: string; scopeType: PolicyScopeType; scopeId?: string }) {
    const scopeId = input.scopeType === "global" ? "global" : input.scopeId;
    if (!scopeId) {
      throw new ValidationError("scopeId is required for non-global scopes");
    }
    this.policyAssignmentRepository.delete(input.policyId, input.scopeType, scopeId);
  }

  enforceUserCreationPolicies(password: string) {
    const assignment = this.getTopAssignmentByPolicyKey("password_requirements");
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

  enforceLoginPolicies(input: { user: User; tenantId?: string }) {
    const effective = this.resolveEffectiveAssignments(input.user.id, input.tenantId);

    const expiration = effective.get("password_expiration_days");
    if (expiration?.enabled) {
      const days = Number(expiration.config.days ?? 0);
      if (days > 0) {
        const changedAtRaw = input.user.customAttributes.password_changed_at;
        const baseline = changedAtRaw ? new Date(changedAtRaw) : input.user.createdAt;
        const expiryAt = new Date(baseline.getTime() + days * 24 * 60 * 60 * 1000);
        if (expiryAt.getTime() < Date.now()) {
          throw new AuthenticationError("Password has expired. Contact an administrator to reset it.");
        }
      }
    }

    const twoFactor = effective.get("two_factor_required");
    if (twoFactor?.enabled) {
      const required = Boolean(twoFactor.config.required ?? true);
      if (required && input.user.customAttributes.mfa_enabled !== "true") {
        throw new AuthenticationError("Two-factor authentication is required for this account");
      }
    }
  }

  private getTopAssignmentByPolicyKey(policyKey: string) {
    const definition = this.policyDefinitionRepository.findByKey(policyKey);
    if (!definition || !definition.enabled) {
      return undefined;
    }

    const globalAssignment = this.policyAssignmentRepository
      .listByPolicy(definition.id)
      .find((assignment) => assignment.scopeType === "global" && assignment.scopeId === "global");

    return globalAssignment;
  }

  private resolveEffectiveAssignments(userId: string, tenantId?: string) {
    const result = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
    const groupIds = new Set(this.userGroupAssignmentRepository.listByUser(userId).map((assignment) => assignment.groupId));

    for (const definition of this.policyDefinitionRepository.list()) {
      if (!definition.enabled) {
        continue;
      }

      const assignments = this.policyAssignmentRepository
        .listByPolicy(definition.id)
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
        result.set(definition.key, { enabled: effective.enabled, config: effective.config });
      }
    }

    return result;
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!normalized || normalized.length < 2) {
      throw new ValidationError("Policy key must be at least 2 characters");
    }
    return normalized;
  }
}
