import { randomBytes, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import type { FastifyInstance } from "fastify";
import type { AuthenticationStageType, FlowDesignation, GrantType, UiSurface, User } from "../domain/models.js";
import { AppError, AuthenticationError, ValidationError } from "../core/errors.js";
import { verifyPassword } from "../security/password.js";
import { getAssetContentType, readFrontendAsset } from "./view-assets.js";
import { hasAdminPermission, toAdminAction, toAdminResource } from "./admin-authorization.js";
import { registerScimRoutes } from "./scim-routes.js";
import { registerSamlAdminRoutes } from "./saml-routes.js";
import { registerSamlProtocolRoutes } from "./saml-protocol-routes.js";
import { registerAccessGovernanceRoutes } from "./routes/access-governance.js";
import { registerProvisioningRoutes } from "./routes/provisioning.js";
import { registerElevationRoutes } from "./routes/elevations.js";
import { registerServiceIdentityRoutes } from "./routes/service-identities.js";
import { deriveRiskEventsFromAudit } from "./routes/security-risk-events.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerPluginRoutes } from "./routes/plugins.js";
import {
  assignGroupRoleSchema,
  assignRoleSchema,
  assignUserGroupSchema,
  backChannelLogoutSchema,
  authorizationCodeTokenSchema,
  authorizeSchema,
  createAppSchema,
  clientCredentialsSchema,
  createClientSchema,
  createScopeSchema,
  createAuthenticationFlowSchema,
  cibaApprovalSchema,
  cibaAuthenticationRequestSchema,
  deviceAuthorizationSchema,
  deviceVerificationSchema,
  dynamicClientRegistrationSchema,
  frontChannelLogoutSchema,
  createFederationProviderSchema,
  createGroupSchema,
  createUserAttributeSchema,
  createPolicySchema,
  createEventHookSchema,
  createTenantSchema,
  createRoleSchema,
  updateGroupSchema,
  updateRoleSchema,
  createUserSchema,
  introspectSchema,
  loginSchema,
  migrateDatabaseSchema,
  oidcRevokeSchema,
  oauthLogoutSchema,
  portalChangePasswordSchema,
  portalUpdateProfileSchema,
  recoverySchema,
  recoveryRequestSchema,
  sendTestEmailSchema,
  testDatabaseConnectionSchema,
  mfaLoginSchema,
  verifyTotpEnrollmentSchema,
  webauthnLoginBeginSchema,
  webauthnLoginFinishSchema,
  webauthnRegisterBeginSchema,
  webauthnRegisterFinishSchema,
  refreshTokenSchema,
  resetUserPasswordSchema,
  revokeTokenSchema,
  tokenSchema,
  setUserAttributeGroupAssignmentSchema,
  setPolicyAssignmentSchema,
  evaluatePolicyDecisionSchema,
  authorizationCheckSchema,
  removePolicyAssignmentSchema,
  setupInitializeSchema,
  testEventHookSchema,
  updateInstanceSettingsSchema,
  updateAppSchema,
  updateAuthenticationFlowSchema,
  updateClientSchema,
  updateEventHookSchema,
  updateFederationProviderSchema,
  updatePolicySchema,
  updateTenantSchema,
  updateUserAttributeSchema,
  updateUserSchema
} from "./schemas.js";
import { AuthService } from "../services/auth-service.js";
import { AppService } from "../services/app-service.js";
import { AuthenticationFlowService } from "../services/authentication-flow-service.js";
import { ClientService } from "../services/client-service.js";
import { FederationService } from "../services/federation-service.js";
import { GroupService } from "../services/group-service.js";
import { OidcService } from "../services/oidc-service.js";
import { RoleService } from "../services/role-service.js";
import { ScopeService } from "../services/scope-service.js";
import { ScimService } from "../services/scim-service.js";
import { ScimTokenService } from "../services/scim-token-service.js";
import { ProvisioningService } from "../services/provisioning-service.js";
import { DeprovisioningService } from "../services/deprovisioning-service.js";
import { AccessGovernanceService } from "../services/access-governance-service.js";
import { AccessReviewService } from "../services/access-review-service.js";
import { ElevationService } from "../services/elevation-service.js";
import { SetupService } from "../services/setup-service.js";
import { TenantService } from "../services/tenant-service.js";
import { TotpService } from "../services/totp-service.js";
import { WebauthnService } from "../services/webauthn-service.js";
import { ServiceIdentityService } from "../services/service-identity-service.js";
import { UserService } from "../services/user-service.js";
import { UserAttributeService } from "../services/user-attribute-service.js";
import { PolicyService } from "../services/policy-service.js";
import { EventHookService } from "../services/event-hook-service.js";
import { EmailService } from "../services/email-service.js";
import { DatabaseMigrationService } from "../services/database-migration-service.js";
import { InstanceSettingsService } from "../services/instance-settings-service.js";
import { RecoveryService } from "../services/recovery-service.js";
import { SecurityService } from "../services/security-service.js";
import { AuthorizationService } from "../services/authorization-service.js";
import { SamlService } from "../services/saml-service.js";
import { SamlReplayProtectionService } from "../services/saml-replay-protection-service.js";
import { SamlSignatureService } from "../services/saml-signature-service.js";
import { RiskService } from "../services/risk-service.js";
import { ConnectorService, AuthMetricsService } from "../services/connector-service.js";
import { PluginService } from "../services/plugin-service.js";
import { PluginRuntimeService } from "../services/plugin-runtime-service.js";
import { MediaService } from "../services/media-service.js";
import { filterAdminList } from "./list-search.js";
import { GeolocationService } from "../services/geolocation-service.js";
import { TranslationService } from "../services/translation-service.js";
import type {
  AuditRepository,
  PolicyDecisionLogRepository,
  SamlAssertionAuditRepository,
  SamlNameIdMappingRepository,
  SamlServiceProviderRepository
} from "../repositories/contracts.js";

interface RouteDeps {
  authService: AuthService;
  appService: AppService;
  authenticationFlowService: AuthenticationFlowService;
  clientService: ClientService;
  federationService: FederationService;
  groupService: GroupService;
  oidcService: OidcService;
  roleService: RoleService;
  scopeService: ScopeService;
  setupService: SetupService;
  tenantService: TenantService;
  scimService: ScimService;
  scimTokenService: ScimTokenService;
  provisioningService: ProvisioningService;
  deprovisioningService: DeprovisioningService;
  accessGovernanceService: AccessGovernanceService;
  accessReviewService: AccessReviewService;
  elevationService: ElevationService;
  totpService: TotpService;
  webauthnService: WebauthnService;
  serviceIdentityService: ServiceIdentityService;
  userService: UserService;
  userAttributeService: UserAttributeService;
  policyService: PolicyService;
  eventHookService: EventHookService;
  emailService: EmailService;
  databaseMigrationService: DatabaseMigrationService;
  recoveryService: RecoveryService;
  securityService: SecurityService;
  riskService: RiskService;
  connectorService: ConnectorService;
  authMetricsService: AuthMetricsService;
  pluginService: PluginService;
  pluginRuntimeService: PluginRuntimeService;
  mediaService: MediaService;
  authorizationService: AuthorizationService;
  samlService: SamlService;
  samlReplayProtectionService: SamlReplayProtectionService;
  samlSignatureService: SamlSignatureService;
  samlServiceProviderRepository: SamlServiceProviderRepository;
  samlNameIdMappingRepository: SamlNameIdMappingRepository;
  samlAssertionAuditRepository: SamlAssertionAuditRepository;
  instanceSettingsService: InstanceSettingsService;
  auditRepository: AuditRepository;
  policyDecisionLogRepository: PolicyDecisionLogRepository;
}

export const registerRoutes = async (app: FastifyInstance, deps: RouteDeps) => {
  const USER_PICTURE_ATTRIBUTE_KEY = "picture";
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
  const extensionToMimeType: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml"
  };

  const resolveUploadedImageMimeType = (mimetype: string | undefined, filename: string | undefined) => {
    const normalized = (mimetype ?? "").toLowerCase();
    if (allowedImageMimeTypes.has(normalized)) {
      return normalized;
    }

    const inferred = extensionToMimeType[extname(filename ?? "").toLowerCase()];
    return inferred && allowedImageMimeTypes.has(inferred) ? inferred : null;
  };
  const translationService = new TranslationService();
  const geolocationService = new GeolocationService();
  const runBestEffort = async (request: { log: FastifyInstance["log"] }, task: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      request.log.warn(
        {
          task,
          error: error instanceof Error ? error.message : "Unknown side effect failure"
        },
        "Ignored non-critical route side effect failure"
      );
    }
  };

  const escapeXml = (value: string) => value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const normalizeInitials = (value: string | undefined) => {
    if (!value) return "AB";
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    return cleaned || "AB";
  };

  const renderUserDefaultSvg = (variant: string, initialsRaw: string | undefined) => {
    const initials = escapeXml(normalizeInitials(initialsRaw));
    const palette: Record<string, [string, string]> = {
      initials: ["#334155", "#0f172a"],
      male: ["#2563eb", "#0f172a"],
      female: ["#db2777", "#4c1d95"],
      rocket: ["#f97316", "#7c2d12"],
      house: ["#22c55e", "#065f46"],
      dog: ["#14b8a6", "#134e4a"],
      cat: ["#a855f7", "#4c1d95"],
      sunset: ["#f97316", "#dc2626"],
      forest: ["#10b981", "#065f46"],
      ocean: ["#0ea5e9", "#1d4ed8"],
      mono: ["#71717a", "#27272a"]
    };
    const [start, end] = palette[variant] ?? palette.initials;

    const iconByVariant: Record<string, string> = {
      male: `
  <circle cx="160" cy="118" r="42" stroke="white" stroke-width="12" fill="none" />
  <path d="M84 246c8-43 38-68 76-68s68 25 76 68" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" />`,
      female: `
  <circle cx="160" cy="112" r="38" stroke="white" stroke-width="12" fill="none" />
  <path d="M106 248c8-35 28-58 54-58s46 23 54 58" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" />
  <path d="M112 138c8 16 22 24 48 24s40-8 48-24" stroke="white" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.9" />`,
      rocket: `
  <path d="M160 68c38 18 57 62 57 99l-57 34-57-34c0-37 19-81 57-99Z" stroke="white" stroke-width="12" fill="none" stroke-linejoin="round" />
  <circle cx="160" cy="136" r="14" stroke="white" stroke-width="10" fill="none" />
  <path d="M132 205 116 236M188 205 204 236" stroke="white" stroke-width="12" stroke-linecap="round" />
  <path d="M160 201v43" stroke="white" stroke-width="12" stroke-linecap="round" />`,
      house: `
  <path d="M88 150 160 92l72 58" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <rect x="102" y="150" width="116" height="96" rx="10" stroke="white" stroke-width="12" fill="none" />
  <rect x="146" y="186" width="28" height="60" rx="8" stroke="white" stroke-width="10" fill="none" />`,
      dog: `
  <path d="M118 116 88 144M202 116l30 28" stroke="white" stroke-width="12" stroke-linecap="round" />
  <circle cx="160" cy="170" r="58" stroke="white" stroke-width="12" fill="none" />
  <circle cx="138" cy="164" r="6" fill="white" />
  <circle cx="182" cy="164" r="6" fill="white" />
  <path d="M148 190h24" stroke="white" stroke-width="10" stroke-linecap="round" />
  <path d="M144 214c10 10 22 10 32 0" stroke="white" stroke-width="10" fill="none" stroke-linecap="round" />`,
      cat: `
  <path d="M124 116 102 86l-6 44M196 116l22-30 6 44" stroke="white" stroke-width="12" fill="none" stroke-linejoin="round" />
  <circle cx="160" cy="172" r="58" stroke="white" stroke-width="12" fill="none" />
  <circle cx="140" cy="168" r="6" fill="white" />
  <circle cx="180" cy="168" r="6" fill="white" />
  <path d="M160 178 152 190h16Z" fill="white" />
  <path d="M128 192h-26M128 204h-26M192 192h26M192 204h26" stroke="white" stroke-width="8" stroke-linecap="round" />`
    };

    const icon = iconByVariant[variant];
    const content = icon
      ? `<g>${icon}\n  </g>`
      : `<text x="160" y="182" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="108" font-weight="700" fill="white">${initials}</text>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${start}" />
      <stop offset="100%" stop-color="${end}" />
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="160" fill="url(#g)" />
  ${content}
</svg>`;
  };

  const renderAppDefaultSvg = (variant: string) => {
    const templateByVariant: Record<string, string> = {
      grid: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none"><rect width="320" height="320" rx="48" fill="#0f172a"/><rect x="48" y="48" width="92" height="92" rx="16" fill="#22d3ee"/><rect x="180" y="48" width="92" height="92" rx="16" fill="#38bdf8"/><rect x="48" y="180" width="92" height="92" rx="16" fill="#7dd3fc"/><rect x="180" y="180" width="92" height="92" rx="16" fill="#bae6fd"/></svg>`,
      bolt: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none"><rect width="320" height="320" rx="48" fill="#0b1022"/><path d="M190 36L98 178h56l-22 106 92-142h-56l22-106z" fill="#facc15"/></svg>`,
      shield: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none"><rect width="320" height="320" rx="48" fill="#0b1324"/><path d="M160 40l84 30v74c0 58-31 111-84 136-53-25-84-78-84-136V70l84-30z" fill="#22c55e"/><path d="M160 84l45 16v44c0 37-19 71-45 89-26-18-45-52-45-89v-44l45-16z" fill="#bbf7d0"/></svg>`,
      orbit: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none"><rect width="320" height="320" rx="48" fill="#111827"/><circle cx="160" cy="160" r="38" fill="#f43f5e"/><ellipse cx="160" cy="160" rx="116" ry="52" stroke="#fb7185" stroke-width="16"/><ellipse cx="160" cy="160" rx="52" ry="116" stroke="#fda4af" stroke-width="16"/></svg>`
    };

    return templateByVariant[variant] ?? templateByVariant.grid;
  };

  const readImageUpload = async (request: any, reply: any) => {
    let part: Awaited<ReturnType<typeof request.file>> | undefined;
    try {
      part = await request.file();
    } catch {
      reply.status(400).send({ error: "validation_error", message: "Invalid multipart upload payload" });
      return null;
    }

    if (!part) {
      reply.status(400).send({ error: "validation_error", message: "Image file is required" });
      return null;
    }

    const mimeType = resolveUploadedImageMimeType(part.mimetype, part.filename);
    if (!mimeType) {
      reply.status(415).send({ error: "unsupported_media_type", message: "Only image uploads are supported (png, jpeg, webp, gif, svg)" });
      return null;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of part.file) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) {
        reply.status(413).send({ error: "payload_too_large", message: "Image must be 2MB or less" });
        return null;
      }
      chunks.push(chunk);
    }

    return {
      bytes: Buffer.concat(chunks),
      mimeType
    };
  };

  const sendFrontendIndex = async (reply: any, frontend: "admin" | "portal") => {
    const html = await readFrontendAsset(frontend, "index.html");
    return reply.type("text/html; charset=utf-8").send(html);
  };

  const sendFrontendFile = async (reply: any, frontend: "admin" | "portal", relativePath: string) => {
    const file = await readFrontendAsset(frontend, relativePath);
    return reply.type(getAssetContentType(relativePath)).send(file);
  };

  const prefersHtmlResponse = (request: any) => {
    const acceptHeader = request.headers?.accept;
    return typeof acceptHeader === "string" && acceptHeader.includes("text/html");
  };

  function asSafeRedirect(value: unknown): string {
    if (typeof value !== "string" || !value.startsWith("/")) {
      return "/";
    }
    return value;
  }

  async function isAllowedPostLogoutRedirect(clientId: string | undefined, redirectUri: string) {
    if (!clientId) {
      return false;
    }

    const client = await deps.clientService.findClientById(clientId);
    return Boolean(client?.redirectUris.includes(redirectUri));
  }

  async function resolveValidatedPostLogoutRedirect(input: {
    clientId?: string;
    redirectUri?: string;
    state?: string;
  }) {
    if (!input.redirectUri) {
      return undefined;
    }

    if (!await isAllowedPostLogoutRedirect(input.clientId, input.redirectUri)) {
      throw new AuthenticationError("Unregistered post-logout redirect URI");
    }

    const url = new URL(input.redirectUri);
    if (input.state) {
      url.searchParams.set("state", input.state);
    }

    return url.toString();
  }

  function isSensitiveProtocolPath(path: string) {
    return path.startsWith("/auth") || path.startsWith("/oauth") || path.startsWith("/saml");
  }

  function publicErrorMessageForPath(path: string, error: AppError) {
    if (path === "/oauth/introspect" || path === "/oauth/userinfo") {
      return "Token validation failed";
    }

    if (path === "/auth/login/mfa") {
      return "MFA verification failed";
    }

    if (path === "/auth/login/webauthn/begin" || path === "/auth/login/webauthn/finish") {
      return "Authentication failed";
    }

    if (path === "/auth/recovery/request") {
      return "Recovery request could not be completed";
    }

    if (path === "/auth/recovery") {
      return "Recovery verification failed";
    }

    if (path.startsWith("/auth") || path.startsWith("/oauth")) {
      return error instanceof ValidationError ? "Invalid request" : "Authentication failed";
    }

    if (path.startsWith("/saml")) {
      return "SAML request could not be completed";
    }

    return error.message;
  }

  function humanizeValidationField(path: unknown) {
    if (!Array.isArray(path) || path.length === 0) {
      return "Request";
    }

    const last = String(path[path.length - 1]);
    return last
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (char) => char.toUpperCase());
  }

  function formatValidationIssue(issue: unknown) {
    if (!issue || typeof issue !== "object") {
      return undefined;
    }

    const typedIssue = issue as {
      code?: string;
      message?: string;
      minimum?: number;
      path?: unknown;
      type?: string;
      validation?: string;
    };
    const field = humanizeValidationField(typedIssue.path);

    if (typedIssue.code === "invalid_string" && typedIssue.validation === "email") {
      return `${field} must be a valid email address`;
    }

    if (typedIssue.code === "too_small" && typedIssue.type === "string") {
      if (typedIssue.minimum === 1) {
        return `${field} is required`;
      }
      return `${field} must be at least ${typedIssue.minimum} characters`;
    }

    if (typedIssue.message?.trim()) {
      return `${field}: ${typedIssue.message}`;
    }

    return undefined;
  }

  function validationErrorMessageFromIssues(issues: unknown) {
    if (!Array.isArray(issues) || issues.length === 0) {
      return "Request validation failed";
    }

    return formatValidationIssue(issues[0]) ?? "Request validation failed";
  }

  async function getSession(request: any) {
    const sid = request.cookies?.sid;
    if (!sid) return null;
    let session;
    try {
      session = await deps.authService.sessionRepository.findById(sid);
    } catch (error) {
      request.log?.error({ err: error, sid }, "session lookup failed");
      return null;
    }
    if (!session || session.expiresAt.getTime() < Date.now() || session.revokedAt) return null;
    return session;
  }

  function clientUserAgent(request: any) {
    const raw = request.headers?.["user-agent"];
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  }

  function deriveRateLimitActorKey(request: any): { actorKey: string; clientId?: string } {
    const ip = request.ip ?? "unknown";
    const bodyClientId =
      typeof request.body?.client_id === "string" && request.body.client_id.length > 0
        ? request.body.client_id
        : typeof request.body?.clientId === "string" && request.body.clientId.length > 0
          ? request.body.clientId
          : undefined;

    if (bodyClientId) {
      // Bucket per OAuth client + IP so a noisy client doesn't lock out
      // other clients sharing the same egress IP (e.g. behind NAT/proxy).
      return { actorKey: `client:${bodyClientId}|ip:${ip}`, clientId: bodyClientId };
    }

    return { actorKey: `ip:${ip}` };
  }

  async function enforceEndpointRateLimit(request: any, reply: any) {
    const path = request.url.split("?")[0];
    const configs: Array<{
      endpointKey: string;
      limit: number;
      windowMs: number;
      actorKey: string;
      metadata?: Record<string, unknown>;
    }> = [];

    const { actorKey, clientId } = deriveRateLimitActorKey(request);
    const baseMetadata = clientId ? { clientId } : undefined;

    if (path === "/auth/login") {
      configs.push({ endpointKey: "auth_login", limit: 10, windowMs: 60_000, actorKey, metadata: baseMetadata });
    }
    if (path === "/auth/login/mfa") {
      configs.push({ endpointKey: "auth_login_mfa", limit: 10, windowMs: 60_000, actorKey, metadata: baseMetadata });
    }
    if (path === "/auth/recovery/request") {
      configs.push({ endpointKey: "auth_recovery_request", limit: 5, windowMs: 15 * 60_000, actorKey, metadata: baseMetadata });
    }
    if (path === "/api/setup/initialize") {
      // No client_id is available for setup, fall back to IP-only key.
      configs.push({ endpointKey: "setup_initialize", limit: 5, windowMs: 15 * 60_000, actorKey });
    }
    if (path === "/oauth/device/verify") {
      configs.push({ endpointKey: "oauth_device_verify", limit: 10, windowMs: 60_000, actorKey, metadata: baseMetadata });
    }
    if (path === "/oauth/device/authorize") {
      configs.push({ endpointKey: "oauth_device_authorize", limit: 10, windowMs: 60_000, actorKey, metadata: baseMetadata });
    }
    if (path === "/oauth/token") {
      const grantType = typeof request.body?.grant_type === "string" ? request.body.grant_type : undefined;
      configs.push({
        endpointKey: `oauth_token:${grantType ?? "unknown"}`,
        limit: grantType === "urn:ietf:params:oauth:grant-type:device_code" ? 30 : 20,
        windowMs: 60_000,
        actorKey,
        metadata: { grantType, ...(baseMetadata ?? {}) }
      });
    }

    for (const config of configs) {
      const result = await deps.securityService.enforceEndpointRateLimit({
        endpointKey: config.endpointKey,
        actorKey: config.actorKey,
        limit: config.limit,
        windowMs: config.windowMs,
        ip: request.ip,
        metadata: config.metadata
      });

      if (result.blocked) {
        return reply.status(429).header("Retry-After", String(result.retryAfterSeconds)).send({
          error: "rate_limited",
          message: "Too many requests for this endpoint",
          retryAfterSeconds: result.retryAfterSeconds
        });
      }
    }
  }

  async function requireSessionUser(request: any, reply: any) {
    const session = await getSession(request);
    if (!session) {
      reply.status(401).send({ error: "unauthorized" });
      return null;
    }

    const user = await deps.userService.findUserById(session.userId);
    if (!user) {
      reply.status(401).send({ error: "unauthorized" });
      return null;
    }

    return { session, user };
  }

  async function resolveTenantId(tenantSlug: string | undefined) {
    if (!tenantSlug) {
      return undefined;
    }
    return (await deps.tenantService.listTenants()).find((item) => item.slug === tenantSlug)?.id;
  }

  async function isStageEnabledForDesignation(designation: FlowDesignation, stage: AuthenticationStageType) {
    return deps.authenticationFlowService.isStageEnabledForDesignation(designation, stage);
  }

  async function enforcePoliciesForStage(input: {
    stage: AuthenticationStageType;
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
  }) {
    await deps.policyService.enforceStagePolicies({
      stage: input.stage,
      user: input.user,
      tenantId: await resolveTenantId(input.tenantSlug),
      clientId: input.clientId,
      ip: input.ip
    });
  }

  async function enforcePreCredentialStages(input: {
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
    captchaToken?: string;
    promptAcknowledged?: boolean;
  }) {
    await deps.authenticationFlowService.assertStageEnabled("password");

    if (await deps.authenticationFlowService.isStageEnabled("risk_check")) {
      const riskScore = await deps.riskService.evaluateLoginRisk({
        userId: input.user.id,
        ip: input.ip
      });

      await deps.riskService.recordEvent({
        userId: input.user.id,
        ip: input.ip,
        confidence: riskScore.score,
        reason: riskScore.reasons[0] ?? "suspicious_ip",
        decision: riskScore.decision,
        metadata: {
          reasons: riskScore.reasons,
          clientId: input.clientId,
          tenantSlug: input.tenantSlug
        }
      });

      await enforcePoliciesForStage({
        stage: "risk_check",
        user: input.user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: input.ip
      });

      if (riskScore.decision === "block") {
        throw new AuthenticationError("Login blocked due to elevated risk");
      }

      if (riskScore.decision === "challenge" && input.promptAcknowledged !== true) {
        throw new AuthenticationError("Additional verification required due to elevated risk");
      }
    }

    if (await deps.authenticationFlowService.isStageEnabled("captcha") && !input.captchaToken) {
      throw new AuthenticationError("Captcha verification is required");
    }

    await enforcePoliciesForStage({
      stage: "password",
      user: input.user,
      tenantSlug: input.tenantSlug,
      clientId: input.clientId,
      ip: input.ip
    });

    if (await deps.authenticationFlowService.isStageEnabled("prompt") && input.promptAcknowledged !== true) {
      throw new AuthenticationError("Interactive prompt acknowledgement is required");
    }
  }

  async function enforcePostLoginStage(input: {
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
  }) {
    if (!await deps.authenticationFlowService.isStageEnabled("user_login")) {
      return;
    }

    await enforcePoliciesForStage({
      stage: "user_login",
      user: input.user,
      tenantSlug: input.tenantSlug,
      clientId: input.clientId,
      ip: input.ip
    });
  }

  async function enforceInvalidationForSession(input: { session: { userId: string; clientId: string }; ip?: string }) {
    if (!await isStageEnabledForDesignation("invalidation", "user_logout")) {
      return;
    }

    const user = await deps.userService.findUserById(input.session.userId);
    if (!user) {
      return;
    }

    await enforcePoliciesForStage({
      stage: "user_logout",
      user,
      clientId: input.session.clientId,
      ip: input.ip
    });
  }

  // CSRF: double-submit cookie pattern for all mutating API/auth routes
  function generateCsrfToken(): string {
    return randomBytes(32).toString("hex");
  }

  function verifyCsrf(request: any, reply: any): boolean {
    const cookieToken = request.cookies?.csrf_token;
    const headerToken = request.headers["x-csrf-token"];
    if (!cookieToken || !headerToken) {
      reply.status(403).send({ error: "invalid_csrf_token" });
      return false;
    }
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(typeof headerToken === "string" ? headerToken : "");
    if (cookieBuf.length !== headerBuf.length || !timingSafeEqual(cookieBuf, headerBuf)) {
      reply.status(403).send({ error: "invalid_csrf_token" });
      return false;
    }
    return true;
  }

  const csrfProtectedMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
  const csrfExemptPaths = new Set([
    "/auth/login",
    "/oauth/token",
    "/oauth/introspect",
    "/oauth/token/revoke",
  ]);

  app.addHook("preHandler", async (request, reply) => {
    const endpointLimitResult = await enforceEndpointRateLimit(request, reply);
    if (endpointLimitResult) {
      return endpointLimitResult;
    }

    const path = request.url.split("?")[0];
    const hasBearerToken = typeof request.headers.authorization === "string" && request.headers.authorization.startsWith("Bearer ");
    const requiresCsrf = csrfProtectedMethods.has(request.method) && !csrfExemptPaths.has(path) && !hasBearerToken;
    if (requiresCsrf && (path.startsWith("/api/admin") || path.startsWith("/api/account") || path.startsWith("/api/portal") || path === "/auth/logout")) {
      if (!verifyCsrf(request, reply)) {
        return;
      }
    }

    if (path.startsWith("/api/admin")) {
      const session = await getSession(request);

      if (!session) {
        // Fallback: allow service identities authenticating with a Bearer access token
        if (!hasBearerToken) {
          return reply.status(401).send({ error: "unauthorized" });
        }
        try {
          const token = (request.headers.authorization as string).slice("Bearer ".length);
          const claims = await deps.authService.jwtService.verifyAccessToken(token);
          if (claims.actor_type !== "service_identity") {
            return reply.status(401).send({ error: "unauthorized" });
          }
          if (path === "/api/admin/me") {
            return;
          }
          const resource = toAdminResource(path);
          const action = toAdminAction(request.method);
          const permissions = Array.isArray(claims.permissions) ? (claims.permissions as string[]) : [];
          if (!hasAdminPermission({ permissions, resource, action })) {
            return reply.status(403).send({ error: "forbidden" });
          }
          return;
        } catch {
          return reply.status(401).send({ error: "unauthorized" });
        }
      }

      const user = await deps.userService.findUserById(session.userId);
      if (!user) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      if (path === "/api/admin/me") {
        return;
      }

      const resource = toAdminResource(path);
      const action = toAdminAction(request.method);
      const permissions = await deps.roleService.resolvePermissionsForUser(user.id);
      if (!hasAdminPermission({ permissions, resource, action })) {
        return reply.status(403).send({ error: "forbidden" });
      }

      if (resource && action) {
        const authzResult = await deps.authorizationService.evaluate({
          user,
          resource: `admin:${resource}`,
          action,
          clientId: session.clientId,
          ip: request.ip,
          context: {
            path,
            method: request.method
          }
        });

        if (!authzResult.allow) {
          return reply.status(403).send({
            error: "forbidden",
            deniedBy: authzResult.deniedBy
          });
        }
      }
    }
  });

  app.get("/api/setup/status", async () => deps.setupService.status());
  app.post("/api/setup/initialize", async (request, reply) => {
    const input = setupInitializeSchema.parse(request.body);
    const result = await deps.setupService.initialize(input);
    reply.code(201);
    return result;
  });

  // Endpoint to obtain a fresh CSRF token
  app.get("/api/csrf-token", async (_request, reply) => {
    const token = generateCsrfToken();
    reply.setCookie("csrf_token", token, {
      httpOnly: false,
      secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
      sameSite: "strict",
      path: "/",
    });
    return { csrf_token: token };
  });

  app.get("/", async (_request, reply) => {
    return sendFrontendIndex(reply, "admin");
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  app.get("/media/uploads/*", async (request, reply) => {
    const relativePath = String((request.params as Record<string, string>)["*"] ?? "");
    if (!relativePath) {
      return reply.status(404).send({ error: "not_found" });
    }

    try {
      const uploaded = await deps.mediaService.readUploaded(relativePath);
      return reply.type(uploaded.mimeType).send(uploaded.data);
    } catch {
      return reply.status(404).send({ error: "not_found" });
    }
  });

  app.get("/media/defaults/user/:variant.svg", async (request, reply) => {
    const { variant } = request.params as { variant: string };
    const text = typeof (request.query as Record<string, unknown>)?.text === "string"
      ? String((request.query as Record<string, unknown>).text)
      : undefined;
    return reply.type("image/svg+xml").send(renderUserDefaultSvg(variant, text));
  });

  app.get("/media/defaults/app/:variant.svg", async (request, reply) => {
    const { variant } = request.params as { variant: string };
    return reply.type("image/svg+xml").send(renderAppDefaultSvg(variant));
  });

  app.get("/api/media/defaults/users", async (request) => {
    const initials = typeof (request.query as Record<string, unknown>)?.initials === "string"
      ? String((request.query as Record<string, unknown>).initials)
      : "AB";
    return { items: deps.mediaService.listDefaultUserAvatars(initials) };
  });

  app.get("/api/media/defaults/apps", async () => {
    return { items: deps.mediaService.listDefaultAppImages() };
  });

  app.get("/api/ui/customization", async (request, reply) => {
    const surfaceRaw = typeof (request.query as any)?.surface === "string" ? (request.query as any).surface : undefined;
    const clientId = typeof (request.query as any)?.clientId === "string" ? (request.query as any).clientId : undefined;
    const appId = typeof (request.query as any)?.appId === "string" ? (request.query as any).appId : undefined;
    const allowed: UiSurface[] = ["admin_login", "consent", "portal_login", "portal_launcher"];
    const surface = allowed.find((item) => item === surfaceRaw);

    if (!surface) {
      return reply.status(400).send({ error: "validation_error", message: "surface query parameter is required" });
    }

    const customization = await deps.instanceSettingsService.resolveUiCustomization({
      surface,
      clientId,
      appId
    });

    return {
      surface,
      customization
    };
  });

  await registerScimRoutes(app, {
    scimService: deps.scimService,
    scimTokenService: deps.scimTokenService,
    auditRepository: deps.auditRepository,
    eventHookService: deps.eventHookService,
    deprovisioningService: deps.deprovisioningService
  });

  await registerSamlAdminRoutes(app, {
    samlService: deps.samlService,
    samlServiceProviderRepository: deps.samlServiceProviderRepository,
    samlNameIdMappingRepository: deps.samlNameIdMappingRepository,
    samlAssertionAuditRepository: deps.samlAssertionAuditRepository,
    auditRepository: deps.auditRepository
  });

  await registerSamlProtocolRoutes(app, {
    samlService: deps.samlService,
    samlServiceProviderRepository: deps.samlServiceProviderRepository,
    authService: deps.authService,
    userService: deps.userService,
    auditRepository: deps.auditRepository,
    samlReplayProtectionService: deps.samlReplayProtectionService,
    samlSignatureService: deps.samlSignatureService
  });

  app.get("/.well-known/openid-configuration", async () => deps.oidcService.discoveryDocument());
  app.get("/.well-known/jwks.json", async () => deps.oidcService.jwks());

  app.post("/connect/register", async (request, reply) => {
    const input = dynamicClientRegistrationSchema.parse(request.body);

    if (input.app_id && !await deps.appService.findAppById(input.app_id)) {
      return reply.status(400).send({ error: "invalid_request", error_description: "Unknown app_id" });
    }

    const clientId = `dyn_${randomBytes(8).toString("hex")}`;
    const clientSecret = randomBytes(24).toString("hex");
    const grantTypes: GrantType[] = input.grant_types?.length
      ? [...input.grant_types] as GrantType[]
      : ["authorization_code"];
    const allowedScopes = input.scope
      ? input.scope.split(" ").map((s) => s.trim()).filter(Boolean)
      : ["openid", "profile", "email"];

    const requirePkce = grantTypes.includes("authorization_code");

    const created = await deps.clientService.createClient({
      appId: input.app_id,
      id: clientId,
      name: input.client_name,
      secret: clientSecret,
      redirectUris: input.redirect_uris,
      allowedScopes,
      grants: grantTypes,
      requirePkce,
      resources: [],
      flowIds: []
    });

    return reply.status(201).send({
      client_id: created.id,
      client_secret: created.secret,
      client_id_issued_at: Math.floor(created.createdAt.getTime() / 1000),
      client_secret_expires_at: 0,
      app_id: created.appId,
      client_name: created.name,
      redirect_uris: created.redirectUris,
      grant_types: created.grants,
      token_endpoint_auth_method: "client_secret_post",
      scope: created.allowedScopes.join(" ")
    });
  });

  app.get("/oauth/authorize", async (request, reply) => {
    const input = authorizeSchema.parse(request.query);

    try {
      deps.instanceSettingsService.assertAuthorizeRequest({
        responseType: input.response_type,
        codeChallengeMethod: input.code_challenge_method
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: "invalid_request", error_description: error.message });
      }
      throw error;
    }

    const client = await deps.clientService.findClientById(input.client_id);
    if (!client) {
      return reply.status(400).send({ error: "invalid_client", error_description: "Unknown client_id" });
    }
    if (!client.redirectUris.includes(input.redirect_uri)) {
      return reply.status(400).send({ error: "invalid_request", error_description: "redirect_uri not registered for client" });
    }

    const session = await getSession(request);
    const requireLogin = !session || input.prompt === "login";
    if (requireLogin) {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/login?${params}`);
    }

    const user = await deps.userService.findUserById(session!.userId);
    if (!user) {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/login?${params}`);
    }

    const consentStageEnabled = await deps.authenticationFlowService.isStageEnabled("consent");
    const forceConsent = input.prompt === "consent" || input.approval_prompt === "force";
    const hasConsented = input.consent === "approve";
    if (consentStageEnabled && !hasConsented && (forceConsent || input.prompt !== "none")) {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/consent?${params}`);
    }
    if (consentStageEnabled && !hasConsented && input.prompt === "none") {
      const redirectUrl = new URL(input.redirect_uri);
      redirectUrl.searchParams.set("error", "interaction_required");
      if (input.state) redirectUrl.searchParams.set("state", input.state);
      return reply.redirect(redirectUrl.toString());
    }

    const responseTypes = new Set(input.response_type.split(" ").map((value) => value.trim()).filter(Boolean));
    const hasFrontChannelToken = responseTypes.has("token") || responseTypes.has("id_token");
    const responseMode = input.response_mode ?? (hasFrontChannelToken ? "fragment" : "query");

    if (hasFrontChannelToken && responseMode === "query") {
      return reply.status(400).send({ error: "invalid_request", error_description: "response_mode=query is not allowed for token or id_token responses" });
    }

    if (responseTypes.has("id_token") && !input.nonce) {
      return reply.status(400).send({ error: "invalid_request", error_description: "nonce is required when response_type includes id_token" });
    }

    const params: Record<string, string> = {};

    if (responseTypes.has("code")) {
      const authorizationCode = await deps.authService.createAuthorizationCode({
        clientId: input.client_id,
        userId: user.id,
        redirectUri: input.redirect_uri,
        scope: input.scope.split(" "),
        codeChallenge: input.code_challenge,
        codeChallengeMethod: input.code_challenge_method as "S256" | undefined
      });
      params.code = authorizationCode.code;
    }

    if (responseTypes.has("token")) {
      const tenant = input.tenant ? (await deps.tenantService.listTenants()).find((item) => item.slug === input.tenant) : undefined;
      const token = await deps.authService.issueImplicitToken({
        userId: user.id,
        clientId: input.client_id,
        scope: input.scope.split(" "),
        tenantId: tenant?.id,
        ip: request.ip,
        userAgent: clientUserAgent(request)
      });
      params.access_token = token.access_token;
      params.token_type = token.token_type;
      params.expires_in = String(token.expires_in);
      params.scope = token.scope;
    }

    if (responseTypes.has("id_token")) {
      const idToken = await deps.authService.issueFrontChannelIdToken({
        userId: user.id,
        clientId: input.client_id,
        nonce: String(input.nonce)
      });
      params.id_token = idToken;
    }

    if (!responseTypes.has("code") && !responseTypes.has("token") && !responseTypes.has("id_token")) {
      return reply.status(400).send({ error: "unsupported_response_type", error_description: "Unsupported response_type" });
    }

    if (input.state) params.state = input.state;

    if (responseMode === "fragment") {
      const fragment = new URLSearchParams(params).toString();
      return reply.redirect(`${input.redirect_uri}#${fragment}`);
    }

    if (responseMode === "form_post") {
      const fields = Object.entries(params)
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
        .join("");
      const html = `<!DOCTYPE html><html><body onload="document.forms[0].submit()"><form method="POST" action="${input.redirect_uri}">${fields}</form></body></html>`;
      return reply.type("text/html").send(html);
    }

    // Default: query
    const redirectUrl = new URL(input.redirect_uri);
    Object.entries(params).forEach(([k, v]) => redirectUrl.searchParams.set(k, v));
    return reply.redirect(redirectUrl.toString());
  });

  app.post("/oauth/token", async (request, reply) => {
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", error_description: "Invalid token request" });
    }
    try {
      if (parsed.data.grant_type === "authorization_code") {
        return await deps.authService.exchangeAuthorizationCode({
          code: parsed.data.code,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          redirectUri: parsed.data.redirect_uri,
          codeVerifier: parsed.data.code_verifier,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });
      }
      if (parsed.data.grant_type === "refresh_token") {
        return await deps.authService.refreshTokens({
          refreshToken: parsed.data.refresh_token,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret
        });
      }
      if (parsed.data.grant_type === "client_credentials") {
        return await deps.authService.issueClientCredentialsTokens({
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          scope: parsed.data.scope
        });
      }
      if (parsed.data.grant_type === "password") {
        const user = await deps.authService.validateUserCredentials(parsed.data.username, parsed.data.password);
        await enforcePreCredentialStages({
          user,
          clientId: parsed.data.client_id,
          ip: request.ip,
          captchaToken: parsed.data.captcha_token,
          promptAcknowledged: parsed.data.prompt_acknowledged
        });

        if (await deps.authenticationFlowService.isStageEnabled("mfa_totp") && await deps.totpService.requiresTotp(user.id)) {
          return reply.status(400).send({ error: "invalid_grant", error_description: "MFA is required for password grant" });
        }

        if (await deps.authenticationFlowService.isStageEnabled("mfa_webauthn") && (await deps.webauthnService.listCredentials(user.id)).length > 0) {
          return reply.status(400).send({ error: "invalid_grant", error_description: "WebAuthn MFA is required; use interactive login" });
        }

        await enforcePostLoginStage({
          user,
          clientId: parsed.data.client_id,
          ip: request.ip
        });

        const tokenResponse = await deps.authService.issuePasswordGrantTokens({
          username: parsed.data.username,
          password: parsed.data.password,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          scope: parsed.data.scope,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });
        deps.securityService.clearLoginFailures(parsed.data.username);
        return tokenResponse;
      }
      if (parsed.data.grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
        const response = await deps.authService.exchangeDeviceCode({
          deviceCode: parsed.data.device_code,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });

        if ("error" in response) {
          return reply.status(400).send(response);
        }

        return response;
      }
      if (parsed.data.grant_type === "urn:ietf:params:oauth:grant-type:jwt-bearer") {
        return await deps.authService.issueJwtBearerGrantTokens({
          assertion: parsed.data.assertion,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          scope: parsed.data.scope,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });
      }
      if (parsed.data.grant_type === "urn:ietf:params:oauth:grant-type:saml2-bearer") {
        return await deps.authService.issueSaml2BearerGrantTokens({
          assertion: parsed.data.assertion,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          scope: parsed.data.scope,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });
      }
      if (parsed.data.grant_type === "urn:openid:params:grant-type:ciba") {
        const response = await deps.authService.exchangeCibaAuthenticationRequest({
          authReqId: parsed.data.auth_req_id,
          clientId: parsed.data.client_id,
          clientSecret: parsed.data.client_secret,
          ip: request.ip,
          userAgent: clientUserAgent(request)
        });

        if ("error" in response) {
          return reply.status(400).send(response);
        }

        return response;
      }
    } catch (err) {
      if (parsed.data.grant_type === "password") {
        await deps.securityService.recordLoginFailure({
          identifier: parsed.data.username,
          ip: request.ip,
          reason: err instanceof Error ? err.message : "unknown"
        });
        await deps.riskService.recordEvent({
          userId: undefined,
          ip: request.ip,
          confidence: 40,
          reason: "failed_login",
          decision: "challenge",
          metadata: {
            identifier: parsed.data.username,
            grant: "password"
          }
        });
        await deps.auditRepository.log({
          type: "login_failed",
          actorType: "user",
          ip: request.ip,
          metadata: { email: parsed.data.username, grant: "password" }
        });
        await deps.eventHookService.emit("auth.login.failed", {
          email: parsed.data.username,
          ip: request.ip,
          error: err instanceof Error ? err.message : "unknown",
          grant: "password"
        });
      }
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_grant", error_description: publicErrorMessageForPath("/oauth/token", err) });
      }
      throw err;
    }
    return reply.status(400).send({ error: "unsupported_grant_type" });
  });

  app.post("/oauth/token/exchange", async (request, reply) => {
    const { tokenExchangeSchema } = await import("./schemas.js");
    const parsed = tokenExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", error_description: "Missing required fields for token exchange" });
    }
    const { subject_token, subject_token_type, scope, audience, client_id, client_secret } = parsed.data;

    try {
      await deps.authenticationFlowService.assertGrantSupported("token_exchange");
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: "invalid_request", error_description: error.message });
      }
      throw error;
    }

    if (subject_token_type !== "urn:ietf:params:oauth:token-type:access_token" &&
        subject_token_type !== "urn:ietf:params:oauth:token-type:jwt") {
      return reply.status(400).send({ error: "invalid_request", error_description: "Unsupported subject_token_type" });
    }

    let subjectPayload: Record<string, unknown>;
    try {
      subjectPayload = await deps.authService.jwtService.verifyAccessToken(subject_token);
    } catch {
      return reply.status(401).send({ error: "invalid_token", error_description: "Subject token validation failed" });
    }

    let exchangeActor: { type: "client"; id: string } | { type: "service_identity"; id: string; clientId: string; allowedScopes: string[]; allowedAudiences: string[] } | undefined;

    // Optionally validate the caller presenting the exchange request.
    // Accept either a registered OAuth client or a service identity credential.
    if (client_id || client_secret) {
      if (!client_id || !client_secret) {
        return reply.status(400).send({ error: "invalid_request", error_description: "client_id and client_secret must be provided together" });
      }

      let matchedClient = false;

      try {
        const client = await deps.clientService.findClientById(client_id);
        if (client && client.secret === client_secret) {
          if (!client.grants.includes("token_exchange")) {
            return reply.status(401).send({ error: "invalid_client", error_description: "Client does not support token_exchange grant" });
          }
          matchedClient = true;
          exchangeActor = { type: "client", id: client.id };
        }
      } catch {
        // Fallback to service identity verification below.
      }

      if (!matchedClient) {
        const serviceIdentity = await deps.serviceIdentityService.verifyCredential(client_id, client_secret);
        if (!serviceIdentity) {
          return reply.status(401).send({ error: "invalid_client" });
        }
        exchangeActor = {
          type: "service_identity",
          id: serviceIdentity.id,
          clientId: client_id,
          allowedScopes: serviceIdentity.allowedScopes,
          allowedAudiences: serviceIdentity.allowedAudiences
        };
      }
    }

    const subjectSub = String(subjectPayload.sub ?? "");
    const requestedScopes = scope ? scope.split(" ").map((value) => value.trim()).filter(Boolean) : (subjectPayload.scope ? String(subjectPayload.scope).split(" ").map((value) => value.trim()).filter(Boolean) : []);
    const requestedAudiences = audience
      ? audience.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
      : [];

    let finalScopes = requestedScopes;
    if (exchangeActor?.type === "service_identity") {
      const allowedScopes = new Set(exchangeActor.allowedScopes);
      finalScopes = finalScopes.length > 0 ? finalScopes : exchangeActor.allowedScopes;
      if (finalScopes.some((value) => !allowedScopes.has(value))) {
        return reply.status(400).send({ error: "invalid_scope", error_description: "Requested scope exceeds service identity policy" });
      }

      if (requestedAudiences.length > 0) {
        const allowedAudiences = new Set(exchangeActor.allowedAudiences);
        if (requestedAudiences.some((value) => !allowedAudiences.has(value))) {
          return reply.status(400).send({ error: "invalid_target", error_description: "Requested audience exceeds service identity policy" });
        }
      }
    }

    let exchangeClient: Awaited<ReturnType<typeof deps.clientService.findClientById>> | undefined;
    if (exchangeActor?.type === "client") {
      exchangeClient = await deps.clientService.findClientById(exchangeActor.id);
      if (requestedAudiences.length > 0) {
        const allowedAudiences = new Set(exchangeClient?.resources ?? []);
        if (requestedAudiences.some((value) => !allowedAudiences.has(value))) {
          return reply.status(400).send({ error: "invalid_target", error_description: "Requested audience exceeds client policy" });
        }
      }
    }

    const { nanoid } = await import("nanoid");
    const accessTokenId = nanoid();

    // Issue a new token with the same subject but potentially different scopes/audience
    const newToken = await deps.oidcService.mintExchangeToken({
      sub: subjectSub,
      scopes: finalScopes,
      audiences: requestedAudiences,
      accessTokenId,
      client: exchangeClient
    });

    await deps.auditRepository.log({
      type: "token_issued",
      actorType: "client",
      clientId: exchangeActor?.type === "client" ? exchangeActor.id : client_id,
      ip: request.ip,
      metadata: {
        grant: "token_exchange",
        sub: subjectSub,
        scopes: finalScopes,
        audiences: requestedAudiences,
        accessTokenId,
        exchangeActorType: exchangeActor?.type,
        serviceIdentityId: exchangeActor?.type === "service_identity" ? exchangeActor.id : undefined,
        serviceIdentityClientId: exchangeActor?.type === "service_identity" ? exchangeActor.clientId : undefined
      }
    });

    return reply.status(200).send({
      access_token: newToken.accessToken,
      token_type: "Bearer",
      expires_in: newToken.expiresIn,
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: finalScopes.join(" ")
    });
  });

  app.post("/oauth/device/authorize", async (request, reply) => {
    const input = deviceAuthorizationSchema.parse(request.body);
    const issued = await deps.authService.createDeviceAuthorization({
      clientId: input.client_id,
      clientSecret: input.client_secret,
      scope: input.scope
    });
    return reply.status(200).send(issued);
  });

  app.post("/oauth/ciba/authenticate", async (request, reply) => {
    const input = cibaAuthenticationRequestSchema.parse(request.body);
    const issued = await deps.authService.createCibaAuthenticationRequest({
      clientId: input.client_id,
      clientSecret: input.client_secret,
      loginHint: input.login_hint,
      scope: input.scope,
      requestedDeliveryMode: input.requested_delivery_mode,
      clientNotificationEndpoint: input.client_notification_endpoint,
      clientNotificationToken: input.client_notification_token,
      bindingMessage: input.binding_message,
      userCode: input.user_code
    });
    return reply.status(200).send(issued);
  });

  app.post("/oauth/ciba/approve", async (request, reply) => {
    const input = cibaApprovalSchema.parse(request.body);
    const result = await deps.authService.approveCibaAuthenticationRequest({
      authReqId: input.auth_req_id,
      username: input.username,
      password: input.password,
      approve: input.approve
    });
    return reply.status(200).send(result);
  });

  app.post("/oauth/device/verify", async (request, reply) => {
    const input = deviceVerificationSchema.parse(request.body);
    const result = await deps.authService.verifyDeviceUserCode({
      userCode: input.user_code,
      username: input.username,
      password: input.password,
      approve: input.approve
    });
    return reply.status(200).send(result);
  });

  app.post("/oauth/introspect", async (request) => {
    const input = introspectSchema.parse(request.body);
    return await deps.authService.introspectToken({
      token: input.token,
      clientId: input.client_id,
      clientSecret: input.client_secret
    });
  });

  app.post("/oauth/token/revoke", async (request, reply) => {
    const { token } = oidcRevokeSchema.parse(request.body);
    try {
      const payload = await deps.authService.jwtService.verifyAccessToken(token);
      if (payload.type === "refresh" && payload.jti) {
        deps.authService.revokeRefreshToken(String(payload.jti));
      } else if (payload.jti) {
        deps.authService.revokeAccessToken(String(payload.jti));
      }
    } catch { /* invalid tokens - return 200 per spec */ }
    return reply.status(200).send({});
  });

  app.get("/oauth/userinfo", async (request, reply) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "invalid_token", error_description: "Missing bearer token" });
    }
    try {
      const token = authorization.slice("Bearer ".length);
      const claims = await deps.authService.getUserInfoFromAccessToken(token);

      const query = (request.query ?? {}) as Record<string, string | undefined>;
      const requestedFormat = query.format ?? query.response;
      const wantsSigned = requestedFormat === "signed" || requestedFormat === "jwt";

      if (!wantsSigned) {
        return claims;
      }

      const payload = await deps.authService.jwtService.verifyAccessToken(token);
      const subject = typeof payload.sub === "string" ? payload.sub : "unknown";
      const audience = typeof payload.aud === "string"
        ? payload.aud
        : Array.isArray(payload.aud) && typeof payload.aud[0] === "string"
          ? payload.aud[0]
          : "unknown-client";

      const signed = await deps.authService.jwtService.signUserInfoClaims({
        claims,
        audience,
        subject
      });
      return reply.type("application/jwt").send(signed);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_token", error_description: publicErrorMessageForPath("/oauth/userinfo", err) });
      }
      throw err;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const user = await deps.authService.validateUserCredentials(input.email, input.password);
      await enforcePreCredentialStages({
        user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: request.ip,
        captchaToken: input.captchaToken,
        promptAcknowledged: input.promptAcknowledged
      });

      if (await deps.authenticationFlowService.isStageEnabled("mfa_totp") && await deps.totpService.requiresTotp(user.id)) {
        return reply.status(202).send(
          deps.totpService.createLoginChallenge({
            userId: user.id,
            clientId: input.clientId,
            scope: input.scope,
            tenantSlug: input.tenantSlug,
            ip: request.ip
          })
        );
      }

      if (await deps.authenticationFlowService.isStageEnabled("mfa_webauthn") && (await deps.webauthnService.listCredentials(user.id)).length > 0) {
        const challenge = await deps.webauthnService.startLogin({
          user,
          clientId: input.clientId,
          scope: input.scope,
          tenantSlug: input.tenantSlug,
          ip: request.ip
        });

        return reply.status(202).send({
          mfaRequired: true,
          mfaMethod: "webauthn",
          ...challenge
        });
      }

      await enforcePostLoginStage({
        user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: request.ip
      });

      const { session, tokens } = await deps.authService.completeLoginForUser({
        userId: user.id,
        clientId: input.clientId,
        scope: input.scope,
        tenantSlug: input.tenantSlug,
        ip: request.ip,
        userAgent: clientUserAgent(request)
      });
      deps.securityService.clearLoginFailures(input.email);
      await runBestEffort(request, "auth.login.succeeded", async () => {
        await deps.eventHookService.emit("auth.login.succeeded", {
          userId: session.userId,
          clientId: session.clientId,
          sessionId: session.id,
          ip: request.ip
        });
      });
      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });
      return { session, ...tokens };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      await runBestEffort(request, "security.recordLoginFailure", async () => {
        await deps.securityService.recordLoginFailure({
          identifier: input.email,
          ip: request.ip,
          reason
        });
      });
      await runBestEffort(request, "risk.recordEvent", async () => {
        await deps.riskService.recordEvent({
          userId: undefined,
          ip: request.ip,
          confidence: 40,
          reason: "failed_login",
          decision: "challenge",
          metadata: {
            identifier: input.email,
            grant: "interactive"
          }
        });
      });
      await runBestEffort(request, "audit.login_failed", async () => {
        await deps.auditRepository.log({
          type: "login_failed",
          actorType: "user",
          ip: request.ip,
          metadata: { email: input.email }
        });
      });
      await runBestEffort(request, "auth.login.failed", async () => {
        await deps.eventHookService.emit("auth.login.failed", {
          email: input.email,
          ip: request.ip,
          error: reason
        });
      });
      throw err;
    }
  });

  app.post("/auth/login/mfa", async (request, reply) => {
    const input = mfaLoginSchema.parse(request.body);

    try {
      const challenge = deps.totpService.consumeLoginChallenge(input.mfaTicket);
      const user = await deps.userService.findUserById(challenge.userId);

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      if (!await deps.totpService.verifyUserCode({ userId: user.id, code: input.code })) {
        throw new AuthenticationError("Invalid one-time code");
      }

      const tenant = challenge.tenantSlug ? (await deps.tenantService.listTenants()).find((item) => item.slug === challenge.tenantSlug) : undefined;
      await deps.policyService.enforceStagePolicies({
        stage: "mfa_totp",
        user,
        tenantId: tenant?.id,
        clientId: challenge.clientId,
        ip: challenge.ip ?? request.ip
      });

      await enforcePostLoginStage({
        user,
        tenantSlug: challenge.tenantSlug,
        clientId: challenge.clientId,
        ip: challenge.ip ?? request.ip
      });

      const { session, tokens } = await deps.authService.completeLoginForUser({
        userId: user.id,
        clientId: challenge.clientId,
        scope: challenge.scope,
        tenantSlug: challenge.tenantSlug,
        ip: challenge.ip ?? request.ip,
        userAgent: clientUserAgent(request)
      });

      await runBestEffort(request, "auth.login.succeeded.mfa_totp", async () => {
        await deps.eventHookService.emit("auth.login.succeeded", {
          userId: session.userId,
          clientId: session.clientId,
          sessionId: session.id,
          ip: request.ip,
          mfa: "totp"
        });
      });

      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });

      return { session, ...tokens };
    } catch (err) {
      return reply.status(401).send({ error: "invalid_grant", error_description: "MFA verification failed" });
    }
  });

  app.post("/auth/login/webauthn/begin", async (request, reply) => {
    const input = webauthnLoginBeginSchema.parse(request.body);

    try {
      const user = await deps.userService.findUserByEmail(input.identifier.trim()) ?? await deps.userService.findUserByUsername(input.identifier.trim());
      if (!user || !user.active) {
        throw new AuthenticationError("Invalid credentials");
      }

      const challenge = await deps.webauthnService.startLogin({
        user,
        clientId: input.clientId,
        scope: input.scope,
        tenantSlug: input.tenantSlug,
        ip: request.ip
      });

      return reply.status(200).send(challenge);
    } catch (error) {
      return reply.status(401).send({ error: "invalid_grant", error_description: "Authentication failed" });
    }
  });

  app.post("/auth/login/webauthn/finish", async (request, reply) => {
    const input = webauthnLoginFinishSchema.parse(request.body);

    try {
      const result = await deps.webauthnService.finishLogin(input);
      const user = await deps.userService.findUserById(result.userId);
      if (!user) {
        throw new AuthenticationError("User not found");
      }

      await deps.policyService.enforceStagePolicies({
        stage: "mfa_webauthn",
        user,
        tenantId: await resolveTenantId(result.tenantSlug),
        clientId: result.clientId,
        ip: result.ip ?? request.ip
      });

      await enforcePostLoginStage({
        user,
        tenantSlug: result.tenantSlug,
        clientId: result.clientId,
        ip: result.ip ?? request.ip
      });

      const { session, tokens } = await deps.authService.completeLoginForUser({
        userId: user.id,
        clientId: result.clientId,
        scope: result.scope,
        tenantSlug: result.tenantSlug,
        ip: result.ip ?? request.ip,
        userAgent: clientUserAgent(request)
      });

      await runBestEffort(request, "auth.login.succeeded.mfa_webauthn", async () => {
        await deps.eventHookService.emit("auth.login.succeeded", {
          userId: session.userId,
          clientId: session.clientId,
          sessionId: session.id,
          ip: request.ip,
          mfa: "webauthn"
        });
      });

      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });

      return { session, ...tokens };
    } catch (error) {
      return reply.status(401).send({ error: "invalid_grant", error_description: "Authentication failed" });
    }
  });

  app.get("/auth/federation/providers", async () => deps.federationService.listProviders());

  app.get("/api/admin/federation/providers", async (request) => {
    const providers = await deps.federationService.listConfiguredProviders();
    return filterAdminList(providers, request.query as Record<string, unknown>, [
      (provider) => provider.id,
      (provider) => provider.label
    ]);
  });

  app.get("/api/admin/me", async (request, reply) => {
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const user = await deps.userService.findUserById(session.userId);
    if (!user) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      avatarUrl: user.avatarUrl,
      roles: await deps.roleService.resolveNamesForUser(user.id),
      groups: await deps.groupService.resolveGroupNamesForUser(user.id),
      permissions: await deps.roleService.resolvePermissionsForUser(user.id)
    };
  });

  app.get("/api/account/mfa/totp", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    return deps.totpService.getStatus(auth.user.id);
  });

  app.post("/api/account/mfa/totp/enroll", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    return deps.totpService.startEnrollment(auth.user);
  });

  app.post("/api/account/mfa/totp/verify", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    const input = verifyTotpEnrollmentSchema.parse(request.body);
    return deps.totpService.completeEnrollment({
      userId: auth.user.id,
      enrollmentId: input.enrollmentId,
      code: input.code
    });
  });

  app.delete("/api/account/mfa/totp", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    deps.totpService.disable(auth.user.id);
    return reply.status(204).send();
  });

  app.get("/api/account/mfa/webauthn/credentials", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    const credentials = await deps.webauthnService.listCredentials(auth.user.id);
    return credentials.map((credential) => ({
      credentialId: credential.credentialId,
      transports: credential.transports,
      aaguid: credential.aaguid,
      signCount: credential.signCount,
      createdAt: credential.createdAt
    }));
  });

  app.post("/api/account/mfa/webauthn/register/begin", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    const input = webauthnRegisterBeginSchema.parse(request.body);
    return deps.webauthnService.startRegistration(auth.user, input.displayName);
  });

  app.post("/api/account/mfa/webauthn/register/finish", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    const input = webauthnRegisterFinishSchema.parse(request.body);
    return deps.webauthnService.finishRegistration({
      userId: auth.user.id,
      registrationId: input.registrationId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      transports: input.transports,
      aaguid: input.aaguid,
      signCount: input.signCount
    });
  });

  app.delete("/api/account/mfa/webauthn/credentials/:credentialId", async (request, reply) => {
    const auth = await requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    const { credentialId } = request.params as { credentialId: string };
    await deps.webauthnService.removeCredential(auth.user.id, credentialId);
    return reply.status(204).send();
  });

  app.get("/api/admin/settings", async () => deps.instanceSettingsService.getSettings());

  // Delegation: provisioning, access governance, elevations
  await registerProvisioningRoutes(app, {
    scimTokenService: deps.scimTokenService,
    provisioningService: deps.provisioningService,
    deprovisioningService: deps.deprovisioningService,
    requireSessionUser
  });
  await registerAccessGovernanceRoutes(app, {
    accessGovernanceService: deps.accessGovernanceService,
    accessReviewService: deps.accessReviewService,
    auditRepository: deps.auditRepository,
    eventHookService: deps.eventHookService,
    requireSessionUser
  });
  await registerElevationRoutes(app, {
    elevationService: deps.elevationService,
    requireSessionUser
  });
  registerServiceIdentityRoutes(app, deps.serviceIdentityService, deps.roleService, deps.groupService);
  registerConnectorRoutes(app, deps.connectorService, deps.authMetricsService);
  registerPluginRoutes(app, deps.pluginService, deps.pluginRuntimeService);

  app.put("/api/admin/settings", async (request) => {
    const input = updateInstanceSettingsSchema.parse(request.body);
    return deps.instanceSettingsService.updateSettings(input);
  });
  app.post("/api/admin/settings/test-email", async (request, reply) => {
    const input = sendTestEmailSchema.parse(request.body);
    const result = await deps.emailService.send({
      to: input.to,
      subject: input.subject,
      text: input.message
    });
    return reply.status(200).send({ ok: true, ...result });
  });

  app.post("/api/admin/settings/database/test", async (request, reply) => {
    const input = testDatabaseConnectionSchema.parse(request.body);
    const result = await deps.databaseMigrationService.testConnection(input.provider, input.externalDatabaseUrl);
    return reply.status(200).send(result);
  });

  app.post("/api/admin/settings/database/migrate", async (request, reply) => {
    const input = migrateDatabaseSchema.parse(request.body);
    const instanceSettings = await deps.instanceSettingsService.getSettings();
    const result = await deps.databaseMigrationService.migrateFromSqlite({
      sqlitePath: input.sqlitePath ?? instanceSettings.databasePath,
      provider: input.provider,
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    deps.instanceSettingsService.updateSettings({
      databaseProvider: input.provider,
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    return reply.status(200).send(result);
  });

  app.get("/api/admin/authentication/flows", async (request) => {
    const flows = await deps.authenticationFlowService.listFlows();
    return filterAdminList(flows, request.query as Record<string, unknown>, [
      (flow) => flow.name,
      (flow) => flow.description,
      (flow) => flow.id,
      (flow) => flow.designation
    ]);
  });
  app.post("/api/admin/authentication/flows", async (request, reply) => {
    const input = createAuthenticationFlowSchema.parse(request.body);
    reply.code(201);
    return deps.authenticationFlowService.createFlow(input);
  });
  app.put("/api/admin/authentication/flows/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = updateAuthenticationFlowSchema.parse(request.body);
    return deps.authenticationFlowService.updateFlow(id, input);
  });
  app.delete("/api/admin/authentication/flows/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.authenticationFlowService.deleteFlow(id);
    return reply.status(204).send();
  });

  app.get("/api/admin/user-attributes", async (request) => {
    const attributes = await deps.userAttributeService.listAttributes();
    return filterAdminList(attributes, request.query as Record<string, unknown>, [
      (attribute) => attribute.key,
      (attribute) => attribute.name,
      (attribute) => attribute.description,
      (attribute) => attribute.id
    ]);
  });
  app.post("/api/admin/user-attributes", async (request, reply) => {
    const input = createUserAttributeSchema.parse(request.body);
    reply.code(201);
    return deps.userAttributeService.createAttribute(input);
  });
  app.put("/api/admin/user-attributes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = updateUserAttributeSchema.parse(request.body);
    return deps.userAttributeService.updateAttribute(id, input);
  });
  app.delete("/api/admin/user-attributes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.userAttributeService.deleteAttribute(id);
    return reply.status(204).send();
  });
  app.put("/api/admin/user-attributes/:id/groups", async (request) => {
    const { id } = request.params as { id: string };
    const input = setUserAttributeGroupAssignmentSchema.parse(request.body);
    return deps.userAttributeService.setGroupAssignment({ attributeId: id, ...input });
  });
  app.delete("/api/admin/user-attributes/:id/groups/:groupId", async (request, reply) => {
    const { id, groupId } = request.params as { id: string; groupId: string };
    await deps.userAttributeService.removeGroupAssignment({ attributeId: id, groupId });
    return reply.status(204).send();
  });

  app.get("/api/admin/policies", async (request) => {
    const policies = await deps.policyService.listPolicies();
    return filterAdminList(policies, request.query as Record<string, unknown>, [
      (policy) => policy.key,
      (policy) => policy.name,
      (policy) => policy.description,
      (policy) => policy.id
    ]);
  });
  app.post("/api/admin/policies", async (request, reply) => {
    const input = createPolicySchema.parse(request.body);
    const policy = await deps.policyService.createPolicy({
      key: input.key,
      name: input.name,
      description: input.description,
      category: input.category,
      effect: input.effect,
      resourcePattern: input.resourcePattern,
      actionPattern: input.actionPattern,
      stageBindings: input.stageBindings,
      javascriptCode: input.javascriptCode,
      enabled: input.enabled
    });
    reply.code(201);
    return policy;
  });
  app.put("/api/admin/policies/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = updatePolicySchema.parse(request.body);
    return deps.policyService.updatePolicy(id, {
      key: input.key,
      name: input.name,
      description: input.description,
      category: input.category,
      effect: input.effect,
      resourcePattern: input.resourcePattern,
      actionPattern: input.actionPattern,
      stageBindings: input.stageBindings,
      javascriptCode: input.javascriptCode,
      enabled: input.enabled
    });
  });
  app.delete("/api/admin/policies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.policyService.deletePolicy(id);
    return reply.status(204).send();
  });
  app.put("/api/admin/policies/:id/assignments", async (request) => {
    const { id } = request.params as { id: string };
    const input = setPolicyAssignmentSchema.parse(request.body);
    return deps.policyService.setAssignment({
      policyId: id,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      enabled: input.enabled,
      priority: input.priority,
      decisionStrategy: input.decisionStrategy,
      config: input.config
    });
  });
  app.delete("/api/admin/policies/:id/assignments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = removePolicyAssignmentSchema.parse(request.body);
    await deps.policyService.removeAssignment({
      policyId: id,
      scopeType: input.scopeType,
      scopeId: input.scopeId
    });
    return reply.status(204).send();
  });
  app.post("/api/admin/policies/evaluate", async (request, reply) => {
    const input = evaluatePolicyDecisionSchema.parse(request.body);
    const user = await deps.userService.findUserById(input.userId);
    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    const result = await deps.policyService.evaluateAuthorizationPolicies({
      user,
      decisionStrategy: input.decisionStrategy,
      tenantId: input.tenantId,
      clientId: input.clientId,
      ip: input.ip ?? request.ip,
      resource: input.resource,
      action: input.action,
      context: input.context
    });

    await deps.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "user",
      actorId: user.id,
      clientId: input.clientId,
      ip: input.ip ?? request.ip,
      metadata: {
        source: "policies_evaluate",
        resource: input.resource,
        action: input.action,
        allow: result.allow,
        deniedBy: result.deniedBy,
        context: input.context
      }
    });

    await deps.policyDecisionLogRepository.create({
      userId: user.id,
      clientId: input.clientId,
      tenantId: input.tenantId,
      ip: input.ip ?? request.ip,
      resource: input.resource,
      action: input.action,
      allow: result.allow,
      deniedBy: result.deniedBy,
      context: input.context,
      source: "policies_evaluate"
    });

    return result;
  });
  app.post("/api/admin/authorization/check", async (request, reply) => {
    const input = authorizationCheckSchema.parse(request.body);
    const user = await deps.userService.findUserById(input.userId);
    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    const result = await deps.policyService.evaluateAuthorizationPolicies({
      user,
      decisionStrategy: input.decisionStrategy,
      tenantId: input.tenantId,
      clientId: input.clientId,
      ip: input.ip ?? request.ip,
      resource: input.resource,
      action: input.action,
      context: input.context
    });

    await deps.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "user",
      actorId: user.id,
      clientId: input.clientId,
      ip: input.ip ?? request.ip,
      metadata: {
        source: "authorization_check",
        resource: input.resource,
        action: input.action,
        allow: result.allow,
        deniedBy: result.deniedBy,
        context: input.context
      }
    });

    await deps.policyDecisionLogRepository.create({
      userId: user.id,
      clientId: input.clientId,
      tenantId: input.tenantId,
      ip: input.ip ?? request.ip,
      resource: input.resource,
      action: input.action,
      allow: result.allow,
      deniedBy: result.deniedBy,
      context: input.context,
      source: "authorization_check"
    });

    return result;
  });
  app.get("/api/admin/policies/decisions", async (request) => {
    const { limit } = request.query as { limit?: string };
    return deps.policyDecisionLogRepository.list(limit ? Number(limit) : 100);
  });

  app.get("/api/admin/events/hooks", async (request) => {
    const hooks = await deps.eventHookService.listHooks();
    return filterAdminList(hooks, request.query as Record<string, unknown>, [
      (hook) => hook.eventType,
      (hook) => hook.targetUrl,
      (hook) => hook.id
    ]);
  });
  app.get("/api/admin/events/types", async () => deps.eventHookService.listSystemEventTypes());
  app.post("/api/admin/events/hooks", async (request, reply) => {
    const input = createEventHookSchema.parse(request.body);
    const hook = await deps.eventHookService.createHook(input);
    reply.code(201);
    return hook;
  });
  app.put("/api/admin/events/hooks/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = updateEventHookSchema.parse(request.body);
    return deps.eventHookService.updateHook(id, input);
  });
  app.post("/api/admin/events/hooks/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const input = testEventHookSchema.parse(request.body ?? {});
    return deps.eventHookService.emitTest(id, input);
  });
  app.delete("/api/admin/events/hooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.eventHookService.deleteHook(id);
    return reply.status(204).send();
  });
  app.get("/api/admin/events/notifications", async (request) => {
    const { limit } = request.query as { limit?: string };
    return deps.eventHookService.listNotifications(limit ? Number(limit) : 100);
  });

  app.post("/api/admin/federation/providers", async (request, reply) => {
    const input = createFederationProviderSchema.parse(request.body);
    reply.code(201);
    const provider = await deps.federationService.createProvider(input);
    return {
      ...provider,
      clientSecret: undefined,
      hasSecret: true,
      secretPreview: `${provider.clientSecret.slice(0, 4)}...${provider.clientSecret.slice(-4)}`
    };
  });
  app.put("/api/admin/federation/providers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateFederationProviderSchema.parse(request.body);
    const provider = await deps.federationService.updateProvider(id, input);
    return {
      ...provider,
      clientSecret: undefined,
      hasSecret: true,
      secretPreview: `${provider.clientSecret.slice(0, 4)}...${provider.clientSecret.slice(-4)}`
    };
  });
  app.delete("/api/admin/federation/providers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.federationService.deleteProvider(id);
    return reply.status(204).send();
  });

  app.get("/auth/federation/:providerId/start", async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const redirectAfterLogin = asSafeRedirect((request.query as { redirect?: string }).redirect);
    const destination = await deps.federationService.getAuthorizationRedirect(providerId, redirectAfterLogin);
    return reply.redirect(destination);
  });

  app.get("/auth/federation/:providerId/callback", async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.status(400).send({ error: "invalid_request", message: "Missing code or state" });
    }

    const completed = await deps.federationService.completeLogin({ providerId, code, state });
    await deps.policyService.enforceStagePolicies({
      stage: "federation",
      user: completed.user,
      clientId: "sso-admin-ui",
      ip: request.ip
    });

    await enforcePostLoginStage({
      user: completed.user,
      clientId: "sso-admin-ui",
      ip: request.ip
    });

    const session = await deps.authService.sessionRepository.create({
      userId: completed.user.id,
      clientId: "sso-admin-ui",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await deps.securityService.observeSessionStart({
      sessionId: session.id,
      userId: completed.user.id,
      clientId: "sso-admin-ui",
      ip: request.ip,
      userAgent: clientUserAgent(request)
    });

    await deps.auditRepository.log({
      type: "login",
      actorId: completed.user.id,
      actorType: "user",
      clientId: "sso-admin-ui",
      metadata: { method: "federation", providerId, sessionId: session.id }
    });

    reply.setCookie("sid", session.id, {
      httpOnly: true,
      secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return reply.redirect(asSafeRedirect(completed.redirectAfterLogin));
  });

  app.post("/auth/logout", async (request, reply) => {
    const session = await getSession(request);
    if (session) {
      deps.securityService.revokeSessionObservation(session.id);
      await enforceInvalidationForSession({ session, ip: request.ip });
      await deps.auditRepository.log({
        type: "logout",
        actorId: session.userId,
        actorType: "user",
        metadata: { sessionId: session.id }
      });
      await deps.eventHookService.emit("auth.logout", {
        userId: session.userId,
        sessionId: session.id,
        ip: request.ip
      });
    }
    reply.clearCookie("sid", { path: "/" });
    return reply.redirect("/login");
  });

  app.get("/oauth/logout", async (request, reply) => {
    const {
      post_logout_redirect_uri,
      state,
      client_id,
      id_token_hint
    } = oauthLogoutSchema.parse(request.query);
    const session = await getSession(request);
    let hintedClientId: string | undefined;

    if (id_token_hint) {
      try {
        const claims = await deps.authService.jwtService.verifyAccessToken(id_token_hint);
        const aud = claims.aud;
        hintedClientId = typeof aud === "string" ? aud : Array.isArray(aud) ? aud.find((value): value is string => typeof value === "string") : undefined;
      } catch {
        return reply.status(400).send({ error: "invalid_request", error_description: "Invalid id_token_hint" });
      }
    }

    if (client_id && hintedClientId && client_id !== hintedClientId) {
      return reply.status(400).send({ error: "invalid_request", error_description: "client_id does not match id_token_hint" });
    }

    if (session) {
      deps.securityService.revokeSessionObservation(session.id);
      await enforceInvalidationForSession({ session, ip: request.ip });
    }
    reply.clearCookie("sid", { path: "/" });
    if (post_logout_redirect_uri) {
      const redirectClientId = session?.clientId ?? hintedClientId ?? client_id;
      if (!redirectClientId) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      const redirectUrl = await resolveValidatedPostLogoutRedirect({
        clientId: redirectClientId,
        redirectUri: post_logout_redirect_uri,
        state
      });
      return reply.redirect(redirectUrl ?? "/login");
    }
    return reply.redirect("/login");
  });

  app.get("/oauth/frontchannel-logout", async (request, reply) => {
    const input = frontChannelLogoutSchema.parse(request.query);
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    if ((input.sid && input.sid !== session.id) || (input.sub && input.sub !== session.userId)) {
      return reply.status(403).send({ error: "forbidden" });
    }

    await enforceInvalidationForSession({ session, ip: request.ip });
    deps.securityService.revokeSessionObservation(session.id);
    if (!session.revokedAt) {
      await deps.authService.sessionRepository.revoke(session.id, new Date());
    }

    reply.clearCookie("sid", { path: "/" });

    if (input.post_logout_redirect_uri) {
      const redirectUrl = await resolveValidatedPostLogoutRedirect({
        clientId: session.clientId,
        redirectUri: input.post_logout_redirect_uri,
        state: input.state
      });
      return reply.redirect(redirectUrl ?? "/login");
    }

    return reply.type("text/html; charset=utf-8").send("<!DOCTYPE html><html><body>Front-channel logout complete</body></html>");
  });

  app.post("/oauth/backchannel-logout", async (request, reply) => {
    const input = backChannelLogoutSchema.parse(request.body);
    const client = await deps.authService.authenticateClient({
      clientId: input.client_id,
      clientSecret: input.client_secret
    });
    const now = new Date();

    const matchingSessions = (await deps.authService.sessionRepository.list()).filter((session) => {
      if (session.clientId !== client.id) {
        return false;
      }
      if (input.sid && session.id === input.sid) {
        return true;
      }
      if (input.sub && session.userId === input.sub) {
        return true;
      }
      return false;
    });

    for (const session of matchingSessions) {
      await enforceInvalidationForSession({ session, ip: request.ip });
      deps.securityService.revokeSessionObservation(session.id);
      if (!session.revokedAt) {
        await deps.authService.sessionRepository.revoke(session.id, now);
      }
    }

    return reply.status(200).send({ revoked: matchingSessions.length });
  });

  app.post("/auth/recovery/request", async (request, reply) => {
    const input = recoveryRequestSchema.parse(request.body);
    const user = await deps.userService.findUserByEmail(input.identifier) ?? await deps.userService.findUserByUsername(input.identifier);

    // Keep enumeration-safe response semantics regardless of account existence.
    if (!user || !user.active) {
      return reply.status(200).send({ status: "sent_if_account_exists" });
    }

    try {
      if (await isStageEnabledForDesignation("recovery", "identification")) {
        await enforcePoliciesForStage({
          stage: "identification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      const challenge = deps.recoveryService.createChallenge({ userId: user.id });

      if (await isStageEnabledForDesignation("recovery", "email_verification")) {
        await enforcePoliciesForStage({
          stage: "email_verification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });

        await deps.emailService.sendRecoveryVerification({
          to: user.email,
          code: challenge.verificationCode,
          ticket: challenge.ticket
        });
      }

      const response: Record<string, unknown> = {
        status: "sent_if_account_exists",
        expiresIn: challenge.expiresIn
      };
      if (process.env.NODE_ENV !== "production") {
        response.recoveryTicket = challenge.ticket;
        response.verificationCode = challenge.verificationCode;
      }

      return reply.status(200).send(response);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_request", error_description: publicErrorMessageForPath("/auth/recovery/request", err) });
      }
      throw err;
    }
  });

  app.post("/auth/recovery", async (request, reply) => {
    const input = recoverySchema.parse(request.body);

    let challenge;
    try {
      challenge = deps.recoveryService.getChallenge(input.recoveryTicket);
    } catch {
      return reply.status(401).send({ error: "invalid_grant", error_description: "Invalid or expired recovery ticket" });
    }

    const user = await deps.userService.findUserById(challenge.userId);
    if (!user || !user.active) {
      return reply.status(401).send({ error: "invalid_grant", error_description: "Recovery user not found" });
    }

    try {
      if (await isStageEnabledForDesignation("recovery", "identification")) {
        await enforcePoliciesForStage({
          stage: "identification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (await isStageEnabledForDesignation("recovery", "email_verification")) {
        if (!input.verificationCode || !deps.recoveryService.verifyCode({ ticket: input.recoveryTicket, code: input.verificationCode })) {
          return reply.status(401).send({ error: "invalid_grant", error_description: "Email verification failed" });
        }
        await enforcePoliciesForStage({
          stage: "email_verification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (await isStageEnabledForDesignation("recovery", "mfa_totp") && await deps.totpService.requiresTotp(user.id)) {
        if (!input.code || !await deps.totpService.verifyUserCode({ userId: user.id, code: input.code })) {
          return reply.status(401).send({ error: "invalid_grant", error_description: "Invalid one-time code" });
        }
        await enforcePoliciesForStage({
          stage: "mfa_totp",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (await isStageEnabledForDesignation("recovery", "prompt") && input.promptAcknowledged !== true) {
        return reply.status(400).send({ error: "invalid_request", error_description: "Prompt acknowledgement is required" });
      }

      if (await isStageEnabledForDesignation("recovery", "user_write")) {
        await deps.userService.resetPassword(user.id, input.newPassword);
        await enforcePoliciesForStage({
          stage: "user_write",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      deps.recoveryService.consume(input.recoveryTicket);

      if (!await isStageEnabledForDesignation("recovery", "user_login")) {
        return reply.status(200).send({ status: "password_reset" });
      }

      await enforcePoliciesForStage({
        stage: "user_login",
        user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: request.ip
      });

      const { session, tokens } = await deps.authService.completeLoginForUser({
        userId: user.id,
        clientId: input.clientId,
        scope: input.scope,
        tenantSlug: input.tenantSlug
      });

      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: await deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });

      return { session, ...tokens, recovery: true };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_grant", error_description: publicErrorMessageForPath("/auth/recovery", err) });
      }
      throw err;
    }
  });

  app.get("/api/admin/users", async (request) => {
    const users = await deps.userService.listUsers();
    return filterAdminList(users, request.query as Record<string, unknown>, [
      (user) => user.username,
      (user) => user.email,
      (user) => user.givenName,
      (user) => user.familyName,
      (user) => user.id
    ]);
  });
  app.post("/api/admin/users", async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    if (input.password) {
      await deps.policyService.enforceUserCreationPolicies(input.password);
    }
    const user = await deps.userService.createUser(input);
    await deps.auditRepository.log({ type: "user_created", actorType: "system", metadata: { userId: user.id, email: user.email } });
    await deps.eventHookService.emit("user.created", {
      userId: user.id,
      email: user.email,
      username: user.username
    });
    reply.code(201);
    return { id: user.id, email: user.email, username: user.username };
  });
  app.patch("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { appId, appIds, externalSource, externalId, isServiceUser, avatarUrl, email, username, givenName, familyName, active, roleIds, groupIds, customAttributes } = updateUserSchema.parse(request.body);
    if (appId !== undefined || appIds !== undefined || externalSource !== undefined || externalId !== undefined || isServiceUser !== undefined || avatarUrl !== undefined || email !== undefined || username !== undefined || givenName !== undefined || familyName !== undefined) {
      await deps.userService.updateUserProfile(id, { appId, appIds, externalSource, externalId, isServiceUser, avatarUrl, email, username, givenName, familyName });
      if (avatarUrl !== undefined) {
        const refreshedUser = await deps.userService.findUserById(id);
        if (refreshedUser) {
          const nextAttributes = { ...(refreshedUser.customAttributes ?? {}) };
          if (avatarUrl === null) {
            delete nextAttributes[USER_PICTURE_ATTRIBUTE_KEY];
          } else {
            nextAttributes[USER_PICTURE_ATTRIBUTE_KEY] = avatarUrl;
          }
          await deps.userService.setCustomAttributes(id, nextAttributes);
        }
      }
    }
    if (active !== undefined) await deps.userService.setUserActive(id, active);
    if (customAttributes) await deps.userService.setCustomAttributes(id, customAttributes);
    if (roleIds) {
      const existingAssignments = await deps.roleService.listAssignmentsForUser(id);
      const existingRoleIds = Array.from(new Set(existingAssignments.map((assignment) => assignment.roleId)));
      const next = new Set(roleIds);
      for (const roleId of existingRoleIds) {
        if (!next.has(roleId)) {
          await deps.roleService.removeRole({ userId: id, roleId });
        }
      }
      for (const roleId of roleIds) {
        if (!existingRoleIds.includes(roleId)) {
          await deps.roleService.assignRole({ userId: id, roleId });
        }
      }
    }
    if (groupIds) {
      // Reset to exact set by removing all currently assigned groups first.
      const existingGroupIds = await deps.groupService.listGroupIdsForUser(id);
      const next = new Set(groupIds);
      for (const groupId of existingGroupIds) {
        if (!next.has(groupId)) {
          await deps.groupService.removeUserFromGroup({ userId: id, groupId });
        }
      }
      for (const groupId of groupIds) {
        await deps.groupService.assignUserToGroup({ userId: id, groupId });
      }
    }
    await deps.eventHookService.emit("user.updated", {
      userId: id,
      appId,
      appIds,
      externalSource,
      externalId,
      isServiceUser,
      avatarUrl,
      active,
      email,
      username,
      givenName,
      familyName,
      updatedGroupIds: groupIds,
      updatedCustomAttributes: customAttributes ? Object.keys(customAttributes) : undefined
    });
    return { id, appId, appIds, externalSource, externalId, isServiceUser, avatarUrl, active, email, username, givenName, familyName };
  });
  app.post("/api/admin/users/:id/reset-password", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { password } = resetUserPasswordSchema.parse(request.body);

    await deps.policyService.enforceUserCreationPolicies(password);
    await deps.userService.resetPassword(id, password);

    const now = new Date();
    const userSessions = (await deps.authService.sessionRepository.list()).filter((session) => session.userId === id && !session.revokedAt);
    for (const session of userSessions) {
      await deps.authService.sessionRepository.revoke(session.id, now);
    }

    await deps.auditRepository.log({
      type: "user_password_reset",
      actorType: "system",
      metadata: { userId: id, revokedSessions: userSessions.length }
    });

    await deps.eventHookService.emit("user.password_reset", {
      userId: id,
      revokedSessions: userSessions.length
    });

    return reply.status(204).send();
  });

  app.post("/api/admin/users/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await deps.userService.findUserById(id);
    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    const uploaded = await readImageUpload(request, reply);
    if (!uploaded) {
      return;
    }

    const previousAvatarUrl = user.avatarUrl;
    const saved = await deps.mediaService.saveUploadedImage({
      bucket: "users",
      ownerId: user.id,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType
    });

    await deps.userService.updateUserProfile(user.id, { avatarUrl: saved.url });
    await deps.userService.setCustomAttributes(user.id, {
      ...(user.customAttributes ?? {}),
      [USER_PICTURE_ATTRIBUTE_KEY]: saved.url
    });
    await deps.mediaService.deleteByUrl(previousAvatarUrl);

    return reply.status(200).send({ avatarUrl: saved.url });
  });
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.userService.deleteUser(id);
    await deps.eventHookService.emit("user.deleted", {
      userId: id
    });
    return reply.status(204).send();
  });
  app.get("/api/admin/clients", async (request) => {
    const clients = await deps.clientService.listClients();
    return filterAdminList(clients, request.query as Record<string, unknown>, [
      (client) => client.id,
      (client) => client.name,
      (client) => client.appId
    ]);
  });
  app.get("/api/admin/scopes", async (request) => {
    const scopes = await deps.scopeService.listScopes();
    return filterAdminList(scopes, request.query as Record<string, unknown>, [
      (scope) => scope.name,
      (scope) => scope.description,
      (scope) => scope.id
    ]);
  });
  app.post("/api/admin/scopes", async (request, reply) => {
    const input = createScopeSchema.parse(request.body);
    const scope = await deps.scopeService.createScope(input);
    reply.code(201);
    return scope;
  });
  app.delete("/api/admin/scopes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.scopeService.deleteScope(id);
    return reply.status(204).send();
  });
  app.post("/api/admin/clients", async (request, reply) => {
    const input = createClientSchema.parse(request.body);
    const client = await deps.clientService.createClient(input);
    await deps.eventHookService.emit("client.created", {
      clientId: client.id,
      name: client.name,
      grants: client.grants,
      allowedScopes: client.allowedScopes
    });
    reply.code(201);
    return { ...client, secret: undefined, secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}` };
  });
  app.put("/api/admin/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateClientSchema.parse(request.body);
    const client = await deps.clientService.updateClient(id, input);
    if (!client) return reply.status(404).send({ error: "not_found" });
    await deps.eventHookService.emit("client.updated", {
      clientId: client.id,
      name: client.name,
      grants: client.grants,
      allowedScopes: client.allowedScopes
    });
    return { ...client, secret: undefined, secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}` };
  });
  app.delete("/api/admin/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.clientService.deleteClient(id);
    await deps.eventHookService.emit("client.deleted", {
      clientId: id
    });
    return reply.status(204).send();
  });
  app.get("/api/admin/roles", async (request) => {
    const roles = await deps.roleService.listRoles();
    return filterAdminList(roles, request.query as Record<string, unknown>, [
      (role) => role.name,
      (role) => role.description,
      (role) => role.id,
      (role) => role.scope
    ]);
  });
  app.post("/api/admin/roles", async (request, reply) => {
    const input = createRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.createRole(input);
  });
  app.delete("/api/admin/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.roleService.deleteRole(id);
    return reply.status(204).send();
  });
  app.put("/api/admin/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateRoleSchema.parse(request.body);
    const updated = await deps.roleService.updateRole(id, input);
    if (!updated) return reply.status(404).send({ error: "Role not found" });
    return updated;
  });
  app.post("/api/admin/role-assignments", async (request, reply) => {
    const input = assignRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.assignRole(input);
  });
  app.get("/api/admin/groups", async (request) => {
    const groups = await deps.groupService.listGroups();
    return filterAdminList(groups, request.query as Record<string, unknown>, [
      (group) => group.name,
      (group) => group.description,
      (group) => group.id,
      (group) => group.externalId
    ]);
  });
  app.post("/api/admin/groups", async (request, reply) => {
    const input = createGroupSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.createGroup(input);
  });
  app.put("/api/admin/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateGroupSchema.parse(request.body);
    return deps.groupService.updateGroup(id, input);
  });
  app.delete("/api/admin/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.groupService.deleteGroup(id);
    return reply.status(204).send();
  });
  app.post("/api/admin/group-role-assignments", async (request, reply) => {
    const input = assignGroupRoleSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.assignRoleToGroup(input);
  });
  app.delete("/api/admin/group-role-assignments", async (request, reply) => {
    const input = assignGroupRoleSchema.parse(request.body);
    await deps.groupService.removeRoleFromGroup(input);
    return reply.status(204).send();
  });
  app.post("/api/admin/user-groups", async (request, reply) => {
    const input = assignUserGroupSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.assignUserToGroup(input);
  });
  app.delete("/api/admin/user-groups", async (request, reply) => {
    const input = assignUserGroupSchema.parse(request.body);
    await deps.groupService.removeUserFromGroup(input);
    return reply.status(204).send();
  });
  app.get("/api/admin/tenants", async (request) => {
    const tenants = await deps.tenantService.listTenants();
    return filterAdminList(tenants, request.query as Record<string, unknown>, [
      (tenant) => tenant.name,
      (tenant) => tenant.slug,
      (tenant) => tenant.id
    ]);
  });
  app.get("/api/admin/apps", async (request) => {
    const apps = await deps.appService.listApps();
    return filterAdminList(apps, request.query as Record<string, unknown>, [
      (app) => app.name,
      (app) => app.description,
      (app) => app.url,
      (app) => app.id
    ]);
  });
  app.post("/api/admin/apps", async (request, reply) => {
    const input = createAppSchema.parse(request.body);
    reply.code(201);
    return deps.appService.createApp(input);
  });
  app.put("/api/admin/apps/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateAppSchema.parse(request.body);
    return deps.appService.updateApp(id, input);
  });

  app.post("/api/admin/apps/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existingApp = await deps.appService.findAppById(id);
    if (!existingApp) {
      return reply.status(404).send({ error: "not_found", message: "App not found" });
    }

    const uploaded = await readImageUpload(request, reply);
    if (!uploaded) {
      return;
    }

    const previousImageUrl = existingApp.imageUrl;
    const saved = await deps.mediaService.saveUploadedImage({
      bucket: "apps",
      ownerId: id,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType
    });

    const updated = await deps.appService.updateApp(id, { imageUrl: saved.url });
    await deps.mediaService.deleteByUrl(previousImageUrl);
    return reply.status(200).send({ imageUrl: updated.imageUrl });
  });
  app.delete("/api/admin/apps/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.appService.deleteApp(id);
    return reply.status(204).send();
  });
  app.post("/api/admin/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);
    reply.code(201);
    return deps.tenantService.createTenant(input);
  });
  app.put("/api/admin/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateTenantSchema.parse(request.body);
    return deps.tenantService.updateTenant(id, input);
  });

  app.get("/api/admin/sessions", async (request) => {
    const sessions = await deps.authService.sessionRepository.list();
    return filterAdminList(sessions, request.query as Record<string, unknown>, [
      (session) => session.id,
      (session) => session.userId,
      (session) => session.clientId
    ]);
  });
  app.delete("/api/admin/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.securityService.revokeSessionObservation(id);
    await deps.authService.sessionRepository.revoke(id, new Date());
    await deps.auditRepository.log({ type: "session_revoked", actorType: "system", metadata: { sessionId: id } });
    await deps.eventHookService.emit("session.revoked", {
      sessionId: id,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/devices", async () => {
    const clients = await deps.clientService.listClients();
    const deviceClientIds = new Set(
      clients
        .filter((client) => client.grants.includes("device_code"))
        .map((client) => client.id)
    );
    const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

    const sessions = (await deps.authService.sessionRepository.list())
      .filter((session) => deviceClientIds.has(session.clientId))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((session) => ({
        id: session.id,
        clientId: session.clientId,
        clientName: clientNameById.get(session.clientId) ?? session.clientId,
        userId: session.userId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        status: session.revokedAt
          ? "revoked"
          : session.expiresAt.getTime() < Date.now()
            ? "expired"
            : "active"
      }));

    const requests = deps.authService.listDeviceAuthorizations().map((record) => ({
      deviceCode: record.deviceCode,
      userCode: record.userCode,
      clientId: record.clientId,
      clientName: clientNameById.get(record.clientId) ?? record.clientId,
      userId: record.userId,
      scope: record.scope,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      status: record.status,
      lastPolledAt: record.lastPolledAt
    }));

    return { requests, sessions };
  });

  app.delete("/api/admin/devices/requests/:deviceCode", async (request, reply) => {
    const { deviceCode } = request.params as { deviceCode: string };
    deps.authService.revokeDeviceAuthorization(deviceCode);
    await deps.auditRepository.log({
      type: "session_revoked",
      actorType: "system",
      metadata: { deviceCode, kind: "device_request" }
    });
    await deps.eventHookService.emit("device.request.revoked", {
      deviceCode,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.delete("/api/admin/devices/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.securityService.revokeSessionObservation(id);
    await deps.authService.sessionRepository.revoke(id, new Date());
    await deps.auditRepository.log({
      type: "session_revoked",
      actorType: "system",
      metadata: { sessionId: id, kind: "device_session" }
    });
    await deps.eventHookService.emit("device.session.revoked", {
      sessionId: id,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/consents", async (request) => {
    const consents = await deps.authService.consentRepository.list();
    return filterAdminList(consents, request.query as Record<string, unknown>, [
      (consent) => consent.id,
      (consent) => consent.userId,
      (consent) => consent.clientId
    ]);
  });
  app.delete("/api/admin/consents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.authService.consentRepository.revoke(id);
    await deps.auditRepository.log({ type: "consent_revoked", actorType: "system", metadata: { consentId: id } });
    await deps.eventHookService.emit("consent.revoked", {
      consentId: id,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/audit", async (request) => {
    const { limit } = request.query as { limit?: string };
    const events = await deps.auditRepository.list(limit ? Number(limit) : 200);
    return filterAdminList(events, request.query as Record<string, unknown>, [
      (event) => event.type,
      (event) => event.actorId,
      (event) => event.actorType,
      (event) => event.clientId,
      (event) => event.ip,
      (event) => event.id
    ]);
  });

  app.get("/api/admin/security/risk-events", async (request) => {
    const { limit } = request.query as { limit?: string };
    const requestedLimit = limit ? Number(limit) : 50;
    const sourceEvents = await deps.auditRepository.list(Math.max(200, requestedLimit * 5));
    return deriveRiskEventsFromAudit(sourceEvents, requestedLimit);
  });

  app.get("/users", async (request, reply) => {
    if (prefersHtmlResponse(request)) {
      return sendFrontendIndex(reply, "admin");
    }
    return deps.userService.listUsers();
  });
  app.get("/clients", async (request, reply) => {
    if (prefersHtmlResponse(request)) {
      return sendFrontendIndex(reply, "admin");
    }
    return deps.clientService.listClients();
  });
  app.get("/roles", async (request, reply) => {
    if (prefersHtmlResponse(request)) {
      return sendFrontendIndex(reply, "admin");
    }
    return deps.roleService.listRoles();
  });
  app.get("/groups", async (request, reply) => {
    if (prefersHtmlResponse(request)) {
      return sendFrontendIndex(reply, "admin");
    }
    return deps.groupService.listGroups();
  });
  app.get("/tenants", async (request, reply) => {
    if (prefersHtmlResponse(request)) {
      return sendFrontendIndex(reply, "admin");
    }
    return deps.tenantService.listTenants();
  });
  app.post("/users", async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    if (input.password) {
      await deps.policyService.enforceUserCreationPolicies(input.password);
    }
    const user = await deps.userService.createUser(input);
    await deps.eventHookService.emit("user.created", {
      userId: user.id,
      email: user.email,
      username: user.username
    });
    reply.code(201);
    return { id: user.id, email: user.email, username: user.username };
  });
  app.post("/roles", async (request, reply) => {
    const input = createRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.createRole(input);
  });
  app.post("/role-assignments", async (request, reply) => {
    const input = assignRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.assignRole(input);
  });
  app.post("/groups", async (request, reply) => {
    const input = createGroupSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.createGroup(input);
  });
  app.post("/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);
    reply.code(201);
    return deps.tenantService.createTenant(input);
  });
  app.post("/oauth/revoke", async (request) => {
    const input = revokeTokenSchema.parse(request.body);
    if (input.tokenType === "access") {
      deps.authService.revokeAccessToken(input.tokenId);
    } else {
      deps.authService.revokeRefreshToken(input.tokenId);
    }
    return { revoked: true };
  });

  // ─── User Portal API ──────────────────────────────────────────────────────────

  async function getPortalSession(request: any) {
    const sid = request.cookies?.sid;
    if (!sid) return null;
    const session = await deps.authService.sessionRepository.findById(sid);
    if (!session || session.expiresAt.getTime() < Date.now() || session.revokedAt) return null;
    return session;
  }

  app.get("/api/portal/language/default", async (request) => {
    const countryHeaders = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"] as const;
    let countryCode: string | null = null;

    for (const header of countryHeaders) {
      const value = request.headers[header];
      if (typeof value === "string" && value.trim().length === 2) {
        countryCode = value.trim().toUpperCase();
        break;
      }
    }

    const fromCountry = countryCode
      ? geolocationService.getLanguageFromCountryCode(countryCode)
      : null;

    const fromIp = fromCountry
      ? null
      : await geolocationService.detectLanguageFromIp(request.ip);

    const acceptLanguage = typeof request.headers["accept-language"] === "string"
      ? request.headers["accept-language"]
      : "";

    const fallback = translationService.detectLanguageFromHeader(acceptLanguage);
    const language = fromCountry ?? fromIp ?? fallback;

    return {
      language,
      supportedLanguages: translationService.getAvailableLanguages()
    };
  });

  // GET /api/portal/me — current user profile + apps + custom attributes
  app.get("/api/portal/me", async (request, reply) => {
    const session = await getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const user = await deps.userService.findUserById(session.userId);
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    const userAppAccess = await deps.userService.resolveAppAccessForUser(user.id);
    const userCustomAttributes = await deps.userService.resolveCustomAttributesForUser(user.id);
    const roleDetails = await deps.roleService.resolveRolePermissionDetailsForUser(user.id);
    const userApps = (await deps.appService.listApps()).filter((appItem) => {
      return userAppAccess.appIds.length === 0 || userAppAccess.appIds.includes(appItem.id);
    });
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      avatarUrl: user.avatarUrl,
      customAttributes: {
        ...userCustomAttributes.customAttributes,
        ...(user.avatarUrl ? { [USER_PICTURE_ATTRIBUTE_KEY]: user.avatarUrl } : {})
      },
      directCustomAttributes: {
        ...userCustomAttributes.directCustomAttributes,
        ...(user.avatarUrl ? { [USER_PICTURE_ATTRIBUTE_KEY]: user.avatarUrl } : {})
      },
      inheritedCustomAttributes: userCustomAttributes.inheritedCustomAttributes,
      appId: userAppAccess.appId,
      appIds: userAppAccess.appIds,
      directAppIds: userAppAccess.directAppIds,
      inheritedAppIds: userAppAccess.inheritedAppIds,
      roles: roleDetails.map((role) => role.name),
      groups: await deps.groupService.resolveGroupNamesForUser(user.id),
      permissions: Array.from(new Set(roleDetails.flatMap((role) => role.permissions))),
      rolePermissions: roleDetails,
      apps: userApps.map(a => ({ id: a.id, name: a.name, description: a.description, icon: a.icon, imageUrl: a.imageUrl, url: a.url }))
    };
  });

  // PATCH /api/portal/profile — update own profile
  app.patch("/api/portal/profile", async (request, reply) => {
    const session = await getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const input = portalUpdateProfileSchema.parse(request.body);
    if (input.givenName !== undefined || input.familyName !== undefined || input.avatarUrl !== undefined || input.email !== undefined || input.username !== undefined) {
      await deps.userService.updateUserProfile(session.userId, {
        givenName: input.givenName,
        familyName: input.familyName,
        avatarUrl: input.avatarUrl,
        email: input.email,
        username: input.username
      });

      if (input.avatarUrl !== undefined) {
        const refreshedUser = await deps.userService.findUserById(session.userId);
        if (refreshedUser) {
          const nextAttributes = { ...(refreshedUser.customAttributes ?? {}) };
          if (input.avatarUrl === null) {
            delete nextAttributes[USER_PICTURE_ATTRIBUTE_KEY];
          } else {
            nextAttributes[USER_PICTURE_ATTRIBUTE_KEY] = input.avatarUrl;
          }
          await deps.userService.setCustomAttributes(session.userId, nextAttributes);
        }
      }
    }
    if (input.customAttributes !== undefined) {
      await deps.userService.setCustomAttributes(session.userId, input.customAttributes);
    }
    return reply.status(204).send();
  });

  // POST /api/portal/change-password — change own password (requires current pw)
  app.post("/api/portal/change-password", async (request, reply) => {
    const session = await getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const { currentPassword, newPassword } = portalChangePasswordSchema.parse(request.body);
    const user = await deps.userService.findUserById(session.userId);
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return reply.status(400).send({ error: "InvalidPassword", message: "Current password is incorrect" });
    }
    await deps.policyService.enforceUserCreationPolicies(newPassword);
    await deps.userService.resetPassword(session.userId, newPassword);
    return reply.status(204).send();
  });

  // DELETE /api/portal/account — delete own account
  app.delete("/api/portal/account", async (request, reply) => {
    const session = await getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    // Revoke all sessions first
    const allSessions = (await deps.authService.sessionRepository.list()).filter(s => s.userId === session.userId && !s.revokedAt);
    const now = new Date();
    for (const s of allSessions) {
      deps.securityService.revokeSessionObservation(s.id);
      await deps.authService.sessionRepository.revoke(s.id, now);
    }
    await deps.userService.deleteUser(session.userId);
    reply.clearCookie("sid", { path: "/" });
    return reply.status(204).send();
  });

  app.post("/api/portal/avatar", async (request, reply) => {
    const session = await getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });

    const user = await deps.userService.findUserById(session.userId);
    if (!user) return reply.status(401).send({ error: "unauthorized" });

    const uploaded = await readImageUpload(request, reply);
    if (!uploaded) {
      return;
    }

    const previousAvatarUrl = user.avatarUrl;
    const saved = await deps.mediaService.saveUploadedImage({
      bucket: "users",
      ownerId: user.id,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType
    });

    await deps.userService.updateUserProfile(user.id, { avatarUrl: saved.url });
    await deps.userService.setCustomAttributes(user.id, {
      ...(user.customAttributes ?? {}),
      [USER_PICTURE_ATTRIBUTE_KEY]: saved.url
    });
    await deps.mediaService.deleteByUrl(previousAvatarUrl);

    return reply.status(200).send({ avatarUrl: saved.url });
  });

  app.get("/portal", async (request, reply) => {
    const queryIndex = request.url.indexOf("?");
    const query = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
    return reply.redirect(`/portal/${query}`, 308);
  });

  app.get("/portal/*", async (request, reply) => {
    const relativePath = String((request.params as Record<string, string>)["*"] ?? "");

    if (relativePath.startsWith("assets/")) {
      return sendFrontendFile(reply, "portal", relativePath);
    }

    return sendFrontendIndex(reply, "portal");
  });

  app.get("/*", async (request, reply) => {
    const relativePath = String((request.params as Record<string, string>)["*"] ?? "");

    if (["favicon.ico", "favicon.svg", "logo.svg"].includes(relativePath)) {
      return sendFrontendFile(reply, "admin", relativePath);
    }

    if (relativePath.startsWith("assets/")) {
      return sendFrontendFile(reply, "admin", relativePath);
    }

    return sendFrontendIndex(reply, "admin");
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const path = request.url.split("?")[0];
      if (isSensitiveProtocolPath(path)) {
        return reply.status(error.statusCode).send({
          error: error.name,
          message: publicErrorMessageForPath(path, error)
        });
      }
      return reply.status(error.statusCode).send({ error: error.name, message: error.message });
    }
    if (typeof error === "object" && error !== null && "issues" in error) {
      const details = (error as { issues: unknown }).issues;
      return reply.status(422).send({
        error: "ValidationError",
        message: validationErrorMessageFromIssues(details),
        details
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "InternalServerError", message: "Unexpected server error" });
  });
};
