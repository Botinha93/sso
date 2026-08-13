import { z } from "zod";
import { nullableIconSchema, nullableImageUrlSchema, optionalImageUrlSchema } from "./media-schemas.js";

const appUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, {
  message: "Invalid url"
});

export const createRoleSchema = z.object({
  appId: z.string().min(2).optional(),
  name: z.string().min(3),
  description: z.string().min(3),
  permissions: z.array(z.string().min(2)).min(1),
  scope: z.enum(["platform", "tenant"])
});

export const updateRoleSchema = z.object({
  appId: z.string().min(2).optional(),
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string().min(2)).optional(),
  scope: z.enum(["platform", "tenant"]).optional()
});

export const createUserSchema = z.object({
  appId: z.string().min(2).optional(),
  appIds: z.array(z.string().min(2)).optional(),
  externalSource: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  isServiceUser: z.boolean().default(false),
  avatarUrl: optionalImageUrlSchema,
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8).optional(),
  passwordHash: z.string().min(3).optional(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  customAttributes: z.record(z.string(), z.string()).optional(),
  roleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([])
}).superRefine((input, ctx) => {
  if (!input.password && !input.passwordHash) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Either password or passwordHash is required"
    });
  }

  if (input.password && input.passwordHash) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["passwordHash"],
      message: "Provide either password or passwordHash, not both"
    });
  }
});

export const updateUserSchema = z.object({
  appId: z.string().min(2).optional(),
  appIds: z.array(z.string().min(2)).optional(),
  externalSource: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  isServiceUser: z.boolean().optional(),
  avatarUrl: nullableImageUrlSchema,
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  givenName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  customAttributes: z.record(z.string(), z.string()).optional()
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8)
});

export const portalUpdateProfileSchema = z.object({
  givenName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  avatarUrl: nullableImageUrlSchema,
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  customAttributes: z.record(z.string(), z.string()).optional()
});

export const portalChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export const createGroupSchema = z.object({
  appId: z.string().min(2).optional(),
  appIds: z.array(z.string().min(2)).optional(),
  externalSource: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  name: z.string().min(2),
  description: z.string().min(2),
  customAttributes: z.record(z.string(), z.string()).default({}),
  roleIds: z.array(z.string()).default([])
});

export const updateGroupSchema = z.object({
  appId: z.string().min(2).optional(),
  appIds: z.array(z.string().min(2)).optional(),
  externalSource: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  customAttributes: z.record(z.string(), z.string()).optional()
});

export const assignGroupRoleSchema = z.object({
  groupId: z.string().min(2),
  roleId: z.string().min(2)
});

export const assignUserGroupSchema = z.object({
  userId: z.string().min(2),
  groupId: z.string().min(2)
});

export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(8),
  clientId: z.string().min(2).default("sso-admin-ui"),
  tenantSlug: z.string().min(2).optional(),
  scope: z.array(z.string()).default(["openid", "profile", "email"]),
  captchaToken: z.string().min(4).optional(),
  promptAcknowledged: z.boolean().optional()
});

export const mfaLoginSchema = z.object({
  mfaTicket: z.string().min(8),
  code: z.string().min(6).max(8)
});

export const changePasswordLoginSchema = z.object({
  changePasswordTicket: z.string().min(8),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8).optional()
});

export const verifyTotpEnrollmentSchema = z.object({
  enrollmentId: z.string().min(8),
  code: z.string().min(6).max(8)
});

export const webauthnRegisterBeginSchema = z.object({
  displayName: z.string().min(1).max(120).optional()
});

export const webauthnRegisterFinishSchema = z.object({
  registrationId: z.string().min(8),
  credentialId: z.string().min(16),
  publicKey: z.string().min(16),
  transports: z.array(z.string().min(2)).default([]),
  aaguid: z.string().min(1).optional(),
  signCount: z.number().int().min(0).default(0)
});

export const webauthnLoginBeginSchema = z.object({
  identifier: z.string().min(1),
  clientId: z.string().min(2).default("sso-admin-ui"),
  tenantSlug: z.string().min(2).optional(),
  scope: z.array(z.string()).default(["openid", "profile", "email"])
});

export const webauthnLoginFinishSchema = z.object({
  loginId: z.string().min(8),
  credentialId: z.string().min(16),
  signCount: z.number().int().min(0).optional()
});

export const authorizeSchema = z.object({
  response_type: z.enum(["code", "token", "code token", "code id_token", "id_token token", "code id_token token"]),
  client_id: z.string().min(2),
  redirect_uri: z.string().url(),
  scope: z.string().min(1),
  state: z.string().optional(),
  nonce: z.string().optional(),
  acr_values: z.string().optional(),
  ui_locales: z.string().optional(),
  id_token_hint: z.string().optional(),
  approval_prompt: z.enum(["auto", "force"]).optional(),
  prompt: z.enum(["none", "login", "consent", "select_account"]).optional(),
  login_hint: z.string().optional(),
  max_age: z.coerce.number().optional(),
  tenant: z.string().min(2).optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
  consent: z.enum(["approve"]).optional(),
  password_warning: z.enum(["continue"]).optional(),
  response_mode: z.enum(["query", "fragment", "form_post"]).optional()
});

export const authorizationCodeTokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(8),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  redirect_uri: z.string().url(),
  code_verifier: z.string().optional()
});

export const refreshTokenSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(16),
  client_id: z.string().min(2),
  client_secret: z.string().min(8)
});

export const clientCredentialsSchema = z.object({
  grant_type: z.literal("client_credentials"),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  scope: z.string().optional()
});

export const passwordGrantSchema = z.object({
  grant_type: z.literal("password"),
  username: z.string().min(1),
  password: z.string().min(1),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  scope: z.string().optional(),
  captcha_token: z.string().min(4).optional(),
  prompt_acknowledged: z.boolean().optional()
});

export const recoverySchema = z.object({
  recoveryTicket: z.string().min(16),
  code: z.string().min(6).max(8).optional(),
  verificationCode: z.string().min(6).optional(),
  newPassword: z.string().min(8),
  clientId: z.string().min(2).default("sso-admin-ui"),
  tenantSlug: z.string().min(2).optional(),
  scope: z.array(z.string()).default(["openid", "profile", "email"]),
  promptAcknowledged: z.boolean().optional()
});

export const recoveryRequestSchema = z.object({
  identifier: z.string().min(1),
  clientId: z.string().min(2).default("sso-admin-ui"),
  tenantSlug: z.string().min(2).optional()
});

export const deviceCodeTokenSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
  device_code: z.string().min(16),
  client_id: z.string().min(2),
  client_secret: z.string().min(8)
});

export const jwtBearerTokenSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:jwt-bearer"),
  assertion: z.string().min(16),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  scope: z.string().optional()
});

export const saml2BearerTokenSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:saml2-bearer"),
  assertion: z.string().min(16),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  scope: z.string().optional()
});

export const cibaTokenSchema = z.object({
  grant_type: z.literal("urn:openid:params:grant-type:ciba"),
  auth_req_id: z.string().min(16),
  client_id: z.string().min(2),
  client_secret: z.string().min(8)
});

export const tokenSchema = z.discriminatedUnion("grant_type", [
  authorizationCodeTokenSchema,
  refreshTokenSchema,
  clientCredentialsSchema,
  passwordGrantSchema,
  deviceCodeTokenSchema,
  jwtBearerTokenSchema,
  saml2BearerTokenSchema,
  cibaTokenSchema
]);

export const cibaAuthenticationRequestSchema = z.object({
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  login_hint: z.string().min(1),
  scope: z.string().optional(),
  requested_delivery_mode: z.enum(["poll", "ping", "push"]).default("poll"),
  client_notification_endpoint: z.string().url().optional(),
  client_notification_token: z.string().min(8).optional(),
  binding_message: z.string().min(1).max(120).optional(),
  user_code: z.string().min(4).max(20).optional()
});

export const cibaApprovalSchema = z.object({
  auth_req_id: z.string().min(16),
  username: z.string().min(1),
  password: z.string().min(1),
  approve: z.boolean().default(true)
});

export const deviceAuthorizationSchema = z.object({
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  scope: z.string().optional()
});

export const deviceVerificationSchema = z.object({
  user_code: z.string().min(4),
  username: z.string().min(1),
  password: z.string().min(1),
  approve: z.boolean().default(true)
});

export const introspectSchema = z.object({
  token: z.string().min(2),
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional()
});

export const createTenantSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2)
});

export const updateTenantSchema = z.object({
  slug: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  active: z.boolean().optional()
});

export const assignRoleSchema = z.object({
  userId: z.string().min(2),
  roleId: z.string().min(2),
  tenantId: z.string().min(2).optional()
});

export const revokeTokenSchema = z.object({
  tokenId: z.string().min(2),
  tokenType: z.enum(["access", "refresh"])
});

export const oidcRevokeSchema = z.object({
  token: z.string().min(2),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional()
});

const accessTokenTtlSchema = z.number().int().min(60).max(86_400);
const refreshTokenTtlSchema = z.number().int().min(300).max(31_536_000);

export const createClientSchema = z.object({
  appId: z.string().min(2).optional(),
  id: z.string().min(3),
  name: z.string().min(2),
  secret: z.string().min(16),
  redirectUris: z.array(z.string().url()).default([]),
  allowedScopes: z.array(z.string()).min(1),
  grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"])).min(1),
  requirePkce: z.boolean().default(false),
  resources: z.array(z.string().min(1)).default([]),
  flowIds: z.array(z.string().min(1)).default([]),
  accessTokenTtlSeconds: accessTokenTtlSchema.optional(),
  refreshTokenTtlSeconds: refreshTokenTtlSchema.optional()
}).superRefine((input, ctx) => {
  if (input.grants.includes("authorization_code") && input.redirectUris.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["redirectUris"],
      message: "redirectUris must include at least one URL when authorization_code grant is enabled"
    });
  }
});

export const updateClientSchema = z.object({
  appId: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  secret: z.string().min(16).optional(),
  redirectUris: z.array(z.string().url()).optional(),
  allowedScopes: z.array(z.string()).optional(),
  grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"])).optional(),
  requirePkce: z.boolean().optional(),
  resources: z.array(z.string().min(1)).optional(),
  flowIds: z.array(z.string().min(1)).optional(),
  accessTokenTtlSeconds: accessTokenTtlSchema.nullable().optional(),
  refreshTokenTtlSeconds: refreshTokenTtlSchema.nullable().optional()
});

export const createScopeSchema = z.object({
  name: z.string().min(1),
  description: z.string().default("")
});

export const createAppSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  icon: z.string().optional(),
  imageUrl: optionalImageUrlSchema,
  url: appUrlSchema.optional(),
  resources: z.array(z.string().min(1)).default([])
});

export const updateAppSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  icon: nullableIconSchema,
  imageUrl: nullableImageUrlSchema,
  url: appUrlSchema.optional().nullable(),
  resources: z.array(z.string().min(1)).optional()
});

export const createFederationProviderSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(2),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  userInfoEndpoint: z.string().url(),
  clientId: z.string().min(2),
  clientSecret: z.string().min(2),
  scopes: z.array(z.string().min(1)).default(["openid", "profile", "email"]),
  enabled: z.boolean().default(true)
});

export const updateFederationProviderSchema = z.object({
  label: z.string().min(2).optional(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  userInfoEndpoint: z.string().url().optional(),
  clientId: z.string().min(2).optional(),
  clientSecret: z.string().min(2).optional(),
  scopes: z.array(z.string().min(1)).optional(),
  enabled: z.boolean().optional()
});

const authenticationStageSchema = z.object({
  type: z.enum([
    "password",
    "federation",
    "consent",
    "mfa_totp",
    "risk_check",
    "identification",
    "email_verification",
    "captcha",
    "prompt",
    "user_write",
    "user_login",
    "user_logout"
  ]),
  required: z.boolean(),
  order: z.number().int().min(1)
});

export const createAuthenticationFlowSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  designation: z.enum(["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]).default("authentication"),
  enabled: z.boolean().default(false),
  grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"])).min(1),
  stages: z.array(authenticationStageSchema).min(1)
});

export const updateAuthenticationFlowSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  designation: z.enum(["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]).optional(),
  enabled: z.boolean().optional(),
  grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"])).min(1).optional(),
  stages: z.array(authenticationStageSchema).min(1).optional()
});

export const dynamicClientRegistrationSchema = z.object({
  app_id: z.string().min(2).optional(),
  client_name: z.string().min(2).default("dynamic-client"),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"])).optional(),
  response_types: z.array(z.enum(["code", "token", "code token", "code id_token", "id_token token", "code id_token token"])).optional(),
  scope: z.string().optional(),
  token_endpoint_auth_method: z.enum(["client_secret_post"]).default("client_secret_post")
});

const userAttributeTypeSchema = z.enum(["text", "number", "boolean", "date", "json"]);
const authenticationStageTypeSchema = z.enum([
  "password",
  "federation",
  "consent",
  "mfa_totp",
  "mfa_webauthn",
  "mfa_webauthn",
  "risk_check",
  "identification",
  "email_verification",
  "captcha",
  "prompt",
  "user_write",
  "user_login",
  "user_logout"
]);

export const createUserAttributeSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  description: z.string().min(2),
  type: userAttributeTypeSchema,
  enabled: z.boolean().default(true),
  showOnPortal: z.boolean().default(false),
  userEditable: z.boolean().default(false)
});

export const updateUserAttributeSchema = z.object({
  key: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  type: userAttributeTypeSchema.optional(),
  enabled: z.boolean().optional(),
  showOnPortal: z.boolean().optional(),
  userEditable: z.boolean().optional()
});

export const setUserAttributeGroupAssignmentSchema = z.object({
  groupId: z.string().min(2),
  enabled: z.boolean(),
  value: z.string().optional()
});

export const createPolicySchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  description: z.string().min(2),
  category: z.enum(["authentication", "authorization"]).optional(),
  effect: z.enum(["allow", "deny"]).optional(),
  resourcePattern: z.string().min(1).optional(),
  actionPattern: z.string().min(1).optional(),
  stageBindings: z.array(authenticationStageTypeSchema).default([]),
  javascriptCode: z.string().optional(),
  enabled: z.boolean().default(true)
});

export const updatePolicySchema = z.object({
  key: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  category: z.enum(["authentication", "authorization"]).optional(),
  effect: z.enum(["allow", "deny"]).optional(),
  resourcePattern: z.string().min(1).optional().nullable(),
  actionPattern: z.string().min(1).optional().nullable(),
  stageBindings: z.array(authenticationStageTypeSchema).optional(),
  javascriptCode: z.string().optional().nullable(),
  enabled: z.boolean().optional()
});

export const setPolicyAssignmentSchema = z.object({
  scopeType: z.enum(["global", "tenant", "group", "user"]),
  scopeId: z.string().min(1).optional(),
  enabled: z.boolean(),
  priority: z.number().int().optional(),
  decisionStrategy: z.enum(["deny_overrides", "allow_overrides", "first_applicable"]).optional(),
  config: z.record(z.string(), z.unknown()).default({})
});

export const removePolicyAssignmentSchema = z.object({
  scopeType: z.enum(["global", "tenant", "group", "user"]),
  scopeId: z.string().min(1).optional()
});

export const evaluatePolicyDecisionSchema = z.object({
  userId: z.string().min(2),
  resource: z.string().min(1),
  action: z.string().min(1),
  decisionStrategy: z.enum(["deny_overrides", "allow_overrides", "first_applicable"]).optional(),
  tenantId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  ip: z.string().min(1).optional(),
  context: z.record(z.string(), z.unknown()).default({})
});

export const authorizationCheckSchema = evaluatePolicyDecisionSchema;

export const createEventHookSchema = z.object({
  eventType: z.string().min(1),
  targetUrl: z.string().url(),
  method: z.enum(["POST", "PUT"]).default("POST"),
  headers: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true)
});

export const updateEventHookSchema = z.object({
  eventType: z.string().min(1).optional(),
  targetUrl: z.string().url().optional(),
  method: z.enum(["POST", "PUT"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional()
});

export const testEventHookSchema = z.object({
  eventType: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const createScimTokenSchema = z.object({
  label: z.string().min(2),
  expiresAt: z.string().datetime().optional()
});

export const createProvisioningMappingSchema = z.object({
  name: z.string().min(2),
  sourceAttribute: z.string().min(1),
  targetAttribute: z.string().min(1),
  transformExpression: z.string().min(1).optional(),
  enabled: z.boolean().default(true)
});

export const reconcileProvisioningJobSchema = z.object({
  dryRun: z.boolean().default(true)
});

export const createAccessRequestSchema = z.object({
  subjectUserId: z.string().min(2),
  entitlementType: z.string().min(1),
  entitlementValue: z.string().min(1),
  justification: z.string().min(3),
  expiresAt: z.string().datetime().optional()
});

export const listAccessRequestsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "expired", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const decideAccessRequestSchema = z.object({
  rationale: z.string().min(1).max(2000).optional()
});

export const processExpiredAccessRequestsSchema = z.object({
  dryRun: z.boolean().default(false),
  now: z.string().datetime().optional()
});

export const createAccessReviewCampaignSchema = z.object({
  name: z.string().min(3),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional()
});

export const decideAccessReviewItemSchema = z.object({
  decision: z.enum(["certified", "revoked"]),
  rationale: z.string().min(1).max(2000).optional()
});

const uiSurfaceSchema = z.enum(["admin_login", "consent", "portal_login", "portal_launcher"]);

const uiSurfaceCustomizationSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  subtitle: z.string().min(1).max(300).optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  backgroundCss: z.string().min(1).max(500).optional()
});

const uiCustomizationSettingsSchema = z.object({
  defaultBySurface: z.record(uiSurfaceSchema, uiSurfaceCustomizationSchema).default({}),
  byClientId: z.record(z.string().min(1), z.record(uiSurfaceSchema, uiSurfaceCustomizationSchema)).default({}),
  byAppId: z.record(z.string().min(1), z.record(uiSurfaceSchema, uiSurfaceCustomizationSchema)).default({})
});

export const updateInstanceSettingsSchema = z.object({
  databaseProvider: z.enum(["sqlite", "postgresql", "mysql"]).optional(),
  databasePath: z.string().min(1).optional(),
  externalDatabaseUrl: z.string().url().optional(),
  requireHttps: z.boolean().optional(),
  secureCookies: z.boolean().optional(),
  allowAnyCorsOrigin: z.boolean().optional(),
  corsAllowedOrigins: z.array(z.string().url()).optional(),
  requireHttpsRedirectUris: z.boolean().optional(),
  requireS256Pkce: z.boolean().optional(),
  allowImplicitFlow: z.boolean().optional(),
  loginFailureWindowMs: z.number().int().min(60_000).max(86_400_000).optional(),
  loginLockoutThreshold: z.number().int().min(1).max(100).optional(),
  loginLockoutDurationMs: z.number().int().min(60_000).max(86_400_000).optional(),
  sessionAnomalyConcurrencyThreshold: z.number().int().min(1).max(100).optional(),
  rateLimitMultiplier: z.number().min(0.1).max(100).optional(),
  emailTransport: z.enum(["disabled", "log", "smtp"]).optional(),
  emailFrom: z.string().email().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  uiCustomizations: uiCustomizationSettingsSchema.optional()
});

export const sendTestEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).default("SSO email test"),
  message: z.string().min(1).default("This is a test email from the SSO platform.")
});

export const testDatabaseConnectionSchema = z.object({
  provider: z.enum(["postgresql", "mysql"]),
  externalDatabaseUrl: z.string().url()
});

export const migrateDatabaseSchema = z.object({
  provider: z.enum(["postgresql", "mysql"]),
  externalDatabaseUrl: z.string().url(),
  sqlitePath: z.string().min(1).optional()
});

export const setupInitializeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  databaseProvider: z.enum(["sqlite", "postgresql", "mysql"]).default("sqlite"),
  databasePath: z.string().min(1).optional(),
  externalDatabaseUrl: z.string().url().optional()
});

export const frontChannelLogoutSchema = z.object({
  sid: z.string().min(2).optional(),
  sub: z.string().min(2).optional(),
  post_logout_redirect_uri: z.string().url().optional(),
  state: z.string().optional()
});

export const oauthLogoutSchema = z.object({
  post_logout_redirect_uri: z.string().url().optional(),
  state: z.string().optional(),
  client_id: z.string().min(2).optional(),
  id_token_hint: z.string().min(16).optional()
});

export const backChannelLogoutSchema = z.object({
  client_id: z.string().min(2),
  client_secret: z.string().min(8),
  sid: z.string().min(2).optional(),
  sub: z.string().min(2).optional()
}).refine((data) => Boolean(data.sid || data.sub), {
  message: "Either sid or sub is required"
});

export const createElevationRequestSchema = z.object({
  justification: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(480).optional()
});

export const listElevationRequestsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "active", "revoked", "expired"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const approveElevationRequestSchema = z.object({
  rationale: z.string().optional()
});

export const listElevationSessionsQuerySchema = z.object({
  status: z.enum(["active", "revoked", "expired"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const checkElevationAccessSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1)
});

export const createEmergencyBreakGlassSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  reason: z.string().min(10),
  requesterId: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(120).optional()
});

export const createServiceIdentitySchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  appId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  allowedScopes: z.array(z.string()).default([]),
  allowedAudiences: z.array(z.string()).default([]),
  roleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const updateServiceIdentitySchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  appId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  allowedScopes: z.array(z.string()).optional(),
  allowedAudiences: z.array(z.string()).optional(),
  roleIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const issueServiceIdentityCredentialSchema = z.object({
  expiresInDays: z.number().int().min(1).max(3650).optional()
});

export const tokenExchangeSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:token-exchange"),
  subject_token: z.string().min(1),
  subject_token_type: z.string().min(1),
  requested_token_type: z.string().optional(),
  audience: z.string().optional(),
  scope: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional()
});

// ---------------------------------------------------------------------------
// EPIC 8 – Connector Framework
// ---------------------------------------------------------------------------

export const createConnectorSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["ldap", "scim", "csv", "sql", "custom"]),
  config: z.record(z.string(), z.unknown()).default({}),
  schedule: z.string().optional()
});

export const updateConnectorSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["ldap", "scim", "csv", "sql", "custom"]).optional(),
  status: z.enum(["active", "inactive", "error"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  schedule: z.string().optional()
});

export const createConnectorMappingSchema = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.string().optional()
});

// ---------------------------------------------------------------------------
// Plugin Management
// ---------------------------------------------------------------------------

export const pluginManifestSchema = z.object({
  id: z.string().min(3).max(64),
  name: z.string().min(2).max(120),
  version: z.string().min(1).max(32),
  description: z.string().max(500).optional(),
  entrypoint: z.string().min(1).max(160),
  permissions: z.array(z.string().min(2)).default([]),
  hooks: z.array(z.string().min(2)).default([]),
  homepage: z.string().url().optional()
});

export const validatePluginSchema = z.object({
  manifest: pluginManifestSchema,
  bundleBase64: z.string().min(8).optional()
});

export const uploadPluginSchema = z.object({
  manifest: pluginManifestSchema,
  bundleBase64: z.string().min(8),
  activate: z.boolean().default(false)
});
