import type { AppConfig } from "../core/config.js";
import {
  SqliteAccessTokenRepository,
  SqliteAppRepository,
  SqliteAuthenticationFlowRepository,
  SqliteAuditRepository,
  SqliteAuthorizationCodeRepository,
  SqliteClientRepository,
  SqliteScopeRepository,
  SqliteConsentRepository,
  SqliteTotpCredentialRepository,
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
  SqliteInstanceSettingsRepository,
  SqliteRefreshTokenRepository,
  SqliteRoleRepository,
  SqliteSessionRepository,
  SqliteTenantRepository,
  SqliteUserAttributeRepository,
  SqliteGroupUserAttributeAssignmentRepository,
  SqliteUserGroupAssignmentRepository,
  SqliteUserRepository,
  SqliteUserRoleAssignmentRepository
} from "./sqlite.js";

export const createRepositoryBundle = (config: AppConfig) => {
  if (config.databaseProvider !== "sqlite") {
    const provider = config.databaseProvider;
    if (!config.externalDatabaseUrl) {
      throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${provider}`);
    }

    process.emitWarning(
      `[database] DATABASE_PROVIDER=${provider} configured. Runtime repositories are still using SQLite during migration rewrite, so the server is running in compatibility mode against DATABASE_PATH (${config.databasePath}). Use /api/admin/settings/database/migrate to sync SQLite data into the external target.`
    );
  }

  const sqlite = new SqliteDatabase(config.databasePath);
  sqlite.migrate();

  return {
    roleRepository: new SqliteRoleRepository(sqlite.connection),
    tenantRepository: new SqliteTenantRepository(sqlite.connection),
    appRepository: new SqliteAppRepository(sqlite.connection),
    groupRepository: new SqliteGroupRepository(sqlite.connection),
    userGroupAssignmentRepository: new SqliteUserGroupAssignmentRepository(sqlite.connection),
    groupRoleAssignmentRepository: new SqliteGroupRoleAssignmentRepository(sqlite.connection),
    assignmentRepository: new SqliteUserRoleAssignmentRepository(sqlite.connection),
    userRepository: new SqliteUserRepository(sqlite.connection),
    clientRepository: new SqliteClientRepository(sqlite.connection),
    scopeRepository: new SqliteScopeRepository(sqlite.connection),
    sessionRepository: new SqliteSessionRepository(sqlite.connection),
    totpCredentialRepository: new SqliteTotpCredentialRepository(sqlite.connection),
    authorizationCodeRepository: new SqliteAuthorizationCodeRepository(sqlite.connection),
    consentRepository: new SqliteConsentRepository(sqlite.connection),
    refreshTokenRepository: new SqliteRefreshTokenRepository(sqlite.connection),
    accessTokenRepository: new SqliteAccessTokenRepository(sqlite.connection),
    auditRepository: new SqliteAuditRepository(sqlite.connection),
    authenticationFlowRepository: new SqliteAuthenticationFlowRepository(sqlite.connection),
    federationProviderRepository: new SqliteFederationProviderRepository(sqlite.connection),
    federatedIdentityRepository: new SqliteFederatedIdentityRepository(sqlite.connection),
    federationTransactionRepository: new SqliteFederationTransactionRepository(sqlite.connection),
    userAttributeRepository: new SqliteUserAttributeRepository(sqlite.connection),
    groupUserAttributeAssignmentRepository: new SqliteGroupUserAttributeAssignmentRepository(sqlite.connection),
    policyDefinitionRepository: new SqlitePolicyDefinitionRepository(sqlite.connection),
    policyAssignmentRepository: new SqlitePolicyAssignmentRepository(sqlite.connection),
    eventHookRepository: new SqliteEventHookRepository(sqlite.connection),
    eventNotificationRepository: new SqliteEventNotificationRepository(sqlite.connection),
    instanceSettingsRepository: new SqliteInstanceSettingsRepository(sqlite.connection)
  };
};
