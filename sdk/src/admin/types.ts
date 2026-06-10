import type { ClientInstance, ClientOptions, ListPageQuery } from "../core/types.js";

export type GrantType = "authorization_code" | "client_credentials" | "refresh_token" | "password" | "device_code" | "token_exchange" | "jwt_bearer" | "saml2_bearer" | "ciba";

export interface SDKApp {
  id: string;
  name: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  url?: string;
  resources: string[];
  createdAt: string;
}

export interface CreateAppInput {
  description: string;
  icon?: string;
  imageUrl?: string;
  name: string;
  resources?: string[];
  url?: string;
}

export interface UpdateAppInput {
  description?: string;
  icon?: string;
  imageUrl?: string;
  name?: string;
  resources?: string[];
  url?: string;
}

export interface SDKAppInheritanceSource {
  appId: string;
  groupId: string;
  groupName: string;
}

export interface SDKUser {
  id: string;
  appId?: string;
  appIds?: string[];
  directAppIds?: string[];
  inheritedAppIds?: string[];
  inheritedAppSources?: SDKAppInheritanceSource[];
  externalSource?: string;
  externalId?: string;
  isServiceUser: boolean;
  avatarUrl?: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  customAttributes: Record<string, string>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserBaseInput {
  appId?: string;
  appIds?: string[];
  externalSource?: string;
  externalId?: string;
  isServiceUser?: boolean;
  avatarUrl?: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  customAttributes?: Record<string, string>;
  roleIds?: string[];
  groupIds?: string[];
}

export type CreateUserInput = CreateUserBaseInput & (
  | { password: string; passwordHash?: never }
  | { password?: never; passwordHash: string }
);

export interface UpdateUserInput {
  appId?: string;
  appIds?: string[];
  externalSource?: string;
  externalId?: string;
  isServiceUser?: boolean;
  avatarUrl?: string;
  email?: string;
  username?: string;
  givenName?: string;
  familyName?: string;
  active?: boolean;
  groupIds?: string[];
  customAttributes?: Record<string, string>;
}

export interface CreatedUserSummary {
  email: string;
  id: string;
  username: string;
}

export interface UpdatedUserSummary {
  id: string;
  appId?: string;
  appIds?: string[];
  externalSource?: string;
  externalId?: string;
  isServiceUser?: boolean;
  avatarUrl?: string;
  active?: boolean;
  email?: string;
  username?: string;
  givenName?: string;
  familyName?: string;
}

export interface UploadAppImageResult {
  imageUrl: string;
}

export interface AppsAPI {
  /** Lists applications with optional text search and pagination. */
  list(query?: AppListQuery): Promise<SDKApp[]>;
  /** Creates a new application. */
  create(input: CreateAppInput): Promise<SDKApp>;
  /** Updates an existing application by id. */
  update(id: string, input: UpdateAppInput): Promise<SDKApp>;
  /** Uploads an image for an application. */
  uploadImage(id: string, file: Blob | File): Promise<UploadAppImageResult>;
  /** Deletes an application by id. */
  delete(id: string): Promise<void>;
}

export interface AppListQuery extends ListPageQuery {
  search?: string;
}

export interface SDKOAuthClient {
  id: string;
  appId?: string;
  name: string;
  secret?: string;
  secretPreview?: string;
  redirectUris: string[];
  allowedScopes: string[];
  grants: GrantType[];
  requirePkce: boolean;
  resources: string[];
  flowIds: string[];
  createdAt: string;
}

export interface CreateOAuthClientInput {
  appId?: string;
  id: string;
  name: string;
  secret: string;
  redirectUris: string[];
  allowedScopes: string[];
  grants: GrantType[];
  requirePkce?: boolean;
  resources?: string[];
  flowIds?: string[];
}

export interface UpdateOAuthClientInput {
  appId?: string;
  name?: string;
  secret?: string;
  redirectUris?: string[];
  allowedScopes?: string[];
  grants?: GrantType[];
  requirePkce?: boolean;
  resources?: string[];
  flowIds?: string[];
}

export interface ClientsAPI {
  /** Lists OAuth clients with optional app/grant/scope/search filters. */
  list(query?: OAuthClientListQuery): Promise<SDKOAuthClient[]>;
  /** Creates a new OAuth client. */
  create(input: CreateOAuthClientInput): Promise<SDKOAuthClient>;
  /** Updates an OAuth client by id. */
  update(id: string, input: UpdateOAuthClientInput): Promise<SDKOAuthClient>;
  /** Deletes an OAuth client by id. */
  delete(id: string): Promise<void>;
}

export interface OAuthClientListQuery extends ListPageQuery {
  appId?: string;
  grant?: GrantType;
  scope?: string;
  search?: string;
}

export type ConnectorType = "ldap" | "scim" | "csv" | "sql" | "custom";
export type ConnectorStatus = "active" | "inactive" | "error";
export type ConnectorRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface SDKConnector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  config: Record<string, unknown>;
  schedule?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SDKConnectorRun {
  id: string;
  connectorId: string;
  status: ConnectorRunStatus;
  startedAt?: string;
  finishedAt?: string;
  recordsImported: number;
  recordsFailed: number;
  errorMessage?: string;
  createdAt: string;
}

export interface SDKConnectorMapping {
  id: string;
  connectorId: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorInput {
  name: string;
  type: ConnectorType;
  config?: Record<string, unknown>;
  schedule?: string;
}

export interface UpdateConnectorInput {
  name?: string;
  type?: ConnectorType;
  status?: ConnectorStatus;
  config?: Record<string, unknown>;
  schedule?: string;
}

export interface CreateConnectorMappingInput {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface ConnectorRunListQuery {
  limit?: number;
}

export interface ConnectorsAPI {
  /** Lists configured connectors. */
  list(): Promise<SDKConnector[]>;
  /** Gets a connector by id. */
  get(id: string): Promise<SDKConnector>;
  /** Creates a connector. */
  create(input: CreateConnectorInput): Promise<SDKConnector>;
  /** Updates a connector by id. */
  update(id: string, input: UpdateConnectorInput): Promise<SDKConnector>;
  /** Deletes a connector by id. */
  delete(id: string): Promise<void>;
  /** Triggers a connector synchronization run. */
  triggerSync(id: string): Promise<SDKConnectorRun>;
  /** Lists connector sync runs. */
  listRuns(connectorId: string, query?: ConnectorRunListQuery): Promise<SDKConnectorRun[]>;
  /** Lists attribute mappings for a connector. */
  listMappings(connectorId: string): Promise<SDKConnectorMapping[]>;
  /** Creates a connector mapping. */
  createMapping(connectorId: string, input: CreateConnectorMappingInput): Promise<SDKConnectorMapping>;
  /** Deletes a connector mapping. */
  deleteMapping(connectorId: string, mappingId: string): Promise<void>;
}

export interface SDKOAuthScope {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface CreateOAuthScopeInput {
  name: string;
  description?: string;
}

export interface ScopesAPI {
  /** Lists OAuth scopes with optional text search and pagination. */
  list(query?: ScopeListQuery): Promise<SDKOAuthScope[]>;
  /** Creates an OAuth scope. */
  create(input: CreateOAuthScopeInput): Promise<SDKOAuthScope>;
  /** Deletes an OAuth scope by id. */
  delete(id: string): Promise<void>;
}

export interface ScopeListQuery extends ListPageQuery {
  search?: string;
}

export type RoleScope = "platform" | "tenant";

export interface SDKRole {
  id: string;
  appId?: string;
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
  createdAt: string;
}

export interface CreateRoleInput {
  appId?: string;
  description: string;
  name: string;
  permissions: string[];
  scope: RoleScope;
}

export interface UpdateRoleInput {
  appId?: string;
  description?: string;
  name?: string;
  permissions?: string[];
  scope?: RoleScope;
}

export interface AssignRoleInput {
  roleId: string;
  tenantId?: string;
  userId: string;
}

export interface RolesAPI {
  /** Lists roles with optional app/scope/search filters and pagination. */
  list(query?: RoleListQuery): Promise<SDKRole[]>;
  /** Assigns a role to a user (optionally tenant-scoped). */
  assignToUser(input: AssignRoleInput): Promise<unknown>;
  /** Creates a role. */
  create(input: CreateRoleInput): Promise<SDKRole>;
  /** Updates a role by id. */
  update(id: string, input: UpdateRoleInput): Promise<SDKRole>;
  /** Deletes a role by id. */
  delete(id: string): Promise<void>;
}

export interface SDKPermission {
  value: string;
  roleNames: string[];
}

export interface PermissionListQuery extends ListPageQuery {
  search?: string;
}

export interface PermissionsAPI {
  /** Compatibility wrapper deriving permissions from role definitions. */
  list(query?: PermissionListQuery): Promise<SDKPermission[]>;
}

export interface RoleListQuery extends ListPageQuery {
  appId?: string;
  scope?: RoleScope;
  search?: string;
}

export interface SDKGroup {
  id: string;
  appId?: string;
  appIds?: string[];
  externalSource?: string;
  externalId?: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface CreateGroupInput {
  appId?: string;
  appIds?: string[];
  description: string;
  externalId?: string;
  externalSource?: string;
  name: string;
  roleIds?: string[];
}

export interface UpdateGroupInput {
  appId?: string;
  appIds?: string[];
  description?: string;
  externalId?: string;
  externalSource?: string;
  name?: string;
}

export interface AssignGroupRoleInput {
  groupId: string;
  roleId: string;
}

export interface AssignUserGroupInput {
  groupId: string;
  userId: string;
}

export interface GroupUserSummary {
  id: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  isServiceUser: boolean;
  active: boolean;
}

export interface GroupUsersResult {
  userIds: string[];
  users: GroupUserSummary[];
}

export interface GroupsAPI {
  /** Lists groups with optional app/search filters and pagination. */
  list(query?: GroupListQuery): Promise<SDKGroup[]>;
  /** Creates a group. */
  create(input: CreateGroupInput): Promise<SDKGroup>;
  /** Updates a group by id. */
  update(id: string, input: UpdateGroupInput): Promise<SDKGroup>;
  /** Deletes a group by id. */
  delete(id: string): Promise<void>;
  /** Assigns a role to a group. */
  assignRole(input: AssignGroupRoleInput): Promise<unknown>;
  /** Removes a role assignment from a group. */
  removeRole(input: AssignGroupRoleInput): Promise<void>;
  /** Assigns a user to a group. */
  assignUser(input: AssignUserGroupInput): Promise<unknown>;
  /** Removes a user from a group. */
  removeUser(input: AssignUserGroupInput): Promise<void>;
  /** Lists users assigned to a group. */
  listUsers(id: string): Promise<GroupUsersResult>;
}

export interface GroupListQuery extends ListPageQuery {
  appId?: string;
  search?: string;
}

export interface SDKAccessRequest {
  id: string;
  requesterId: string;
  subjectUserId: string;
  entitlementType: string;
  entitlementValue: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  justification: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessRequestInput {
  subjectUserId: string;
  entitlementType: string;
  entitlementValue: string;
  justification: string;
  expiresAt?: string;
}

export interface AccessRequestListQuery {
  limit?: number;
  status?: SDKAccessRequest["status"];
}

export interface AccessRequestDecisionInput {
  rationale?: string;
}

export interface ProcessExpiredAccessRequestsInput {
  dryRun?: boolean;
  now?: string;
}

export interface ProcessExpiredAccessRequestsResult {
  dryRun: boolean;
  evaluatedApprovedRequests: number;
  expiredRequests: number;
  revokedAssignments: number;
}

export interface StalledAccessRequest {
  id: string;
  requesterId: string;
  entitlementType: string;
  entitlementValue: string;
  stalledMinutes: number;
  createdAt: string;
}

export interface StalledAccessRequestsResponse {
  stalledRequests: StalledAccessRequest[];
}

export interface AccessRequestsAPI {
  /** Lists access requests with optional status/limit filtering. */
  list(query?: AccessRequestListQuery): Promise<SDKAccessRequest[]>;
  /** Lists requests considered stalled beyond a threshold in minutes. */
  listStalled(stalledAfterMinutes?: number): Promise<StalledAccessRequestsResponse>;
  /** Creates a new access request. */
  create(input: CreateAccessRequestInput): Promise<SDKAccessRequest>;
  /** Approves an access request. */
  approve(id: string, input?: AccessRequestDecisionInput): Promise<SDKAccessRequest>;
  /** Rejects an access request. */
  reject(id: string, input?: AccessRequestDecisionInput): Promise<SDKAccessRequest>;
  /** Processes expirations for approved access requests. */
  processExpirations(input?: ProcessExpiredAccessRequestsInput): Promise<ProcessExpiredAccessRequestsResult>;
}

export interface SDKAccessReviewCampaign {
  id: string;
  name: string;
  description?: string;
  status: "active" | "closed";
  createdByUserId: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SDKAccessReviewItem {
  id: string;
  campaignId: string;
  subjectUserId: string;
  entitlementType: "role" | "group";
  entitlementValue: string;
  currentState: "granted";
  decision?: "certified" | "revoked";
  decidedByUserId?: string;
  decisionRationale?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessReviewCampaignInput {
  name: string;
  description?: string;
  dueAt?: string;
}

export interface SDKAccessReviewCampaignResult {
  campaign: SDKAccessReviewCampaign;
  generatedItems: number;
}

export interface SDKAccessReviewCampaignDetails {
  campaign: SDKAccessReviewCampaign;
  items: SDKAccessReviewItem[];
}

export interface AccessReviewDecisionInput {
  decision: "certified" | "revoked";
  rationale?: string;
}

export interface AccessReviewListQuery {
  limit?: number;
}

export interface AccessReviewsAPI {
  /** Lists access review campaigns. */
  listCampaigns(query?: AccessReviewListQuery): Promise<SDKAccessReviewCampaign[]>;
  /** Gets campaign details including review items. */
  getCampaign(id: string): Promise<SDKAccessReviewCampaignDetails>;
  /** Creates a campaign and generates review items. */
  createCampaign(input: CreateAccessReviewCampaignInput): Promise<SDKAccessReviewCampaignResult>;
  /** Records a decision on an access review item. */
  decideItem(id: string, input: AccessReviewDecisionInput): Promise<SDKAccessReviewItem>;
}

export type ElevationStatus = "pending" | "approved" | "active" | "revoked" | "expired";
export type ElevationSessionStatus = "active" | "revoked" | "expired";

export interface SDKElevationRequest {
  id: string;
  correlationId: string;
  requesterId: string;
  justification: string;
  resource: string;
  action: string;
  status: ElevationStatus;
  approvedByUserId?: string;
  approvedAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SDKElevationSession {
  id: string;
  correlationId: string;
  elevationRequestId: string;
  requesterId: string;
  resource: string;
  action: string;
  status: ElevationSessionStatus;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateElevationInput {
  justification: string;
  resource: string;
  action: string;
  durationMinutes?: number;
}

export interface ElevationListQuery {
  limit?: number;
  status?: ElevationStatus;
}

export interface ElevationSessionsQuery {
  limit?: number;
  status?: ElevationSessionStatus;
}

export interface ApproveElevationInput {
  rationale?: string;
}

export interface CheckElevationAccessInput {
  resource: string;
  action: string;
}

export interface CheckElevationAccessResult {
  allowed: boolean;
  sessionId?: string;
}

export interface ProcessElevationExpirationsResult {
  expired: number;
}

export interface CreateBreakGlassInput {
  resource: string;
  action: string;
  reason: string;
  requesterId?: string;
  durationMinutes?: number;
}

export interface SDKBreakGlassResult {
  request: SDKElevationRequest;
  session: SDKElevationSession;
  breakGlassId: string;
}

export interface ElevationsAPI {
  /** Lists elevation requests with optional filters. */
  list(query?: ElevationListQuery): Promise<SDKElevationRequest[]>;
  /** Lists elevation sessions with optional filters. */
  listSessions(query?: ElevationSessionsQuery): Promise<SDKElevationSession[]>;
  /** Gets an elevation request by id. */
  get(id: string): Promise<SDKElevationRequest>;
  /** Creates a new elevation request. */
  create(input: CreateElevationInput): Promise<SDKElevationRequest>;
  /** Approves an elevation request. */
  approve(id: string, input?: ApproveElevationInput): Promise<SDKElevationRequest>;
  /** Activates an approved elevation request. */
  activate(id: string): Promise<SDKElevationRequest>;
  /** Revokes an elevation request or session. */
  revoke(id: string): Promise<SDKElevationRequest>;
  /** Processes expiration lifecycle updates for elevations. */
  processExpirations(): Promise<ProcessElevationExpirationsResult>;
  /** Checks whether current caller has active elevation access for a resource/action. */
  check(input: CheckElevationAccessInput): Promise<CheckElevationAccessResult>;
  /** Performs explicit break-glass elevation flow. */
  breakGlass(input: CreateBreakGlassInput): Promise<SDKBreakGlassResult>;
}

export interface UserGroupsResult {
  groupIds: string[];
  groups: SDKGroup[];
}

export interface UserRolesResult {
  roleIds: string[];
  roles: SDKRole[];
}

export interface UserPermissionsResult {
  permissions: string[];
}

export interface UploadUserAvatarResult {
  avatarUrl: string;
}

export interface UsersAPI {
  /** Lists users with optional app/active/search/group/customAttribute filters and pagination. */
  list(query?: UserListQuery): Promise<SDKUser[]>;
  /** Gets a user by id with resolved customAttributes and groups. */
  get(id: string): Promise<SDKUser>;
  /** Creates a user. */
  create(input: CreateUserInput): Promise<SDKUser>;
  /** Updates a user by id. */
  update(id: string, input: UpdateUserInput): Promise<SDKUser>;
  /** Resets a user's password. */
  resetPassword(id: string, password: string): Promise<void>;
  /** Gets groups assigned to a user. */
  getGroups(id: string): Promise<UserGroupsResult>;
  /** Gets roles assigned to a user. */
  getRoles(id: string): Promise<UserRolesResult>;
  /** Gets flattened permissions for a user. */
  getPermissions(id: string): Promise<UserPermissionsResult>;
  /** Uploads an avatar image for a user. */
  uploadAvatar(id: string, file: Blob | File): Promise<UploadUserAvatarResult>;
  /** Deletes a user by id. */
  delete(id: string): Promise<void>;
}

export interface UserListQuery extends ListPageQuery {
  appId?: string;
  active?: boolean;
  search?: string;
  group?: string;
  customAttributes?: Record<string, string>;
}

export interface SDKTenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
}

export interface TenantListQuery extends ListPageQuery {
  search?: string;
}

export interface TenantsAPI {
  list(query?: TenantListQuery): Promise<SDKTenant[]>;
  create(input: CreateTenantInput): Promise<SDKTenant>;
  update(id: string, input: UpdateTenantInput): Promise<SDKTenant>;
}

export interface SDKSession {
  id: string;
  userId: string;
  clientId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface SessionListQuery extends ListPageQuery {
  userId?: string;
}

export interface SessionsAPI {
  list(query?: SessionListQuery): Promise<SDKSession[]>;
  revoke(id: string): Promise<void>;
}

export interface SDKConsent {
  id: string;
  userId: string;
  clientId: string;
  scope: string;
  grantedAt?: string;
  createdAt: string;
}

export interface ConsentListQuery extends ListPageQuery {
  userId?: string;
  clientId?: string;
}

export interface ConsentsAPI {
  list(query?: ConsentListQuery): Promise<SDKConsent[]>;
  revoke(id: string): Promise<void>;
}

export interface SDKDeviceRequest {
  deviceCode: string;
  userCode?: string;
  clientId?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface SDKDeviceSession {
  id: string;
  userId?: string;
  clientId?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface SDKDevicesResponse {
  requests: SDKDeviceRequest[];
  sessions: SDKDeviceSession[];
}

export interface DeviceListQuery extends ListPageQuery {
  status?: string;
}

export interface DevicesAPI {
  list(query?: DeviceListQuery): Promise<SDKDevicesResponse>;
  revokeRequest(deviceCode: string): Promise<void>;
  revokeSession(id: string): Promise<void>;
}

export interface SDKAuditEvent {
  id: string;
  actorId?: string;
  actorType?: string;
  action: string;
  resource?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuditListQuery {
  limit?: number;
}

export interface AuditAPI {
  list(query?: AuditListQuery): Promise<SDKAuditEvent[]>;
}

export interface SDKAdminMe {
  id: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  avatarUrl?: string | null;
  /** Effective role names, including roles inherited via group membership. */
  roles: string[];
  /** Names of groups the user belongs to. */
  groups: string[];
  /** Flattened, de-duplicated permission strings granted by the user's effective roles. */
  permissions: string[];
}

export interface MeAPI {
  /** Returns the current admin/portal session user with effective roles, groups, and flattened permissions. */
  get(): Promise<SDKAdminMe>;
}

export interface SDKAuthenticationFlow {
  id: string;
  name: string;
  description?: string;
  steps?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAuthenticationFlowInput {
  name: string;
  description?: string;
  steps?: unknown[];
}

export interface UpdateAuthenticationFlowInput {
  name?: string;
  description?: string;
  steps?: unknown[];
}

export interface AuthenticationFlowListQuery extends ListPageQuery {
  search?: string;
}

export interface AuthenticationFlowsAPI {
  list(query?: AuthenticationFlowListQuery): Promise<SDKAuthenticationFlow[]>;
  create(input: CreateAuthenticationFlowInput): Promise<SDKAuthenticationFlow>;
  update(id: string, input: UpdateAuthenticationFlowInput): Promise<SDKAuthenticationFlow>;
  delete(id: string): Promise<void>;
}

export interface SDKUserAttributeDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserAttributeInput {
  key: string;
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
}

export interface UpdateUserAttributeInput {
  name?: string;
  description?: string;
  type?: string;
  required?: boolean;
}

export interface SetUserAttributeGroupAssignmentInput {
  groupId: string;
}

export interface UserAttributeListQuery extends ListPageQuery {
  search?: string;
}

export interface UserAttributesAPI {
  list(query?: UserAttributeListQuery): Promise<SDKUserAttributeDefinition[]>;
  create(input: CreateUserAttributeInput): Promise<SDKUserAttributeDefinition>;
  update(id: string, input: UpdateUserAttributeInput): Promise<SDKUserAttributeDefinition>;
  delete(id: string): Promise<void>;
  setGroupAssignment(id: string, input: SetUserAttributeGroupAssignmentInput): Promise<void>;
  removeGroupAssignment(id: string, groupId: string): Promise<void>;
}

export interface SDKPolicyDefinition {
  id: string;
  name: string;
  description?: string;
  statement?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  statement?: Record<string, unknown>;
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  statement?: Record<string, unknown>;
}

export interface SetPolicyAssignmentInput {
  subjectType: string;
  subjectId: string;
}

export interface RemovePolicyAssignmentInput {
  subjectType: string;
  subjectId: string;
}

export interface PolicyEvaluateInput {
  subject?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  action?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizationCheckInput {
  userId: string;
  resource: string;
  action: string;
  decisionStrategy?: "deny_overrides" | "allow_overrides" | "first_applicable";
  tenantId?: string;
  clientId?: string;
  ip?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizationCheckResult {
  allow: boolean;
  deniedBy?: string;
  [key: string]: unknown;
}

export interface SDKPolicyDecisionLog {
  id: string;
  policyId?: string;
  outcome: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface PolicyListQuery extends ListPageQuery {
  search?: string;
}

export interface PolicyDecisionsListQuery {
  limit?: number;
}

export interface PoliciesAPI {
  list(query?: PolicyListQuery): Promise<SDKPolicyDefinition[]>;
  create(input: CreatePolicyInput): Promise<SDKPolicyDefinition>;
  update(id: string, input: UpdatePolicyInput): Promise<SDKPolicyDefinition>;
  delete(id: string): Promise<void>;
  setAssignment(id: string, input: SetPolicyAssignmentInput): Promise<void>;
  removeAssignment(id: string, input: RemovePolicyAssignmentInput): Promise<void>;
  evaluate(input: PolicyEvaluateInput): Promise<unknown>;
  authorizationCheck(input: AuthorizationCheckInput): Promise<AuthorizationCheckResult>;
  decisions(query?: PolicyDecisionsListQuery): Promise<SDKPolicyDecisionLog[]>;
}

export interface SDKEventHook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEventHookInput {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateEventHookInput {
  name?: string;
  url?: string;
  events?: string[];
  active?: boolean;
  secret?: string;
}

export interface SDKEventNotification {
  id: string;
  hookId?: string;
  eventType: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface EventHookListQuery extends ListPageQuery {
  search?: string;
}

export interface EventHookNotificationsListQuery {
  limit?: number;
}

export interface EventHooksAPI {
  list(query?: EventHookListQuery): Promise<SDKEventHook[]>;
  create(input: CreateEventHookInput): Promise<SDKEventHook>;
  update(id: string, input: UpdateEventHookInput): Promise<SDKEventHook>;
  delete(id: string): Promise<void>;
  test(id: string, payload?: Record<string, unknown>): Promise<unknown>;
  types(): Promise<string[]>;
  notifications(query?: EventHookNotificationsListQuery): Promise<SDKEventNotification[]>;
}

export interface SDKFederationProvider {
  id: string;
  type: string;
  name: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFederationProviderInput {
  type: string;
  name: string;
  config?: Record<string, unknown>;
}

export interface UpdateFederationProviderInput {
  name?: string;
  config?: Record<string, unknown>;
}

export interface FederationProviderListQuery extends ListPageQuery {
  search?: string;
}

export interface FederationAPI {
  list(query?: FederationProviderListQuery): Promise<SDKFederationProvider[]>;
  create(input: CreateFederationProviderInput): Promise<SDKFederationProvider>;
  update(id: string, input: UpdateFederationProviderInput): Promise<SDKFederationProvider>;
  delete(id: string): Promise<void>;
}

export interface SDKAdminSettings {
  [key: string]: unknown;
}

export interface UpdateAdminSettingsInput {
  [key: string]: unknown;
}

export interface SendTestEmailInput {
  to: string;
  subject?: string;
  message?: string;
}

export interface SendTestEmailResult {
  ok: boolean;
  [key: string]: unknown;
}

export interface TestDatabaseConnectionInput {
  provider: "postgresql" | "mysql";
  externalDatabaseUrl: string;
}

export interface TestDatabaseConnectionResult {
  ok: boolean;
  [key: string]: unknown;
}

export interface DatabaseMigrationInput {
  provider: "postgresql" | "mysql";
  externalDatabaseUrl: string;
  sqlitePath?: string;
}

export interface DatabaseMigrationResult {
  ok: boolean;
  [key: string]: unknown;
}

export interface SettingsAPI {
  get(): Promise<SDKAdminSettings>;
  update(input: UpdateAdminSettingsInput): Promise<SDKAdminSettings>;
  testEmail(input: SendTestEmailInput): Promise<SendTestEmailResult>;
  testDatabase(input: TestDatabaseConnectionInput): Promise<TestDatabaseConnectionResult>;
  migrateDatabase(input: DatabaseMigrationInput): Promise<DatabaseMigrationResult>;
}

export interface SDKRiskEvent {
  id: string;
  type: string;
  severity?: string;
  status?: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface RiskEventListQuery {
  limit?: number;
}

export interface SecurityAPI {
  riskEvents(query?: RiskEventListQuery): Promise<SDKRiskEvent[]>;
}

export interface SDKAuthMetric {
  bucket: string;
  event: string;
  count: number;
  [key: string]: unknown;
}

export interface AuthMetricsListQuery {
  startHour?: string;
  endHour?: string;
  event?: string;
}

export interface AuthMetricsAPI {
  auth(query?: AuthMetricsListQuery): Promise<SDKAuthMetric[]>;
}

export interface SDKPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entrypoint: string;
  permissions?: string[];
  hooks?: string[];
  homepage?: string;
}

export interface SDKPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  entrypoint: string;
  permissions: string[];
  hooks: string[];
  homepage?: string;
  status: "uploaded" | "active";
  uploadedAt: string;
  updatedAt: string;
  bundleChecksum: string;
  bundleBytes: number;
}

export interface ValidatePluginInput {
  manifest: SDKPluginManifest;
  bundleBase64?: string;
}

export interface ValidatePluginResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UploadPluginInput {
  manifest: SDKPluginManifest;
  bundleBase64: string;
  activate?: boolean;
}

export interface PluginsAPI {
  list(): Promise<SDKPlugin[]>;
  validate(input: ValidatePluginInput): Promise<ValidatePluginResult>;
  upload(input: UploadPluginInput): Promise<SDKPlugin>;
  delete(id: string): Promise<void>;
}

export interface AdminClient extends ClientInstance {
  accessReviews: AccessReviewsAPI;
  accessRequests: AccessRequestsAPI;
  apps: AppsAPI;
  audit: AuditAPI;
  authenticationFlows: AuthenticationFlowsAPI;
  clients: ClientsAPI;
  consents: ConsentsAPI;
  connectors: ConnectorsAPI;
  devices: DevicesAPI;
  elevations: ElevationsAPI;
  eventHooks: EventHooksAPI;
  federation: FederationAPI;
  groups: GroupsAPI;
  me: MeAPI;
  metrics: AuthMetricsAPI;
  permissions: PermissionsAPI;
  plugins: PluginsAPI;
  policies: PoliciesAPI;
  provisioning: ReturnType<typeof import("../provisioning/index.js").createProvisioningAPI>;
  roles: RolesAPI;
  saml: ReturnType<typeof import("../federation/index.js").createSamlAdminAPI>;
  scopes: ScopesAPI;
  security: SecurityAPI;
  sessions: SessionsAPI;
  serviceIdentities: ReturnType<typeof import("../workload/service-identities.js").createWorkloadAPI>;
  settings: SettingsAPI;
  tenants: TenantsAPI;
  userAttributes: UserAttributesAPI;
  users: UsersAPI;
  /** Returns a cloned admin client with a new auth strategy. */
  withAuth(auth: NonNullable<ClientOptions["auth"]>): AdminClient;
}
