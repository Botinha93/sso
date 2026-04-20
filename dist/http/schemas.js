import { z } from "zod";
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
    permissions: z.array(z.string().min(2)).min(1).optional(),
    scope: z.enum(["platform", "tenant"]).optional()
});
export const createUserSchema = z.object({
    appId: z.string().min(2).optional(),
    externalSource: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    isServiceUser: z.boolean().default(false),
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(8),
    givenName: z.string().min(1),
    familyName: z.string().min(1),
    customAttributes: z.record(z.string(), z.string()).default({}),
    roleIds: z.array(z.string()).default([]),
    groupIds: z.array(z.string()).default([])
});
export const updateUserSchema = z.object({
    appId: z.string().min(2).optional(),
    externalSource: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    isServiceUser: z.boolean().optional(),
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    givenName: z.string().min(1).optional(),
    familyName: z.string().min(1).optional(),
    active: z.boolean().optional(),
    groupIds: z.array(z.string()).optional(),
    customAttributes: z.record(z.string(), z.string()).optional()
});
export const resetUserPasswordSchema = z.object({
    password: z.string().min(8)
});
export const portalUpdateProfileSchema = z.object({
    givenName: z.string().min(1).optional(),
    familyName: z.string().min(1).optional(),
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
    externalSource: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    name: z.string().min(2),
    description: z.string().min(2),
    roleIds: z.array(z.string()).default([])
});
export const updateGroupSchema = z.object({
    appId: z.string().min(2).optional(),
    externalSource: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional()
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
export const verifyTotpEnrollmentSchema = z.object({
    enrollmentId: z.string().min(8),
    code: z.string().min(6).max(8)
});
export const authorizeSchema = z.object({
    response_type: z.enum(["code", "token"]),
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
export const tokenSchema = z.discriminatedUnion("grant_type", [
    authorizationCodeTokenSchema,
    refreshTokenSchema,
    clientCredentialsSchema,
    passwordGrantSchema,
    deviceCodeTokenSchema
]);
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
export const createClientSchema = z.object({
    appId: z.string().min(2).optional(),
    id: z.string().min(3),
    name: z.string().min(2),
    secret: z.string().min(16),
    redirectUris: z.array(z.string().url()).min(1),
    allowedScopes: z.array(z.string()).min(1),
    grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code"])).min(1),
    requirePkce: z.boolean().default(false),
    resources: z.array(z.string().min(1)).default([]),
    flowIds: z.array(z.string().min(1)).default([])
});
export const updateClientSchema = z.object({
    appId: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    secret: z.string().min(16).optional(),
    redirectUris: z.array(z.string().url()).optional(),
    allowedScopes: z.array(z.string()).optional(),
    grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code"])).optional(),
    requirePkce: z.boolean().optional(),
    resources: z.array(z.string().min(1)).optional(),
    flowIds: z.array(z.string().min(1)).optional()
});
export const createScopeSchema = z.object({
    name: z.string().min(1),
    description: z.string().default("")
});
export const createAppSchema = z.object({
    name: z.string().min(2),
    description: z.string().min(2),
    icon: z.string().optional(),
    url: z.string().url().optional()
});
export const updateAppSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    icon: z.string().optional(),
    url: z.string().url().optional().nullable()
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
    grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code"])).min(1),
    stages: z.array(authenticationStageSchema).min(1)
});
export const updateAuthenticationFlowSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    designation: z.enum(["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]).optional(),
    enabled: z.boolean().optional(),
    grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code"])).min(1).optional(),
    stages: z.array(authenticationStageSchema).min(1).optional()
});
export const dynamicClientRegistrationSchema = z.object({
    app_id: z.string().min(2).optional(),
    client_name: z.string().min(2).default("dynamic-client"),
    redirect_uris: z.array(z.string().url()).min(1),
    grant_types: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password", "device_code"])).optional(),
    response_types: z.array(z.enum(["code", "token"])).optional(),
    scope: z.string().optional(),
    token_endpoint_auth_method: z.enum(["client_secret_post"]).default("client_secret_post")
});
const userAttributeTypeSchema = z.enum(["text", "number", "boolean", "date", "json"]);
const authenticationStageTypeSchema = z.enum([
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
]);
export const createUserAttributeSchema = z.object({
    key: z.string().min(2),
    name: z.string().min(2),
    description: z.string().min(2),
    type: userAttributeTypeSchema,
    enabled: z.boolean().default(true)
});
export const updateUserAttributeSchema = z.object({
    key: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    type: userAttributeTypeSchema.optional(),
    enabled: z.boolean().optional()
});
export const setUserAttributeGroupAssignmentSchema = z.object({
    groupId: z.string().min(2),
    enabled: z.boolean()
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
    emailTransport: z.enum(["disabled", "log", "smtp"]).optional(),
    emailFrom: z.string().email().optional(),
    smtpHost: z.string().min(1).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional()
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
export const backChannelLogoutSchema = z.object({
    sid: z.string().min(2).optional(),
    sub: z.string().min(2).optional()
}).refine((data) => Boolean(data.sid || data.sub), {
    message: "Either sid or sub is required"
});
