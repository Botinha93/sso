import { createHash } from "node:crypto";

/** Closed relying-party configuration for the issuer-reviewed NexusHub v1 profile. */
export const NEXUSHUB_CLIENT_PROFILE_ID = "nexushub" as const;
export const NEXUSHUB_CLIENT_PROFILE_VERSION = 1 as const;
export const LIBERIDE_CLIENT_PROFILE_ID = "liberide" as const;
export const LIBERIDE_CLIENT_PROFILE_VERSION = 1 as const;
export const NEXUSHUB_CLIENT_REDIRECT_PATH = "/auth/callback" as const;
export const NEXUSHUB_CLIENT_GRANTS = ["authorization_code", "refresh_token", "token_exchange"] as const;
export const NEXUSHUB_CLIENT_SCOPES = [
  "openid",
  "profile",
  "email",
  "nexushub.installations:write",
  "nexushub.operations:read",
  "nexushub.operations:resume",
  "nexushub.organizations:read",
  "nexushub.organizations:write",
  "nexushub.projects:read",
  "nexushub.projects:write",
  "nexushub.applications:read",
  "nexushub.applications:write"
] as const;

export type NexusHubClientProfile = {
  profileId: typeof NEXUSHUB_CLIENT_PROFILE_ID;
  profileVersion: typeof NEXUSHUB_CLIENT_PROFILE_VERSION;
  name: "NexusHub";
  redirectUris: [string];
  allowedScopes: [...typeof NEXUSHUB_CLIENT_SCOPES];
  grants: [...typeof NEXUSHUB_CLIENT_GRANTS];
  requirePkce: true;
  tokenEndpointAuthMethod: "client_secret_post";
};

export type LiberIDEClientProfile = {
  profileId: typeof LIBERIDE_CLIENT_PROFILE_ID;
  profileVersion: typeof LIBERIDE_CLIENT_PROFILE_VERSION;
  name: "LiberIDE";
  redirectUris: [string];
  allowedScopes: ["openid", "profile", "email"];
  grants: ["authorization_code"];
  requirePkce: true;
  tokenEndpointAuthMethod: "client_secret_post";
};

export class NexusHubClientProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NexusHubClientProfileError";
  }
}

/**
 * Derives the complete client registration from issuer-owned enrollment data.
 * Callers cannot supply callback paths, scopes, grants, or client metadata.
 */
export function deriveNexusHubClientProfile(input: {
  profileId: unknown;
  profileVersion: unknown;
  publicOrigin: unknown;
}): NexusHubClientProfile {
  if (input.profileId !== NEXUSHUB_CLIENT_PROFILE_ID || input.profileVersion !== NEXUSHUB_CLIENT_PROFILE_VERSION) {
    throw new NexusHubClientProfileError("Unsupported NexusHub client profile");
  }
  if (typeof input.publicOrigin !== "string") {
    throw new NexusHubClientProfileError("Enrollment public origin is invalid");
  }

  let origin: URL;
  try {
    origin = new URL(input.publicOrigin);
  } catch {
    throw new NexusHubClientProfileError("Enrollment public origin is invalid");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.origin !== input.publicOrigin) {
    throw new NexusHubClientProfileError("Enrollment public origin must be a canonical HTTPS origin");
  }

  return {
    profileId: NEXUSHUB_CLIENT_PROFILE_ID,
    profileVersion: NEXUSHUB_CLIENT_PROFILE_VERSION,
    name: "NexusHub",
    redirectUris: [`${origin.origin}${NEXUSHUB_CLIENT_REDIRECT_PATH}`],
    allowedScopes: [...NEXUSHUB_CLIENT_SCOPES],
    grants: [...NEXUSHUB_CLIENT_GRANTS],
    requirePkce: true,
    tokenEndpointAuthMethod: "client_secret_post"
  };
}

/** Fixed server-side OIDC login profile; the callback origin is separately issuer-enrolled. */
export function deriveLiberIDEClientProfile(input: {
  profileId: unknown;
  profileVersion: unknown;
  publicOrigin: unknown;
}): LiberIDEClientProfile {
  if (input.profileId !== LIBERIDE_CLIENT_PROFILE_ID || input.profileVersion !== LIBERIDE_CLIENT_PROFILE_VERSION) {
    throw new NexusHubClientProfileError("Unsupported LiberIDE client profile");
  }
  if (typeof input.publicOrigin !== "string") throw new NexusHubClientProfileError("LiberIDE enrollment origin is invalid");
  let origin: URL;
  try { origin = new URL(input.publicOrigin); }
  catch { throw new NexusHubClientProfileError("LiberIDE enrollment origin is invalid"); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" ||
      origin.search || origin.hash || origin.origin !== input.publicOrigin) {
    throw new NexusHubClientProfileError("LiberIDE enrollment origin must be a canonical HTTPS origin");
  }
  return {
    profileId: LIBERIDE_CLIENT_PROFILE_ID,
    profileVersion: LIBERIDE_CLIENT_PROFILE_VERSION,
    name: "LiberIDE",
    redirectUris: [`${origin.origin}/api/auth/nexusid/callback`],
    allowedScopes: ["openid", "profile", "email"],
    grants: ["authorization_code"],
    requirePkce: true,
    tokenEndpointAuthMethod: "client_secret_post"
  };
}

/** Stable request digest for uniqueness/conflict checks at the persistence boundary. */
export function nexusHubClientProfileDigest(profile: NexusHubClientProfile): string {
  const canonical = JSON.stringify({
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    name: profile.name,
    redirectUris: [...profile.redirectUris].sort(),
    allowedScopes: [...profile.allowedScopes].sort(),
    grants: [...profile.grants].sort(),
    requirePkce: profile.requirePkce,
    tokenEndpointAuthMethod: profile.tokenEndpointAuthMethod
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function liberIDEClientProfileDigest(profile: LiberIDEClientProfile): string {
  return createHash("sha256").update(JSON.stringify({
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    name: profile.name,
    redirectUris: [...profile.redirectUris].sort(),
    allowedScopes: [...profile.allowedScopes].sort(),
    grants: [...profile.grants].sort(),
    requirePkce: profile.requirePkce,
    tokenEndpointAuthMethod: profile.tokenEndpointAuthMethod
  })).digest("hex");
}
