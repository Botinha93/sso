import type { AppConfig } from "../core/config.js";
import type {
  AccessRequestApprovalRepository,
  AccessReviewCampaignRepository,
  AccessReviewItemRepository,
  AccessRequestRepository,
  AccessTokenRepository,
  AppRepository,
  AuditRepository,
  AuthenticationFlowRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ConsentRepository,
  DeprovisioningQueueRepository,
  ElevationSessionRepository,
  ElevationRequestRepository,
  EventHookRepository,
  EventNotificationRepository,
  FederatedIdentityRepository,
  FederationProviderRepository,
  FederationTransactionRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  GroupUserAttributeAssignmentRepository,
  InstanceSettingsRepository,
  RiskEventRepository,
  SamlAssertionAuditRepository,
  SamlNameIdMappingRepository,
  SamlServiceProviderRepository,
  PolicyAssignmentRepository,
  PolicyDecisionLogRepository,
  PolicyDefinitionRepository,
  ProvisioningJobRepository,
  ProvisioningMappingRepository,
  ScimTokenRepository,
  RefreshTokenRepository,
  RoleRepository,
  ScopeRepository,
  ServiceIdentityRepository,
  ServiceIdentityCredentialRepository,
  SessionRepository,
  TenantRepository,
  TotpCredentialRepository,
  WebauthnCredentialRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository,
  ConnectorRepository,
  ConnectorRunRepository,
  ConnectorMappingRepository,
  AuthMetricRepository
} from "./contracts.js";
import { createPrismaRepositoryBundle } from "./prisma-factory.js";
import { SqliteRiskEventRepository } from "./sqlite-risk.js";
import { SqliteServiceIdentityRepository, SqliteServiceIdentityCredentialRepository } from "./sqlite-workload-identity.js";
import { SqliteConnectorRepository, SqliteConnectorRunRepository, SqliteConnectorMappingRepository, SqliteAuthMetricRepository } from "./sqlite-connectors.js";
import {
  SqliteAccessTokenRepository,
  SqliteAccessRequestRepository,
  SqliteAccessRequestApprovalRepository,
  SqliteAccessReviewCampaignRepository,
  SqliteAccessReviewItemRepository,
  SqliteAppRepository,
  SqliteAuditRepository,
  SqliteAuthenticationFlowRepository,
  SqliteAuthorizationCodeRepository,
  SqliteClientRepository,
  SqliteConsentRepository,
  SqliteDeprovisioningQueueRepository,
  SqliteDatabase,
  SqliteEventHookRepository,
  SqliteEventNotificationRepository,
  SqliteFederatedIdentityRepository,
  SqliteFederationProviderRepository,
  SqliteFederationTransactionRepository,
  SqliteGroupRepository,
  SqliteGroupRoleAssignmentRepository,
  SqliteGroupUserAttributeAssignmentRepository,
  SqliteInstanceSettingsRepository,
  SqliteElevationSessionRepository,
  SqliteElevationRequestRepository,
  SqlitePolicyAssignmentRepository,
  SqlitePolicyDecisionLogRepository,
  SqlitePolicyDefinitionRepository,
  SqliteProvisioningJobRepository,
  SqliteProvisioningMappingRepository,
  SqliteRefreshTokenRepository,
  SqliteRoleRepository,
  SqliteScopeRepository,
  SqliteScimTokenRepository,
  SqliteSamlAssertionAuditRepository,
  SqliteSamlNameIdMappingRepository,
  SqliteSamlServiceProviderRepository,
  SqliteSessionRepository,
  SqliteTenantRepository,
  SqliteTotpCredentialRepository,
  SqliteWebauthnCredentialRepository,
  SqliteUserAttributeRepository,
  SqliteUserGroupAssignmentRepository,
  SqliteUserRepository,
  SqliteUserRoleAssignmentRepository
} from "./sqlite.js";

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
  webauthnCredentialRepository: WebauthnCredentialRepository;
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
  scimTokenRepository: ScimTokenRepository;
  provisioningMappingRepository: ProvisioningMappingRepository;
  provisioningJobRepository: ProvisioningJobRepository;
  deprovisioningQueueRepository: DeprovisioningQueueRepository;
  accessRequestRepository: AccessRequestRepository;
  accessRequestApprovalRepository: AccessRequestApprovalRepository;
  accessReviewCampaignRepository: AccessReviewCampaignRepository;
  accessReviewItemRepository: AccessReviewItemRepository;
  elevationRequestRepository: ElevationRequestRepository;
  elevationSessionRepository: ElevationSessionRepository;
  eventHookRepository: EventHookRepository;
  eventNotificationRepository: EventNotificationRepository;
  instanceSettingsRepository: InstanceSettingsRepository;
  samlServiceProviderRepository: SamlServiceProviderRepository;
  samlNameIdMappingRepository: SamlNameIdMappingRepository;
  samlAssertionAuditRepository: SamlAssertionAuditRepository;
  riskEventRepository: RiskEventRepository;
  serviceIdentityRepository: ServiceIdentityRepository;
  serviceIdentityCredentialRepository: ServiceIdentityCredentialRepository;
  connectorRepository: ConnectorRepository;
  connectorRunRepository: ConnectorRunRepository;
  connectorMappingRepository: ConnectorMappingRepository;
  authMetricRepository: AuthMetricRepository;
  dispose?: () => Promise<void>;
}

export const createRepositoryBundle = async (config: AppConfig): Promise<RepositoryBundle> => {
  if (config.databaseProvider !== "sqlite" && !config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  if (config.databaseProvider === "sqlite") {
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
      webauthnCredentialRepository: new SqliteWebauthnCredentialRepository(sqlite.connection),
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
      scimTokenRepository: new SqliteScimTokenRepository(sqlite.connection),
      provisioningMappingRepository: new SqliteProvisioningMappingRepository(sqlite.connection),
      provisioningJobRepository: new SqliteProvisioningJobRepository(sqlite.connection),
      deprovisioningQueueRepository: new SqliteDeprovisioningQueueRepository(sqlite.connection),
      accessRequestRepository: new SqliteAccessRequestRepository(sqlite.connection),
      accessRequestApprovalRepository: new SqliteAccessRequestApprovalRepository(sqlite.connection),
      accessReviewCampaignRepository: new SqliteAccessReviewCampaignRepository(sqlite.connection),
      accessReviewItemRepository: new SqliteAccessReviewItemRepository(sqlite.connection),
      elevationRequestRepository: new SqliteElevationRequestRepository(sqlite.connection),
      elevationSessionRepository: new SqliteElevationSessionRepository(sqlite.connection),
      eventHookRepository: new SqliteEventHookRepository(sqlite.connection),
      eventNotificationRepository: new SqliteEventNotificationRepository(sqlite.connection),
      instanceSettingsRepository: new SqliteInstanceSettingsRepository(sqlite.connection),
      samlServiceProviderRepository: new SqliteSamlServiceProviderRepository(sqlite.connection),
      samlNameIdMappingRepository: new SqliteSamlNameIdMappingRepository(sqlite.connection),
      samlAssertionAuditRepository: new SqliteSamlAssertionAuditRepository(sqlite.connection),
      riskEventRepository: new SqliteRiskEventRepository(sqlite.connection),
      serviceIdentityRepository: new SqliteServiceIdentityRepository(sqlite.connection),
      serviceIdentityCredentialRepository: new SqliteServiceIdentityCredentialRepository(sqlite.connection),
      connectorRepository: new SqliteConnectorRepository(sqlite.connection),
      connectorRunRepository: new SqliteConnectorRunRepository(sqlite.connection),
      connectorMappingRepository: new SqliteConnectorMappingRepository(sqlite.connection),
      authMetricRepository: new SqliteAuthMetricRepository(sqlite.connection),
      dispose: async () => {
        sqlite.connection.close();
      }
    };
  }

  return createPrismaRepositoryBundle(config);
};
