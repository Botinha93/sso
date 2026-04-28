export type Language = "en" | "es" | "fr" | "de" | "it" | "pt" | "ja" | "zh" | "ko" | "ru";
export type RoleScope = "platform" | "tenant";
export type GrantType = "authorization_code" | "client_credentials" | "refresh_token" | "password" | "device_code" | "token_exchange" | "jwt_bearer" | "saml2_bearer" | "ciba";
export type AuthenticationStageType =
  | "password"
  | "federation"
  | "consent"
  | "mfa_totp"
  | "mfa_webauthn"
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
  appIds?: string[];
  directAppIds?: string[];
  inheritedAppIds?: string[];
  externalSource?: string;
  externalId?: string;
  isServiceUser: boolean;
  avatarUrl?: string;
  email: string;
  username: string;
  passwordHash: string;
  preferredLanguage?: Language;
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

export interface WebauthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  signCount: number;
  transports: string[];
  aaguid?: string;
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
  appIds?: string[];
  customAttributes?: Record<string, string>;
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
  imageUrl?: string;
  url?: string;
  resources: string[];
  createdAt: Date;
}

export type UiSurface = "admin_login" | "consent" | "portal_login" | "portal_launcher";

export interface UiSurfaceCustomization {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundCss?: string;
}

export interface UiCustomizationSettings {
  defaultBySurface: Partial<Record<UiSurface, UiSurfaceCustomization>>;
  byClientId: Record<string, Partial<Record<UiSurface, UiSurfaceCustomization>>>;
  byAppId: Record<string, Partial<Record<UiSurface, UiSurfaceCustomization>>>;
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
  uiCustomizations: UiCustomizationSettings;
  tokenSigningAlgorithm: "RS256";
  updatedAt: Date;
}

export interface UserGroupAssignment {
  id: string;
  userId: string;
  groupId: string;
  createdAt: Date;
}

export interface UserAppAssignment {
  id: string;
  userId: string;
  appId: string;
  createdAt: Date;
}

export interface GroupAppAssignment {
  id: string;
  groupId: string;
  appId: string;
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
  value?: string;
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
  | "elevation_request_expired"
  | "elevation_session_started"
  | "elevation_session_revoked"
  | "elevation_session_expired"
  | "elevation_break_glass_activated"
  | "saml_service_provider_created"
  | "saml_service_provider_updated"
  | "saml_service_provider_deleted"
  | "saml_service_provider_metadata_uploaded"
  | "saml_service_provider_certificate_rotated"
  | "saml_sso_initiated"
  | "saml_sso_succeeded"
  | "saml_sso_failed"
  | "saml_slo_initiated"
  | "saml_assertion_validated"
  | "saml_assertion_invalid"
  | "access_review_campaign_created"
  | "access_review_item_decided"
  | "connector_created"
  | "connector_updated"
  | "connector_deleted"
  | "connector_sync_triggered"
  | "connector_sync_succeeded"
  | "connector_sync_retry_scheduled"
  | "connector_sync_failed"
  | "plugin_runtime_load_failed"
  | "plugin_runtime_executed"
  | "plugin_runtime_failed"
  | "plugin_runtime_console"
  | "plugin_runtime_log";

export type ElevationStatus = "pending" | "approved" | "active" | "revoked" | "expired";
export type ElevationSessionStatus = "active" | "revoked" | "expired";

export interface ElevationRequest {
  id: string;
  correlationId: string;
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

export interface ElevationSession {
  id: string;
  correlationId: string;
  elevationRequestId: string;
  requesterId: string;
  resource: string;
  action: string;
  status: ElevationSessionStatus;
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date;
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

export interface SamlServiceProvider {
  id: string;
  appId?: string;
  entityId: string;
  metadata?: string;
  acsUrl: string;
  sloUrl?: string;
  signingCertificate?: string;
  encryptionCertificate?: string;
  nameIdFormat: "persistent" | "transient" | "emailAddress";
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SamlNameIdMapping {
  id: string;
  spId: string;
  format: "persistent" | "transient" | "emailAddress";
  sourceAttribute: string;
  createdAt: Date;
}

export interface SamlAssertionAudit {
  id: string;
  spId: string;
  requestId: string;
  responseId: string;
  subject: string;
  audience: string;
  assertionId: string;
  issueInstant: Date;
  notOnOrAfter: Date;
  destinationUrl: string;
  statusCode: string;
  createdAt: Date;
}

export type RiskDecision = "allow" | "challenge" | "block";
export type RiskReason = "failed_login" | "suspicious_ip" | "new_device" | "geo_anomaly" | "brute_force" | "token_abuse" | "bot_detected";

export interface RiskEvent {
  id: string;
  userId?: string;
  ip?: string;
  deviceFingerprintHash?: string;
  geo?: string;
  confidence: number; // 0-100 score
  reason: RiskReason;
  decision: RiskDecision;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type ServiceIdentityStatus = "active" | "inactive" | "suspended";

export interface ServiceIdentity {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  appId?: string;
  status: ServiceIdentityStatus;
  allowedScopes: string[];
  allowedAudiences: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceIdentityCredential {
  id: string;
  serviceIdentityId: string;
  clientId: string;
  clientSecretHash: string;
  expiresAt?: Date;
  revokedAt?: Date;
  rotatedFromId?: string;
  lastUsedAt?: Date;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// EPIC 8 – Connector Framework
// ---------------------------------------------------------------------------

export type ConnectorType = "ldap" | "scim" | "csv" | "sql" | "custom";
export type ConnectorStatus = "active" | "inactive" | "error";
export type ConnectorRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  config: Record<string, unknown>;
  schedule?: string; // cron expression
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorRun {
  id: string;
  connectorId: string;
  status: ConnectorRunStatus;
  startedAt?: Date;
  finishedAt?: Date;
  recordsImported: number;
  recordsFailed: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface ConnectorMapping {
  id: string;
  connectorId: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// EPIC 8 – Auth Metrics
// ---------------------------------------------------------------------------

export interface AuthMetricRollup {
  id: string;
  bucket: string; // ISO date-hour e.g. "2026-04-20T10"
  event: string; // "login_success" | "login_failure" | "token_issued" | "policy_denied"
  count: number;
  createdAt: Date;
}
