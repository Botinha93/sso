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

export interface RepositoryBundle {
  roleRepository: SqliteRoleRepository;
  tenantRepository: SqliteTenantRepository;
  appRepository: SqliteAppRepository;
  groupRepository: SqliteGroupRepository;
  userGroupAssignmentRepository: SqliteUserGroupAssignmentRepository;
  groupRoleAssignmentRepository: SqliteGroupRoleAssignmentRepository;
  assignmentRepository: SqliteUserRoleAssignmentRepository;
  userRepository: SqliteUserRepository;
  clientRepository: SqliteClientRepository;
  scopeRepository: SqliteScopeRepository;
  sessionRepository: SqliteSessionRepository;
  totpCredentialRepository: SqliteTotpCredentialRepository;
  authorizationCodeRepository: SqliteAuthorizationCodeRepository;
  consentRepository: SqliteConsentRepository;
  refreshTokenRepository: SqliteRefreshTokenRepository;
  accessTokenRepository: SqliteAccessTokenRepository;
  auditRepository: SqliteAuditRepository;
  authenticationFlowRepository: SqliteAuthenticationFlowRepository;
  federationProviderRepository: SqliteFederationProviderRepository;
  federatedIdentityRepository: SqliteFederatedIdentityRepository;
  federationTransactionRepository: SqliteFederationTransactionRepository;
  userAttributeRepository: SqliteUserAttributeRepository;
  groupUserAttributeAssignmentRepository: SqliteGroupUserAttributeAssignmentRepository;
  policyDefinitionRepository: SqlitePolicyDefinitionRepository;
  policyAssignmentRepository: SqlitePolicyAssignmentRepository;
  eventHookRepository: SqliteEventHookRepository;
  eventNotificationRepository: SqliteEventNotificationRepository;
  instanceSettingsRepository: SqliteInstanceSettingsRepository;
}

const createSqliteRepositoryBundle = (config: AppConfig): RepositoryBundle => {
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

export const createRepositoryBundle = async (config: AppConfig): Promise<RepositoryBundle> => {
  if (config.databaseProvider === "sqlite") {
    return createSqliteRepositoryBundle(config);
  }

  const provider = config.databaseProvider;
  if (!config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${provider}`);
  }

  throw new Error(
    `DATABASE_PROVIDER=${provider} is configured, but the active runtime repository layer is still SQLite-only. ` +
      `External database support is not wired into live repositories yet. ` +
      `Use /api/admin/settings/database/migrate to copy data into ${provider}, then keep DATABASE_PROVIDER=sqlite for runtime until the repository rewrite is completed.`
  );
};
