import type {
  AccessTokenRecord,
  AuthenticationFlow,
  AuditEvent,
  AuthorizationCode,
  Consent,
  EventHook,
  EventNotification,
  FederatedIdentity,
  FederationProvider,
  FederationTransaction,
  Group,
  App,
  GroupRoleAssignment,
  OAuthClient,
  OAuthScope,
  PolicyAssignment,
  PolicyDefinition,
  PolicyScopeType,
  RefreshTokenRecord,
  Role,
  Session,
  Tenant,
  User,
  UserAttributeDefinition,
  GroupUserAttributeAssignment,
  UserGroupAssignment,
  UserRoleAssignment
} from "../domain/models.js";
export interface RoleRepository {
  create(input: Omit<Role, "id" | "createdAt">): Role;
  update(id: string, input: Partial<Omit<Role, "id" | "createdAt">>): Role | undefined;
  list(): Role[];
  findByIds(ids: string[]): Role[];
  findByName(name: string): Role | undefined;
  delete(id: string): void;
}

export interface UserRepository {
  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): User;
  list(): User[];
  findByEmail(email: string): User | undefined;
  findByUsername(username: string): User | undefined;
  findById(id: string): User | undefined;
  updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId">>): User | undefined;
  setPasswordHash(id: string, passwordHash: string): void;
  setActive(id: string, active: boolean): void;
  setCustomAttributes(id: string, customAttributes: Record<string, string>): void;
  delete(id: string): void;
}

export interface AppRepository {
  create(input: Omit<App, "id" | "createdAt">): App;
  list(): App[];
  findById(id: string): App | undefined;
  update(id: string, input: Partial<Omit<App, "id" | "createdAt">>): App | undefined;
  delete(id: string): void;
}

export interface ClientRepository {
  create(input: Omit<OAuthClient, "createdAt">): OAuthClient;
  findById(id: string): OAuthClient | undefined;
  list(): OAuthClient[];
  update(id: string, input: Partial<Omit<OAuthClient, "id" | "createdAt">>): OAuthClient | undefined;
  delete(id: string): void;
}

export interface ScopeRepository {
  create(input: Omit<OAuthScope, "id" | "createdAt">): OAuthScope;
  list(): OAuthScope[];
  findByName(name: string): OAuthScope | undefined;
  delete(id: string): void;
}

export interface SessionRepository {
  create(input: Omit<Session, "id">): Session;
  findById(id: string): Session | undefined;
  list(): Session[];
  revoke(id: string, revokedAt: Date): void;
}

export interface AuthorizationCodeRepository {
  create(input: Omit<AuthorizationCode, "id" | "createdAt">): AuthorizationCode;
  consume(code: string): AuthorizationCode | undefined;
}

export interface TenantRepository {
  create(input: Omit<Tenant, "id" | "createdAt">): Tenant;
  list(): Tenant[];
  findBySlug(slug: string): Tenant | undefined;
  findById(id: string): Tenant | undefined;
  update(id: string, input: Partial<Omit<Tenant, "id" | "createdAt">>): Tenant | undefined;
}

export interface GroupRepository {
  create(input: Omit<Group, "id" | "createdAt">): Group;
  list(): Group[];
  findById(id: string): Group | undefined;
  update(id: string, input: Partial<Omit<Group, "id" | "createdAt">>): Group | undefined;
  delete(id: string): void;
}

export interface UserGroupAssignmentRepository {
  assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): UserGroupAssignment;
  listByUser(userId: string): UserGroupAssignment[];
  remove(userId: string, groupId: string): void;
}

export interface GroupRoleAssignmentRepository {
  assign(input: Omit<GroupRoleAssignment, "id" | "createdAt">): GroupRoleAssignment;
  listByGroup(groupId: string): GroupRoleAssignment[];
  listByGroups(groupIds: string[]): GroupRoleAssignment[];
  remove(groupId: string, roleId: string): void;
}

export interface UserRoleAssignmentRepository {
  assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): UserRoleAssignment;
  listByUser(userId: string): UserRoleAssignment[];
}

export interface ConsentRepository {
  upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Consent;
  findByUserAndClient(userId: string, clientId: string): Consent | undefined;
  list(): Consent[];
  revoke(id: string): void;
}

export interface RefreshTokenRepository {
  create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): RefreshTokenRecord;
  findActiveByHash(tokenHash: string): RefreshTokenRecord | undefined;
  markConsumed(tokenId: string, consumedAt: Date): void;
  revokeTokenFamily(tokenId: string, revokedAt: Date): void;
  revokeByTokenId(tokenId: string, revokedAt: Date): void;
}

export interface AccessTokenRepository {
  create(input: Omit<AccessTokenRecord, "id" | "createdAt">): AccessTokenRecord;
  isRevoked(tokenId: string): boolean;
  revokeByTokenId(tokenId: string, revokedAt: Date): void;
}

export interface AuditRepository {
  log(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent;
  list(limit?: number): AuditEvent[];
}

export interface FederatedIdentityRepository {
  findByProviderSubject(providerId: string, providerSubject: string): FederatedIdentity | undefined;
  create(input: Omit<FederatedIdentity, "id" | "createdAt" | "lastLoginAt">): FederatedIdentity;
  touchLogin(id: string, loggedAt: Date): void;
}

export interface FederationTransactionRepository {
  create(input: Omit<FederationTransaction, "createdAt">): FederationTransaction;
  consume(state: string): FederationTransaction | undefined;
  purgeExpired(now: Date): void;
}

export interface FederationProviderRepository {
  list(): FederationProvider[];
  findById(id: string): FederationProvider | undefined;
  create(input: Omit<FederationProvider, "createdAt" | "updatedAt">): FederationProvider;
  update(id: string, input: Partial<Omit<FederationProvider, "id" | "createdAt" | "updatedAt">>): FederationProvider | undefined;
  delete(id: string): void;
}

export interface AuthenticationFlowRepository {
  list(): AuthenticationFlow[];
  findById(id: string): AuthenticationFlow | undefined;
  create(input: Omit<AuthenticationFlow, "createdAt" | "updatedAt">): AuthenticationFlow;
  update(id: string, input: Partial<Omit<AuthenticationFlow, "id" | "createdAt" | "updatedAt">>): AuthenticationFlow | undefined;
  delete(id: string): void;
}

export interface UserAttributeRepository {
  list(): UserAttributeDefinition[];
  findById(id: string): UserAttributeDefinition | undefined;
  findByKey(key: string): UserAttributeDefinition | undefined;
  create(input: Omit<UserAttributeDefinition, "createdAt" | "updatedAt">): UserAttributeDefinition;
  update(id: string, input: Partial<Omit<UserAttributeDefinition, "id" | "createdAt" | "updatedAt">>): UserAttributeDefinition | undefined;
  delete(id: string): void;
}

export interface GroupUserAttributeAssignmentRepository {
  list(): GroupUserAttributeAssignment[];
  listByAttribute(attributeId: string): GroupUserAttributeAssignment[];
  upsert(input: Omit<GroupUserAttributeAssignment, "id" | "createdAt" | "updatedAt">): GroupUserAttributeAssignment;
  delete(attributeId: string, groupId: string): void;
}

export interface PolicyDefinitionRepository {
  list(): PolicyDefinition[];
  findById(id: string): PolicyDefinition | undefined;
  findByKey(key: string): PolicyDefinition | undefined;
  create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): PolicyDefinition;
  update(id: string, input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>): PolicyDefinition | undefined;
  delete(id: string): void;
}

export interface PolicyAssignmentRepository {
  list(): PolicyAssignment[];
  listByPolicy(policyId: string): PolicyAssignment[];
  upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): PolicyAssignment;
  delete(policyId: string, scopeType: PolicyScopeType, scopeId: string): void;
}

export interface EventHookRepository {
  list(): EventHook[];
  listByEventType(eventType: string): EventHook[];
  findById(id: string): EventHook | undefined;
  create(input: Omit<EventHook, "createdAt" | "updatedAt">): EventHook;
  update(id: string, input: Partial<Omit<EventHook, "id" | "createdAt" | "updatedAt">>): EventHook | undefined;
  delete(id: string): void;
}

export interface EventNotificationRepository {
  list(limit?: number): EventNotification[];
  create(input: Omit<EventNotification, "id" | "createdAt">): EventNotification;
}
