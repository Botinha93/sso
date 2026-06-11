import type { User } from "./models.js";

/** Canonical platform scope catalog seeded on setup and advertised in OIDC discovery. */
export const DEFAULT_SCOPES = [
  { name: "openid", description: "Authenticate user with OpenID Connect" },
  { name: "profile", description: "Read basic profile claims (name, username, picture)" },
  { name: "email", description: "Read user email claims" },
  { name: "offline_access", description: "Request refresh tokens" },
  { name: "roles", description: "Read role claims" },
  { name: "groups", description: "Read group membership claims" },
  { name: "permissions", description: "Read effective permission claims" }
] as const;

/** Claims emitted when each scope is granted (sub is always included separately). */
export const SCOPE_CLAIM_MAP: Record<string, readonly string[]> = {
  profile: ["name", "preferred_username", "given_name", "family_name", "picture"],
  email: ["email", "email_verified"],
  roles: ["roles"],
  groups: ["groups"],
  permissions: ["permissions"]
};

export const OIDC_CLAIMS_SUPPORTED = [
  "sub",
  "iss",
  "aud",
  "exp",
  "iat",
  "email",
  "email_verified",
  "name",
  "preferred_username",
  "given_name",
  "family_name",
  "picture",
  "roles",
  "groups",
  "permissions"
] as const;

/** Human-readable consent screen labels keyed by scope name. */
export const SCOPE_CONSENT_LABELS: Record<string, string> = {
  openid: "Verify your identity (OpenID Connect)",
  profile: "Access your name, username, and profile picture",
  email: "Access your email address",
  offline_access: "Stay signed in with refresh tokens",
  roles: "Read your assigned roles",
  groups: "Read your group memberships",
  permissions: "Read your effective permissions"
};

export type ScopeClaimResolverContext = {
  user: User;
  scopes: string[];
  tenantId?: string;
  resolveRoles: () => Promise<string[]>;
  resolveGroups: () => Promise<string[]>;
  resolvePermissions: () => Promise<string[]>;
};

/** Build OIDC user claims gated by granted scopes. */
export async function buildScopeGatedClaims(
  ctx: ScopeClaimResolverContext
): Promise<Record<string, unknown>> {
  const { user, scopes } = ctx;
  const claims: Record<string, unknown> = { sub: user.id };

  if (scopes.includes("profile")) {
    claims.name = `${user.givenName} ${user.familyName}`.trim() || user.username;
    claims.preferred_username = user.username;
    claims.given_name = user.givenName;
    claims.family_name = user.familyName;
    if (user.avatarUrl) {
      claims.picture = user.avatarUrl;
    }
  }

  if (scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = true;
  }

  if (scopes.includes("roles")) {
    claims.roles = await ctx.resolveRoles();
  }

  if (scopes.includes("groups")) {
    claims.groups = await ctx.resolveGroups();
  }

  if (scopes.includes("permissions")) {
    claims.permissions = await ctx.resolvePermissions();
  }

  return claims;
}

/** Strip `sub` for JWT payloads where subject is set via setSubject(). */
export function claimsWithoutSubject(claims: Record<string, unknown>) {
  const { sub: _sub, ...rest } = claims;
  return rest;
}

/** Authorization claims to embed in access tokens for the granted scopes. */
export async function buildAccessTokenAuthorizationClaims(
  ctx: ScopeClaimResolverContext
): Promise<{ roles?: string[]; groups?: string[]; permissions?: string[] }> {
  const result: { roles?: string[]; groups?: string[]; permissions?: string[] } = {};

  if (ctx.scopes.includes("roles")) {
    result.roles = await ctx.resolveRoles();
  }

  if (ctx.scopes.includes("groups")) {
    result.groups = await ctx.resolveGroups();
  }

  if (ctx.scopes.includes("permissions")) {
    result.permissions = await ctx.resolvePermissions();
  }

  return result;
}
