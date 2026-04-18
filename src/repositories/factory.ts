import type { AppConfig } from "../core/config.js";
import type {
  AccessTokenRepository,
  AppRepository,
  AuditRepository,
  AuthenticationFlowRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ConsentRepository,
  EventHookRepository,
  EventNotificationRepository,
  FederatedIdentityRepository,
  FederationProviderRepository,
  FederationTransactionRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  GroupUserAttributeAssignmentRepository,
  InstanceSettingsRepository,
  PolicyAssignmentRepository,
  PolicyDefinitionRepository,
  RefreshTokenRepository,
  RoleRepository,
  ScopeRepository,
  SessionRepository,
  TenantRepository,
  TotpCredentialRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository
} from "./contracts.js";
import { createPrismaRepositoryBundle } from "./prisma-factory.js";

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
  eventHookRepository: EventHookRepository;
  eventNotificationRepository: EventNotificationRepository;
  instanceSettingsRepository: InstanceSettingsRepository;
}

export const createRepositoryBundle = async (config: AppConfig): Promise<RepositoryBundle> => {
  if (config.databaseProvider !== "sqlite" && !config.externalDatabaseUrl) {
    throw new Error(`DATABASE_URL is required when DATABASE_PROVIDER=${config.databaseProvider}`);
  }

  return createPrismaRepositoryBundle(config);
};
