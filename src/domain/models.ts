export type RoleScope = "platform" | "tenant";
export type GrantType = "authorization_code" | "client_credentials" | "refresh_token";
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

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
  createdAt: Date;
}

export interface User {
  id: string;
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
  name: string;
  description: string;
  createdAt: Date;
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
  config: Record<string, unknown>;
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
  | "logout"
  | "token_issued"
  | "token_refreshed"
  | "token_revoked"
  | "consent_granted"
  | "consent_revoked"
  | "session_revoked"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "user_created";

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
