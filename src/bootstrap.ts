import type { AppConfig } from "./core/config.js";
import { createSigningKeys } from "./security/keys.js";
import { JwtService } from "./security/jwt.js";
import {
  SqliteAccessTokenRepository,
  SqliteAppRepository,
  SqliteAuthenticationFlowRepository,
  SqliteAuditRepository,
  SqliteAuthorizationCodeRepository,
  SqliteClientRepository,
  SqliteScopeRepository,
  SqliteConsentRepository,
  SqliteDatabase,
  SqliteFederationProviderRepository,
  SqliteFederatedIdentityRepository,
  SqliteFederationTransactionRepository,
  SqliteGroupRepository,
  SqliteGroupRoleAssignmentRepository,
  SqlitePolicyAssignmentRepository,
  SqlitePolicyDefinitionRepository,
  SqliteEventHookRepository,
  SqliteEventNotificationRepository,
  SqliteRefreshTokenRepository,
  SqliteRoleRepository,
  SqliteSessionRepository,
  SqliteTenantRepository,
  SqliteUserAttributeRepository,
  SqliteGroupUserAttributeAssignmentRepository,
  SqliteUserGroupAssignmentRepository,
  SqliteUserRepository,
  SqliteUserRoleAssignmentRepository
} from "./repositories/sqlite.js";
import { AuthService } from "./services/auth-service.js";
import { AppService } from "./services/app-service.js";
import { AuthenticationFlowService } from "./services/authentication-flow-service.js";
import { ClientService } from "./services/client-service.js";
import { FederationService } from "./services/federation-service.js";
import { GroupService } from "./services/group-service.js";
import { OidcService } from "./services/oidc-service.js";
import { PolicyService } from "./services/policy-service.js";
import { EventHookService } from "./services/event-hook-service.js";
import { RoleService } from "./services/role-service.js";
import { ScopeService } from "./services/scope-service.js";
import { SetupService } from "./services/setup-service.js";
import { TenantService } from "./services/tenant-service.js";
import { UserAttributeService } from "./services/user-attribute-service.js";
import { UserService } from "./services/user-service.js";

export const bootstrap = async (config: AppConfig) => {
  const sqlite = new SqliteDatabase(config.databasePath);
  sqlite.migrate();

  const roleRepository = new SqliteRoleRepository(sqlite.connection);
  const tenantRepository = new SqliteTenantRepository(sqlite.connection);
  const appRepository = new SqliteAppRepository(sqlite.connection);
  const groupRepository = new SqliteGroupRepository(sqlite.connection);
  const userGroupAssignmentRepository = new SqliteUserGroupAssignmentRepository(sqlite.connection);
  const groupRoleAssignmentRepository = new SqliteGroupRoleAssignmentRepository(sqlite.connection);
  const assignmentRepository = new SqliteUserRoleAssignmentRepository(sqlite.connection);
  const userRepository = new SqliteUserRepository(sqlite.connection);
  const clientRepository = new SqliteClientRepository(sqlite.connection);
  const scopeRepository = new SqliteScopeRepository(sqlite.connection);
  const sessionRepository = new SqliteSessionRepository(sqlite.connection);
  const authorizationCodeRepository = new SqliteAuthorizationCodeRepository(sqlite.connection);
  const consentRepository = new SqliteConsentRepository(sqlite.connection);
  const refreshTokenRepository = new SqliteRefreshTokenRepository(sqlite.connection);
  const accessTokenRepository = new SqliteAccessTokenRepository(sqlite.connection);
  const auditRepository = new SqliteAuditRepository(sqlite.connection);
  const authenticationFlowRepository = new SqliteAuthenticationFlowRepository(sqlite.connection);
  const federationProviderRepository = new SqliteFederationProviderRepository(sqlite.connection);
  const federatedIdentityRepository = new SqliteFederatedIdentityRepository(sqlite.connection);
  const federationTransactionRepository = new SqliteFederationTransactionRepository(sqlite.connection);
  const userAttributeRepository = new SqliteUserAttributeRepository(sqlite.connection);
  const groupUserAttributeAssignmentRepository = new SqliteGroupUserAttributeAssignmentRepository(sqlite.connection);
  const policyDefinitionRepository = new SqlitePolicyDefinitionRepository(sqlite.connection);
  const policyAssignmentRepository = new SqlitePolicyAssignmentRepository(sqlite.connection);
  const eventHookRepository = new SqliteEventHookRepository(sqlite.connection);
  const eventNotificationRepository = new SqliteEventNotificationRepository(sqlite.connection);

  const roleService = new RoleService(
    roleRepository,
    assignmentRepository,
    tenantRepository,
    userGroupAssignmentRepository,
    groupRoleAssignmentRepository
  );
  const authenticationFlowService = new AuthenticationFlowService(authenticationFlowRepository);
  const groupService = new GroupService(
    groupRepository,
    groupRoleAssignmentRepository,
    userGroupAssignmentRepository,
    roleRepository,
    userRepository
  );
  const userService = new UserService(userRepository, roleService, groupService);
  const userAttributeService = new UserAttributeService(
    userAttributeRepository,
    groupUserAttributeAssignmentRepository,
    groupRepository
  );
  const policyService = new PolicyService(
    policyDefinitionRepository,
    policyAssignmentRepository,
    userGroupAssignmentRepository
  );
  policyService.ensureBuiltIns();
  const eventHookService = new EventHookService(eventHookRepository, eventNotificationRepository);
  const federationService = new FederationService(
    config,
    userRepository,
    federationProviderRepository,
    federatedIdentityRepository,
    federationTransactionRepository,
    authenticationFlowService
  );
  const tenantService = new TenantService(tenantRepository);
  const clientService = new ClientService(clientRepository);
  const scopeService = new ScopeService(scopeRepository);
  const appService = new AppService(appRepository);
  const setupService = new SetupService(userService, roleService, groupService, policyService, scopeService);

  // Keep sane defaults in place across upgrades and restarts.
  setupService.ensureSaneDefaults();

  if (!tenantRepository.findBySlug("default")) {
    tenantService.createTenant({
      slug: "default",
      name: "Default Tenant"
    });
  }

  const existingFlows = authenticationFlowService.listFlows();
  const hasActiveAuthenticationFlow = existingFlows.some((flow) => flow.designation === "authentication" && flow.enabled);
  const ensureFlow = (name: string, create: () => void) => {
    if (!existingFlows.some((flow) => flow.name === name)) {
      create();
    }
  };

  ensureFlow("Two-factor Login", () => {
    authenticationFlowService.createFlow({
      name: "Two-factor Login",
      description: "Default login pattern with optional OTP validation for configured users.",
      designation: "authentication",
      enabled: !hasActiveAuthenticationFlow,
      grantTypes: ["authorization_code", "refresh_token"],
      stages: [
        { type: "password", required: true, order: 1 },
        { type: "mfa_totp", required: true, order: 2 },
        { type: "consent", required: true, order: 3 }
      ]
    });
  });

  ensureFlow("Login with conditional Captcha", () => {
    authenticationFlowService.createFlow({
      name: "Login with conditional Captcha",
      description: "Authentication flow with risk-aware captcha challenge before credential checks.",
      designation: "authentication",
      enabled: false,
      grantTypes: ["authorization_code", "refresh_token"],
      stages: [
        { type: "risk_check", required: true, order: 1 },
        { type: "captcha", required: true, order: 2 },
        { type: "password", required: true, order: 3 },
        { type: "consent", required: true, order: 4 }
      ]
    });
  });

  ensureFlow("Enrollment (2 Stage)", () => {
    authenticationFlowService.createFlow({
      name: "Enrollment (2 Stage)",
      description: "Simple signup flow for username/email/password and immediate login.",
      designation: "enrollment",
      enabled: true,
      grantTypes: ["authorization_code"],
      stages: [
        { type: "prompt", required: true, order: 1 },
        { type: "user_write", required: true, order: 2 }
      ]
    });
  });

  ensureFlow("Enrollment with email verification", () => {
    authenticationFlowService.createFlow({
      name: "Enrollment with email verification",
      description: "Enrollment flow with an additional email verification stage.",
      designation: "enrollment",
      enabled: false,
      grantTypes: ["authorization_code"],
      stages: [
        { type: "prompt", required: true, order: 1 },
        { type: "email_verification", required: true, order: 2 },
        { type: "user_write", required: true, order: 3 },
        { type: "user_login", required: true, order: 4 }
      ]
    });
  });

  ensureFlow("Recovery with email and MFA verification", () => {
    authenticationFlowService.createFlow({
      name: "Recovery with email and MFA verification",
      description: "Recovery flow with identification, email check, MFA verification, then password reset.",
      designation: "recovery",
      enabled: true,
      grantTypes: ["authorization_code"],
      stages: [
        { type: "identification", required: true, order: 1 },
        { type: "email_verification", required: true, order: 2 },
        { type: "mfa_totp", required: true, order: 3 },
        { type: "prompt", required: true, order: 4 },
        { type: "user_write", required: true, order: 5 },
        { type: "user_login", required: true, order: 6 }
      ]
    });
  });

  ensureFlow("default-invalidation-flow", () => {
    authenticationFlowService.createFlow({
      name: "default-invalidation-flow",
      description: "Ends authentik session and triggers provider logout.",
      designation: "invalidation",
      enabled: true,
      grantTypes: ["authorization_code"],
      stages: [{ type: "user_logout", required: true, order: 1 }]
    });
  });

  ensureFlow("default-provider-invalidation-flow", () => {
    authenticationFlowService.createFlow({
      name: "default-provider-invalidation-flow",
      description: "Provider-only invalidation without ending the central session.",
      designation: "invalidation",
      enabled: false,
      grantTypes: ["authorization_code"],
      stages: [{ type: "consent", required: true, order: 1 }]
    });
  });

  const activeAuthFlow = authenticationFlowService.getActiveFlow();

  if (!clientRepository.findById("sso-admin-ui")) {
    clientRepository.create({
      id: "sso-admin-ui",
      name: "SSO Admin UI",
      secret: "super-secret-admin-client",
      redirectUris: ["http://localhost:3000/callback"],
      allowedScopes: ["openid", "profile", "email", "offline_access", "roles"],
      grants: ["authorization_code", "refresh_token"],
      requirePkce: true,
      resources: [],
      flowIds: activeAuthFlow ? [activeAuthFlow.id] : []
    });
  }

  const signingKeys = await createSigningKeys();
  const jwtService = new JwtService(signingKeys, config);
  const authService = new AuthService(
    userService,
    roleService,
    authenticationFlowService,
    clientRepository,
    sessionRepository,
    authorizationCodeRepository,
    consentRepository,
    refreshTokenRepository,
    accessTokenRepository,
    tenantRepository,
    jwtService,
    auditRepository
  );
  const oidcService = new OidcService(config, jwtService);

  return {
    roleService,
    groupService,
    authenticationFlowService,
    federationService,
    userAttributeService,
    policyService,
    eventHookService,
    tenantService,
    userService,
    clientService,
    scopeService,
    appService,
    setupService,
    authService,
    oidcService,
    auditRepository
  };
};
