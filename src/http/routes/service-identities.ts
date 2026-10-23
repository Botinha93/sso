import type { FastifyInstance } from "fastify";
import type { ServiceIdentityService } from "../../services/service-identity-service.js";
import type { GroupService } from "../../services/group-service.js";
import type { RoleService } from "../../services/role-service.js";
import type { AuthService } from "../../services/auth-service.js";
import type { AuditRepository } from "../../repositories/contracts.js";
import type { NexusBusManagementEnrollmentRepository } from "../../repositories/contracts.js";
import type { ClientService } from "../../services/client-service.js";
import { deriveLiberIDEClientProfile, deriveNexusHubClientProfile, liberIDEClientProfileDigest, nexusHubClientProfileDigest } from "../../services/nexushub-client-profile.js";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import {
  createServiceIdentitySchema,
  updateServiceIdentitySchema,
  issueServiceIdentityCredentialSchema
} from "../schemas.js";

// These metadata flags grant a service identity unrestricted admin access
// (see isBootstrapAdminServiceIdentityMetadata). They may only be set by the
// bootstrap process, never through the management API, otherwise any role
// with service_identities:add could escalate to *:*.
const PRIVILEGED_METADATA_KEYS = ["bootstrap_admin", "ungated_admin", "nexushub_enrollment", "nexusbus_management_enrollment"];
const NEXUSHUB_PROVISIONING_AUDIENCE = "urn:nexusid:nexushub:client-provisioning";
const NEXUSHUB_PROFILE_VERSIONS = ["nexushub:1"] as const;
const LIBERIDE_PROFILE_VERSION = "liberide:1";
const NEXUSBUS_MANAGEMENT_AUDIENCE = "nexusbus-management";
const NEXUSBUS_MANAGEMENT_ROLES = ["nexusbus.installation.read", "nexusbus.installation.apply"] as const;
const NEXUSBUS_MANAGEMENT_TTL_SECONDS = 300;

const stripPrivilegedMetadata = <T extends { metadata?: Record<string, unknown> }>(input: T): T => {
  if (!input.metadata) {
    return input;
  }
  const metadata = { ...input.metadata };
  for (const key of PRIVILEGED_METADATA_KEYS) {
    delete metadata[key];
  }
  return { ...input, metadata };
};

export function registerServiceIdentityRoutes(
  app: FastifyInstance,
  serviceIdentityService: ServiceIdentityService,
  roleService: RoleService,
  groupService: GroupService,
  authService: AuthService,
  auditRepository: AuditRepository,
  resolveAuditActor: (request: FastifyRequest) => Promise<{ actorId?: string; actorType: "user" | "client" | "system" }>,
  jwtService: { issueNexusBusManagementToken(params: { subject: string; tenant: string; app: string; hubScope: { organizationId: string; projectId?: string }; roles: string[]; tokenId: string; lifetimeSeconds: number }): Promise<string>; },
  nexusBusManagementEnrollmentRepository: NexusBusManagementEnrollmentRepository,
  clientService?: ClientService
) {
  const hubProvisioningEnabled = () => process.env.NEXUSID_NEXUSHUB_PROVISIONING_ENABLED === "true";
  const normalizedHttpsOrigin = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
      return url.origin;
    } catch {
      return undefined;
    }
  };
  const enrollmentFrom = (identity: { metadata?: Record<string, unknown> }) => {
    const value = identity.metadata?.nexushub_enrollment;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as { status?: string; installationId?: string; serviceIdentityId?: string; publicOrigin?: string; liberideOrigin?: string; credentialId?: string; credentialClientId?: string; clientId?: string; adoptedExisting?: boolean; profileVersions?: string[]; revokedAt?: string }
      : undefined;
  };
  const validBusIdentity = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/.test(value);
  const validHubId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/.test(value);
  const sameSecret = (stored: string, supplied: string) => {
    const a = Buffer.from(stored, "utf8");
    const b = Buffer.from(supplied, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const approvedBusBinding = (binding: { organizationId?: string; projectId?: string; tenant?: string; app?: string; roles?: string[] }) => {
    try {
      const entries = JSON.parse(process.env.NEXUSID_NEXUSBUS_MANAGEMENT_BINDINGS_JSON ?? "[]") as Array<typeof binding>;
      return entries.find((entry) => entry.organizationId === binding.organizationId && (entry.projectId ?? undefined) === (binding.projectId ?? undefined) && entry.tenant === binding.tenant && entry.app === binding.app && Array.isArray(entry.roles) && binding.roles?.every((role) => entry.roles!.includes(role)));
    } catch {
      return undefined;
    }
  };

  // NexusID platform-admin approval is the authority for this exact Hub-scope
  // to Bus-identity mapping. The generated management secret is independent of
  // service-identity OAuth credentials and is only returned once.
  app.put<{ Params: { id: string }; Body: { organizationId?: string; projectId?: string; tenant?: string; app?: string; roles?: string[] } }>("/api/admin/service-identities/:id/nexusbus-management-enrollment", async (request, reply) => {
    if (process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED !== "true") return reply.status(404).send({ error: "not_found" });
    const { organizationId, projectId, tenant, app: busApp, roles } = request.body ?? {};
    if (!validHubId(organizationId) || (projectId !== undefined && !validHubId(projectId)) ||
        !validBusIdentity(tenant) || !validBusIdentity(busApp) || !Array.isArray(roles) || roles.length < 1 ||
        roles.some((role) => !(NEXUSBUS_MANAGEMENT_ROLES as readonly string[]).includes(role)) || new Set(roles).size !== roles.length) {
      return reply.status(400).send({ error: "validation_error" });
    }
    if (!approvedBusBinding({ organizationId, projectId, tenant, app: busApp, roles })) return reply.status(403).send({ error: "bus_management_binding_not_approved" });
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (!identity || identity.status !== "active") return reply.status(404).send({ error: "service_identity_not_found_or_inactive" });
    const current = await nexusBusManagementEnrollmentRepository.findByServiceIdentity(identity.id);
    if (current) return reply.status(409).send({ error: current.status === "active" ? "enrollment_already_exists" : "enrollment_revoked" });
    const secret = randomBytes(32).toString("base64url");
    const credentialId = randomUUID();
    let enrollment;
    try {
      enrollment = await nexusBusManagementEnrollmentRepository.create({ enrollmentId: randomUUID(), installationId: randomUUID(), serviceIdentityId: identity.id, credentialId, credentialHash: createHash("sha256").update(secret).digest("hex"), organizationId: organizationId!, ...(projectId ? { projectId } : {}), tenant: tenant!, app: busApp!, roles: [...(roles as string[])].sort() });
    } catch {
      // The unique service-identity constraint closes concurrent enrollment races.
      return reply.status(409).send({ error: "enrollment_already_exists" });
    }
    const actor = await resolveAuditActor(request);
    await auditRepository.log({ type: "nexusbus_management_enrollment_created", ...actor, metadata: { enrollmentId: enrollment.enrollmentId, installationId: enrollment.installationId, serviceIdentityId: identity.id, credentialId, organizationId, projectId, tenant, app: busApp, roles: enrollment.roles, outcome: "success" } });
    return reply.status(201).send({ data: { enrollmentId: enrollment.enrollmentId, installationId: enrollment.installationId, credentialId, clientId: credentialId, clientSecret: secret, audience: NEXUSBUS_MANAGEMENT_AUDIENCE, organizationId, projectId, tenant, app: busApp, roles: enrollment.roles, expiresIn: NEXUSBUS_MANAGEMENT_TTL_SECONDS } });
  });

  app.delete<{ Params: { id: string } }>("/api/admin/service-identities/:id/nexusbus-management-enrollment", async (request, reply) => {
    if (process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED !== "true") return reply.status(404).send({ error: "not_found" });
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    const current = identity && await nexusBusManagementEnrollmentRepository.findByServiceIdentity(identity.id);
    if (!identity || !current || current.status !== "active") return reply.status(404).send({ error: "enrollment_not_found" });
    if (!await nexusBusManagementEnrollmentRepository.revoke(identity.id)) return reply.status(404).send({ error: "enrollment_not_found" });
    const actor = await resolveAuditActor(request);
    await auditRepository.log({ type: "nexusbus_management_enrollment_revoked", ...actor, metadata: { enrollmentId: current.enrollmentId, installationId: current.installationId, serviceIdentityId: identity.id, credentialId: current.credentialId, outcome: "success" } });
    return reply.status(204).send();
  });

  app.post<{ Body: { grant_type?: string; client_id?: string; client_secret?: string; roles?: string[] } }>("/api/nexusbus/v1/token", async (request, reply) => {
    if (process.env.NEXUSID_NEXUSBUS_MANAGEMENT_ENABLED !== "true") return reply.status(404).send({ error: "not_found" });
    if (request.body?.grant_type !== "nexusbus_management" || typeof request.body.client_id !== "string" || typeof request.body.client_secret !== "string" || !Array.isArray(request.body.roles)) return reply.status(400).send({ error: "invalid_request" });
    const enrollment = await nexusBusManagementEnrollmentRepository.findByCredential(request.body.client_id);
    const identity = enrollment && await serviceIdentityService.getServiceIdentity(enrollment.serviceIdentityId);
    const suppliedHash = createHash("sha256").update(request.body.client_secret).digest();
    const storedHash = enrollment?.credentialHash ? Buffer.from(enrollment.credentialHash, "hex") : Buffer.alloc(32);
    const secretMatches = storedHash.length === suppliedHash.length && timingSafeEqual(storedHash, suppliedHash);
    const requestedRoles = request.body.roles;
    const rolesValid = requestedRoles.length > 0 && requestedRoles.every((role) => typeof role === "string" && enrollment?.roles?.includes(role)) && new Set(requestedRoles).size === requestedRoles.length;
    const bindingStillApproved = approvedBusBinding({ organizationId: enrollment?.organizationId, projectId: enrollment?.projectId, tenant: enrollment?.tenant, app: enrollment?.app, roles: enrollment?.roles });
    if (!identity || identity.status !== "active" || enrollment?.status !== "active" || !secretMatches || !rolesValid || !bindingStillApproved) {
      await auditRepository.log({ type: "nexusbus_management_token_denied", actorType: "system", metadata: { credentialId: request.body.client_id, enrollmentId: enrollment?.enrollmentId, reason: "invalid_or_inactive_credential_or_role", outcome: "denied" } });
      return reply.status(401).send({ error: "invalid_client" });
    }
    const token = await jwtService.issueNexusBusManagementToken({
      subject: enrollment.installationId!, tenant: enrollment.tenant!, app: enrollment.app!,
      hubScope: { organizationId: enrollment.organizationId!, ...(enrollment.projectId ? { projectId: enrollment.projectId } : {}) },
      roles: requestedRoles, tokenId: randomUUID(), lifetimeSeconds: NEXUSBUS_MANAGEMENT_TTL_SECONDS
    });
    await auditRepository.log({ type: "nexusbus_management_token_issued", actorType: "system", metadata: { enrollmentId: enrollment.enrollmentId, installationId: enrollment.installationId, serviceIdentityId: identity.id, credentialId: enrollment.credentialId, organizationId: enrollment.organizationId, projectId: enrollment.projectId, tenant: enrollment.tenant, app: enrollment.app, roles: requestedRoles, expiresIn: NEXUSBUS_MANAGEMENT_TTL_SECONDS, outcome: "success" } });
    return { access_token: token, token_type: "Bearer", expires_in: NEXUSBUS_MANAGEMENT_TTL_SECONDS, audience: NEXUSBUS_MANAGEMENT_AUDIENCE };
  });

  // This issuer-admin operation creates the binding. The installation ID is
  // generated by NexusID; the Hub may not nominate an ID or profile set.
  app.put<{ Params: { id: string }; Body: { credentialId?: string; publicOrigin?: string; liberideOrigin?: string; adoptClientId?: string } }>("/api/admin/service-identities/:id/nexushub-enrollment", async (request, reply) => {
    if (!hubProvisioningEnabled()) return reply.status(404).send({ error: "not_found" });
    const body = request.body;
    if (!body || Object.keys(body).some((key) => !["credentialId", "publicOrigin", "liberideOrigin", "adoptClientId"].includes(key)) || typeof body.credentialId !== "string" || !body.credentialId.trim()) {
      return reply.status(400).send({ error: "validation_error" });
    }
    const publicOrigin = normalizedHttpsOrigin(body.publicOrigin);
    if (!publicOrigin || publicOrigin !== body.publicOrigin) {
      return reply.status(400).send({ error: "validation_error", message: "publicOrigin must be a canonical HTTPS origin" });
    }
    const liberideOrigin = body.liberideOrigin === undefined ? undefined : normalizedHttpsOrigin(body.liberideOrigin);
    if (body.liberideOrigin !== undefined && (!liberideOrigin || liberideOrigin !== body.liberideOrigin)) {
      return reply.status(400).send({ error: "validation_error", message: "liberideOrigin must be a canonical HTTPS origin" });
    }
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (!identity || identity.status !== "active") return reply.status(404).send({ error: "service_identity_not_found_or_inactive" });
    const credential = identity.credentials.find((item) => item.id === body.credentialId);
    if (!credential || credential.revokedAt || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
      return reply.status(400).send({ error: "credential_not_active" });
    }
    let approvedExistingClientId: string | undefined;
    if (body.adoptClientId !== undefined) {
      if (!clientService || typeof body.adoptClientId !== "string" || !body.adoptClientId.trim()) return reply.status(400).send({ error: "invalid_adopt_client" });
      const expectedProfile = deriveNexusHubClientProfile({ profileId: "nexushub", profileVersion: 1, publicOrigin });
      const candidate = await clientService.findClientById(body.adoptClientId);
      const exact = candidate && candidate.name === expectedProfile.name &&
        JSON.stringify([...candidate.redirectUris].sort()) === JSON.stringify([...expectedProfile.redirectUris].sort()) &&
        JSON.stringify([...candidate.allowedScopes].sort()) === JSON.stringify([...expectedProfile.allowedScopes].sort()) &&
        JSON.stringify([...candidate.grants].sort()) === JSON.stringify([...expectedProfile.grants].sort()) && candidate.requirePkce === expectedProfile.requirePkce;
      if (!exact) return reply.status(409).send({ error: "existing_client_profile_mismatch" });
      approvedExistingClientId = candidate.id;
    }
    const existing = enrollmentFrom(identity);
    if (existing?.status === "active") {
      if (existing.credentialId === credential.id && existing.publicOrigin === publicOrigin && existing.liberideOrigin === liberideOrigin && existing.clientId === approvedExistingClientId) {
        return { data: { installationId: existing.installationId, publicOrigin, ...(existing.liberideOrigin ? { liberideOrigin: existing.liberideOrigin } : {}), profileVersions: existing.profileVersions, ...(existing.clientId ? { adoptedClientId: existing.clientId } : {}) } };
      }
      return reply.status(409).send({ error: "installation_already_enrolled", message: "Revoke the existing enrollment before binding a different credential or origin" });
    }
    const enrollment = {
      status: "active",
      installationId: randomUUID(),
      serviceIdentityId: identity.id,
      credentialId: credential.id,
      credentialClientId: credential.clientId,
      publicOrigin,
      ...(liberideOrigin ? { liberideOrigin } : {}),
      ...(approvedExistingClientId ? { clientId: approvedExistingClientId, adoptedExisting: true } : {}),
      profileVersions: [...NEXUSHUB_PROFILE_VERSIONS, ...(liberideOrigin ? [LIBERIDE_PROFILE_VERSION] : [])],
      enrolledAt: new Date().toISOString()
    };
    const metadata = { ...(identity.metadata ?? {}), nexushub_enrollment: enrollment };
    const updated = await serviceIdentityService.updateServiceIdentity(identity.id, {
      allowedAudiences: Array.from(new Set([...identity.allowedAudiences, NEXUSHUB_PROVISIONING_AUDIENCE])),
      metadata
    });
    if (!updated) return reply.status(404).send({ error: "service_identity_not_found" });
    const actor = await resolveAuditActor(request);
    await auditRepository.log({
      type: "nexushub_installation_enrolled",
      ...actor,
      metadata: { installationId: enrollment.installationId, serviceIdentityId: identity.id, credentialId: credential.id, publicOrigin, profileVersions: enrollment.profileVersions }
    });
    return reply.status(201).send({ data: { installationId: enrollment.installationId, publicOrigin, ...(enrollment.liberideOrigin ? { liberideOrigin: enrollment.liberideOrigin } : {}), profileVersions: enrollment.profileVersions, ...(enrollment.clientId ? { adoptedClientId: enrollment.clientId } : {}) } });
  });

  app.delete<{ Params: { id: string } }>("/api/admin/service-identities/:id/nexushub-enrollment", async (request, reply) => {
    if (!hubProvisioningEnabled()) return reply.status(404).send({ error: "not_found" });
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    const current = identity && enrollmentFrom(identity);
    if (!identity || !current || current.status !== "active") return reply.status(404).send({ error: "enrollment_not_found" });
    const revokedAt = new Date().toISOString();
    await serviceIdentityService.updateServiceIdentity(identity.id, {
      metadata: { ...(identity.metadata ?? {}), nexushub_enrollment: { ...current, status: "revoked", revokedAt } }
    });
    const actor = await resolveAuditActor(request);
    await auditRepository.log({
      type: "nexushub_installation_revoked",
      ...actor,
      metadata: { installationId: current.installationId, serviceIdentityId: identity.id, credentialId: current.credentialId }
    });
    return reply.status(204).send();
  });

  // Hub-side enrollment inspection is intentionally a narrow, bearer-token
  // endpoint. It proves the enrolled identity/credential binding but does not
  // expose issuer-owned client profiles, whose client secret remains held by
  // the caller and is never returned from the provisioning API.
  app.get("/api/nexushub/v1/enrollment", async (request, reply) => {
    if (!hubProvisioningEnabled()) return reply.status(404).send({ error: "not_found" });
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return reply.status(401).send({ error: "unauthorized" });
    let claims: Record<string, unknown>;
    try {
      claims = await authService.jwtService.verifyAccessToken(header.slice("Bearer ".length)) as unknown as Record<string, unknown>;
    } catch {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const subject = String(claims.service_identity_id ?? claims.sub ?? "").trim();
    const clientId = String(claims.client_id ?? "").trim();
    const audiences = Array.isArray(claims.aud) ? claims.aud.map(String) : typeof claims.aud === "string" ? [claims.aud] : [];
    if (claims.actor_type !== "service_identity" || !subject || !clientId || !audiences.includes(NEXUSHUB_PROVISIONING_AUDIENCE)) {
      return reply.status(403).send({ error: "forbidden" });
    }
    const identity = await serviceIdentityService.getServiceIdentity(subject);
    const enrollment = identity && enrollmentFrom(identity);
    const credential = identity?.credentials.find((item) => item.clientId === clientId && !item.revokedAt && (!item.expiresAt || item.expiresAt.getTime() > Date.now()));
    if (!identity || identity.status !== "active" || !enrollment || enrollment.status !== "active" ||
        enrollment.serviceIdentityId !== subject || enrollment.credentialClientId !== clientId || !credential || credential.id !== enrollment.credentialId) {
      return reply.status(403).send({ error: "enrollment_inactive" });
    }
    return { data: { installationId: enrollment.installationId, publicOrigin: enrollment.publicOrigin, ...(enrollment.liberideOrigin ? { liberideOrigin: enrollment.liberideOrigin } : {}), profileVersions: enrollment.profileVersions } };
  });

  // Machine provisioning is separately gated from RFC 7591 and derives every
  // registration field from the issuer-owned enrollment. The caller chooses
  // only its own secret; it is never returned by this API. A reserved client
  // ID derived from the installation makes an ambiguous retry converge on the
  // same OAuth row. The primary-key insert is the serialization point.
  app.put<{ Body: { profileId?: string; profileVersion?: number; mode?: "ensure" | "adopt-existing"; clientId?: string; clientSecret?: string } }>("/api/nexushub/v1/client-profile", { bodyLimit: 16 * 1024 }, async (request, reply) => {
    if (!hubProvisioningEnabled()) return reply.status(404).send({ error: "not_found" });
    if (!clientService) return reply.status(503).send({ error: "provisioning_unavailable" });
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return reply.status(401).send({ error: "unauthorized" });
    let claims: Record<string, unknown>;
    try { claims = await authService.jwtService.verifyAccessToken(header.slice("Bearer ".length)) as unknown as Record<string, unknown>; }
    catch { return reply.status(401).send({ error: "unauthorized" }); }
    const subject = String(claims.service_identity_id ?? claims.sub ?? "").trim();
    const credentialClientId = String(claims.client_id ?? "").trim();
    const audiences = Array.isArray(claims.aud) ? claims.aud.map(String) : typeof claims.aud === "string" ? [claims.aud] : [];
    if (claims.actor_type !== "service_identity" || !subject || !credentialClientId || !audiences.includes(NEXUSHUB_PROVISIONING_AUDIENCE)) return reply.status(403).send({ error: "forbidden" });
    const identity = await serviceIdentityService.getServiceIdentity(subject);
    const enrollment = identity && enrollmentFrom(identity);
    const activeCredential = identity?.credentials.find((item) => item.clientId === credentialClientId && !item.revokedAt && (!item.expiresAt || item.expiresAt.getTime() > Date.now()));
    if (!identity || identity.status !== "active" || !enrollment || enrollment.status !== "active" || enrollment.serviceIdentityId !== subject || enrollment.credentialClientId !== credentialClientId || !activeCredential || activeCredential.id !== enrollment.credentialId) return reply.status(403).send({ error: "enrollment_inactive" });
    const input = request.body;
    if (input && Object.keys(input).some((key) => !["profileId", "profileVersion", "mode", "clientId", "clientSecret"].includes(key))) return reply.status(400).send({ error: "validation_error", message: "Unknown profile fields are not accepted" });
    if (!input || !["nexushub", "liberide"].includes(input.profileId ?? "") || input.profileVersion !== 1 || !["ensure", "adopt-existing"].includes(input.mode ?? "ensure") || typeof input.clientSecret !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(input.clientSecret)) return reply.status(400).send({ error: "validation_error" });
    let profile;
    try {
      profile = input.profileId === "liberide"
        ? deriveLiberIDEClientProfile({ profileId: input.profileId, profileVersion: input.profileVersion, publicOrigin: enrollment.liberideOrigin })
        : deriveNexusHubClientProfile({ profileId: input.profileId, profileVersion: input.profileVersion, publicOrigin: enrollment.publicOrigin });
    }
    catch { return reply.status(409).send({ error: "enrollment_profile_unavailable" }); }
    const reservedClientId = input.profileId === "liberide"
      ? `li_${createHash("sha256").update(`liberide-installation:${enrollment.installationId}`).digest("hex").slice(0, 40)}`
      : `nh_${createHash("sha256").update(`nexushub-installation:${enrollment.installationId}`).digest("hex").slice(0, 40)}`;
    const expectedClientId = input.profileId === "nexushub"
      ? enrollment.clientId ?? reservedClientId
      : reservedClientId;
    const requestedClientId = input.clientId ?? expectedClientId;
    if (requestedClientId !== expectedClientId) return reply.status(409).send({ error: "client_id_not_owned_by_installation" });
    const existing = await clientService.findClientById(expectedClientId);
    if (existing) {
      const sameProfile = existing.name === profile.name && sameSecret(existing.secret, input.clientSecret) &&
        JSON.stringify([...existing.redirectUris].sort()) === JSON.stringify([...profile.redirectUris].sort()) &&
        JSON.stringify([...existing.allowedScopes].sort()) === JSON.stringify([...profile.allowedScopes].sort()) &&
        JSON.stringify([...existing.grants].sort()) === JSON.stringify([...profile.grants].sort()) && existing.requirePkce === profile.requirePkce;
      if (!sameProfile) return reply.status(409).send({ error: "client_profile_conflict" });
      const actor = { actorId: credentialClientId, actorType: "client" as const };
      const digest = profile.profileId === "liberide" ? liberIDEClientProfileDigest(profile) : nexusHubClientProfileDigest(profile);
      await auditRepository.log({ type: "nexushub_client_profile_replayed", ...actor, metadata: { installationId: enrollment.installationId, serviceIdentityId: identity.id, credentialClientId, clientId: expectedClientId, profileId: profile.profileId, profileVersion: profile.profileVersion, digest, outcome: (input.mode ?? "ensure") === "adopt-existing" ? "adopted_existing" : "idempotent_replay" } });
      return { data: { clientId: expectedClientId, profileId: profile.profileId, profileVersion: profile.profileVersion, redirectUris: profile.redirectUris, scopes: profile.allowedScopes, grants: profile.grants, requirePkce: profile.requirePkce, tokenEndpointAuthMethod: profile.tokenEndpointAuthMethod, adopted: (input.mode ?? "ensure") === "adopt-existing" } };
    }
    if ((input.mode ?? "ensure") === "adopt-existing") return reply.status(404).send({ error: "client_not_found_for_adoption" });
    if (input.profileId === "nexushub" && enrollment.adoptedExisting) return reply.status(404).send({ error: "adopted_client_not_found" });
    let created = true;
    try {
      await clientService.createClient({ id: expectedClientId, name: profile.name, secret: input.clientSecret, redirectUris: profile.redirectUris, allowedScopes: profile.allowedScopes, grants: [...profile.grants], requirePkce: profile.requirePkce });
    } catch {
      // A concurrent identical ensure may have won the reserved-ID insert.
      // Re-read and validate on the next call; never return secret material.
      const raced = await clientService.findClientById(expectedClientId);
      if (!raced) return reply.status(503).send({ error: "provisioning_outcome_unknown", retryable: true });
      const same = sameSecret(raced.secret, input.clientSecret) && raced.name === profile.name && JSON.stringify([...raced.redirectUris].sort()) === JSON.stringify([...profile.redirectUris].sort()) && JSON.stringify([...raced.allowedScopes].sort()) === JSON.stringify([...profile.allowedScopes].sort()) && JSON.stringify([...raced.grants].sort()) === JSON.stringify([...profile.grants].sort()) && raced.requirePkce === profile.requirePkce;
      if (!same) return reply.status(409).send({ error: "client_profile_conflict" });
      created = false;
    }
    const actor = { actorId: credentialClientId, actorType: "client" as const };
    const digest = profile.profileId === "liberide" ? liberIDEClientProfileDigest(profile) : nexusHubClientProfileDigest(profile);
    await auditRepository.log({ type: created ? "nexushub_client_profile_created" : "nexushub_client_profile_replayed", ...actor, metadata: { installationId: enrollment.installationId, serviceIdentityId: identity.id, credentialClientId, clientId: expectedClientId, profileId: profile.profileId, profileVersion: profile.profileVersion, digest, outcome: created ? "created" : "idempotent_replay" } });
    return reply.status(created ? 201 : 200).send({ data: { clientId: expectedClientId, profileId: profile.profileId, profileVersion: profile.profileVersion, redirectUris: profile.redirectUris, scopes: profile.allowedScopes, grants: profile.grants, requirePkce: profile.requirePkce, tokenEndpointAuthMethod: profile.tokenEndpointAuthMethod, adopted: false } });
  });
  const enrichIdentity = async <T extends { id: string }>(identity: T) => {
    const [assignments, groupIds] = await Promise.all([
      roleService.listAssignmentsForUser(identity.id),
      groupService.listGroupIdsForUser(identity.id)
    ]);

    const roleIds = Array.from(new Set(assignments
      .filter((assignment) => !assignment.tenantId)
      .map((assignment) => assignment.roleId)));

    return {
      ...identity,
      roleIds,
      groupIds
    };
  };

  const syncRoleAssignments = async (userId: string, nextRoleIds: string[]) => {
    const existingAssignments = await roleService.listAssignmentsForUser(userId);
    const existingRoleIds = Array.from(new Set(existingAssignments
      .filter((assignment) => !assignment.tenantId)
      .map((assignment) => assignment.roleId)));
    const next = new Set(nextRoleIds);

    for (const roleId of existingRoleIds) {
      if (!next.has(roleId)) {
        await roleService.removeRole({ userId, roleId });
      }
    }

    for (const roleId of nextRoleIds) {
      if (!existingRoleIds.includes(roleId)) {
        await roleService.assignRole({ userId, roleId });
      }
    }
  };

  const syncGroupAssignments = async (userId: string, nextGroupIds: string[]) => {
    const existingGroupIds = await groupService.listGroupIdsForUser(userId);
    const next = new Set(nextGroupIds);

    for (const groupId of existingGroupIds) {
      if (!next.has(groupId)) {
        await groupService.removeUserFromGroup({ userId, groupId });
      }
    }

    for (const groupId of nextGroupIds) {
      if (!existingGroupIds.includes(groupId)) {
        await groupService.assignUserToGroup({ userId, groupId });
      }
    }
  };

  app.get("/api/admin/service-identities", async (request, reply) => {
    const identities = await serviceIdentityService.listServiceIdentities();
    return { data: await Promise.all(identities.map((identity) => enrichIdentity(identity))) };
  });

  app.post("/api/admin/service-identities", async (request, reply) => {
    const parsed = createServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const { roleIds, groupIds, ...serviceIdentityInput } = stripPrivilegedMetadata(parsed.data);
    const identity = await serviceIdentityService.createServiceIdentity(serviceIdentityInput);

    await syncRoleAssignments(identity.id, roleIds);
    await syncGroupAssignments(identity.id, groupIds);

    const refreshed = await serviceIdentityService.getServiceIdentity(identity.id);
    return reply.status(201).send(await enrichIdentity(refreshed ?? identity));
  });

  app.get("/api/admin/service-identities/:id", async (request: any, reply) => {
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (!identity) return reply.status(404).send({ error: "not_found" });
    return enrichIdentity(identity);
  });

  app.patch("/api/admin/service-identities/:id", async (request: any, reply) => {
    const parsed = updateServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const { roleIds, groupIds, ...serviceIdentityInput } = stripPrivilegedMetadata(parsed.data);
    const existingIdentity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (existingIdentity?.metadata && serviceIdentityInput.metadata) {
      // Preserve flags set by the bootstrap process when an admin edits other metadata.
      for (const key of PRIVILEGED_METADATA_KEYS) {
        if (existingIdentity.metadata[key] !== undefined) {
          serviceIdentityInput.metadata[key] = existingIdentity.metadata[key];
        }
      }
    }
    const updated = await serviceIdentityService.updateServiceIdentity(request.params.id, serviceIdentityInput);
    if (!updated) return reply.status(404).send({ error: "not_found" });

    if (roleIds !== undefined) {
      await syncRoleAssignments(request.params.id, roleIds);
    }

    if (groupIds !== undefined) {
      await syncGroupAssignments(request.params.id, groupIds);
    }

    const refreshed = await serviceIdentityService.getServiceIdentity(request.params.id);
    return enrichIdentity(refreshed ?? updated);
  });

  app.delete("/api/admin/service-identities/:id", async (request: any, reply) => {
    await syncRoleAssignments(request.params.id, []);
    await syncGroupAssignments(request.params.id, []);
    await serviceIdentityService.deleteServiceIdentity(request.params.id);
    return reply.status(204).send();
  });

  app.post("/api/admin/service-identities/:id/credentials", async (request: any, reply) => {
    const parsed = issueServiceIdentityCredentialSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const result = await serviceIdentityService.issueCredential(request.params.id, parsed.data.expiresInDays);
    return reply.status(201).send(result);
  });

  app.post("/api/admin/service-identities/:id/credentials/rotate", async (request: any, reply) => {
    const { credentialId, expiresInDays } = (request.body ?? {}) as { credentialId?: string; expiresInDays?: number };
    if (!credentialId) {
      return reply.status(400).send({ error: "credentialId required" });
    }
    const result = await serviceIdentityService.rotateCredential(request.params.id, credentialId, expiresInDays);
    return reply.status(201).send(result);
  });

  app.delete("/api/admin/service-identities/:id/credentials/:credentialId", async (request: any, reply) => {
    await serviceIdentityService.revokeCredential(request.params.id, request.params.credentialId);
    return reply.status(204).send();
  });

  app.get("/api/admin/service-identities/:id/usage", async (request: any, reply) => {
    const usage = await serviceIdentityService.getUsage(request.params.id);
    return { data: usage };
  });
}
