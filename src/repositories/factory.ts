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
  GroupAppAssignmentRepository,
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
  UserAppAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository,
  ConnectorRepository,
  ConnectorRunRepository,
  ConnectorMappingRepository,
  AuthMetricRepository,
  SuggestionRepository
} from "./contracts.js";
import { createPrismaRepositoryBundle } from "./prisma-factory.js";

export interface RepositoryBundle {
  roleRepository: RoleRepository;
  tenantRepository: TenantRepository;
  appRepository: AppRepository;
  groupRepository: GroupRepository;
  userGroupAssignmentRepository: UserGroupAssignmentRepository;
  userAppAssignmentRepository: UserAppAssignmentRepository;
  groupAppAssignmentRepository: GroupAppAssignmentRepository;
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
  suggestionRepository: SuggestionRepository;
  dispose?: () => Promise<void>;
}

export const createRepositoryBundle = async (config: AppConfig): Promise<RepositoryBundle> => {
  if (config.databaseProvider !== "sqlite" && !config.externalDatabaseUrl) {
    throw new Error(`External database URL is required when database provider is ${config.databaseProvider}`);
  }

  return createPrismaRepositoryBundle(config);
};
