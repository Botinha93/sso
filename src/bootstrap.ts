import type { AppConfig } from "./core/config.js";
import { createSigningKeys } from "./security/keys.js";
import { JwtService } from "./security/jwt.js";
import { createRepositoryBundle } from "./repositories/factory.js";
import { AuthService } from "./services/auth-service.js";
import { AppService } from "./services/app-service.js";
import { AuthorizationService } from "./services/authorization-service.js";
import { AuthenticationFlowService } from "./services/authentication-flow-service.js";
import { ClientService } from "./services/client-service.js";
import { DatabaseMigrationService } from "./services/database-migration-service.js";
import { FederationService } from "./services/federation-service.js";
import { GroupService } from "./services/group-service.js";
import { OidcService } from "./services/oidc-service.js";
import { PolicyService } from "./services/policy-service.js";
import { ProvisioningService } from "./services/provisioning-service.js";
import { DeprovisioningService } from "./services/deprovisioning-service.js";
import { AccessGovernanceService } from "./services/access-governance-service.js";
import { AccessReviewService } from "./services/access-review-service.js";
import { ElevationService } from "./services/elevation-service.js";
import { EventHookService } from "./services/event-hook-service.js";
import { EmailService } from "./services/email-service.js";
import { InstanceSettingsService } from "./services/instance-settings-service.js";
import { RecoveryService } from "./services/recovery-service.js";
import { RoleService } from "./services/role-service.js";
import { SecurityService } from "./services/security-service.js";
import { ScopeService } from "./services/scope-service.js";
import { ScimService } from "./services/scim-service.js";
import { ScimTokenService } from "./services/scim-token-service.js";
import { SamlService } from "./services/saml-service.js";
import { SamlReplayProtectionService } from "./services/saml-replay-protection-service.js";
import { SamlSignatureService } from "./services/saml-signature-service.js";
import { SetupService } from "./services/setup-service.js";
import { TenantService } from "./services/tenant-service.js";
import { TotpService } from "./services/totp-service.js";
import { WebauthnService } from "./services/webauthn-service.js";
import { RiskService } from "./services/risk-service.js";
import { ServiceIdentityService } from "./services/service-identity-service.js";
import { ConnectorService, AuthMetricsService } from "./services/connector-service.js";
import { PluginService } from "./services/plugin-service.js";
import { PluginRuntimeService } from "./services/plugin-runtime-service.js";
import { UserAttributeService } from "./services/user-attribute-service.js";
import { UserService } from "./services/user-service.js";
import { MediaService } from "./services/media-service.js";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readRuntimeDatabaseConfigSync, saveRuntimeDatabaseConfig } from "./core/runtime-database-config.js";

const pinRuntimeDatabaseConfigIfNeeded = async (
  config: AppConfig,
  instanceSettingsService: InstanceSettingsService,
  userService: UserService
) => {
  if (readRuntimeDatabaseConfigSync()) {
    return;
  }

  const users = await userService.listUsers();
  if (users.length === 0) {
    return;
  }

  const settings = await instanceSettingsService.getSettings();
  await saveRuntimeDatabaseConfig({
    databaseProvider: settings.databaseProvider ?? config.databaseProvider,
    databasePath: settings.databasePath ?? config.databasePath,
    externalDatabaseUrl: settings.externalDatabaseUrl ?? config.externalDatabaseUrl
  });
};

export const bootstrap = async (config: AppConfig) => {
  const repositories = await createRepositoryBundle(config);
  const {
    roleRepository,
    tenantRepository,
    appRepository,
    groupRepository,
    userGroupAssignmentRepository,
    userAppAssignmentRepository,
    groupAppAssignmentRepository,
    groupRoleAssignmentRepository,
    assignmentRepository,
    userRepository,
    clientRepository,
    scopeRepository,
    sessionRepository,
    totpCredentialRepository,
    webauthnCredentialRepository,
    authorizationCodeRepository,
    consentRepository,
    refreshTokenRepository,
    accessTokenRepository,
    auditRepository,
    authenticationFlowRepository,
    federationProviderRepository,
    federatedIdentityRepository,
    federationTransactionRepository,
    userAttributeRepository,
    groupUserAttributeAssignmentRepository,
    policyDefinitionRepository,
    policyAssignmentRepository,
    policyDecisionLogRepository,
    scimTokenRepository,
    provisioningMappingRepository,
    provisioningJobRepository,
    deprovisioningQueueRepository,
    accessRequestRepository,
    accessRequestApprovalRepository,
    accessReviewCampaignRepository,
    accessReviewItemRepository,
    elevationRequestRepository,
    elevationSessionRepository,
    eventHookRepository,
    eventNotificationRepository,
    instanceSettingsRepository,
    samlServiceProviderRepository,
    samlNameIdMappingRepository,
    samlAssertionAuditRepository
  } = repositories;

  const riskService = new RiskService(repositories.riskEventRepository);
  const eventHookService = new EventHookService(eventHookRepository, eventNotificationRepository);
  const connectorService = new ConnectorService(
    repositories.connectorRepository,
    repositories.connectorRunRepository,
    repositories.connectorMappingRepository,
    auditRepository,
    eventHookService
  );
  const authMetricsService = new AuthMetricsService(repositories.authMetricRepository);
  const pluginStorageRoot = resolve(process.cwd(), dirname(config.databasePath), "plugins");
  const mediaStorageRoot = resolve(process.cwd(), dirname(config.databasePath), "uploads");
  await mkdir(mediaStorageRoot, { recursive: true });
  const pluginService = new PluginService(pluginStorageRoot);
  const mediaService = new MediaService(mediaStorageRoot);
  const pluginRuntimeService = new PluginRuntimeService(pluginService, auditRepository);
  eventHookService.setPluginRuntime(pluginRuntimeService);
  const serviceIdentityService = new ServiceIdentityService(
    userRepository,
    repositories.serviceIdentityCredentialRepository
  );

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
    appRepository,
    groupAppAssignmentRepository,
    userAttributeRepository,
    groupUserAttributeAssignmentRepository,
    groupRoleAssignmentRepository,
    userGroupAssignmentRepository,
    roleRepository,
    userRepository
  );
  const userService = new UserService(
    userRepository,
    appRepository,
    userAppAssignmentRepository,
    userAttributeRepository,
    roleService,
    groupService
  );
  const userAttributeService = new UserAttributeService(
    userAttributeRepository,
    groupUserAttributeAssignmentRepository,
    groupRepository
  );

  const existingUserAttributeDefinitions = await userAttributeService.listDefinitions();
  if (!existingUserAttributeDefinitions.some((attribute) => attribute.key === "picture")) {
    await userAttributeService.createAttribute({
      key: "picture",
      name: "Picture",
      description: "Profile picture URL",
      type: "text",
      enabled: true
    });
  }
  const policyService = new PolicyService(
    policyDefinitionRepository,
    policyAssignmentRepository,
    userGroupAssignmentRepository
  );
  const authorizationService = new AuthorizationService(policyService);
  await policyService.ensureBuiltIns();
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);
  await instanceSettingsService.ensureDefaults();
  const securityService = new SecurityService(auditRepository, eventHookService, instanceSettingsService);
  const emailService = new EmailService(instanceSettingsService);
  const databaseMigrationService = new DatabaseMigrationService();
  const recoveryService = new RecoveryService();
  const federationService = new FederationService(
    config,
    userRepository,
    federationProviderRepository,
    federatedIdentityRepository,
    federationTransactionRepository,
    authenticationFlowService
  );
  const tenantService = new TenantService(tenantRepository);
  const clientService = new ClientService(clientRepository, instanceSettingsService);
  const scopeService = new ScopeService(scopeRepository);
  const appService = new AppService(appRepository);
  await appService.ensureDefaults();
  const scimService = new ScimService(userService, groupService);
  const scimTokenService = new ScimTokenService(scimTokenRepository);
  const samlService = new SamlService(
    samlServiceProviderRepository,
    samlNameIdMappingRepository,
    samlAssertionAuditRepository,
    auditRepository
  );
  const samlReplayProtectionService = new SamlReplayProtectionService();
  const samlSignatureService = new SamlSignatureService();
  const provisioningService = new ProvisioningService(
    provisioningMappingRepository,
    provisioningJobRepository,
    userRepository,
    groupRepository
  );
  const deprovisioningService = new DeprovisioningService(deprovisioningQueueRepository);
  const accessGovernanceService = new AccessGovernanceService(
    accessRequestRepository,
    accessRequestApprovalRepository,
    userRepository,
    roleRepository,
    groupRepository,
    roleService,
    groupService
  );
  const accessReviewService = new AccessReviewService(
    accessReviewCampaignRepository,
    accessReviewItemRepository,
    userRepository,
    assignmentRepository,
    userGroupAssignmentRepository,
    roleRepository,
    groupRepository,
    roleService,
    groupService
  );
  const elevationService = new ElevationService(
    elevationRequestRepository,
    elevationSessionRepository,
    userRepository,
    auditRepository
  );
  const setupService = new SetupService(
    userService,
    roleService,
    groupService,
    policyService,
    scopeService,
    appService,
    instanceSettingsService
  );
  const totpService = new TotpService(config, totpCredentialRepository);
  const webauthnService = new WebauthnService(config, webauthnCredentialRepository);

  // Keep sane defaults in place across upgrades and restarts.
  await setupService.ensureSaneDefaults();
  await pinRuntimeDatabaseConfigIfNeeded(config, instanceSettingsService, userService);

  if (!await tenantRepository.findBySlug("default")) {
    await tenantService.createTenant({
      slug: "default",
      name: "Default Tenant"
    });
  }

  const existingFlows = await authenticationFlowService.listFlows();
  const hasActiveAuthenticationFlow = existingFlows.some((flow) => flow.designation === "authentication" && flow.enabled);
  const ensureFlow = async (name: string, create: () => Promise<void>) => {
    if (!existingFlows.some((flow) => flow.name === name)) {
      await create();
    }
  };

  await ensureFlow("Two-factor Login", async () => {
    await authenticationFlowService.createFlow({
      name: "Two-factor Login",
      description: "Default login pattern with optional OTP validation for configured users.",
      designation: "authentication",
      enabled: !hasActiveAuthenticationFlow,
      grantTypes: ["authorization_code", "refresh_token", "password", "device_code", "client_credentials", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"],
      stages: [
        { type: "password", required: true, order: 1 },
        { type: "mfa_totp", required: true, order: 2 },
        { type: "consent", required: true, order: 3 }
      ]
    });
  });

  await ensureFlow("Login with conditional Captcha", async () => {
    await authenticationFlowService.createFlow({
      name: "Login with conditional Captcha",
      description: "Authentication flow with risk-aware captcha challenge before credential checks.",
      designation: "authentication",
      enabled: false,
      grantTypes: ["authorization_code", "refresh_token", "password", "device_code", "client_credentials", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"],
      stages: [
        { type: "risk_check", required: true, order: 1 },
        { type: "captcha", required: true, order: 2 },
        { type: "password", required: true, order: 3 },
        { type: "consent", required: true, order: 4 }
      ]
    });
  });

  await ensureFlow("Enrollment (2 Stage)", async () => {
    await authenticationFlowService.createFlow({
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

  await ensureFlow("Enrollment with email verification", async () => {
    await authenticationFlowService.createFlow({
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

  await ensureFlow("Recovery with email and MFA verification", async () => {
    await authenticationFlowService.createFlow({
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

  await ensureFlow("default-invalidation-flow", async () => {
    await authenticationFlowService.createFlow({
      name: "default-invalidation-flow",
      description: "Ends authentik session and triggers provider logout.",
      designation: "invalidation",
      enabled: true,
      grantTypes: ["authorization_code"],
      stages: [{ type: "user_logout", required: true, order: 1 }]
    });
  });

  await ensureFlow("default-provider-invalidation-flow", async () => {
    await authenticationFlowService.createFlow({
      name: "default-provider-invalidation-flow",
      description: "Provider-only invalidation without ending the central session.",
      designation: "invalidation",
      enabled: false,
      grantTypes: ["authorization_code"],
      stages: [{ type: "consent", required: true, order: 1 }]
    });
  });

  const activeAuthFlow = await authenticationFlowService.getActiveFlow();

  if (!await clientRepository.findById("sso-admin-ui")) {
    await clientRepository.create({
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

  if (!await clientRepository.findById("sso-device-cli")) {
    await clientRepository.create({
      id: "sso-device-cli",
      name: "SSO Device CLI",
      secret: "super-secret-device-client",
      redirectUris: [],
      allowedScopes: ["openid", "profile", "email", "offline_access", "roles"],
      grants: ["device_code", "refresh_token"],
      requirePkce: false,
      resources: [],
      flowIds: activeAuthFlow ? [activeAuthFlow.id] : []
    });
  }

  if (!await clientRepository.findById("sso-password-cli")) {
    await clientRepository.create({
      id: "sso-password-cli",
      name: "SSO Password CLI",
      secret: "super-secret-password-client",
      redirectUris: [],
      allowedScopes: ["openid", "profile", "email", "offline_access", "roles"],
      grants: ["password", "refresh_token"],
      requirePkce: false,
      resources: [],
      flowIds: activeAuthFlow ? [activeAuthFlow.id] : []
    });
  }

  if (!await clientRepository.findById("sso-service-client")) {
    await clientRepository.create({
      id: "sso-service-client",
      name: "SSO Service Client",
      secret: "super-secret-service-client",
      redirectUris: [],
      allowedScopes: ["roles"],
      grants: ["client_credentials"],
      requirePkce: false,
      resources: [],
      flowIds: []
    });
  }

  const defaultApps = await appRepository.list();
  const accountPortalApp = defaultApps.find((app) => app.name === "Account Portal");
  const adminPortalApp = defaultApps.find((app) => app.name === "Admin Portal");

  if (adminPortalApp) {
    const adminClient = await clientRepository.findById("sso-admin-ui");
    if (adminClient && adminClient.appId !== adminPortalApp.id) {
      await clientRepository.update(adminClient.id, { appId: adminPortalApp.id });
    }
  }

  if (accountPortalApp) {
    const accountClientIds = ["sso-device-cli", "sso-password-cli", "sso-service-client"];
    for (const clientId of accountClientIds) {
      const client = await clientRepository.findById(clientId);
      if (client && client.appId !== accountPortalApp.id) {
        await clientRepository.update(client.id, { appId: accountPortalApp.id });
      }
    }
  }

  const signingKeys = await createSigningKeys();
  const jwtService = new JwtService(signingKeys, config);
  const authService = new AuthService(
    userService,
    roleService,
    groupService,
    authenticationFlowService,
    clientRepository,
    sessionRepository,
    authorizationCodeRepository,
    consentRepository,
    refreshTokenRepository,
    accessTokenRepository,
    tenantRepository,
    jwtService,
    auditRepository,
    securityService,
    serviceIdentityService
  );
  const oidcService = new OidcService(config, jwtService);

  return {
    config,
    roleService,
    groupService,
    authenticationFlowService,
    federationService,
    userAttributeService,
    policyService,
    authorizationService,
    eventHookService,
    securityService,
    emailService,
    databaseMigrationService,
    recoveryService,
    instanceSettingsService,
    tenantService,
    userService,
    scimService,
    scimTokenService,
    samlService,
    samlReplayProtectionService,
    samlSignatureService,
    samlServiceProviderRepository,
    samlNameIdMappingRepository,
    samlAssertionAuditRepository,
    provisioningService,
    deprovisioningService,
    accessGovernanceService,
    accessReviewService,
    elevationService,
    clientService,
    scopeService,
    appService,
    setupService,
    totpService,
    webauthnService,
    riskService,
    serviceIdentityService,
    connectorService,
    authMetricsService,
    pluginService,
    pluginRuntimeService,
    mediaService,
    authService,
    oidcService,
    auditRepository,
    policyDecisionLogRepository,
    dispose: repositories.dispose ?? (async () => undefined)
  };
};
