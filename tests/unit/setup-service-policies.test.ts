import test from "node:test";
import assert from "node:assert/strict";
import { SetupService } from "../../src/services/setup-service.js";
import type { AppService } from "../../src/services/app-service.js";
import type { GroupService } from "../../src/services/group-service.js";
import type { PolicyService } from "../../src/services/policy-service.js";
import type { RoleService } from "../../src/services/role-service.js";
import type { ScopeService } from "../../src/services/scope-service.js";
import type { UserService } from "../../src/services/user-service.js";
import type { InstanceSettingsService } from "../../src/services/instance-settings-service.js";
import { DEFAULT_SCOPES } from "../../src/domain/oidc-scopes.js";

type PolicyListItem = Awaited<ReturnType<PolicyService["listPolicies"]>>[number];
type AssignmentInput = Parameters<PolicyService["setAssignment"]>[0];

const adminPortalAppId = "admin-portal";

const createSetupService = (input: {
  policies: PolicyListItem[];
  setAssignment: (assignment: AssignmentInput) => Promise<unknown>;
}) => {
  const appService = {
    ensureDefaults: async () => undefined,
    listApps: async () => [{ id: adminPortalAppId, name: "Admin Portal" }]
  };

  const roleService = {
    listRoles: async () => [
      { id: "role-admin", name: "platform_admin", appId: adminPortalAppId },
      { id: "role-readonly", name: "readonly", appId: adminPortalAppId },
      { id: "role-auditor", name: "auditor", appId: adminPortalAppId },
      { id: "role-helpdesk", name: "helpdesk", appId: adminPortalAppId }
    ]
  };

  const groupService = {
    listGroups: async () => [
      { id: "group-admins", name: "Administrators", appId: adminPortalAppId },
      { id: "group-auditors", name: "Auditors", appId: adminPortalAppId },
      { id: "group-helpdesk", name: "Helpdesk", appId: adminPortalAppId },
      { id: "group-readonly", name: "Read Only", appId: adminPortalAppId }
    ]
  };

  const policyService = {
    ensureBuiltIns: async () => undefined,
    listPolicies: async () => input.policies,
    setAssignment: input.setAssignment
  };

  const scopeService = {
    listScopes: async () => DEFAULT_SCOPES
  };

  return new SetupService(
    {} as UserService,
    roleService as unknown as RoleService,
    groupService as unknown as GroupService,
    policyService as unknown as PolicyService,
    scopeService as unknown as ScopeService,
    appService as unknown as AppService,
    {} as InstanceSettingsService
  );
};

const policyWithGlobalAssignment = (
  key: string,
  config: Record<string, unknown>,
  enabled = true
): PolicyListItem => ({
  id: `policy-${key}`,
  key,
  name: key,
  description: key,
  category: "authentication",
  stageBindings: [],
  enabled: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  assignments: [{
    id: `assignment-${key}`,
    policyId: `policy-${key}`,
    scopeType: "global",
    scopeId: "global",
    enabled,
    config,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  }]
});

const policyWithoutAssignment = (key: string): PolicyListItem => ({
  id: `policy-${key}`,
  key,
  name: key,
  description: key,
  category: "authentication",
  stageBindings: [],
  enabled: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  assignments: []
});

test("ensureSaneDefaults does not overwrite saved policy assignments", async () => {
  const setAssignmentCalls: AssignmentInput[] = [];
  const setup = createSetupService({
    policies: [
      policyWithGlobalAssignment("password_requirements", { minLength: 8 }),
      policyWithGlobalAssignment("password_expiration_days", { days: 30, warnDaysBefore: 7 }, true),
      policyWithGlobalAssignment("unique_email", {}),
      policyWithGlobalAssignment("two_factor_required", { required: true }, true)
    ],
    setAssignment: async (assignment) => {
      setAssignmentCalls.push(assignment);
      return assignment;
    }
  });

  await setup.ensureSaneDefaults();

  assert.equal(setAssignmentCalls.length, 0);
});

test("ensureSaneDefaults seeds missing global policy assignments", async () => {
  const setAssignmentCalls: AssignmentInput[] = [];
  const setup = createSetupService({
    policies: [
      policyWithoutAssignment("password_requirements"),
      policyWithGlobalAssignment("password_expiration_days", { days: 30 }, true),
      policyWithoutAssignment("unique_email"),
      policyWithoutAssignment("two_factor_required")
    ],
    setAssignment: async (assignment) => {
      setAssignmentCalls.push(assignment);
      return assignment;
    }
  });

  await setup.ensureSaneDefaults();

  assert.deepEqual(
    setAssignmentCalls.map((assignment) => assignment.policyId).sort(),
    ["policy-password_requirements", "policy-two_factor_required", "policy-unique_email"]
  );
  assert.equal(
    setAssignmentCalls.some((assignment) => assignment.policyId === "policy-password_expiration_days"),
    false
  );
});
