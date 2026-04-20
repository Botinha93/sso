import type {
  AccessTokenRecord,
  AuthenticationFlow,
  AuditEvent,
  AuthorizationCode,
  Consent,
  EventHook,
  EventNotification,
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
export interface RoleRepository {
  create(input: Omit<Role, "id" | "createdAt">): Promise<Role>;
  update(id: string, input: Partial<Omit<Role, "id" | "createdAt">>): Promise<Role | undefined>;
  list(): Promise<Role[]>;
  findByIds(ids: string[]): Promise<Role[]>;
  findByName(name: string): Promise<Role | undefined>;
  delete(id: string): Promise<void>;
}

export interface UserRepository {
  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  list(): Promise<User[]>;
  findByEmail(email: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId" | "isServiceUser">>): Promise<User | undefined>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
  setCustomAttributes(id: string, customAttributes: Record<string, string>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AppRepository {
  create(input: Omit<App, "id" | "createdAt">): Promise<App>;
  list(): Promise<App[]>;
  findById(id: string): Promise<App | undefined>;
  update(id: string, input: Partial<Omit<App, "id" | "createdAt">>): Promise<App | undefined>;
  delete(id: string): Promise<void>;
}

export interface InstanceSettingsRepository {
  get(): Promise<InstanceSettings | undefined>;
  upsert(input: Omit<InstanceSettings, "updatedAt">): Promise<InstanceSettings>;
}

export interface ClientRepository {
  create(input: Omit<OAuthClient, "createdAt">): Promise<OAuthClient>;
  findById(id: string): Promise<OAuthClient | undefined>;
  list(): Promise<OAuthClient[]>;
  update(id: string, input: Partial<Omit<OAuthClient, "id" | "createdAt">>): Promise<OAuthClient | undefined>;
  delete(id: string): Promise<void>;
}

export interface ScopeRepository {
  create(input: Omit<OAuthScope, "id" | "createdAt">): Promise<OAuthScope>;
  list(): Promise<OAuthScope[]>;
  findByName(name: string): Promise<OAuthScope | undefined>;
  delete(id: string): Promise<void>;
}

export interface SessionRepository {
  create(input: Omit<Session, "id">): Promise<Session>;
  findById(id: string): Promise<Session | undefined>;
  list(): Promise<Session[]>;
  revoke(id: string, revokedAt: Date): Promise<void>;
}

export interface TotpCredentialRepository {
  findByUserId(userId: string): Promise<TotpCredential | undefined>;
  upsert(input: Omit<TotpCredential, "createdAt" | "updatedAt">): Promise<TotpCredential>;
  delete(userId: string): Promise<void>;
}

export interface AuthorizationCodeRepository {
  create(input: Omit<AuthorizationCode, "id" | "createdAt">): Promise<AuthorizationCode>;
  consume(code: string): Promise<AuthorizationCode | undefined>;
}

export interface TenantRepository {
  create(input: Omit<Tenant, "id" | "createdAt">): Promise<Tenant>;
  list(): Promise<Tenant[]>;
  findBySlug(slug: string): Promise<Tenant | undefined>;
  findById(id: string): Promise<Tenant | undefined>;
  update(id: string, input: Partial<Omit<Tenant, "id" | "createdAt">>): Promise<Tenant | undefined>;
}

export interface GroupRepository {
  create(input: Omit<Group, "id" | "createdAt">): Promise<Group>;
  list(): Promise<Group[]>;
  findById(id: string): Promise<Group | undefined>;
  update(id: string, input: Partial<Omit<Group, "id" | "createdAt">>): Promise<Group | undefined>;
  delete(id: string): Promise<void>;
}

export interface UserGroupAssignmentRepository {
  assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): Promise<UserGroupAssignment>;
  listByUser(userId: string): Promise<UserGroupAssignment[]>;
  remove(userId: string, groupId: string): Promise<void>;
}

export interface GroupRoleAssignmentRepository {
  assign(input: Omit<GroupRoleAssignment, "id" | "createdAt">): Promise<GroupRoleAssignment>;
  listByGroup(groupId: string): Promise<GroupRoleAssignment[]>;
  listByGroups(groupIds: string[]): Promise<GroupRoleAssignment[]>;
  remove(groupId: string, roleId: string): Promise<void>;
}

export interface UserRoleAssignmentRepository {
  assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): Promise<UserRoleAssignment>;
  listByUser(userId: string): Promise<UserRoleAssignment[]>;
}

export interface ConsentRepository {
  upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Promise<Consent>;
  findByUserAndClient(userId: string, clientId: string): Promise<Consent | undefined>;
  list(): Promise<Consent[]>;
  revoke(id: string): Promise<void>;
}

export interface RefreshTokenRepository {
  create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Promise<RefreshTokenRecord>;
  findActiveByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  markConsumed(tokenId: string, consumedAt: Date): Promise<void>;
  revokeTokenFamily(tokenId: string, revokedAt: Date): Promise<void>;
  revokeByTokenId(tokenId: string, revokedAt: Date): Promise<void>;
}

export interface AccessTokenRepository {
  create(input: Omit<AccessTokenRecord, "id" | "createdAt">): Promise<AccessTokenRecord>;
  isRevoked(tokenId: string): Promise<boolean>;
  revokeByTokenId(tokenId: string, revokedAt: Date): Promise<void>;
}

export interface AuditRepository {
  log(input: Omit<AuditEvent, "id" | "createdAt">): Promise<AuditEvent>;
  list(limit?: number): Promise<AuditEvent[]>;
}

export interface FederatedIdentityRepository {
  findByProviderSubject(providerId: string, providerSubject: string): Promise<FederatedIdentity | undefined>;
  create(input: Omit<FederatedIdentity, "id" | "createdAt" | "lastLoginAt">): Promise<FederatedIdentity>;
  touchLogin(id: string, loggedAt: Date): Promise<void>;
}

export interface FederationTransactionRepository {
  create(input: Omit<FederationTransaction, "createdAt">): Promise<FederationTransaction>;
  consume(state: string): Promise<FederationTransaction | undefined>;
  purgeExpired(now: Date): Promise<void>;
}

export interface FederationProviderRepository {
  list(): Promise<FederationProvider[]>;
  findById(id: string): Promise<FederationProvider | undefined>;
  create(input: Omit<FederationProvider, "createdAt" | "updatedAt">): Promise<FederationProvider>;
  update(id: string, input: Partial<Omit<FederationProvider, "id" | "createdAt" | "updatedAt">>): Promise<FederationProvider | undefined>;
  delete(id: string): Promise<void>;
}

export interface AuthenticationFlowRepository {
  list(): Promise<AuthenticationFlow[]>;
  findById(id: string): Promise<AuthenticationFlow | undefined>;
  create(input: Omit<AuthenticationFlow, "createdAt" | "updatedAt">): Promise<AuthenticationFlow>;
  update(id: string, input: Partial<Omit<AuthenticationFlow, "id" | "createdAt" | "updatedAt">>): Promise<AuthenticationFlow | undefined>;
  delete(id: string): Promise<void>;
}

export interface UserAttributeRepository {
  list(): Promise<UserAttributeDefinition[]>;
  findById(id: string): Promise<UserAttributeDefinition | undefined>;
  findByKey(key: string): Promise<UserAttributeDefinition | undefined>;
  create(input: Omit<UserAttributeDefinition, "createdAt" | "updatedAt">): Promise<UserAttributeDefinition>;
  update(id: string, input: Partial<Omit<UserAttributeDefinition, "id" | "createdAt" | "updatedAt">>): Promise<UserAttributeDefinition | undefined>;
  delete(id: string): Promise<void>;
}

export interface GroupUserAttributeAssignmentRepository {
  list(): Promise<GroupUserAttributeAssignment[]>;
  listByAttribute(attributeId: string): Promise<GroupUserAttributeAssignment[]>;
  upsert(input: Omit<GroupUserAttributeAssignment, "id" | "createdAt" | "updatedAt">): Promise<GroupUserAttributeAssignment>;
  delete(attributeId: string, groupId: string): Promise<void>;
}

export interface PolicyDefinitionRepository {
  list(): Promise<PolicyDefinition[]>;
  findById(id: string): Promise<PolicyDefinition | undefined>;
  findByKey(key: string): Promise<PolicyDefinition | undefined>;
  create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): Promise<PolicyDefinition>;
  update(id: string, input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>): Promise<PolicyDefinition | undefined>;
  delete(id: string): Promise<void>;
}

export interface PolicyAssignmentRepository {
  list(): Promise<PolicyAssignment[]>;
  listByPolicy(policyId: string): Promise<PolicyAssignment[]>;
  upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): Promise<PolicyAssignment>;
  delete(policyId: string, scopeType: PolicyScopeType, scopeId: string): Promise<void>;
}

export interface PolicyDecisionLogRepository {
  list(limit?: number): Promise<PolicyDecisionLog[]>;
  create(input: Omit<PolicyDecisionLog, "id" | "createdAt">): Promise<PolicyDecisionLog>;
}

export interface ScimTokenRepository {
  list(): Promise<ScimToken[]>;
  findByTokenHash(tokenHash: string): Promise<ScimToken | undefined>;
  create(input: Omit<ScimToken, "id" | "createdAt" | "updatedAt" | "lastUsedAt">): Promise<ScimToken>;
  touchLastUsed(id: string, usedAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventHookRepository {
  list(): Promise<EventHook[]>;
  listByEventType(eventType: string): Promise<EventHook[]>;
  findById(id: string): Promise<EventHook | undefined>;
  create(input: Omit<EventHook, "createdAt" | "updatedAt">): Promise<EventHook>;
  update(id: string, input: Partial<Omit<EventHook, "id" | "createdAt" | "updatedAt">>): Promise<EventHook | undefined>;
  delete(id: string): Promise<void>;
}

export interface EventNotificationRepository {
  list(limit?: number): Promise<EventNotification[]>;
  create(input: Omit<EventNotification, "id" | "createdAt">): Promise<EventNotification>;
}
