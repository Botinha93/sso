import { z } from "zod";
export const createRoleSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(3),
    permissions: z.array(z.string().min(2)).min(1),
    scope: z.enum(["platform", "tenant"])
});
export const createUserSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(8),
    givenName: z.string().min(1),
    familyName: z.string().min(1),
    roleIds: z.array(z.string()).default([])
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    clientId: z.string().min(2),
    tenantSlug: z.string().min(2).optional(),
    scope: z.array(z.string()).default(["openid", "profile", "email"])
});
export const authorizeSchema = z.object({
    response_type: z.literal("code"),
    client_id: z.string().min(2),
    redirect_uri: z.string().url(),
    scope: z.string().min(1),
    state: z.string().optional(),
    tenant: z.string().min(2).optional(),
    email: z.string().email(),
    password: z.string().min(8),
    code_challenge: z.string().optional(),
    code_challenge_method: z.enum(["S256"]).optional()
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
export const tokenSchema = z.discriminatedUnion("grant_type", [
    authorizationCodeTokenSchema,
    refreshTokenSchema
]);
export const createTenantSchema = z.object({
    slug: z.string().min(2),
    name: z.string().min(2)
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
