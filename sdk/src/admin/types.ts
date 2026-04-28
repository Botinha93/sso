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

export interface SDKUser {
  id: string;
  appId?: string;
  appIds?: string[];
  directAppIds?: string[];
  inheritedAppIds?: string[];
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

export interface CreateUserInput {
  appId?: string;
  appIds?: string[];
  externalSource?: string;
  externalId?: string;
  isServiceUser?: boolean;
  avatarUrl?: string;
  email: string;
  username: string;
  password: string;
  givenName: string;
  familyName: string;
  customAttributes?: Record<string, string>;
  roleIds?: string[];
  groupIds?: string[];
}

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

export interface AppsAPI {
  /** Lists applications with optional text search and pagination. */
  list(query?: AppListQuery): Promise<SDKApp[]>;
  /** Creates a new application. */
  create(input: CreateAppInput): Promise<SDKApp>;
  /** Updates an existing application by id. */
  update(id: string, input: UpdateAppInput): Promise<SDKApp>;
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

export interface UsersAPI {
  /** Lists users with optional app/active/search filters and pagination. */
  list(query?: UserListQuery): Promise<SDKUser[]>;
  /** Creates a user. */
  create(input: CreateUserInput): Promise<CreatedUserSummary>;
  /** Updates a user by id. */
  update(id: string, input: UpdateUserInput): Promise<UpdatedUserSummary>;
  /** Resets a user's password. */
  resetPassword(id: string, password: string): Promise<void>;
  /** Deletes a user by id. */
  delete(id: string): Promise<void>;
}

export interface UserListQuery extends ListPageQuery {
  appId?: string;
  active?: boolean;
  search?: string;
}

export interface AdminClient extends ClientInstance {
  accessReviews: AccessReviewsAPI;
  accessRequests: AccessRequestsAPI;
  apps: AppsAPI;
  clients: ClientsAPI;
  connectors: ConnectorsAPI;
  elevations: ElevationsAPI;
  groups: GroupsAPI;
  provisioning: ReturnType<typeof import("../provisioning/index.js").createProvisioningAPI>;
  roles: RolesAPI;
  saml: ReturnType<typeof import("../federation/index.js").createSamlAdminAPI>;
  scopes: ScopesAPI;
  serviceIdentities: ReturnType<typeof import("../workload/service-identities.js").createWorkloadAPI>;
  users: UsersAPI;
  /** Returns a cloned admin client with a new auth strategy. */
  withAuth(auth: NonNullable<ClientOptions["auth"]>): AdminClient;
}
