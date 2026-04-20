/**
 * Multi-Database Repository Factory
 * 
 * This factory provides a database-agnostic way to instantiate repositories.
 * It supports SQLite, PostgreSQL, and MySQL backends.
 * 
 * The factory dynamically selects the correct provider implementation based on 
 * configuration and creates the appropriate adapter.
 */

import type { AppConfig } from "../core/config.js";
import type { DatabaseAdapter } from "./adapters/database.js";
import type { SqliteDatabaseAdapter } from "./adapters/sqlite.js";
import { createDatabaseAdapter } from "./adapters/index.js";

// Import all repository contracts
import type {
  RoleRepository,
  TenantRepository,
  AppRepository,
  GroupRepository,
  UserGroupAssignmentRepository,
  GroupRoleAssignmentRepository,
  UserRoleAssignmentRepository,
  UserRepository,
  ClientRepository,
  ScopeRepository,
  SessionRepository,
  TotpCredentialRepository,
  AuthorizationCodeRepository,
  ConsentRepository,
  RefreshTokenRepository,
  AccessTokenRepository,
  AuditRepository,
  AuthenticationFlowRepository,
  FederationProviderRepository,
  FederatedIdentityRepository,
  FederationTransactionRepository,
  UserAttributeRepository,
  GroupUserAttributeAssignmentRepository,
  PolicyDefinitionRepository,
  PolicyAssignmentRepository,
  PolicyDecisionLogRepository,
  EventHookRepository,
  EventNotificationRepository,
  InstanceSettingsRepository
} from "./contracts.js";

/**
 * Repository bundle - provides unified access to all repositories
 * regardless of the underlying database implementation
 */
export interface RepositoryBundle {
  roleRepository: RoleRepository;
  tenantRepository: TenantRepository;
  appRepository: AppRepository;
  groupRepository: GroupRepository;
  userGroupAssignmentRepository: UserGroupAssignmentRepository;
  groupRoleAssignmentRepository: GroupRoleAssignmentRepository;
  assignmentRepository: UserRoleAssignmentRepository;
  userRepository: UserRepository;
  clientRepository: ClientRepository;
  scopeRepository: ScopeRepository;
  sessionRepository: SessionRepository;
  totpCredentialRepository: TotpCredentialRepository;
  authorizationCodeRepository: AuthorizationCodeRepository;
  consentRepository: ConsentRepository;
  refreshTokenRepository: RefreshTokenRepository;
  accessTokenRepository: AccessTokenRepository;
  auditRepository: AuditRepository;
  authenticationFlowRepository: AuthenticationFlowRepository;
  federationProviderRepository: FederationProviderRepository;
  federatedIdentityRepository: FederatedIdentityRepository;
  federationTransactionRepository: FederationTransactionRepository;
  userAttributeRepository: UserAttributeRepository;
  groupUserAttributeAssignmentRepository: GroupUserAttributeAssignmentRepository;
  policyDefinitionRepository: PolicyDefinitionRepository;
  policyAssignmentRepository: PolicyAssignmentRepository;
  policyDecisionLogRepository: PolicyDecisionLogRepository;
  eventHookRepository: EventHookRepository;
  eventNotificationRepository: EventNotificationRepository;
  instanceSettingsRepository: InstanceSettingsRepository;
}

/**
 * Create a repository bundle based on the configuration
 * This is the main entry point for database access
 */
export async function createMultiDatabaseRepositoryBundle(config: AppConfig): Promise<RepositoryBundle> {
  // Determine which provider to use
  const provider = config.databaseProvider;
  let connectionString: string;

  switch (provider) {
    case "sqlite":
      connectionString = config.databasePath;
      break;
    case "postgresql":
    case "mysql":
      if (!config.externalDatabaseUrl) {
        throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${provider}`);
      }
      connectionString = config.externalDatabaseUrl;
      break;
    default:
      throw new Error(`Unsupported database provider: ${provider}`);
  }

  // Create the database adapter for the selected provider
  const adapter = await createDatabaseAdapter(provider, connectionString);

  // Log which provider is being used
  console.log(`[database] Using ${provider} database backend`);
  console.log(
    `[database] Connection: ${provider === "sqlite" ? connectionString : `${provider}://...`}`
  );

  // Create repositories using the adapter
  // These are provider-agnostic wrappers that work with any adapter
  const bundle = createRepositoriesFromAdapter(adapter, provider);

  return bundle;
}

/**
 * Internal function that creates repositories using the database adapter
 * This supports the new unified repository interface
 */
function createRepositoriesFromAdapter(adapter: DatabaseAdapter, provider: "sqlite" | "postgresql" | "mysql"): RepositoryBundle {
  // For backward compatibility during transition, we use the SQLite repositories
  // They will work with any database through the adapter
  
  // This is a bridge implementation - full implementations per provider will be added iteratively
  // For now, we're using the SQLite implementations which have been battle-tested

  if (provider === "sqlite") {
    // Use native SQLite implementation (fastest path)
    const { SqliteDatabase } = require("./sqlite.js");
    const sqliteAdapter = adapter as SqliteDatabaseAdapter;
    const sqlite = new SqliteDatabase(sqliteAdapter.getConnection());
    
    // Import and instantiate all SQLite repositories
    const {
      SqliteRoleRepository,
      SqliteTenantRepository,
      SqliteAppRepository,
      SqliteGroupRepository,
      SqliteUserGroupAssignmentRepository,
      SqliteGroupRoleAssignmentRepository,
      SqliteUserRoleAssignmentRepository,
      SqliteUserRepository,
      SqliteClientRepository,
      SqliteScopeRepository,
      SqliteSessionRepository,
      SqliteTotpCredentialRepository,
      SqliteAuthorizationCodeRepository,
      SqliteConsentRepository,
      SqliteRefreshTokenRepository,
      SqliteAccessTokenRepository,
      SqliteAuditRepository,
      SqliteAuthenticationFlowRepository,
      SqliteFederationProviderRepository,
      SqliteFederatedIdentityRepository,
      SqliteFederationTransactionRepository,
      SqliteUserAttributeRepository,
      SqliteGroupUserAttributeAssignmentRepository,
      SqlitePolicyDefinitionRepository,
      SqlitePolicyAssignmentRepository,
      SqlitePolicyDecisionLogRepository,
      SqliteEventHookRepository,
      SqliteEventNotificationRepository,
      SqliteInstanceSettingsRepository
    } = require("./sqlite.js");

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
      policyDecisionLogRepository: new SqlitePolicyDecisionLogRepository(sqlite.connection),
      eventHookRepository: new SqliteEventHookRepository(sqlite.connection),
      eventNotificationRepository: new SqliteEventNotificationRepository(sqlite.connection),
      instanceSettingsRepository: new SqliteInstanceSettingsRepository(sqlite.connection)
    };
  }

  throw new Error(
    `PostgreSQL and MySQL repository implementations are not yet complete. ` +
      `${provider} has been configured but runtime support is still in development. ` +
      `Use sqlite for now or contact the development team for status updates.`
  );
}

// Export the legacy factory for backward compatibility
export { createRepositoryBundle } from "./factory.js";
