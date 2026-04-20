import type {
  AccessTokenRecord,
  AccessReviewCampaign,
  AccessReviewItem,
  AccessRequest,
  AccessRequestApproval,
  AuthenticationFlow,
  AuditEvent,
  AuthorizationCode,
  Consent,
  ElevationRequest,
  ElevationSession,
  EventHook,
  EventNotification,
  DeprovisioningQueueItem,
  InstanceSettings,
  FederatedIdentity,
  FederationProvider,
  FederationTransaction,
  Group,
  App,
  GroupRoleAssignment,
  OAuthClient,
  OAuthScope,
  PolicyAssignment,
  PolicyDecisionLog,
  PolicyDefinition,
  PolicyScopeType,
  ProvisioningJob,
  ProvisioningMapping,
  ScimToken,
  RefreshTokenRecord,
  Role,
  Session,
  Tenant,
  TotpCredential,
  User,
  UserAttributeDefinition,
  GroupUserAttributeAssignment,
  UserGroupAssignment,
  UserRoleAssignment
} from "../domain/models.js";

type Awaitable<T> = T | Promise<T>;

export interface RoleRepository {
  create(input: Omit<Role, "id" | "createdAt">): Awaitable<Role>;
  update(id: string, input: Partial<Omit<Role, "id" | "createdAt">>): Awaitable<Role | undefined>;
  list(): Awaitable<Role[]>;
  findByIds(ids: string[]): Awaitable<Role[]>;
  findByName(name: string): Awaitable<Role | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface UserRepository {
  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Awaitable<User>;
  list(): Awaitable<User[]>;
  findByEmail(email: string): Awaitable<User | undefined>;
  findByUsername(username: string): Awaitable<User | undefined>;
  findById(id: string): Awaitable<User | undefined>;
  updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId" | "externalSource" | "externalId" | "isServiceUser">>): Awaitable<User | undefined>;
  setPasswordHash(id: string, passwordHash: string): Awaitable<void>;
  setActive(id: string, active: boolean): Awaitable<void>;
  setCustomAttributes(id: string, customAttributes: Record<string, string>): Awaitable<void>;
  delete(id: string): Awaitable<void>;
}

export interface AppRepository {
  create(input: Omit<App, "id" | "createdAt">): Awaitable<App>;
  list(): Awaitable<App[]>;
  findById(id: string): Awaitable<App | undefined>;
  update(id: string, input: Partial<Omit<App, "id" | "createdAt">>): Awaitable<App | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface InstanceSettingsRepository {
  get(): Awaitable<InstanceSettings | undefined>;
  upsert(input: Omit<InstanceSettings, "updatedAt">): Awaitable<InstanceSettings>;
}

export interface ClientRepository {
  create(input: Omit<OAuthClient, "createdAt">): Awaitable<OAuthClient>;
  findById(id: string): Awaitable<OAuthClient | undefined>;
  list(): Awaitable<OAuthClient[]>;
  update(id: string, input: Partial<Omit<OAuthClient, "id" | "createdAt">>): Awaitable<OAuthClient | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface ScopeRepository {
  create(input: Omit<OAuthScope, "id" | "createdAt">): Awaitable<OAuthScope>;
  list(): Awaitable<OAuthScope[]>;
  findByName(name: string): Awaitable<OAuthScope | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface SessionRepository {
  create(input: Omit<Session, "id">): Awaitable<Session>;
  findById(id: string): Awaitable<Session | undefined>;
  list(): Awaitable<Session[]>;
  revoke(id: string, revokedAt: Date): Awaitable<void>;
}

export interface TotpCredentialRepository {
  findByUserId(userId: string): Awaitable<TotpCredential | undefined>;
  upsert(input: Omit<TotpCredential, "createdAt" | "updatedAt">): Awaitable<TotpCredential>;
  delete(userId: string): Awaitable<void>;
}

export interface AuthorizationCodeRepository {
  create(input: Omit<AuthorizationCode, "id" | "createdAt">): Awaitable<AuthorizationCode>;
  consume(code: string): Awaitable<AuthorizationCode | undefined>;
}

export interface TenantRepository {
  create(input: Omit<Tenant, "id" | "createdAt">): Awaitable<Tenant>;
  list(): Awaitable<Tenant[]>;
  findBySlug(slug: string): Awaitable<Tenant | undefined>;
  findById(id: string): Awaitable<Tenant | undefined>;
  update(id: string, input: Partial<Omit<Tenant, "id" | "createdAt">>): Awaitable<Tenant | undefined>;
}

export interface GroupRepository {
  create(input: Omit<Group, "id" | "createdAt">): Awaitable<Group>;
  list(): Awaitable<Group[]>;
  findById(id: string): Awaitable<Group | undefined>;
  update(id: string, input: Partial<Omit<Group, "id" | "createdAt">>): Awaitable<Group | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface UserGroupAssignmentRepository {
  assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): Awaitable<UserGroupAssignment>;
  listByUser(userId: string): Awaitable<UserGroupAssignment[]>;
  remove(userId: string, groupId: string): Awaitable<void>;
}

export interface GroupRoleAssignmentRepository {
  assign(input: Omit<GroupRoleAssignment, "id" | "createdAt">): Awaitable<GroupRoleAssignment>;
  listByGroup(groupId: string): Awaitable<GroupRoleAssignment[]>;
  listByGroups(groupIds: string[]): Awaitable<GroupRoleAssignment[]>;
  remove(groupId: string, roleId: string): Awaitable<void>;
}

export interface UserRoleAssignmentRepository {
  assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): Awaitable<UserRoleAssignment>;
  listByUser(userId: string): Awaitable<UserRoleAssignment[]>;
  remove(input: { userId: string; roleId: string; tenantId?: string }): Awaitable<void>;
}

export interface ConsentRepository {
  upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Awaitable<Consent>;
  findByUserAndClient(userId: string, clientId: string): Awaitable<Consent | undefined>;
  list(): Awaitable<Consent[]>;
  revoke(id: string): Awaitable<void>;
}

export interface RefreshTokenRepository {
  create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Awaitable<RefreshTokenRecord>;
  findActiveByHash(tokenHash: string): Awaitable<RefreshTokenRecord | undefined>;
  markConsumed(tokenId: string, consumedAt: Date): Awaitable<void>;
  revokeTokenFamily(tokenId: string, revokedAt: Date): Awaitable<void>;
  revokeByTokenId(tokenId: string, revokedAt: Date): Awaitable<void>;
}

export interface AccessTokenRepository {
  create(input: Omit<AccessTokenRecord, "id" | "createdAt">): Awaitable<AccessTokenRecord>;
  isRevoked(tokenId: string): Awaitable<boolean>;
  revokeByTokenId(tokenId: string, revokedAt: Date): Awaitable<void>;
}

export interface AuditRepository {
  log(input: Omit<AuditEvent, "id" | "createdAt">): Awaitable<AuditEvent>;
  list(limit?: number): Awaitable<AuditEvent[]>;
}

export interface FederatedIdentityRepository {
  findByProviderSubject(providerId: string, providerSubject: string): Awaitable<FederatedIdentity | undefined>;
  create(input: Omit<FederatedIdentity, "id" | "createdAt" | "lastLoginAt">): Awaitable<FederatedIdentity>;
  touchLogin(id: string, loggedAt: Date): Awaitable<void>;
}

export interface FederationTransactionRepository {
  create(input: Omit<FederationTransaction, "createdAt">): Awaitable<FederationTransaction>;
  consume(state: string): Awaitable<FederationTransaction | undefined>;
  purgeExpired(now: Date): Awaitable<void>;
}

export interface FederationProviderRepository {
  list(): Awaitable<FederationProvider[]>;
  findById(id: string): Awaitable<FederationProvider | undefined>;
  create(input: Omit<FederationProvider, "createdAt" | "updatedAt">): Awaitable<FederationProvider>;
  update(id: string, input: Partial<Omit<FederationProvider, "id" | "createdAt" | "updatedAt">>): Awaitable<FederationProvider | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface AuthenticationFlowRepository {
  list(): Awaitable<AuthenticationFlow[]>;
  findById(id: string): Awaitable<AuthenticationFlow | undefined>;
  create(input: Omit<AuthenticationFlow, "createdAt" | "updatedAt">): Awaitable<AuthenticationFlow>;
  update(id: string, input: Partial<Omit<AuthenticationFlow, "id" | "createdAt" | "updatedAt">>): Awaitable<AuthenticationFlow | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface UserAttributeRepository {
  list(): Awaitable<UserAttributeDefinition[]>;
  findById(id: string): Awaitable<UserAttributeDefinition | undefined>;
  findByKey(key: string): Awaitable<UserAttributeDefinition | undefined>;
  create(input: Omit<UserAttributeDefinition, "createdAt" | "updatedAt">): Awaitable<UserAttributeDefinition>;
  update(id: string, input: Partial<Omit<UserAttributeDefinition, "id" | "createdAt" | "updatedAt">>): Awaitable<UserAttributeDefinition | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface GroupUserAttributeAssignmentRepository {
  list(): Awaitable<GroupUserAttributeAssignment[]>;
  listByAttribute(attributeId: string): Awaitable<GroupUserAttributeAssignment[]>;
  upsert(input: Omit<GroupUserAttributeAssignment, "id" | "createdAt" | "updatedAt">): Awaitable<GroupUserAttributeAssignment>;
  delete(attributeId: string, groupId: string): Awaitable<void>;
}

export interface PolicyDefinitionRepository {
  list(): Awaitable<PolicyDefinition[]>;
  findById(id: string): Awaitable<PolicyDefinition | undefined>;
  findByKey(key: string): Awaitable<PolicyDefinition | undefined>;
  create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): Awaitable<PolicyDefinition>;
  update(id: string, input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>): Awaitable<PolicyDefinition | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface PolicyAssignmentRepository {
  list(): Awaitable<PolicyAssignment[]>;
  listByPolicy(policyId: string): Awaitable<PolicyAssignment[]>;
  upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): Awaitable<PolicyAssignment>;
  delete(policyId: string, scopeType: PolicyScopeType, scopeId: string): Awaitable<void>;
}

export interface PolicyDecisionLogRepository {
  list(limit?: number): Awaitable<PolicyDecisionLog[]>;
  create(input: Omit<PolicyDecisionLog, "id" | "createdAt">): Awaitable<PolicyDecisionLog>;
}

export interface ScimTokenRepository {
  list(): Awaitable<ScimToken[]>;
  findByTokenHash(tokenHash: string): Awaitable<ScimToken | undefined>;
  create(input: Omit<ScimToken, "id" | "createdAt" | "updatedAt" | "lastUsedAt">): Awaitable<ScimToken>;
  touchLastUsed(id: string, usedAt: Date): Awaitable<void>;
  delete(id: string): Awaitable<void>;
}

export interface ProvisioningMappingRepository {
  list(): Awaitable<ProvisioningMapping[]>;
  create(input: Omit<ProvisioningMapping, "id" | "createdAt" | "updatedAt">): Awaitable<ProvisioningMapping>;
  update(id: string, input: Partial<Omit<ProvisioningMapping, "id" | "createdAt" | "updatedAt">>): Awaitable<ProvisioningMapping | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface ProvisioningJobRepository {
  list(limit?: number): Awaitable<ProvisioningJob[]>;
  create(input: Omit<ProvisioningJob, "id" | "createdAt">): Awaitable<ProvisioningJob>;
  update(id: string, input: Partial<Omit<ProvisioningJob, "id" | "createdAt">>): Awaitable<ProvisioningJob | undefined>;
}

export interface DeprovisioningQueueRepository {
  list(limit?: number): Awaitable<DeprovisioningQueueItem[]>;
  enqueue(input: Omit<DeprovisioningQueueItem, "id" | "createdAt">): Awaitable<DeprovisioningQueueItem>;
  updateStatus(id: string, input: {
    status: DeprovisioningQueueItem["status"];
    error?: string;
    processedAt?: Date;
  }): Awaitable<DeprovisioningQueueItem | undefined>;
}

export interface AccessRequestRepository {
  list(input?: { limit?: number; status?: AccessRequest["status"] }): Awaitable<AccessRequest[]>;
  findById(id: string): Awaitable<AccessRequest | undefined>;
  create(input: Omit<AccessRequest, "id" | "createdAt" | "updatedAt">): Awaitable<AccessRequest>;
  update(id: string, input: Partial<Omit<AccessRequest, "id" | "createdAt">>): Awaitable<AccessRequest | undefined>;
}

export interface AccessRequestApprovalRepository {
  listByAccessRequestId(accessRequestId: string): Awaitable<AccessRequestApproval[]>;
  create(input: Omit<AccessRequestApproval, "id" | "createdAt">): Awaitable<AccessRequestApproval>;
}

export interface AccessReviewCampaignRepository {
  list(input?: { limit?: number; status?: AccessReviewCampaign["status"] }): Awaitable<AccessReviewCampaign[]>;
  findById(id: string): Awaitable<AccessReviewCampaign | undefined>;
  create(input: Omit<AccessReviewCampaign, "id" | "createdAt" | "updatedAt">): Awaitable<AccessReviewCampaign>;
  update(id: string, input: Partial<Omit<AccessReviewCampaign, "id" | "createdAt">>): Awaitable<AccessReviewCampaign | undefined>;
}

export interface AccessReviewItemRepository {
  listByCampaignId(campaignId: string): Awaitable<AccessReviewItem[]>;
  findById(id: string): Awaitable<AccessReviewItem | undefined>;
  create(input: Omit<AccessReviewItem, "id" | "createdAt" | "updatedAt">): Awaitable<AccessReviewItem>;
  update(id: string, input: Partial<Omit<AccessReviewItem, "id" | "createdAt">>): Awaitable<AccessReviewItem | undefined>;
}

export interface EventHookRepository {
  list(): Awaitable<EventHook[]>;
  listByEventType(eventType: string): Awaitable<EventHook[]>;
  findById(id: string): Awaitable<EventHook | undefined>;
  create(input: Omit<EventHook, "createdAt" | "updatedAt">): Awaitable<EventHook>;
  update(id: string, input: Partial<Omit<EventHook, "id" | "createdAt" | "updatedAt">>): Awaitable<EventHook | undefined>;
  delete(id: string): Awaitable<void>;
}

export interface EventNotificationRepository {
  list(limit?: number): Awaitable<EventNotification[]>;
  create(input: Omit<EventNotification, "id" | "createdAt">): Awaitable<EventNotification>;
}

export interface ElevationRequestRepository {
  list(input?: { limit?: number; status?: ElevationRequest["status"]; requesterId?: string }): Awaitable<ElevationRequest[]>;
  findById(id: string): Awaitable<ElevationRequest | undefined>;
  create(input: Omit<ElevationRequest, "id" | "createdAt" | "updatedAt">): Awaitable<ElevationRequest>;
  update(id: string, input: Partial<Omit<ElevationRequest, "id" | "createdAt">>): Awaitable<ElevationRequest | undefined>;
}

export interface ElevationSessionRepository {
  list(input?: { limit?: number; status?: ElevationSession["status"]; requesterId?: string }): Awaitable<ElevationSession[]>;
  create(input: Omit<ElevationSession, "id" | "createdAt" | "updatedAt">): Awaitable<ElevationSession>;
  findActive(input: { requesterId: string; resource: string; action: string; now?: Date }): Awaitable<ElevationSession | undefined>;
  closeByElevationRequestId(input: { elevationRequestId: string; status: "revoked" | "expired"; closedAt: Date }): Awaitable<number>;
  closeExpired(now: Date): Awaitable<number>;
}
