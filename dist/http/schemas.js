import { z } from "zod";
export const createRoleSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(3),
    permissions: z.array(z.string().min(2)).min(1),
    scope: z.enum(["platform", "tenant"])
});
export const updateRoleSchema = z.object({
    name: z.string().min(3).optional(),
    description: z.string().optional(),
    permissions: z.array(z.string().min(2)).min(1).optional(),
    scope: z.enum(["platform", "tenant"]).optional()
});
export const createUserSchema = z.object({
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
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    givenName: z.string().min(1).optional(),
    familyName: z.string().min(1).optional(),
    active: z.boolean().optional(),
    groupIds: z.array(z.string()).optional(),
    customAttributes: z.record(z.string(), z.string()).optional()
});
export const createGroupSchema = z.object({
    name: z.string().min(2),
    description: z.string().min(2),
    roleIds: z.array(z.string()).default([])
});
export const updateGroupSchema = z.object({
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
    scope: z.array(z.string()).default(["openid", "profile", "email"])
});
export const authorizeSchema = z.object({
    response_type: z.literal("code"),
    client_id: z.string().min(2),
    redirect_uri: z.string().url(),
    scope: z.string().min(1),
    state: z.string().optional(),
    nonce: z.string().optional(),
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
export const tokenSchema = z.discriminatedUnion("grant_type", [
    authorizationCodeTokenSchema,
    refreshTokenSchema,
    clientCredentialsSchema
]);
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
    id: z.string().min(3),
    name: z.string().min(2),
    secret: z.string().min(16),
    redirectUris: z.array(z.string().url()).min(1),
    allowedScopes: z.array(z.string()).min(1),
    grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token"])).min(1),
    requirePkce: z.boolean().default(false),
    resources: z.array(z.string().min(1)).default([]),
    flowIds: z.array(z.string().min(1)).default([])
});
export const updateClientSchema = z.object({
    name: z.string().min(2).optional(),
    secret: z.string().min(16).optional(),
    redirectUris: z.array(z.string().url()).optional(),
    allowedScopes: z.array(z.string()).optional(),
    grants: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token"])).optional(),
    requirePkce: z.boolean().optional(),
    resources: z.array(z.string().min(1)).optional(),
    flowIds: z.array(z.string().min(1)).optional()
});
export const createScopeSchema = z.object({
    name: z.string().min(1),
    description: z.string().default("")
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
    grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token"])).min(1),
    stages: z.array(authenticationStageSchema).min(1)
});
export const updateAuthenticationFlowSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    designation: z.enum(["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]).optional(),
    enabled: z.boolean().optional(),
    grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token"])).min(1).optional(),
    stages: z.array(authenticationStageSchema).min(1).optional()
});
const userAttributeTypeSchema = z.enum(["text", "number", "boolean", "date", "json"]);
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
    enabled: z.boolean().default(true)
});
export const updatePolicySchema = z.object({
    key: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    enabled: z.boolean().optional()
});
export const setPolicyAssignmentSchema = z.object({
    scopeType: z.enum(["global", "tenant", "group", "user"]),
    scopeId: z.string().min(1).optional(),
    enabled: z.boolean(),
    config: z.record(z.string(), z.unknown()).default({})
});
export const removePolicyAssignmentSchema = z.object({
    scopeType: z.enum(["global", "tenant", "group", "user"]),
    scopeId: z.string().min(1).optional()
});
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
export const setupInitializeSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(8)
});
