import { nanoid } from "nanoid";
import type {
  AccessTokenRecord,
  AccessRequest,
  App,
  AuditEvent,
  AuthenticationFlow,
  AuthorizationCode,
  Consent,
  DeprovisioningQueueItem,
  EventHook,
  EventNotification,
  FederatedIdentity,
  FederationProvider,
  FederationTransaction,
  Group,
  GroupRoleAssignment,
  GroupUserAttributeAssignment,
  InstanceSettings,
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
  UserGroupAssignment,
  UserRoleAssignment
} from "../domain/models.js";
import type { RepositoryBundle } from "./factory.js";

type PrismaRow = Record<string, unknown>;

const readField = (row: PrismaRow, ...keys: string[]) => {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return undefined;
};

type PrismaClientLike = {
  role: any;
  user: any;
  client: any;
  scope: any;
  session: any;
  totpCredential: any;
  authorizationCode: any;
  tenant: any;
  app: any;
  instanceSetting: any;
  group: any;
  userGroupAssignment: any;
  groupRoleAssignment: any;
  userRoleAssignment: any;
  consent: any;
  refreshToken: any;
  accessToken: any;
  auditLog: any;
  federatedIdentity: any;
  federationTransaction: any;
  federationProvider: any;
  authenticationFlow: any;
  userAttributeDefinition: any;
  groupUserAttributeAssignment: any;
  policyDefinition: any;
  policyAssignment: any;
  policyDecisionLog: any;
  scimToken: any;
  provisioningMapping: any;
  provisioningJob: any;
  deprovisioningQueue: any;
  accessRequest: any;
  eventHook: any;
  eventNotification: any;
  $queryRaw<T = PrismaRow[]>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

const asDate = (value: unknown) => new Date(String(value));
const maybeDate = (value: unknown) => (value === null || value === undefined || value === "" ? undefined : asDate(value));
const asBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "") {
      return false;
    }
    if (normalized === "1" || normalized === "true") {
      return true;
    }
  }

  return Boolean(value);
};
const asBooleanInt = (value: boolean) => (value ? 1 : 0);

const parseStringArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const parseStringRecord = (value: unknown): Record<string, string> => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(String(value)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, String(entry)]));
  } catch {
    return {};
  }
};

const parseObjectRecord = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(String(value));
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const mapRole = (row: PrismaRow): Role => ({
  id: String(readField(row, "id")),
  appId: readField(row, "appId", "app_id") ? String(readField(row, "appId", "app_id")) : undefined,
  name: String(readField(row, "name")),
  description: String(readField(row, "description")),
  permissions: parseStringArray(readField(row, "permissionsJson", "permissions_json")),
  scope: String(readField(row, "scope")) as Role["scope"],
  createdAt: asDate(readField(row, "createdAt", "created_at"))
});

const mapUser = (row: PrismaRow): User => ({
  id: String(readField(row, "id")),
  appId: readField(row, "appId", "app_id") ? String(readField(row, "appId", "app_id")) : undefined,
  externalSource: readField(row, "externalSource", "external_source") ? String(readField(row, "externalSource", "external_source")) : undefined,
  externalId: readField(row, "externalId", "external_id") ? String(readField(row, "externalId", "external_id")) : undefined,
  isServiceUser: asBoolean(readField(row, "isServiceUser", "is_service_user")),
  email: String(readField(row, "email")),
  username: String(readField(row, "username")),
  passwordHash: String(readField(row, "passwordHash", "password_hash")),
  givenName: String(readField(row, "givenName", "given_name")),
  familyName: String(readField(row, "familyName", "family_name")),
  customAttributes: parseStringRecord(readField(row, "customAttributesJson", "custom_attributes_json")),
  active: asBoolean(readField(row, "active")),
  createdAt: asDate(readField(row, "createdAt", "created_at")),
  updatedAt: asDate(readField(row, "updatedAt", "updated_at"))
});

const mapClient = (row: PrismaRow): OAuthClient => ({
  id: String(row.id),
  appId: row.appId ? String(row.appId) : undefined,
  name: String(row.name),
  secret: String(row.secret),
  redirectUris: parseStringArray(row.redirectUrisJson),
  allowedScopes: parseStringArray(row.allowedScopesJson),
  grants: parseStringArray(row.grantsJson) as OAuthClient["grants"],
  requirePkce: asBoolean(row.requirePkce),
  resources: parseStringArray(row.resourcesJson),
  flowIds: parseStringArray(row.flowIdsJson),
  createdAt: asDate(row.createdAt)
});

const mapScope = (row: PrismaRow): OAuthScope => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  createdAt: asDate(row.createdAt)
});

const mapSession = (row: PrismaRow): Session => ({
  id: String(row.id),
  userId: String(row.userId),
  clientId: String(row.clientId),
  createdAt: asDate(row.createdAt),
  expiresAt: asDate(row.expiresAt),
  revokedAt: maybeDate(row.revokedAt)
});

const mapTotpCredential = (row: PrismaRow): TotpCredential => ({
  userId: String(row.userId),
  secret: String(row.secret),
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapAuthorizationCode = (row: PrismaRow): AuthorizationCode => ({
  id: String(row.id),
  code: String(row.code),
  clientId: String(row.clientId),
  userId: String(row.userId),
  redirectUri: String(row.redirectUri),
  scope: parseStringArray(row.scopeJson),
  codeChallenge: row.codeChallenge ? String(row.codeChallenge) : undefined,
  codeChallengeMethod: row.codeChallengeMethod ? "S256" : undefined,
  expiresAt: asDate(row.expiresAt),
  createdAt: asDate(row.createdAt)
});

const mapTenant = (row: PrismaRow): Tenant => ({
  id: String(row.id),
  slug: String(row.slug),
  name: String(row.name),
  active: asBoolean(row.active),
  createdAt: asDate(row.createdAt)
});

const mapGroup = (row: PrismaRow): Group => ({
  id: String(row.id),
  appId: row.appId ? String(row.appId) : undefined,
  externalSource: row.externalSource ? String(row.externalSource) : undefined,
  externalId: row.externalId ? String(row.externalId) : undefined,
  name: String(row.name),
  description: String(row.description),
  createdAt: asDate(row.createdAt)
});

const mapApp = (row: PrismaRow): App => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  icon: row.icon ? String(row.icon) : undefined,
  url: row.url ? String(row.url) : undefined,
  createdAt: asDate(row.createdAt)
});

const mapInstanceSettings = (row: PrismaRow): InstanceSettings => {
  const parsed = parseObjectRecord(row.settingsJson) as Partial<InstanceSettings>;

  return {
    id: String(row.id),
    databaseProvider: parsed.databaseProvider === "postgresql" || parsed.databaseProvider === "mysql" ? parsed.databaseProvider : "sqlite",
    databasePath: typeof parsed.databasePath === "string" && parsed.databasePath.length > 0 ? parsed.databasePath : "./data/sso.sqlite",
    externalDatabaseUrl: typeof parsed.externalDatabaseUrl === "string" && parsed.externalDatabaseUrl.length > 0 ? parsed.externalDatabaseUrl : undefined,
    requireHttps: Boolean(parsed.requireHttps),
    secureCookies: Boolean(parsed.secureCookies),
    allowAnyCorsOrigin: Boolean(parsed.allowAnyCorsOrigin),
    corsAllowedOrigins: Array.isArray(parsed.corsAllowedOrigins) ? parsed.corsAllowedOrigins.map(String) : [],
    requireHttpsRedirectUris: Boolean(parsed.requireHttpsRedirectUris),
    requireS256Pkce: Boolean(parsed.requireS256Pkce),
    allowImplicitFlow: Boolean(parsed.allowImplicitFlow),
    loginFailureWindowMs: typeof parsed.loginFailureWindowMs === "number" ? parsed.loginFailureWindowMs : 15 * 60 * 1000,
    loginLockoutThreshold: typeof parsed.loginLockoutThreshold === "number" ? parsed.loginLockoutThreshold : 5,
    loginLockoutDurationMs: typeof parsed.loginLockoutDurationMs === "number" ? parsed.loginLockoutDurationMs : 15 * 60 * 1000,
    sessionAnomalyConcurrencyThreshold: typeof parsed.sessionAnomalyConcurrencyThreshold === "number" ? parsed.sessionAnomalyConcurrencyThreshold : 5,
    emailTransport: parsed.emailTransport === "disabled" || parsed.emailTransport === "smtp" ? parsed.emailTransport : "log",
    emailFrom: typeof parsed.emailFrom === "string" && parsed.emailFrom.length > 0 ? parsed.emailFrom : "no-reply@example.local",
    smtpHost: typeof parsed.smtpHost === "string" && parsed.smtpHost.length > 0 ? parsed.smtpHost : undefined,
    smtpPort: typeof parsed.smtpPort === "number" ? parsed.smtpPort : undefined,
    smtpSecure: typeof parsed.smtpSecure === "boolean" ? parsed.smtpSecure : false,
    smtpUser: typeof parsed.smtpUser === "string" && parsed.smtpUser.length > 0 ? parsed.smtpUser : undefined,
    smtpPass: typeof parsed.smtpPass === "string" && parsed.smtpPass.length > 0 ? parsed.smtpPass : undefined,
    tokenSigningAlgorithm: "RS256",
    updatedAt: asDate(row.updatedAt)
  };
};

const mapUserGroupAssignment = (row: PrismaRow): UserGroupAssignment => ({
  id: String(row.id),
  userId: String(row.userId),
  groupId: String(row.groupId),
  createdAt: asDate(row.createdAt)
});

const mapGroupRoleAssignment = (row: PrismaRow): GroupRoleAssignment => ({
  id: String(row.id),
  groupId: String(row.groupId),
  roleId: String(row.roleId),
  createdAt: asDate(row.createdAt)
});

const mapAssignment = (row: PrismaRow): UserRoleAssignment => ({
  id: String(row.id),
  userId: String(row.userId),
  roleId: String(row.roleId),
  tenantId: row.tenantId ? String(row.tenantId) : undefined,
  createdAt: asDate(row.createdAt)
});

const mapConsent = (row: PrismaRow): Consent => ({
  id: String(row.id),
  userId: String(row.userId),
  clientId: String(row.clientId),
  scope: parseStringArray(row.scopeJson),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapRefreshToken = (row: PrismaRow): RefreshTokenRecord => ({
  id: String(row.id),
  tokenId: String(row.tokenId),
  tokenHash: String(row.tokenHash),
  userId: String(row.userId),
  clientId: String(row.clientId),
  sessionId: String(row.sessionId),
  scope: parseStringArray(row.scopeJson),
  expiresAt: asDate(row.expiresAt),
  createdAt: asDate(row.createdAt),
  consumedAt: maybeDate(row.consumedAt),
  revokedAt: maybeDate(row.revokedAt),
  rotatedFromTokenId: row.rotatedFromTokenId ? String(row.rotatedFromTokenId) : undefined
});

const mapAccessToken = (row: PrismaRow): AccessTokenRecord => ({
  id: String(row.id),
  tokenId: String(row.tokenId),
  userId: String(row.userId),
  clientId: String(row.clientId),
  sessionId: String(row.sessionId),
  expiresAt: asDate(row.expiresAt),
  createdAt: asDate(row.createdAt),
  revokedAt: maybeDate(row.revokedAt)
});

const mapAuditEvent = (row: PrismaRow): AuditEvent => ({
  id: String(row.id),
  type: String(row.type) as AuditEvent["type"],
  actorId: row.actorId ? String(row.actorId) : undefined,
  actorType: String(row.actorType) as AuditEvent["actorType"],
  clientId: row.clientId ? String(row.clientId) : undefined,
  ip: row.ip ? String(row.ip) : undefined,
  metadata: row.metadataJson ? parseObjectRecord(row.metadataJson) : undefined,
  createdAt: asDate(row.createdAt)
});

const mapFederatedIdentity = (row: PrismaRow): FederatedIdentity => ({
  id: String(row.id),
  providerId: String(row.providerId),
  providerSubject: String(row.providerSubject),
  userId: String(row.userId),
  email: row.email ? String(row.email) : undefined,
  createdAt: asDate(row.createdAt),
  lastLoginAt: asDate(row.lastLoginAt)
});

const mapFederationTransaction = (row: PrismaRow): FederationTransaction => ({
  state: String(row.state),
  providerId: String(row.providerId),
  codeVerifier: String(row.codeVerifier),
  redirectAfterLogin: String(row.redirectAfterLogin),
  createdAt: asDate(row.createdAt),
  expiresAt: asDate(row.expiresAt)
});

const mapFederationProvider = (row: PrismaRow): FederationProvider => ({
  id: String(row.id),
  label: String(row.label),
  authorizationEndpoint: String(row.authorizationEndpoint),
  tokenEndpoint: String(row.tokenEndpoint),
  userInfoEndpoint: String(row.userInfoEndpoint),
  clientId: String(row.clientId),
  clientSecret: String(row.clientSecret),
  scopes: parseStringArray(row.scopesJson),
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapAuthenticationFlow = (row: PrismaRow): AuthenticationFlow => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  designation: typeof row.designation === "string" && String(row.designation).length > 0 ? String(row.designation) as AuthenticationFlow["designation"] : "authentication",
  enabled: asBoolean(row.enabled),
  grantTypes: (parseStringArray(row.grantsJson).length ? parseStringArray(row.grantsJson) : ["authorization_code"]) as AuthenticationFlow["grantTypes"],
  stages: JSON.parse(String(row.stagesJson)) as AuthenticationFlow["stages"],
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapUserAttributeDefinition = (row: PrismaRow): UserAttributeDefinition => ({
  id: String(row.id),
  key: String(row.key),
  name: String(row.name),
  description: String(row.description),
  type: String(row.type) as UserAttributeDefinition["type"],
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapGroupUserAttributeAssignment = (row: PrismaRow): GroupUserAttributeAssignment => ({
  id: String(row.id),
  groupId: String(row.groupId),
  attributeId: String(row.attributeId),
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapPolicyDefinition = (row: PrismaRow): PolicyDefinition => ({
  id: String(row.id),
  key: String(row.key),
  name: String(row.name),
  description: String(row.description),
  category: row.category === "authorization" ? "authorization" : "authentication",
  effect: row.effect === "allow" ? "allow" : "deny",
  resourcePattern: row.resourcePattern ? String(row.resourcePattern) : undefined,
  actionPattern: row.actionPattern ? String(row.actionPattern) : undefined,
  stageBindings: parseStringArray(row.stageBindingsJson) as PolicyDefinition["stageBindings"],
  javascriptCode: row.javascriptCode ? String(row.javascriptCode) : undefined,
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapPolicyAssignment = (row: PrismaRow): PolicyAssignment => ({
  id: String(row.id),
  policyId: String(row.policyId),
  scopeType: String(row.scopeType) as PolicyScopeType,
  scopeId: row.scopeId ? String(row.scopeId) : undefined,
  enabled: asBoolean(row.enabled),
  priority: typeof row.priority === "number" ? row.priority : 0,
  decisionStrategy: row.decisionStrategy ? String(row.decisionStrategy) as PolicyAssignment["decisionStrategy"] : undefined,
  config: parseObjectRecord(row.configJson),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapPolicyDecisionLog = (row: PrismaRow): PolicyDecisionLog => ({
  id: String(row.id),
  userId: String(row.userId),
  clientId: readField(row, "clientId") ? String(readField(row, "clientId")) : undefined,
  tenantId: readField(row, "tenantId") ? String(readField(row, "tenantId")) : undefined,
  ip: readField(row, "ip") ? String(readField(row, "ip")) : undefined,
  resource: String(row.resource),
  action: String(row.action),
  allow: asBoolean(row.allow),
  deniedBy: parseStringArray(readField(row, "deniedByJson")),
  context: parseObjectRecord(readField(row, "contextJson")),
  source: String(row.source) as PolicyDecisionLog["source"],
  createdAt: asDate(row.createdAt)
});

const mapScimToken = (row: PrismaRow): ScimToken => ({
  id: String(row.id),
  label: String(row.label),
  tokenHash: String(row.tokenHash),
  lastUsedAt: readField(row, "lastUsedAt") ? asDate(readField(row, "lastUsedAt")) : undefined,
  expiresAt: readField(row, "expiresAt") ? asDate(readField(row, "expiresAt")) : undefined,
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapProvisioningMapping = (row: PrismaRow): ProvisioningMapping => ({
  id: String(row.id),
  name: String(row.name),
  sourceAttribute: String(row.sourceAttribute),
  targetAttribute: String(row.targetAttribute),
  transformExpression: readField(row, "transformExpression") ? String(readField(row, "transformExpression")) : undefined,
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapProvisioningJob = (row: PrismaRow): ProvisioningJob => ({
  id: String(row.id),
  jobType: String(row.jobType) as ProvisioningJob["jobType"],
  status: String(row.status) as ProvisioningJob["status"],
  summary: parseObjectRecord(row.summaryJson),
  initiatedByUserId: readField(row, "initiatedByUserId") ? String(readField(row, "initiatedByUserId")) : undefined,
  createdAt: asDate(row.createdAt),
  completedAt: maybeDate(readField(row, "completedAt"))
});

const mapDeprovisioningQueueItem = (row: PrismaRow): DeprovisioningQueueItem => ({
  id: String(row.id),
  subjectType: String(readField(row, "subjectType", "subject_type")) as DeprovisioningQueueItem["subjectType"],
  subjectId: String(readField(row, "subjectId", "subject_id")),
  actionType: String(readField(row, "actionType", "action_type")) as DeprovisioningQueueItem["actionType"],
  status: String(row.status) as DeprovisioningQueueItem["status"],
  payload: parseObjectRecord(readField(row, "payloadJson", "payload_json")),
  error: readField(row, "error") ? String(readField(row, "error")) : undefined,
  createdAt: asDate(readField(row, "createdAt", "created_at")),
  processedAt: maybeDate(readField(row, "processedAt", "processed_at"))
});

const mapAccessRequest = (row: PrismaRow): AccessRequest => ({
  id: String(readField(row, "id")),
  requesterId: String(readField(row, "requesterId", "requester_id")),
  subjectUserId: String(readField(row, "subjectUserId", "subject_user_id")),
  entitlementType: String(readField(row, "entitlementType", "entitlement_type")),
  entitlementValue: String(readField(row, "entitlementValue", "entitlement_value")),
  status: String(readField(row, "status")) as AccessRequest["status"],
  justification: String(readField(row, "justification")),
  expiresAt: maybeDate(readField(row, "expiresAt", "expires_at")),
  createdAt: asDate(readField(row, "createdAt", "created_at")),
  updatedAt: asDate(readField(row, "updatedAt", "updated_at"))
});

const mapEventHook = (row: PrismaRow): EventHook => ({
  id: String(row.id),
  eventType: String(row.eventType),
  targetUrl: String(row.targetUrl),
  method: String(row.method) as EventHook["method"],
  headers: parseObjectRecord(row.headersJson) as Record<string, string>,
  enabled: asBoolean(row.enabled),
  createdAt: asDate(row.createdAt),
  updatedAt: asDate(row.updatedAt)
});

const mapEventNotification = (row: PrismaRow): EventNotification => ({
  id: String(row.id),
  eventType: String(row.eventType),
  hookId: row.hookId ? String(row.hookId) : undefined,
  payload: parseObjectRecord(row.payloadJson),
  status: String(row.status) as EventNotification["status"],
  responseStatus: typeof row.responseStatus === "number" ? row.responseStatus : undefined,
  responseBody: row.responseBody ? String(row.responseBody) : undefined,
  error: row.error ? String(row.error) : undefined,
  createdAt: asDate(row.createdAt)
});

class PrismaRoleRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<Role, "id" | "createdAt">): Promise<Role> {
    const role = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.role.create({
      data: {
        id: role.id,
        appId: role.appId ?? null,
        name: role.name,
        description: role.description,
        permissionsJson: JSON.stringify(role.permissions),
        scope: role.scope,
        createdAt: role.createdAt.toISOString()
      }
    });
    return role;
  }

  async update(id: string, input: Partial<Omit<Role, "id" | "createdAt">>): Promise<Role | undefined> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }

    const current = mapRole(existing as PrismaRow);
    const updated = { ...current, ...input };
    await this.prisma.role.update({
      where: { id },
      data: {
        appId: updated.appId ?? null,
        name: updated.name,
        description: updated.description,
        permissionsJson: JSON.stringify(updated.permissions),
        scope: updated.scope
      }
    });
    return updated;
  }

  async list(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapRole(row));
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.role.findMany({ where: { id: { in: ids } } });
    return rows.map((row: PrismaRow) => mapRole(row));
  }

  async findByName(name: string): Promise<Role | undefined> {
    const row = await this.prisma.role.findUnique({ where: { name } });
    return row ? mapRole(row as PrismaRow) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaUserRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date();
    const user: User = { ...input, id: nanoid(), createdAt: now, updatedAt: now };
    await this.prisma.user.create({
      data: {
        id: user.id,
        appId: user.appId ?? null,
        externalSource: user.externalSource ?? null,
        externalId: user.externalId ?? null,
        isServiceUser: asBooleanInt(user.isServiceUser),
        email: user.email,
        username: user.username,
        passwordHash: user.passwordHash,
        givenName: user.givenName,
        familyName: user.familyName,
        customAttributesJson: JSON.stringify(user.customAttributes),
        active: asBooleanInt(user.active),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    });
    return user;
  }

  async list(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapUser(row));
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const rows = await this.prisma.$queryRaw<PrismaRow[]>`
      SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
    `;
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const rows = await this.prisma.$queryRaw<PrismaRow[]>`
      SELECT * FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row as PrismaRow) : undefined;
  }

  async updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId" | "externalSource" | "externalId" | "isServiceUser">>): Promise<User | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: User = {
      ...existing,
      appId: input.appId !== undefined ? input.appId : existing.appId,
      externalSource: input.externalSource !== undefined ? input.externalSource : existing.externalSource,
      externalId: input.externalId !== undefined ? input.externalId : existing.externalId,
      isServiceUser: input.isServiceUser ?? existing.isServiceUser,
      email: input.email ?? existing.email,
      username: input.username ?? existing.username,
      givenName: input.givenName ?? existing.givenName,
      familyName: input.familyName ?? existing.familyName,
      updatedAt: new Date()
    };

    await this.prisma.user.update({
      where: { id },
      data: {
        appId: updated.appId ?? null,
        externalSource: updated.externalSource ?? null,
        externalId: updated.externalId ?? null,
        isServiceUser: asBooleanInt(updated.isServiceUser),
        email: updated.email,
        username: updated.username,
        givenName: updated.givenName,
        familyName: updated.familyName,
        updatedAt: updated.updatedAt.toISOString()
      }
    });

    return updated;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, updatedAt: new Date().toISOString() }
    });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { active: asBooleanInt(active), updatedAt: new Date().toISOString() }
    });
  }

  async setCustomAttributes(id: string, customAttributes: Record<string, string>): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { customAttributesJson: JSON.stringify(customAttributes), updatedAt: new Date().toISOString() }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaClientRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<OAuthClient, "createdAt">): Promise<OAuthClient> {
    const client: OAuthClient = { ...input, resources: input.resources ?? [], flowIds: input.flowIds ?? [], createdAt: new Date() };
    await this.prisma.client.create({
      data: {
        id: client.id,
        appId: client.appId ?? null,
        name: client.name,
        secret: client.secret,
        redirectUrisJson: JSON.stringify(client.redirectUris),
        allowedScopesJson: JSON.stringify(client.allowedScopes),
        grantsJson: JSON.stringify(client.grants),
        requirePkce: asBooleanInt(client.requirePkce),
        resourcesJson: JSON.stringify(client.resources),
        flowIdsJson: JSON.stringify(client.flowIds),
        createdAt: client.createdAt.toISOString()
      }
    });
    return client;
  }

  async findById(id: string): Promise<OAuthClient | undefined> {
    const row = await this.prisma.client.findUnique({ where: { id } });
    return row ? mapClient(row as PrismaRow) : undefined;
  }

  async list(): Promise<OAuthClient[]> {
    const rows = await this.prisma.client.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapClient(row));
  }

  async update(id: string, input: Partial<Omit<OAuthClient, "id" | "createdAt">>): Promise<OAuthClient | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated = { ...existing, ...input };
    await this.prisma.client.update({
      where: { id },
      data: {
        appId: updated.appId ?? null,
        name: updated.name,
        secret: updated.secret,
        redirectUrisJson: JSON.stringify(updated.redirectUris),
        allowedScopesJson: JSON.stringify(updated.allowedScopes),
        grantsJson: JSON.stringify(updated.grants),
        requirePkce: asBooleanInt(updated.requirePkce),
        resourcesJson: JSON.stringify(updated.resources),
        flowIdsJson: JSON.stringify(updated.flowIds)
      }
    });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaScopeRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<OAuthScope, "id" | "createdAt">): Promise<OAuthScope> {
    const scope: OAuthScope = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.scope.create({ data: { id: scope.id, name: scope.name, description: scope.description, createdAt: scope.createdAt.toISOString() } });
    return scope;
  }

  async list(): Promise<OAuthScope[]> {
    const rows = await this.prisma.scope.findMany({ orderBy: { name: "asc" } });
    return rows.map((row: PrismaRow) => mapScope(row));
  }

  async findByName(name: string): Promise<OAuthScope | undefined> {
    const row = await this.prisma.scope.findUnique({ where: { name } });
    return row ? mapScope(row as PrismaRow) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.scope.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaSessionRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<Session, "id">): Promise<Session> {
    const session: Session = { ...input, id: nanoid() };
    await this.prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        clientId: session.clientId,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null
      }
    });
    return session;
  }

  async findById(id: string): Promise<Session | undefined> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row ? mapSession(row as PrismaRow) : undefined;
  }

  async list(): Promise<Session[]> {
    const rows = await this.prisma.session.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row: PrismaRow) => mapSession(row));
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.update({ where: { id }, data: { revokedAt: revokedAt.toISOString() } }).catch(() => undefined);
  }
}

class PrismaTotpCredentialRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findByUserId(userId: string): Promise<TotpCredential | undefined> {
    const row = await this.prisma.totpCredential.findUnique({ where: { userId } });
    return row ? mapTotpCredential(row as PrismaRow) : undefined;
  }

  async upsert(input: Omit<TotpCredential, "createdAt" | "updatedAt">): Promise<TotpCredential> {
    const existing = await this.findByUserId(input.userId);
    const createdAt = existing?.createdAt ?? new Date();
    const updatedAt = new Date();
    await this.prisma.totpCredential.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, secret: input.secret, enabled: asBooleanInt(input.enabled), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() },
      update: { secret: input.secret, enabled: asBooleanInt(input.enabled), updatedAt: updatedAt.toISOString() }
    });
    return { userId: input.userId, secret: input.secret, enabled: input.enabled, createdAt, updatedAt };
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.totpCredential.delete({ where: { userId } }).catch(() => undefined);
  }
}

class PrismaAuthorizationCodeRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<AuthorizationCode, "id" | "createdAt">): Promise<AuthorizationCode> {
    const code: AuthorizationCode = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.authorizationCode.create({
      data: {
        id: code.id,
        code: code.code,
        clientId: code.clientId,
        userId: code.userId,
        redirectUri: code.redirectUri,
        scopeJson: JSON.stringify(code.scope),
        codeChallenge: code.codeChallenge ?? null,
        codeChallengeMethod: code.codeChallengeMethod ?? null,
        expiresAt: code.expiresAt.toISOString(),
        createdAt: code.createdAt.toISOString()
      }
    });
    return code;
  }

  async consume(rawCode: string): Promise<AuthorizationCode | undefined> {
    const row = await this.prisma.authorizationCode.findUnique({ where: { code: rawCode } });
    if (!row) {
      return undefined;
    }
    await this.prisma.authorizationCode.delete({ where: { code: rawCode } });
    return mapAuthorizationCode(row as PrismaRow);
  }
}

class PrismaTenantRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<Tenant, "id" | "createdAt">): Promise<Tenant> {
    const tenant: Tenant = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.tenant.create({ data: { id: tenant.id, slug: tenant.slug, name: tenant.name, active: asBooleanInt(tenant.active), createdAt: tenant.createdAt.toISOString() } });
    return tenant;
  }

  async list(): Promise<Tenant[]> {
    const rows = await this.prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapTenant(row));
  }

  async findBySlug(slug: string): Promise<Tenant | undefined> {
    const row = await this.prisma.tenant.findUnique({ where: { slug } });
    return row ? mapTenant(row as PrismaRow) : undefined;
  }

  async findById(id: string): Promise<Tenant | undefined> {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
    return row ? mapTenant(row as PrismaRow) : undefined;
  }

  async update(id: string, input: Partial<Omit<Tenant, "id" | "createdAt">>): Promise<Tenant | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: Tenant = { ...existing, slug: input.slug ?? existing.slug, name: input.name ?? existing.name, active: input.active ?? existing.active };
    await this.prisma.tenant.update({ where: { id }, data: { slug: updated.slug, name: updated.name, active: asBooleanInt(updated.active) } });
    return updated;
  }
}

class PrismaAppRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<App, "id" | "createdAt">): Promise<App> {
    const app: App = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.app.create({ data: { id: app.id, name: app.name, description: app.description, icon: app.icon ?? null, url: app.url ?? null, createdAt: app.createdAt.toISOString() } });
    return app;
  }

  async list(): Promise<App[]> {
    const rows = await this.prisma.app.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapApp(row));
  }

  async findById(id: string): Promise<App | undefined> {
    const row = await this.prisma.app.findUnique({ where: { id } });
    return row ? mapApp(row as PrismaRow) : undefined;
  }

  async update(id: string, input: Partial<Omit<App, "id" | "createdAt">>): Promise<App | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: App = { ...existing, name: input.name ?? existing.name, description: input.description ?? existing.description, icon: input.icon !== undefined ? input.icon : existing.icon, url: input.url !== undefined ? input.url : existing.url };
    await this.prisma.app.update({ where: { id }, data: { name: updated.name, description: updated.description, icon: updated.icon ?? null, url: updated.url ?? null } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.app.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaInstanceSettingsRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async get(): Promise<InstanceSettings | undefined> {
    const row = await this.prisma.instanceSetting.findUnique({ where: { id: "instance" } });
    return row ? mapInstanceSettings(row as PrismaRow) : undefined;
  }

  async upsert(input: Omit<InstanceSettings, "updatedAt">): Promise<InstanceSettings> {
    const updatedAt = new Date();
    const settingsJson = JSON.stringify({
      databaseProvider: input.databaseProvider,
      databasePath: input.databasePath,
      externalDatabaseUrl: input.externalDatabaseUrl,
      requireHttps: input.requireHttps,
      secureCookies: input.secureCookies,
      allowAnyCorsOrigin: input.allowAnyCorsOrigin,
      corsAllowedOrigins: input.corsAllowedOrigins,
      requireHttpsRedirectUris: input.requireHttpsRedirectUris,
      requireS256Pkce: input.requireS256Pkce,
      allowImplicitFlow: input.allowImplicitFlow,
      loginFailureWindowMs: input.loginFailureWindowMs,
      loginLockoutThreshold: input.loginLockoutThreshold,
      loginLockoutDurationMs: input.loginLockoutDurationMs,
      sessionAnomalyConcurrencyThreshold: input.sessionAnomalyConcurrencyThreshold,
      emailTransport: input.emailTransport,
      emailFrom: input.emailFrom,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      smtpUser: input.smtpUser,
      smtpPass: input.smtpPass,
      tokenSigningAlgorithm: input.tokenSigningAlgorithm
    });
    await this.prisma.instanceSetting.upsert({ where: { id: input.id }, create: { id: input.id, settingsJson, updatedAt: updatedAt.toISOString() }, update: { settingsJson, updatedAt: updatedAt.toISOString() } });
    return { ...input, tokenSigningAlgorithm: "RS256", updatedAt };
  }
}

class PrismaGroupRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<Group, "id" | "createdAt">): Promise<Group> {
    const group: Group = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.group.create({
      data: {
        id: group.id,
        appId: group.appId ?? null,
        externalSource: group.externalSource ?? null,
        externalId: group.externalId ?? null,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt.toISOString()
      }
    });
    return group;
  }

  async list(): Promise<Group[]> {
    const rows = await this.prisma.group.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapGroup(row));
  }

  async findById(id: string): Promise<Group | undefined> {
    const row = await this.prisma.group.findUnique({ where: { id } });
    return row ? mapGroup(row as PrismaRow) : undefined;
  }

  async update(id: string, input: Partial<Omit<Group, "id" | "createdAt">>): Promise<Group | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: Group = {
      ...existing,
      appId: input.appId ?? existing.appId,
      externalSource: input.externalSource !== undefined ? input.externalSource : existing.externalSource,
      externalId: input.externalId !== undefined ? input.externalId : existing.externalId,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description
    };
    await this.prisma.group.update({
      where: { id },
      data: {
        appId: updated.appId ?? null,
        externalSource: updated.externalSource ?? null,
        externalId: updated.externalId ?? null,
        name: updated.name,
        description: updated.description
      }
    });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.group.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaUserGroupAssignmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): Promise<UserGroupAssignment> {
    const existing = await this.prisma.userGroupAssignment.findFirst({ where: { userId: input.userId, groupId: input.groupId } });
    if (existing) {
      return mapUserGroupAssignment(existing as PrismaRow);
    }

    const assignment: UserGroupAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.userGroupAssignment.create({ data: { id: assignment.id, userId: assignment.userId, groupId: assignment.groupId, createdAt: assignment.createdAt.toISOString() } });
    return assignment;
  }

  async listByUser(userId: string): Promise<UserGroupAssignment[]> {
    const rows = await this.prisma.userGroupAssignment.findMany({ where: { userId } });
    return rows.map((row: PrismaRow) => mapUserGroupAssignment(row));
  }

  async remove(userId: string, groupId: string): Promise<void> {
    await this.prisma.userGroupAssignment.deleteMany({ where: { userId, groupId } });
  }
}

class PrismaGroupRoleAssignmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async assign(input: Omit<GroupRoleAssignment, "id" | "createdAt">): Promise<GroupRoleAssignment> {
    const existing = await this.prisma.groupRoleAssignment.findFirst({ where: { groupId: input.groupId, roleId: input.roleId } });
    if (existing) {
      return mapGroupRoleAssignment(existing as PrismaRow);
    }

    const assignment: GroupRoleAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.groupRoleAssignment.create({ data: { id: assignment.id, groupId: assignment.groupId, roleId: assignment.roleId, createdAt: assignment.createdAt.toISOString() } });
    return assignment;
  }

  async listByGroup(groupId: string): Promise<GroupRoleAssignment[]> {
    const rows = await this.prisma.groupRoleAssignment.findMany({ where: { groupId } });
    return rows.map((row: PrismaRow) => mapGroupRoleAssignment(row));
  }

  async listByGroups(groupIds: string[]): Promise<GroupRoleAssignment[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.groupRoleAssignment.findMany({ where: { groupId: { in: groupIds } } });
    return rows.map((row: PrismaRow) => mapGroupRoleAssignment(row));
  }

  async remove(groupId: string, roleId: string): Promise<void> {
    await this.prisma.groupRoleAssignment.deleteMany({ where: { groupId, roleId } });
  }
}

class PrismaUserRoleAssignmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): Promise<UserRoleAssignment> {
    const existing = await this.prisma.userRoleAssignment.findFirst({ where: { userId: input.userId, roleId: input.roleId, tenantId: input.tenantId ?? null } });
    if (existing) {
      return mapAssignment(existing as PrismaRow);
    }

    const assignment: UserRoleAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.userRoleAssignment.create({ data: { id: assignment.id, userId: assignment.userId, roleId: assignment.roleId, tenantId: assignment.tenantId ?? null, createdAt: assignment.createdAt.toISOString() } });
    return assignment;
  }

  async listByUser(userId: string): Promise<UserRoleAssignment[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({ where: { userId } });
    return rows.map((row: PrismaRow) => mapAssignment(row));
  }
}

class PrismaConsentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Promise<Consent> {
    const existing = await this.findByUserAndClient(input.userId, input.clientId);
    const now = new Date();
    if (existing) {
      await this.prisma.consent.update({ where: { id: existing.id }, data: { scopeJson: JSON.stringify(input.scope), updatedAt: now.toISOString() } });
      return { ...existing, scope: input.scope, updatedAt: now };
    }

    const consent: Consent = { id: nanoid(), userId: input.userId, clientId: input.clientId, scope: input.scope, createdAt: now, updatedAt: now };
    await this.prisma.consent.create({ data: { id: consent.id, userId: consent.userId, clientId: consent.clientId, scopeJson: JSON.stringify(consent.scope), createdAt: consent.createdAt.toISOString(), updatedAt: consent.updatedAt.toISOString() } });
    return consent;
  }

  async findByUserAndClient(userId: string, clientId: string): Promise<Consent | undefined> {
    const row = await this.prisma.consent.findFirst({ where: { userId, clientId } });
    return row ? mapConsent(row as PrismaRow) : undefined;
  }

  async list(): Promise<Consent[]> {
    const rows = await this.prisma.consent.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((row: PrismaRow) => mapConsent(row));
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.consent.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Promise<RefreshTokenRecord> {
    const token: RefreshTokenRecord = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.refreshToken.create({ data: { id: token.id, tokenId: token.tokenId, tokenHash: token.tokenHash, userId: token.userId, clientId: token.clientId, sessionId: token.sessionId, scopeJson: JSON.stringify(token.scope), expiresAt: token.expiresAt.toISOString(), createdAt: token.createdAt.toISOString(), consumedAt: token.consumedAt?.toISOString() ?? null, revokedAt: token.revokedAt?.toISOString() ?? null, rotatedFromTokenId: token.rotatedFromTokenId ?? null } });
    return token;
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.prisma.refreshToken.findFirst({ where: { tokenHash, consumedAt: null, revokedAt: null } });
    return row ? mapRefreshToken(row as PrismaRow) : undefined;
  }

  async markConsumed(tokenId: string, consumedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { tokenId }, data: { consumedAt: consumedAt.toISOString() } });
  }

  async revokeTokenFamily(tokenId: string, revokedAt: Date): Promise<void> {
    const rows = await this.prisma.refreshToken.findMany({ select: { tokenId: true, rotatedFromTokenId: true } });
    const queue = [tokenId];
    const family = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (family.has(current)) {
        continue;
      }
      family.add(current);
      for (const row of rows as Array<{ tokenId: string; rotatedFromTokenId: string | null }>) {
        if (row.rotatedFromTokenId === current) {
          queue.push(row.tokenId);
        }
      }
    }
    await this.prisma.refreshToken.updateMany({ where: { tokenId: { in: [...family] } }, data: { revokedAt: revokedAt.toISOString() } });
  }

  async revokeByTokenId(tokenId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { tokenId }, data: { revokedAt: revokedAt.toISOString() } });
  }
}

class PrismaAccessTokenRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<AccessTokenRecord, "id" | "createdAt">): Promise<AccessTokenRecord> {
    const token: AccessTokenRecord = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.accessToken.create({ data: { id: token.id, tokenId: token.tokenId, userId: token.userId, clientId: token.clientId, sessionId: token.sessionId, expiresAt: token.expiresAt.toISOString(), createdAt: token.createdAt.toISOString(), revokedAt: token.revokedAt?.toISOString() ?? null } });
    return token;
  }

  async isRevoked(tokenId: string): Promise<boolean> {
    const row = await this.prisma.accessToken.findUnique({ where: { tokenId }, select: { revokedAt: true } });
    return Boolean(row?.revokedAt);
  }

  async revokeByTokenId(tokenId: string, revokedAt: Date): Promise<void> {
    await this.prisma.accessToken.updateMany({ where: { tokenId }, data: { revokedAt: revokedAt.toISOString() } });
  }
}

class PrismaAuditRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async log(input: Omit<AuditEvent, "id" | "createdAt">): Promise<AuditEvent> {
    const event: AuditEvent = { ...input, id: nanoid(), createdAt: new Date() };
    await this.prisma.auditLog.create({ data: { id: event.id, type: event.type, actorId: event.actorId ?? null, actorType: event.actorType, clientId: event.clientId ?? null, ip: event.ip ?? null, metadataJson: event.metadata ? JSON.stringify(event.metadata) : null, createdAt: event.createdAt.toISOString() } });
    return event;
  }

  async list(limit = 200): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row: PrismaRow) => mapAuditEvent(row));
  }
}

class PrismaFederatedIdentityRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findByProviderSubject(providerId: string, providerSubject: string): Promise<FederatedIdentity | undefined> {
    const row = await this.prisma.federatedIdentity.findFirst({ where: { providerId, providerSubject } });
    return row ? mapFederatedIdentity(row as PrismaRow) : undefined;
  }

  async create(input: Omit<FederatedIdentity, "id" | "createdAt" | "lastLoginAt">): Promise<FederatedIdentity> {
    const entity: FederatedIdentity = { ...input, id: nanoid(), createdAt: new Date(), lastLoginAt: new Date() };
    await this.prisma.federatedIdentity.create({ data: { id: entity.id, providerId: entity.providerId, providerSubject: entity.providerSubject, userId: entity.userId, email: entity.email ?? null, createdAt: entity.createdAt.toISOString(), lastLoginAt: entity.lastLoginAt.toISOString() } });
    return entity;
  }

  async touchLogin(id: string, loggedAt: Date): Promise<void> {
    await this.prisma.federatedIdentity.update({ where: { id }, data: { lastLoginAt: loggedAt.toISOString() } }).catch(() => undefined);
  }
}

class PrismaFederationTransactionRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: Omit<FederationTransaction, "createdAt">): Promise<FederationTransaction> {
    const transaction: FederationTransaction = { ...input, createdAt: new Date() };
    await this.prisma.federationTransaction.create({ data: { state: transaction.state, providerId: transaction.providerId, codeVerifier: transaction.codeVerifier, redirectAfterLogin: transaction.redirectAfterLogin, createdAt: transaction.createdAt.toISOString(), expiresAt: transaction.expiresAt.toISOString() } });
    return transaction;
  }

  async consume(state: string): Promise<FederationTransaction | undefined> {
    const row = await this.prisma.federationTransaction.findUnique({ where: { state } });
    if (!row) {
      return undefined;
    }
    await this.prisma.federationTransaction.delete({ where: { state } });
    return mapFederationTransaction(row as PrismaRow);
  }

  async purgeExpired(now: Date): Promise<void> {
    await this.prisma.federationTransaction.deleteMany({ where: { expiresAt: { lt: now.toISOString() } } });
  }
}

class PrismaFederationProviderRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<FederationProvider[]> {
    const rows = await this.prisma.federationProvider.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapFederationProvider(row));
  }

  async findById(id: string): Promise<FederationProvider | undefined> {
    const row = await this.prisma.federationProvider.findUnique({ where: { id } });
    return row ? mapFederationProvider(row as PrismaRow) : undefined;
  }

  async create(input: Omit<FederationProvider, "createdAt" | "updatedAt">): Promise<FederationProvider> {
    const now = new Date();
    const provider: FederationProvider = { ...input, createdAt: now, updatedAt: now };
    await this.prisma.federationProvider.create({ data: { id: provider.id, label: provider.label, authorizationEndpoint: provider.authorizationEndpoint, tokenEndpoint: provider.tokenEndpoint, userInfoEndpoint: provider.userInfoEndpoint, clientId: provider.clientId, clientSecret: provider.clientSecret, scopesJson: JSON.stringify(provider.scopes), enabled: asBooleanInt(provider.enabled), createdAt: provider.createdAt.toISOString(), updatedAt: provider.updatedAt.toISOString() } });
    return provider;
  }

  async update(id: string, input: Partial<Omit<FederationProvider, "id" | "createdAt" | "updatedAt">>): Promise<FederationProvider | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: FederationProvider = { ...existing, ...input, updatedAt: new Date() };
    await this.prisma.federationProvider.update({ where: { id }, data: { label: updated.label, authorizationEndpoint: updated.authorizationEndpoint, tokenEndpoint: updated.tokenEndpoint, userInfoEndpoint: updated.userInfoEndpoint, clientId: updated.clientId, clientSecret: updated.clientSecret, scopesJson: JSON.stringify(updated.scopes), enabled: asBooleanInt(updated.enabled), updatedAt: updated.updatedAt.toISOString() } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.federationProvider.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaAuthenticationFlowRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<AuthenticationFlow[]> {
    const rows = await this.prisma.authenticationFlow.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapAuthenticationFlow(row));
  }

  async findById(id: string): Promise<AuthenticationFlow | undefined> {
    const row = await this.prisma.authenticationFlow.findUnique({ where: { id } });
    return row ? mapAuthenticationFlow(row as PrismaRow) : undefined;
  }

  async create(input: Omit<AuthenticationFlow, "createdAt" | "updatedAt">): Promise<AuthenticationFlow> {
    const now = new Date();
    const flow: AuthenticationFlow = { ...input, createdAt: now, updatedAt: now };
    await this.prisma.authenticationFlow.create({ data: { id: flow.id, name: flow.name, description: flow.description, designation: flow.designation, enabled: asBooleanInt(flow.enabled), grantsJson: JSON.stringify(flow.grantTypes), stagesJson: JSON.stringify(flow.stages), createdAt: flow.createdAt.toISOString(), updatedAt: flow.updatedAt.toISOString() } });
    return flow;
  }

  async update(id: string, input: Partial<Omit<AuthenticationFlow, "id" | "createdAt" | "updatedAt">>): Promise<AuthenticationFlow | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: AuthenticationFlow = { ...existing, ...input, updatedAt: new Date() };
    await this.prisma.authenticationFlow.update({ where: { id }, data: { name: updated.name, description: updated.description, designation: updated.designation, enabled: asBooleanInt(updated.enabled), grantsJson: JSON.stringify(updated.grantTypes), stagesJson: JSON.stringify(updated.stages), updatedAt: updated.updatedAt.toISOString() } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.authenticationFlow.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaUserAttributeRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<UserAttributeDefinition[]> {
    const rows = await this.prisma.userAttributeDefinition.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapUserAttributeDefinition(row));
  }

  async findById(id: string): Promise<UserAttributeDefinition | undefined> {
    const row = await this.prisma.userAttributeDefinition.findUnique({ where: { id } });
    return row ? mapUserAttributeDefinition(row as PrismaRow) : undefined;
  }

  async findByKey(key: string): Promise<UserAttributeDefinition | undefined> {
    const row = await this.prisma.userAttributeDefinition.findUnique({ where: { key } });
    return row ? mapUserAttributeDefinition(row as PrismaRow) : undefined;
  }

  async create(input: Omit<UserAttributeDefinition, "createdAt" | "updatedAt">): Promise<UserAttributeDefinition> {
    const now = new Date();
    const attribute: UserAttributeDefinition = { ...input, createdAt: now, updatedAt: now };
    await this.prisma.userAttributeDefinition.create({ data: { id: attribute.id, key: attribute.key, name: attribute.name, description: attribute.description, type: attribute.type, enabled: asBooleanInt(attribute.enabled), createdAt: attribute.createdAt.toISOString(), updatedAt: attribute.updatedAt.toISOString() } });
    return attribute;
  }

  async update(id: string, input: Partial<Omit<UserAttributeDefinition, "id" | "createdAt" | "updatedAt">>): Promise<UserAttributeDefinition | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: UserAttributeDefinition = { ...existing, ...input, updatedAt: new Date() };
    await this.prisma.userAttributeDefinition.update({ where: { id }, data: { key: updated.key, name: updated.name, description: updated.description, type: updated.type, enabled: asBooleanInt(updated.enabled), updatedAt: updated.updatedAt.toISOString() } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userAttributeDefinition.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaGroupUserAttributeAssignmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<GroupUserAttributeAssignment[]> {
    const rows = await this.prisma.groupUserAttributeAssignment.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapGroupUserAttributeAssignment(row));
  }

  async listByAttribute(attributeId: string): Promise<GroupUserAttributeAssignment[]> {
    const rows = await this.prisma.groupUserAttributeAssignment.findMany({ where: { attributeId }, orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapGroupUserAttributeAssignment(row));
  }

  async upsert(input: Omit<GroupUserAttributeAssignment, "id" | "createdAt" | "updatedAt">): Promise<GroupUserAttributeAssignment> {
    const existing = await this.prisma.groupUserAttributeAssignment.findFirst({ where: { groupId: input.groupId, attributeId: input.attributeId } });
    if (existing) {
      const current = mapGroupUserAttributeAssignment(existing as PrismaRow);
      const updated: GroupUserAttributeAssignment = { ...current, enabled: input.enabled, updatedAt: new Date() };
      await this.prisma.groupUserAttributeAssignment.update({ where: { id: updated.id }, data: { enabled: asBooleanInt(updated.enabled), updatedAt: updated.updatedAt.toISOString() } });
      return updated;
    }

    const now = new Date();
    const assignment: GroupUserAttributeAssignment = { id: nanoid(), groupId: input.groupId, attributeId: input.attributeId, enabled: input.enabled, createdAt: now, updatedAt: now };
    await this.prisma.groupUserAttributeAssignment.create({ data: { id: assignment.id, groupId: assignment.groupId, attributeId: assignment.attributeId, enabled: asBooleanInt(assignment.enabled), createdAt: assignment.createdAt.toISOString(), updatedAt: assignment.updatedAt.toISOString() } });
    return assignment;
  }

  async delete(attributeId: string, groupId: string): Promise<void> {
    await this.prisma.groupUserAttributeAssignment.deleteMany({ where: { attributeId, groupId } });
  }
}

class PrismaPolicyDefinitionRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<PolicyDefinition[]> {
    const rows = await this.prisma.policyDefinition.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapPolicyDefinition(row));
  }

  async findById(id: string): Promise<PolicyDefinition | undefined> {
    const row = await this.prisma.policyDefinition.findUnique({ where: { id } });
    return row ? mapPolicyDefinition(row as PrismaRow) : undefined;
  }

  async findByKey(key: string): Promise<PolicyDefinition | undefined> {
    const row = await this.prisma.policyDefinition.findUnique({ where: { key } });
    return row ? mapPolicyDefinition(row as PrismaRow) : undefined;
  }

  async create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): Promise<PolicyDefinition> {
    const now = new Date();
    const policy: PolicyDefinition = { ...input, createdAt: now, updatedAt: now };
    await this.prisma.policyDefinition.create({ data: { id: policy.id, key: policy.key, name: policy.name, description: policy.description, category: policy.category, effect: policy.effect ?? "deny", resourcePattern: policy.resourcePattern ?? null, actionPattern: policy.actionPattern ?? null, stageBindingsJson: JSON.stringify(policy.stageBindings), javascriptCode: policy.javascriptCode ?? null, enabled: asBooleanInt(policy.enabled), createdAt: policy.createdAt.toISOString(), updatedAt: policy.updatedAt.toISOString() } });
    return policy;
  }

  async update(id: string, input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>): Promise<PolicyDefinition | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: PolicyDefinition = { ...existing, ...input, updatedAt: new Date() };
    await this.prisma.policyDefinition.update({ where: { id }, data: { key: updated.key, name: updated.name, description: updated.description, category: updated.category, effect: updated.effect ?? "deny", resourcePattern: updated.resourcePattern ?? null, actionPattern: updated.actionPattern ?? null, stageBindingsJson: JSON.stringify(updated.stageBindings), javascriptCode: updated.javascriptCode ?? null, enabled: asBooleanInt(updated.enabled), updatedAt: updated.updatedAt.toISOString() } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.policyDefinition.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaPolicyAssignmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<PolicyAssignment[]> {
    const rows = await this.prisma.policyAssignment.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapPolicyAssignment(row));
  }

  async listByPolicy(policyId: string): Promise<PolicyAssignment[]> {
    const rows = await this.prisma.policyAssignment.findMany({ where: { policyId }, orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapPolicyAssignment(row));
  }

  async upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): Promise<PolicyAssignment> {
    const existing = await this.prisma.policyAssignment.findFirst({ where: { policyId: input.policyId, scopeType: input.scopeType, scopeId: input.scopeId ?? null } });
    if (existing) {
      const current = mapPolicyAssignment(existing as PrismaRow);
      const updated: PolicyAssignment = { ...current, enabled: input.enabled, priority: input.priority, decisionStrategy: input.decisionStrategy, config: input.config, updatedAt: new Date() };
      await this.prisma.policyAssignment.update({ where: { id: updated.id }, data: { enabled: asBooleanInt(updated.enabled), priority: updated.priority ?? 0, decisionStrategy: updated.decisionStrategy ?? null, configJson: JSON.stringify(updated.config), updatedAt: updated.updatedAt.toISOString() } });
      return updated;
    }

    const now = new Date();
    const assignment: PolicyAssignment = { id: nanoid(), policyId: input.policyId, scopeType: input.scopeType, scopeId: input.scopeId, enabled: input.enabled, priority: input.priority, decisionStrategy: input.decisionStrategy, config: input.config, createdAt: now, updatedAt: now };
    await this.prisma.policyAssignment.create({ data: { id: assignment.id, policyId: assignment.policyId, scopeType: assignment.scopeType, scopeId: assignment.scopeId ?? null, enabled: asBooleanInt(assignment.enabled), priority: assignment.priority ?? 0, decisionStrategy: assignment.decisionStrategy ?? null, configJson: JSON.stringify(assignment.config), createdAt: assignment.createdAt.toISOString(), updatedAt: assignment.updatedAt.toISOString() } });
    return assignment;
  }

  async delete(policyId: string, scopeType: PolicyScopeType, scopeId: string): Promise<void> {
    await this.prisma.policyAssignment.deleteMany({ where: { policyId, scopeType, scopeId } });
  }
}

class PrismaPolicyDecisionLogRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(limit = 100): Promise<PolicyDecisionLog[]> {
    const rows = await this.prisma.policyDecisionLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row: PrismaRow) => mapPolicyDecisionLog(row));
  }

  async create(input: Omit<PolicyDecisionLog, "id" | "createdAt">): Promise<PolicyDecisionLog> {
    const log: PolicyDecisionLog = {
      ...input,
      id: nanoid(),
      createdAt: new Date()
    };
    await this.prisma.policyDecisionLog.create({
      data: {
        id: log.id,
        userId: log.userId,
        clientId: log.clientId ?? null,
        tenantId: log.tenantId ?? null,
        ip: log.ip ?? null,
        resource: log.resource,
        action: log.action,
        allow: asBooleanInt(log.allow),
        deniedByJson: JSON.stringify(log.deniedBy),
        contextJson: JSON.stringify(log.context),
        source: log.source,
        createdAt: log.createdAt.toISOString()
      }
    });
    return log;
  }
}

class PrismaScimTokenRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<ScimToken[]> {
    const rows = await this.prisma.scimToken.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapScimToken(row));
  }

  async findByTokenHash(tokenHash: string): Promise<ScimToken | undefined> {
    const row = await this.prisma.scimToken.findUnique({ where: { tokenHash } });
    return row ? mapScimToken(row as PrismaRow) : undefined;
  }

  async create(input: Omit<ScimToken, "id" | "createdAt" | "updatedAt" | "lastUsedAt">): Promise<ScimToken> {
    const now = new Date();
    const token: ScimToken = {
      ...input,
      id: nanoid(),
      createdAt: now,
      updatedAt: now
    };
    await this.prisma.scimToken.create({
      data: {
        id: token.id,
        label: token.label,
        tokenHash: token.tokenHash,
        lastUsedAt: null,
        expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
        createdAt: token.createdAt.toISOString(),
        updatedAt: token.updatedAt.toISOString()
      }
    });
    return token;
  }

  async touchLastUsed(id: string, usedAt: Date): Promise<void> {
    await this.prisma.scimToken.update({
      where: { id },
      data: {
        lastUsedAt: usedAt.toISOString(),
        updatedAt: usedAt.toISOString()
      }
    }).catch(() => undefined);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.scimToken.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaProvisioningMappingRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<ProvisioningMapping[]> {
    const rows = await this.prisma.provisioningMapping.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapProvisioningMapping(row));
  }

  async create(input: Omit<ProvisioningMapping, "id" | "createdAt" | "updatedAt">): Promise<ProvisioningMapping> {
    const now = new Date();
    const mapping: ProvisioningMapping = {
      ...input,
      id: nanoid(),
      createdAt: now,
      updatedAt: now
    };

    await this.prisma.provisioningMapping.create({
      data: {
        id: mapping.id,
        name: mapping.name,
        sourceAttribute: mapping.sourceAttribute,
        targetAttribute: mapping.targetAttribute,
        transformExpression: mapping.transformExpression ?? null,
        enabled: asBooleanInt(mapping.enabled),
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString()
      }
    });

    return mapping;
  }

  async update(id: string, input: Partial<Omit<ProvisioningMapping, "id" | "createdAt" | "updatedAt">>): Promise<ProvisioningMapping | undefined> {
    const existing = await this.prisma.provisioningMapping.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }

    const current = mapProvisioningMapping(existing as PrismaRow);
    const updated: ProvisioningMapping = {
      ...current,
      ...input,
      updatedAt: new Date()
    };

    await this.prisma.provisioningMapping.update({
      where: { id },
      data: {
        name: updated.name,
        sourceAttribute: updated.sourceAttribute,
        targetAttribute: updated.targetAttribute,
        transformExpression: updated.transformExpression ?? null,
        enabled: asBooleanInt(updated.enabled),
        updatedAt: updated.updatedAt.toISOString()
      }
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.provisioningMapping.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaProvisioningJobRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(limit = 50): Promise<ProvisioningJob[]> {
    const rows = await this.prisma.provisioningJob.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row: PrismaRow) => mapProvisioningJob(row));
  }

  async create(input: Omit<ProvisioningJob, "id" | "createdAt">): Promise<ProvisioningJob> {
    const job: ProvisioningJob = {
      ...input,
      id: nanoid(),
      createdAt: new Date()
    };
    await this.prisma.provisioningJob.create({
      data: {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        summaryJson: JSON.stringify(job.summary),
        initiatedByUserId: job.initiatedByUserId ?? null,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : null
      }
    });
    return job;
  }

  async update(id: string, input: Partial<Omit<ProvisioningJob, "id" | "createdAt">>): Promise<ProvisioningJob | undefined> {
    const existing = await this.prisma.provisioningJob.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }

    const current = mapProvisioningJob(existing as PrismaRow);
    const updated: ProvisioningJob = {
      ...current,
      ...input
    };

    await this.prisma.provisioningJob.update({
      where: { id },
      data: {
        jobType: updated.jobType,
        status: updated.status,
        summaryJson: JSON.stringify(updated.summary),
        initiatedByUserId: updated.initiatedByUserId ?? null,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null
      }
    });

    return updated;
  }
}

class PrismaDeprovisioningQueueRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(limit = 100): Promise<DeprovisioningQueueItem[]> {
    const rows = await this.prisma.deprovisioningQueue.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row: PrismaRow) => mapDeprovisioningQueueItem(row));
  }

  async enqueue(input: Omit<DeprovisioningQueueItem, "id" | "createdAt">): Promise<DeprovisioningQueueItem> {
    const item: DeprovisioningQueueItem = {
      ...input,
      id: nanoid(),
      createdAt: new Date()
    };

    await this.prisma.deprovisioningQueue.create({
      data: {
        id: item.id,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        actionType: item.actionType,
        status: item.status,
        payloadJson: JSON.stringify(item.payload),
        error: item.error ?? null,
        createdAt: item.createdAt.toISOString(),
        processedAt: item.processedAt ? item.processedAt.toISOString() : null
      }
    });

    return item;
  }

  async updateStatus(id: string, input: { status: DeprovisioningQueueItem["status"]; error?: string; processedAt?: Date }): Promise<DeprovisioningQueueItem | undefined> {
    const existing = await this.prisma.deprovisioningQueue.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }

    await this.prisma.deprovisioningQueue.update({
      where: { id },
      data: {
        status: input.status,
        error: input.error ?? null,
        processedAt: input.processedAt ? input.processedAt.toISOString() : null
      }
    });

    return mapDeprovisioningQueueItem({
      ...(existing as PrismaRow),
      status: input.status,
      error: input.error,
      processedAt: input.processedAt ? input.processedAt.toISOString() : null
    });
  }
}

class PrismaAccessRequestRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(input?: { limit?: number; status?: AccessRequest["status"] }): Promise<AccessRequest[]> {
    const limit = Math.max(1, Math.min(200, input?.limit ?? 100));
    const where = input?.status ? { status: input.status } : undefined;
    const rows = await this.prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return rows.map((row: PrismaRow) => mapAccessRequest(row));
  }

  async create(input: Omit<AccessRequest, "id" | "createdAt" | "updatedAt">): Promise<AccessRequest> {
    const now = new Date();
    const request: AccessRequest = {
      ...input,
      id: nanoid(),
      createdAt: now,
      updatedAt: now
    };

    await this.prisma.accessRequest.create({
      data: {
        id: request.id,
        requesterId: request.requesterId,
        subjectUserId: request.subjectUserId,
        entitlementType: request.entitlementType,
        entitlementValue: request.entitlementValue,
        status: request.status,
        justification: request.justification,
        expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString()
      }
    });

    return request;
  }

  async update(id: string, input: Partial<Omit<AccessRequest, "id" | "createdAt">>): Promise<AccessRequest | undefined> {
    const existing = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }

    const current = mapAccessRequest(existing as PrismaRow);
    const updated: AccessRequest = {
      ...current,
      ...input,
      updatedAt: new Date()
    };

    await this.prisma.accessRequest.update({
      where: { id },
      data: {
        requesterId: updated.requesterId,
        subjectUserId: updated.subjectUserId,
        entitlementType: updated.entitlementType,
        entitlementValue: updated.entitlementValue,
        status: updated.status,
        justification: updated.justification,
        expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
        updatedAt: updated.updatedAt.toISOString()
      }
    });

    return updated;
  }
}

class PrismaEventHookRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(): Promise<EventHook[]> {
    const rows = await this.prisma.eventHook.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapEventHook(row));
  }

  async listByEventType(eventType: string): Promise<EventHook[]> {
    const rows = await this.prisma.eventHook.findMany({ where: { eventType }, orderBy: { createdAt: "asc" } });
    return rows.map((row: PrismaRow) => mapEventHook(row));
  }

  async findById(id: string): Promise<EventHook | undefined> {
    const row = await this.prisma.eventHook.findUnique({ where: { id } });
    return row ? mapEventHook(row as PrismaRow) : undefined;
  }

  async create(input: Omit<EventHook, "createdAt" | "updatedAt">): Promise<EventHook> {
    const now = new Date();
    const hook: EventHook = { ...input, createdAt: now, updatedAt: now };
    await this.prisma.eventHook.create({ data: { id: hook.id, eventType: hook.eventType, targetUrl: hook.targetUrl, method: hook.method, headersJson: JSON.stringify(hook.headers), enabled: asBooleanInt(hook.enabled), createdAt: hook.createdAt.toISOString(), updatedAt: hook.updatedAt.toISOString() } });
    return hook;
  }

  async update(id: string, input: Partial<Omit<EventHook, "id" | "createdAt" | "updatedAt">>): Promise<EventHook | undefined> {
    const existing = await this.findById(id);
    if (!existing) {
      return undefined;
    }
    const updated: EventHook = { ...existing, ...input, updatedAt: new Date() };
    await this.prisma.eventHook.update({ where: { id }, data: { eventType: updated.eventType, targetUrl: updated.targetUrl, method: updated.method, headersJson: JSON.stringify(updated.headers), enabled: asBooleanInt(updated.enabled), updatedAt: updated.updatedAt.toISOString() } });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.eventHook.delete({ where: { id } }).catch(() => undefined);
  }
}

class PrismaEventNotificationRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async list(limit = 100): Promise<EventNotification[]> {
    const rows = await this.prisma.eventNotification.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row: PrismaRow) => mapEventNotification(row));
  }

  async create(input: Omit<EventNotification, "id" | "createdAt">): Promise<EventNotification> {
    const notification: EventNotification = { id: nanoid(), ...input, createdAt: new Date() };
    await this.prisma.eventNotification.create({ data: { id: notification.id, eventType: notification.eventType, hookId: notification.hookId ?? null, payloadJson: JSON.stringify(notification.payload), status: notification.status, responseStatus: notification.responseStatus ?? null, responseBody: notification.responseBody ?? null, error: notification.error ?? null, createdAt: notification.createdAt.toISOString() } });
    return notification;
  }
}

export const createPrismaRepositories = (prisma: PrismaClientLike): RepositoryBundle => ({
  roleRepository: new PrismaRoleRepository(prisma),
  tenantRepository: new PrismaTenantRepository(prisma),
  appRepository: new PrismaAppRepository(prisma),
  groupRepository: new PrismaGroupRepository(prisma),
  userGroupAssignmentRepository: new PrismaUserGroupAssignmentRepository(prisma),
  groupRoleAssignmentRepository: new PrismaGroupRoleAssignmentRepository(prisma),
  assignmentRepository: new PrismaUserRoleAssignmentRepository(prisma),
  userRepository: new PrismaUserRepository(prisma),
  clientRepository: new PrismaClientRepository(prisma),
  scopeRepository: new PrismaScopeRepository(prisma),
  sessionRepository: new PrismaSessionRepository(prisma),
  totpCredentialRepository: new PrismaTotpCredentialRepository(prisma),
  authorizationCodeRepository: new PrismaAuthorizationCodeRepository(prisma),
  consentRepository: new PrismaConsentRepository(prisma),
  refreshTokenRepository: new PrismaRefreshTokenRepository(prisma),
  accessTokenRepository: new PrismaAccessTokenRepository(prisma),
  auditRepository: new PrismaAuditRepository(prisma),
  authenticationFlowRepository: new PrismaAuthenticationFlowRepository(prisma),
  federationProviderRepository: new PrismaFederationProviderRepository(prisma),
  federatedIdentityRepository: new PrismaFederatedIdentityRepository(prisma),
  federationTransactionRepository: new PrismaFederationTransactionRepository(prisma),
  userAttributeRepository: new PrismaUserAttributeRepository(prisma),
  groupUserAttributeAssignmentRepository: new PrismaGroupUserAttributeAssignmentRepository(prisma),
  policyDefinitionRepository: new PrismaPolicyDefinitionRepository(prisma),
  policyAssignmentRepository: new PrismaPolicyAssignmentRepository(prisma),
  policyDecisionLogRepository: new PrismaPolicyDecisionLogRepository(prisma),
  scimTokenRepository: new PrismaScimTokenRepository(prisma),
  provisioningMappingRepository: new PrismaProvisioningMappingRepository(prisma),
  provisioningJobRepository: new PrismaProvisioningJobRepository(prisma),
  deprovisioningQueueRepository: new PrismaDeprovisioningQueueRepository(prisma),
  accessRequestRepository: new PrismaAccessRequestRepository(prisma),
  eventHookRepository: new PrismaEventHookRepository(prisma),
  eventNotificationRepository: new PrismaEventNotificationRepository(prisma),
  instanceSettingsRepository: new PrismaInstanceSettingsRepository(prisma)
});
