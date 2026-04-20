export type RoleScope = "platform" | "tenant";
export type GrantType = "authorization_code" | "client_credentials" | "refresh_token" | "password" | "device_code";
export type AuthenticationStageType =
  | "password"
  | "federation"
  | "consent"
  | "mfa_totp"
  | "risk_check"
  | "identification"
  | "email_verification"
  | "captcha"
  | "prompt"
  | "user_write"
  | "user_login"
  | "user_logout";
export type FlowDesignation =
  | "authentication"
  | "authorization"
  | "enrollment"
  | "invalidation"
  | "recovery"
  | "stage_configuration"
  | "unenrollment";
export type UserAttributeType = "text" | "number" | "boolean" | "date" | "json";
export type PolicyScopeType = "global" | "tenant" | "group" | "user";
export type PolicyCategory = "authentication" | "authorization";
export type PolicyEffect = "allow" | "deny";
export type PolicyDecisionStrategy = "deny_overrides" | "allow_overrides" | "first_applicable";

export interface Role {
  id: string;
  appId?: string;
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
  createdAt: Date;
}

export interface User {
  id: string;
  appId?: string;
  externalSource?: string;
  externalId?: string;
  isServiceUser: boolean;
  email: string;
  username: string;
  passwordHash: string;
  givenName: string;
  familyName: string;
  customAttributes: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthClient {
  id: string;
  appId?: string;
  name: string;
  secret: string;
  redirectUris: string[];
  allowedScopes: string[];
  grants: GrantType[];
  requirePkce: boolean;
  resources: string[];
  flowIds: string[];
  createdAt: Date;
}

export interface OAuthScope {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  clientId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface TotpCredential {
  userId: string;
  secret: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  expiresAt: Date;
  createdAt: Date;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

export interface Group {
  id: string;
  appId?: string;
  externalSource?: string;
  externalId?: string;
  name: string;
  description: string;
  createdAt: Date;
}

export interface App {
  id: string;
  name: string;
  description: string;
  icon?: string;
  url?: string;
  createdAt: Date;
}

export interface InstanceSettings {
  id: string;
  databaseProvider: "sqlite" | "postgresql" | "mysql";
  databasePath: string;
  externalDatabaseUrl?: string;
  requireHttps: boolean;
  secureCookies: boolean;
  allowAnyCorsOrigin: boolean;
  corsAllowedOrigins: string[];
  requireHttpsRedirectUris: boolean;
  requireS256Pkce: boolean;
  allowImplicitFlow: boolean;
  loginFailureWindowMs: number;
  loginLockoutThreshold: number;
  loginLockoutDurationMs: number;
  sessionAnomalyConcurrencyThreshold: number;
  emailTransport: "disabled" | "log" | "smtp";
  emailFrom: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  tokenSigningAlgorithm: "RS256";
  updatedAt: Date;
}

export interface UserGroupAssignment {
  id: string;
  userId: string;
  groupId: string;
  createdAt: Date;
}

export interface GroupRoleAssignment {
  id: string;
  groupId: string;
  roleId: string;
  createdAt: Date;
}

export interface FederatedIdentity {
  id: string;
  providerId: string;
  providerSubject: string;
  userId: string;
  email?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface FederationTransaction {
  state: string;
  providerId: string;
  codeVerifier: string;
  redirectAfterLogin: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface FederationProvider {
  id: string;
  label: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationStage {
  type: AuthenticationStageType;
  required: boolean;
  order: number;
}

export interface AuthenticationFlow {
  id: string;
  name: string;
  description: string;
  designation: FlowDesignation;
  enabled: boolean;
  grantTypes: GrantType[];
  stages: AuthenticationStage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAttributeDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  type: UserAttributeType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupUserAttributeAssignment {
  id: string;
  groupId: string;
  attributeId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  category: PolicyCategory;
  effect?: PolicyEffect;
  resourcePattern?: string;
  actionPattern?: string;
  stageBindings: AuthenticationStageType[];
  javascriptCode?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyAssignment {
  id: string;
  policyId: string;
  scopeType: PolicyScopeType;
  scopeId?: string;
  enabled: boolean;
  priority?: number;
  decisionStrategy?: PolicyDecisionStrategy;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDecisionLog {
  id: string;
  userId: string;
  clientId?: string;
  tenantId?: string;
  ip?: string;
  resource: string;
  action: string;
  allow: boolean;
  deniedBy: string[];
  context: Record<string, unknown>;
  source: "policies_evaluate" | "authorization_check";
  createdAt: Date;
}

export interface ScimToken {
  id: string;
  label: string;
  tokenHash: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisioningMapping {
  id: string;
  name: string;
  sourceAttribute: string;
  targetAttribute: string;
  transformExpression?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisioningJob {
  id: string;
  jobType: "reconcile";
  status: "running" | "completed" | "failed";
  summary: Record<string, unknown>;
  initiatedByUserId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface DeprovisioningQueueItem {
  id: string;
  subjectType: "user" | "group";
  subjectId: string;
  actionType: "user_offboard" | "group_cleanup";
  status: "pending" | "completed" | "failed";
  payload: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface AccessRequest {
  id: string;
  requesterId: string;
  subjectUserId: string;
  entitlementType: string;
  entitlementValue: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  justification: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessRequestApproval {
  id: string;
  accessRequestId: string;
  approverId: string;
  decision: "approved" | "rejected";
  rationale?: string;
  createdAt: Date;
}

export interface AccessReviewCampaign {
  id: string;
  name: string;
  description?: string;
  status: "active" | "closed";
  createdByUserId: string;
  dueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessReviewItem {
  id: string;
  campaignId: string;
  subjectUserId: string;
  entitlementType: "role" | "group";
  entitlementValue: string;
  currentState: "granted";
  decision?: "certified" | "revoked";
  decidedByUserId?: string;
  decisionRationale?: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventHook {
  id: string;
  eventType: string;
  targetUrl: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventNotification {
  id: string;
  eventType: string;
  hookId?: string;
  payload: Record<string, unknown>;
  status: "delivered" | "failed";
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: Date;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  tenantId?: string;
  createdAt: Date;
}

export interface Consent {
  id: string;
  userId: string;
  clientId: string;
  scope: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  tokenId: string;
  tokenHash: string;
  userId: string;
  clientId: string;
  sessionId: string;
  scope: string[];
  expiresAt: Date;
  createdAt: Date;
  consumedAt?: Date;
  revokedAt?: Date;
  rotatedFromTokenId?: string;
}

export interface AccessTokenRecord {
  id: string;
  tokenId: string;
  userId: string;
  clientId: string;
  sessionId: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
}

export interface TokenBundle {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scope: string;
}

export type AuditEventType =
  | "login"
  | "login_failed"
  | "account_lockout"
  | "logout"
  | "token_issued"
  | "token_refreshed"
  | "token_revoked"
  | "consent_granted"
  | "consent_revoked"
  | "session_revoked"
  | "session_anomaly_detected"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "user_created"
  | "user_password_reset"
  | "scim_user_created"
  | "scim_user_updated"
  | "scim_user_deleted"
  | "scim_group_created"
  | "scim_group_updated"
  | "scim_group_deleted"
  | "policy_decision_evaluated"
  | "security_sqli_blocked"
  | "security_rate_limit_blocked"
  | "elevation_request_created"
  | "elevation_request_approved"
  | "elevation_request_activated"
  | "elevation_request_revoked"
  | "elevation_request_expired";

export type ElevationStatus = "pending" | "approved" | "active" | "revoked" | "expired";

export interface ElevationRequest {
  id: string;
  requesterId: string;
  justification: string;
  resource: string;
  action: string;
  status: ElevationStatus;
  approvedByUserId?: string;
  approvedAt?: Date;
  activatedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  actorId?: string;
  actorType: "user" | "client" | "system";
  clientId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
