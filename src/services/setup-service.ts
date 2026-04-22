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
    const roleIds = await this.ensureDefaultRoles();
    await this.ensureDefaultGroups(roleIds);
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

    const roleIds = await this.ensureDefaultRoles();
    await this.ensureDefaultGroups(roleIds);
    await this.ensureDefaultPolicies();

    await this.instanceSettingsService.updateSettings({
      databaseProvider: input.databaseProvider ?? "sqlite",
      databasePath: input.databasePath ?? "./data/sso.sqlite",
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    const [givenName, ...rest] = name.split(/\s+/).filter(Boolean);
    const familyName = rest.join(" ") || "Administrator";

    const adminUser = await this.userService.createUser({
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

  private async ensureDefaultRoles() {
    const existing = await this.roleService.listRoles();

    const platformAdmin = existing.find((role) => role.name === "platform_admin") ?? await this.roleService.createRole({
      name: "platform_admin",
      description: "Full platform administration access",
      permissions: ["*:*", ...makeAllPermissions()],
      scope: "platform"
    });

    const readOnly = existing.find((role) => role.name === "readonly") ?? await this.roleService.createRole({
      name: "readonly",
      description: "View-only access to administration data",
      permissions: ALL_RESOURCES.map((resource) => `${resource}:view`),
      scope: "platform"
    });

    const auditor = existing.find((role) => role.name === "auditor") ?? await this.roleService.createRole({
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

    const helpdesk = existing.find((role) => role.name === "helpdesk") ?? await this.roleService.createRole({
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

    return {
      platformAdmin: platformAdmin.id,
      readOnly: readOnly.id,
      auditor: auditor.id,
      helpdesk: helpdesk.id
    };
  }

  private async ensureDefaultGroups(roleIds: { platformAdmin: string; readOnly: string; auditor: string; helpdesk: string }) {
    const groups = await this.groupService.listGroups();

    if (!groups.some((group) => group.name === "Administrators")) {
      await this.groupService.createGroup({
        name: "Administrators",
        description: "Platform administrators",
        roleIds: [roleIds.platformAdmin]
      });
    }

    if (!groups.some((group) => group.name === "Auditors")) {
      await this.groupService.createGroup({
        name: "Auditors",
        description: "Security and compliance review users",
        roleIds: [roleIds.auditor]
      });
    }

    if (!groups.some((group) => group.name === "Helpdesk")) {
      await this.groupService.createGroup({
        name: "Helpdesk",
        description: "Operational support users",
        roleIds: [roleIds.helpdesk]
      });
    }

    if (!groups.some((group) => group.name === "Read Only")) {
      await this.groupService.createGroup({
        name: "Read Only",
        description: "Read-only observers",
        roleIds: [roleIds.readOnly]
      });
    }
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

    // Ensure a default "Account Portal" app exists.
    const existingApps = await this.appService.listApps();
    const portalApp = existingApps.find((app) => app.name === "Account Portal");
    if (!portalApp) {
      await this.appService.createApp({
        name: "Account Portal",
        description: "Default self-service user portal",
        icon: "👤",
        url: "/portal/"
      });
    } else if (portalApp.url === "/portal") {
      // Normalize legacy default URL to canonical portal base path.
      await this.appService.updateApp(portalApp.id, {
        url: "/portal/"
      });
    }
  }
}
