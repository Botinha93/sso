import { ValidationError } from "../core/errors.js";
import type { AppService } from "./app-service.js";
import type { GroupService } from "./group-service.js";
import type { PolicyService } from "./policy-service.js";
import type { RoleService } from "./role-service.js";
import type { ScopeService } from "./scope-service.js";
import type { UserService } from "./user-service.js";
import type { InstanceSettingsService } from "./instance-settings-service.js";

const ALL_RESOURCES = [
  "users",
  "groups",
  "roles",
  "clients",
  "sessions",
  "audit_log",
  "consents",
  "tenants",
  "apps",
  "federation_providers",
  "authentication_flows",
  "user_attributes",
  "policies",
  "events",
  "scopes",
  "administration"
] as const;

const ACTIONS = ["view", "add", "change", "delete", "disable"] as const;

const makeAllPermissions = () => {
  const permissions: string[] = [];
  for (const resource of ALL_RESOURCES) {
    for (const action of ACTIONS) {
      permissions.push(`${resource}:${action}`);
    }
  }
  return permissions;
};

export class SetupService {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService,
    private readonly policyService: PolicyService,
    private readonly scopeService: ScopeService,
    private readonly appService: AppService,
    private readonly instanceSettingsService: InstanceSettingsService
  ) {}

  async status() {
    const users = await this.userService.listUsers();
    const roles = await this.roleService.listRoles();
    const settings = await this.instanceSettingsService.getSettings();
    return {
      requiresSetup: users.length === 0 || !roles.some((role) => role.name === "platform_admin"),
      databaseProvider: settings.databaseProvider
    };
  }

  async ensureSaneDefaults() {
    const adminPortalAppId = await this.ensureAdminPortalAppId();
    const roleIds = await this.ensureDefaultRoles(adminPortalAppId);
    await this.ensureDefaultGroups(roleIds, adminPortalAppId);
    await this.ensureDefaultPolicies();
  }

  async initialize(input: {
    name: string;
    email: string;
    username: string;
    password: string;
    databaseProvider?: "sqlite" | "postgresql" | "mysql";
    databasePath?: string;
    externalDatabaseUrl?: string;
  }) {
    const status = await this.status();
    if (!status.requiresSetup) {
      throw new ValidationError("Setup has already been completed");
    }

    const name = input.name.trim();
    if (!name) {
      throw new ValidationError("Admin name is required");
    }

    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new ValidationError("Admin email is required");
    }

    const username = input.username.trim();
    if (!username) {
      throw new ValidationError("Admin username is required");
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw new ValidationError("Admin username may only contain letters, numbers, _, ., and -");
    }

    if (await this.userService.findUserByEmail(email)) {
      throw new ValidationError("A user with this email already exists");
    }

    if (await this.userService.findUserByUsername(username)) {
      throw new ValidationError("A user with this username already exists");
    }

    const adminPortalAppId = await this.ensureAdminPortalAppId();
    const roleIds = await this.ensureDefaultRoles(adminPortalAppId);
    await this.ensureDefaultGroups(roleIds, adminPortalAppId);
    await this.ensureDefaultPolicies();

    await this.instanceSettingsService.updateSettings({
      databaseProvider: input.databaseProvider ?? "sqlite",
      databasePath: input.databasePath ?? "./data/sso.sqlite",
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    const [givenName, ...rest] = name.split(/\s+/).filter(Boolean);
    const familyName = rest.join(" ") || "Administrator";

    const adminUser = await this.userService.createUser({
      appId: adminPortalAppId,
      email,
      username,
      password: input.password,
      givenName: givenName || "Admin",
      familyName,
      roleIds: [roleIds.platformAdmin]
    });

    return {
      userId: adminUser.id,
      email: adminUser.email,
      username: adminUser.username
    };
  }

  private async ensureDefaultRoles(adminPortalAppId: string) {
    const existing = await this.roleService.listRoles();

    const existingPlatformAdmin = existing.find((role) => role.name === "platform_admin");
    const platformAdmin = existingPlatformAdmin ?? await this.roleService.createRole({
      appId: adminPortalAppId,
      name: "platform_admin",
      description: "Full platform administration access",
      permissions: ["*:*", ...makeAllPermissions()],
      scope: "platform"
    });
    if (existingPlatformAdmin && existingPlatformAdmin.appId !== adminPortalAppId) {
      await this.roleService.updateRole(existingPlatformAdmin.id, { appId: adminPortalAppId });
    }

    const existingReadOnly = existing.find((role) => role.name === "readonly");
    const readOnly = existingReadOnly ?? await this.roleService.createRole({
      appId: adminPortalAppId,
      name: "readonly",
      description: "View-only access to administration data",
      permissions: ALL_RESOURCES.map((resource) => `${resource}:view`),
      scope: "platform"
    });
    if (existingReadOnly && existingReadOnly.appId !== adminPortalAppId) {
      await this.roleService.updateRole(existingReadOnly.id, { appId: adminPortalAppId });
    }

    const existingAuditor = existing.find((role) => role.name === "auditor");
    const auditor = existingAuditor ?? await this.roleService.createRole({
      appId: adminPortalAppId,
      name: "auditor",
      description: "Audit and session monitoring access",
      permissions: [
        "audit_log:view",
        "events:view",
        "sessions:view",
        "consents:view",
        "users:view"
      ],
      scope: "platform"
    });
    if (existingAuditor && existingAuditor.appId !== adminPortalAppId) {
      await this.roleService.updateRole(existingAuditor.id, { appId: adminPortalAppId });
    }

    const existingHelpdesk = existing.find((role) => role.name === "helpdesk");
    const helpdesk = existingHelpdesk ?? await this.roleService.createRole({
      appId: adminPortalAppId,
      name: "helpdesk",
      description: "Operational user support with limited write access",
      permissions: [
        "users:view",
        "users:change",
        "groups:view",
        "roles:view",
        "sessions:view",
        "sessions:delete",
        "consents:view",
        "consents:delete"
      ],
      scope: "platform"
    });
    if (existingHelpdesk && existingHelpdesk.appId !== adminPortalAppId) {
      await this.roleService.updateRole(existingHelpdesk.id, { appId: adminPortalAppId });
    }

    return {
      platformAdmin: platformAdmin.id,
      readOnly: readOnly.id,
      auditor: auditor.id,
      helpdesk: helpdesk.id
    };
  }

  private async ensureDefaultGroups(roleIds: { platformAdmin: string; readOnly: string; auditor: string; helpdesk: string }, adminPortalAppId: string) {
    const groups = await this.groupService.listGroups();

    const administrators = groups.find((group) => group.name === "Administrators");
    if (!administrators) {
      await this.groupService.createGroup({
        appId: adminPortalAppId,
        name: "Administrators",
        description: "Platform administrators",
        roleIds: [roleIds.platformAdmin]
      });
    } else if (administrators.appId !== adminPortalAppId) {
      await this.groupService.updateGroup(administrators.id, { appId: adminPortalAppId });
    }

    const auditors = groups.find((group) => group.name === "Auditors");
    if (!auditors) {
      await this.groupService.createGroup({
        appId: adminPortalAppId,
        name: "Auditors",
        description: "Security and compliance review users",
        roleIds: [roleIds.auditor]
      });
    } else if (auditors.appId !== adminPortalAppId) {
      await this.groupService.updateGroup(auditors.id, { appId: adminPortalAppId });
    }

    const helpdesk = groups.find((group) => group.name === "Helpdesk");
    if (!helpdesk) {
      await this.groupService.createGroup({
        appId: adminPortalAppId,
        name: "Helpdesk",
        description: "Operational support users",
        roleIds: [roleIds.helpdesk]
      });
    } else if (helpdesk.appId !== adminPortalAppId) {
      await this.groupService.updateGroup(helpdesk.id, { appId: adminPortalAppId });
    }

    const readOnly = groups.find((group) => group.name === "Read Only");
    if (!readOnly) {
      await this.groupService.createGroup({
        appId: adminPortalAppId,
        name: "Read Only",
        description: "Read-only observers",
        roleIds: [roleIds.readOnly]
      });
    } else if (readOnly.appId !== adminPortalAppId) {
      await this.groupService.updateGroup(readOnly.id, { appId: adminPortalAppId });
    }
  }

  private async ensureAdminPortalAppId() {
    await this.appService.ensureDefaults();
    const apps = await this.appService.listApps();
    const adminPortal = apps.find((app) => app.name === "Admin Portal");
    if (!adminPortal) {
      throw new ValidationError("Admin Portal app is missing");
    }
    return adminPortal.id;
  }

  private async ensureDefaultPolicies() {
    await this.policyService.ensureBuiltIns();

    const policies = await this.policyService.listPolicies();
    const byKey = new Map(policies.map((policy) => [policy.key, policy]));

    const passwordRequirements = byKey.get("password_requirements");
    if (passwordRequirements) {
      await this.policyService.setAssignment({
        policyId: passwordRequirements.id,
        scopeType: "global",
        enabled: true,
        config: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSymbol: false
        }
      });
    }

    const passwordExpiration = byKey.get("password_expiration_days");
    if (passwordExpiration) {
      await this.policyService.setAssignment({
        policyId: passwordExpiration.id,
        scopeType: "global",
        enabled: false,
        config: {
          days: 90
        }
      });
    }

    const uniqueEmail = byKey.get("unique_email");
    if (uniqueEmail) {
      await this.policyService.setAssignment({
        policyId: uniqueEmail.id,
        scopeType: "global",
        enabled: true,
        config: {}
      });
    }

    const twoFactor = byKey.get("two_factor_required");
    if (twoFactor) {
      await this.policyService.setAssignment({
        policyId: twoFactor.id,
        scopeType: "global",
        enabled: false,
        config: {
          required: false
        }
      });
    }

    // Ensure core OIDC scopes exist even on first run.
    const defaults = [
      { name: "openid", description: "Authenticate user with OpenID Connect" },
      { name: "profile", description: "Read basic profile claims" },
      { name: "email", description: "Read user email claims" },
      { name: "offline_access", description: "Request refresh tokens" },
      { name: "roles", description: "Read role claims" }
    ];

    const existingScopes = (await this.scopeService.listScopes()).map((scope) => scope.name);
    const known = new Set(existingScopes);
    for (const scope of defaults) {
      if (!known.has(scope.name)) {
        await this.scopeService.createScope(scope);
      }
    }

  }
}
