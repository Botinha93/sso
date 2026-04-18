import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthenticationStageType, FlowDesignation, GrantType, User } from "../domain/models.js";
import { AppError, AuthenticationError } from "../core/errors.js";
import { verifyPassword } from "../security/password.js";
import { readViewAsset } from "./view-assets.js";
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
  portalChangePasswordSchema,
  portalUpdateProfileSchema,
  recoverySchema,
  recoveryRequestSchema,
  sendTestEmailSchema,
  testDatabaseConnectionSchema,
  mfaLoginSchema,
  verifyTotpEnrollmentSchema,
  refreshTokenSchema,
  resetUserPasswordSchema,
  revokeTokenSchema,
  tokenSchema,
  setUserAttributeGroupAssignmentSchema,
  setPolicyAssignmentSchema,
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
import { SetupService } from "../services/setup-service.js";
import { TenantService } from "../services/tenant-service.js";
import { TotpService } from "../services/totp-service.js";
import { UserService } from "../services/user-service.js";
import { UserAttributeService } from "../services/user-attribute-service.js";
import { PolicyService } from "../services/policy-service.js";
import { EventHookService } from "../services/event-hook-service.js";
import { EmailService } from "../services/email-service.js";
import { DatabaseMigrationService } from "../services/database-migration-service.js";
import { InstanceSettingsService } from "../services/instance-settings-service.js";
import { RecoveryService } from "../services/recovery-service.js";
import { SecurityService } from "../services/security-service.js";
import type { AuditRepository } from "../repositories/contracts.js";

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
  totpService: TotpService;
  userService: UserService;
  userAttributeService: UserAttributeService;
  policyService: PolicyService;
  eventHookService: EventHookService;
  emailService: EmailService;
  databaseMigrationService: DatabaseMigrationService;
  recoveryService: RecoveryService;
  securityService: SecurityService;
  instanceSettingsService: InstanceSettingsService;
  auditRepository: AuditRepository;
}

export const registerRoutes = async (app: FastifyInstance, deps: RouteDeps) => {

  const sendAdminShell = async (reply: any) => {
    const html = await readViewAsset("admin.html");
    return reply.type("text/html; charset=utf-8").send(html);
  };

  function asSafeRedirect(value: unknown): string {
    if (typeof value !== "string" || !value.startsWith("/")) {
      return "/";
    }
    return value;
  }

  function getSession(request: any) {
    const sid = request.cookies?.sid;
    if (!sid) return null;
    const session = deps.authService.sessionRepository.findById(sid);
    if (!session || session.expiresAt.getTime() < Date.now() || session.revokedAt) return null;
    return session;
  }

  function clientUserAgent(request: any) {
    const raw = request.headers?.["user-agent"];
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  }

  async function enforceEndpointRateLimit(request: any, reply: any) {
    const path = request.url.split("?")[0];
    const configs: Array<{ endpointKey: string; limit: number; windowMs: number; actorKey: string; metadata?: Record<string, unknown> }> = [];

    if (path === "/auth/login") {
      configs.push({ endpointKey: "auth_login", limit: 10, windowMs: 60_000, actorKey: request.ip });
    }
    if (path === "/auth/login/mfa") {
      configs.push({ endpointKey: "auth_login_mfa", limit: 10, windowMs: 60_000, actorKey: request.ip });
    }
    if (path === "/auth/recovery/request") {
      configs.push({ endpointKey: "auth_recovery_request", limit: 5, windowMs: 15 * 60_000, actorKey: request.ip });
    }
    if (path === "/oauth/device/verify") {
      configs.push({ endpointKey: "oauth_device_verify", limit: 10, windowMs: 60_000, actorKey: request.ip });
    }
    if (path === "/oauth/device/authorize") {
      configs.push({ endpointKey: "oauth_device_authorize", limit: 10, windowMs: 60_000, actorKey: request.ip });
    }
    if (path === "/oauth/token") {
      const grantType = typeof request.body?.grant_type === "string" ? request.body.grant_type : undefined;
      configs.push({
        endpointKey: `oauth_token:${grantType ?? "unknown"}`,
        limit: grantType === "urn:ietf:params:oauth:grant-type:device_code" ? 30 : 20,
        windowMs: 60_000,
        actorKey: request.ip,
        metadata: { grantType }
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

  function toResource(path: string): string | undefined {
    const relative = path.replace(/^\/api\/admin\/?/, "");
    const top = relative.split("/")[0];
    const map: Record<string, string> = {
      users: "users",
      clients: "clients",
      roles: "roles",
      groups: "groups",
      tenants: "tenants",
      devices: "sessions",
      sessions: "sessions",
      audit: "audit_log",
      consents: "consents",
      federation: "federation_providers",
      authentication: "authentication_flows",
      "user-attributes": "user_attributes",
      policies: "policies",
      events: "events",
      scopes: "scopes",
      settings: "administration",
      administration: "administration",
      apps: "apps",
      "role-assignments": "roles",
      "group-role-assignments": "groups",
      "user-groups": "groups"
    };
    return map[top];
  }

  function toAction(method: string): "view" | "add" | "change" | "delete" | "disable" | undefined {
    switch (method.toUpperCase()) {
      case "GET":
        return "view";
      case "POST":
        return "add";
      case "PUT":
      case "PATCH":
        return "change";
      case "DELETE":
        return "delete";
      default:
        return undefined;
    }
  }

  function requireSessionUser(request: any, reply: any) {
    const session = getSession(request);
    if (!session) {
      reply.status(401).send({ error: "unauthorized" });
      return null;
    }

    const user = deps.userService.findUserById(session.userId);
    if (!user) {
      reply.status(401).send({ error: "unauthorized" });
      return null;
    }

    return { session, user };
  }

  function resolveTenantId(tenantSlug: string | undefined) {
    if (!tenantSlug) {
      return undefined;
    }
    return deps.tenantService.listTenants().find((item) => item.slug === tenantSlug)?.id;
  }

  function isStageEnabledForDesignation(designation: FlowDesignation, stage: AuthenticationStageType) {
    return deps.authenticationFlowService.isStageEnabledForDesignation(designation, stage);
  }

  function enforcePoliciesForStage(input: {
    stage: AuthenticationStageType;
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
  }) {
    deps.policyService.enforceStagePolicies({
      stage: input.stage,
      user: input.user,
      tenantId: resolveTenantId(input.tenantSlug),
      clientId: input.clientId,
      ip: input.ip
    });
  }

  function enforcePreCredentialStages(input: {
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
    captchaToken?: string;
    promptAcknowledged?: boolean;
  }) {
    deps.authenticationFlowService.assertStageEnabled("password");

    if (deps.authenticationFlowService.isStageEnabled("risk_check")) {
      enforcePoliciesForStage({
        stage: "risk_check",
        user: input.user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: input.ip
      });
    }

    if (deps.authenticationFlowService.isStageEnabled("captcha") && !input.captchaToken) {
      throw new AuthenticationError("Captcha verification is required");
    }

    enforcePoliciesForStage({
      stage: "password",
      user: input.user,
      tenantSlug: input.tenantSlug,
      clientId: input.clientId,
      ip: input.ip
    });

    if (deps.authenticationFlowService.isStageEnabled("prompt") && input.promptAcknowledged !== true) {
      throw new AuthenticationError("Interactive prompt acknowledgement is required");
    }
  }

  function enforcePostLoginStage(input: {
    user: User;
    tenantSlug?: string;
    clientId?: string;
    ip?: string;
  }) {
    if (!deps.authenticationFlowService.isStageEnabled("user_login")) {
      return;
    }

    enforcePoliciesForStage({
      stage: "user_login",
      user: input.user,
      tenantSlug: input.tenantSlug,
      clientId: input.clientId,
      ip: input.ip
    });
  }

  function enforceInvalidationForSession(input: { session: { userId: string; clientId: string }; ip?: string }) {
    if (!isStageEnabledForDesignation("invalidation", "user_logout")) {
      return;
    }

    const user = deps.userService.findUserById(input.session.userId);
    if (!user) {
      return;
    }

    enforcePoliciesForStage({
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
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
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

    if (!csrfProtectedMethods.has(request.method)) return;
    if (csrfExemptPaths.has(request.url.split("?")[0])) return;
    // Only enforce CSRF on admin and auth endpoints
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/admin") || path.startsWith("/api/account") || path === "/auth/logout") {
      verifyCsrf(request, reply);
    }

    if (path.startsWith("/api/admin")) {
      const session = getSession(request);
      if (!session) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      const user = deps.userService.findUserById(session.userId);
      if (!user) {
        return reply.status(401).send({ error: "unauthorized" });
      }

      if (path === "/api/admin/me") {
        return;
      }

      const resource = toResource(path);
      const action = toAction(request.method);
      const permissions = deps.roleService.resolvePermissionsForUser(user.id);
      const hasGlobal = permissions.includes("*:*");
      const hasResourceWildcard = resource ? permissions.includes(`${resource}:*`) : false;
      const hasAction = resource && action ? permissions.includes(`${resource}:${action}`) : false;

      if (!hasGlobal && !hasResourceWildcard && !hasAction) {
        return reply.status(403).send({ error: "forbidden" });
      }
    }
  });

  app.get("/api/setup/status", async () => deps.setupService.status());
  app.post("/api/setup/initialize", async (request, reply) => {
    const input = setupInitializeSchema.parse(request.body);
    const result = deps.setupService.initialize(input);
    reply.code(201);
    return result;
  });

  // Endpoint to obtain a fresh CSRF token
  app.get("/api/csrf-token", async (_request, reply) => {
    const token = generateCsrfToken();
    reply.setCookie("csrf_token", token, {
      httpOnly: false,
      secure: deps.instanceSettingsService.shouldUseSecureCookies(),
      sameSite: "strict",
      path: "/",
    });
    return { csrf_token: token };
  });

  app.get("/", async (_request, reply) => {
    return sendAdminShell(reply);
  });

  const adminShellPaths = [
    "/login",
    "/consent",
    "/oauth/device/verify",
    "/dashboard",
    "/sessions",
    "/devices",
    "/audit",
    "/consents",
    "/apps",
    "/federation",
    "/authentication",
    "/interaction-views",
    "/user-attributes",
    "/policies",
    "/events",
    "/administration",
    "/documentation",
  ];

  for (const path of adminShellPaths) {
    app.get(path, async (_request, reply) => sendAdminShell(reply));
  }

  app.get("/assets/admin.css", async (_request, reply) => {
    const css = await readViewAsset("admin.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/assets/admin.js", async (_request, reply) => {
    const js = await readViewAsset("admin.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  app.get("/.well-known/openid-configuration", async () => deps.oidcService.discoveryDocument());
  app.get("/.well-known/jwks.json", async () => deps.oidcService.jwks());

  app.post("/connect/register", async (request, reply) => {
    const input = dynamicClientRegistrationSchema.parse(request.body);

    if (input.app_id && !deps.appService.findAppById(input.app_id)) {
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

    const created = deps.clientService.createClient({
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

    const client = deps.clientService.findClientById(input.client_id);
    if (!client) {
      return reply.status(400).send({ error: "invalid_client", error_description: "Unknown client_id" });
    }
    if (!client.redirectUris.includes(input.redirect_uri)) {
      return reply.status(400).send({ error: "invalid_request", error_description: "redirect_uri not registered for client" });
    }

    const session = getSession(request);
    const requireLogin = !session || input.prompt === "login";
    if (requireLogin) {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/login?${params}`);
    }

    const user = deps.userService.findUserById(session!.userId);
    if (!user) {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/login?${params}`);
    }

    const consentStageEnabled = deps.authenticationFlowService.isStageEnabled("consent");
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

    const responseMode = input.response_mode ?? "query";
    const params: Record<string, string> = {};
    if (input.response_type === "code") {
      const authorizationCode = deps.authService.createAuthorizationCode({
        clientId: input.client_id,
        userId: user.id,
        redirectUri: input.redirect_uri,
        scope: input.scope.split(" "),
        codeChallenge: input.code_challenge,
        codeChallengeMethod: input.code_challenge_method as "S256" | undefined
      });
      params.code = authorizationCode.code;
    } else {
      const tenant = input.tenant ? deps.tenantService.listTenants().find((item) => item.slug === input.tenant) : undefined;
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
        const user = deps.authService.validateUserCredentials(parsed.data.username, parsed.data.password);
        enforcePreCredentialStages({
          user,
          clientId: parsed.data.client_id,
          ip: request.ip,
          captchaToken: parsed.data.captcha_token,
          promptAcknowledged: parsed.data.prompt_acknowledged
        });

        if (deps.authenticationFlowService.isStageEnabled("mfa_totp") && deps.totpService.requiresTotp(user.id)) {
          return reply.status(400).send({ error: "invalid_grant", error_description: "MFA is required for password grant" });
        }

        enforcePostLoginStage({
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
    } catch (err) {
      if (parsed.data.grant_type === "password") {
        await deps.securityService.recordLoginFailure({
          identifier: parsed.data.username,
          ip: request.ip,
          reason: err instanceof Error ? err.message : "unknown"
        });
        deps.auditRepository.log({
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
        return reply.status(err.statusCode).send({ error: "invalid_grant", error_description: err.message });
      }
      throw err;
    }
    return reply.status(400).send({ error: "unsupported_grant_type" });
  });

  app.post("/oauth/device/authorize", async (request, reply) => {
    const input = deviceAuthorizationSchema.parse(request.body);
    const issued = deps.authService.createDeviceAuthorization({
      clientId: input.client_id,
      clientSecret: input.client_secret,
      scope: input.scope
    });
    return reply.status(200).send(issued);
  });

  app.post("/oauth/device/verify", async (request, reply) => {
    const input = deviceVerificationSchema.parse(request.body);
    const result = deps.authService.verifyDeviceUserCode({
      userCode: input.user_code,
      username: input.username,
      password: input.password,
      approve: input.approve
    });
    return reply.status(200).send(result);
  });

  app.post("/oauth/introspect", async (request) => {
    const { token } = introspectSchema.parse(request.body);
    return deps.authService.introspectToken(token);
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
        return reply.status(err.statusCode).send({ error: "invalid_token", error_description: err.message });
      }
      throw err;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const user = deps.authService.validateUserCredentials(input.email, input.password);
      enforcePreCredentialStages({
        user,
        tenantSlug: input.tenantSlug,
        clientId: input.clientId,
        ip: request.ip,
        captchaToken: input.captchaToken,
        promptAcknowledged: input.promptAcknowledged
      });

      if (deps.authenticationFlowService.isStageEnabled("mfa_totp") && deps.totpService.requiresTotp(user.id)) {
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

      enforcePostLoginStage({
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
      await deps.eventHookService.emit("auth.login.succeeded", {
        userId: session.userId,
        clientId: session.clientId,
        sessionId: session.id,
        ip: request.ip
      });
      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });
      return { session, ...tokens };
    } catch (err) {
      await deps.securityService.recordLoginFailure({
        identifier: input.email,
        ip: request.ip,
        reason: err instanceof Error ? err.message : "unknown"
      });
      deps.auditRepository.log({
        type: "login_failed",
        actorType: "user",
        ip: request.ip,
        metadata: { email: input.email }
      });
      await deps.eventHookService.emit("auth.login.failed", {
        email: input.email,
        ip: request.ip,
        error: err instanceof Error ? err.message : "unknown"
      });
      throw err;
    }
  });

  app.post("/auth/login/mfa", async (request, reply) => {
    const input = mfaLoginSchema.parse(request.body);

    try {
      const challenge = deps.totpService.consumeLoginChallenge(input.mfaTicket);
      const user = deps.userService.findUserById(challenge.userId);

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      if (!deps.totpService.verifyUserCode({ userId: user.id, code: input.code })) {
        throw new AuthenticationError("Invalid one-time code");
      }

      const tenant = challenge.tenantSlug ? deps.tenantService.listTenants().find((item) => item.slug === challenge.tenantSlug) : undefined;
      deps.policyService.enforceStagePolicies({
        stage: "mfa_totp",
        user,
        tenantId: tenant?.id,
        clientId: challenge.clientId,
        ip: challenge.ip ?? request.ip
      });

      enforcePostLoginStage({
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

      await deps.eventHookService.emit("auth.login.succeeded", {
        userId: session.userId,
        clientId: session.clientId,
        sessionId: session.id,
        ip: request.ip,
        mfa: "totp"
      });

      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });

      return { session, ...tokens };
    } catch (err) {
      return reply.status(401).send({ error: "invalid_grant", error_description: err instanceof Error ? err.message : "MFA failed" });
    }
  });

  app.get("/auth/federation/providers", async () => deps.federationService.listProviders());

  app.get("/api/admin/federation/providers", async () => deps.federationService.listConfiguredProviders());

  app.get("/api/admin/me", async (request, reply) => {
    const session = getSession(request);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const user = deps.userService.findUserById(session.userId);
    if (!user) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      roles: deps.roleService.resolveNamesForUser(user.id),
      groups: deps.groupService.resolveGroupNamesForUser(user.id),
      permissions: deps.roleService.resolvePermissionsForUser(user.id)
    };
  });

  app.get("/api/account/mfa/totp", async (request, reply) => {
    const auth = requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    return deps.totpService.getStatus(auth.user.id);
  });

  app.post("/api/account/mfa/totp/enroll", async (request, reply) => {
    const auth = requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    return deps.totpService.startEnrollment(auth.user);
  });

  app.post("/api/account/mfa/totp/verify", async (request, reply) => {
    const auth = requireSessionUser(request, reply);
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
    const auth = requireSessionUser(request, reply);
    if (!auth) {
      return;
    }

    deps.totpService.disable(auth.user.id);
    return reply.status(204).send();
  });

  app.get("/api/admin/settings", async () => deps.instanceSettingsService.getSettings());
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
    const result = await deps.databaseMigrationService.migrateFromSqlite({
      sqlitePath: input.sqlitePath ?? deps.instanceSettingsService.getSettings().databasePath,
      provider: input.provider,
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    deps.instanceSettingsService.updateSettings({
      databaseProvider: input.provider,
      externalDatabaseUrl: input.externalDatabaseUrl
    });

    return reply.status(200).send(result);
  });

  app.get("/api/admin/authentication/flows", async () => deps.authenticationFlowService.listFlows());
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

  app.get("/api/admin/user-attributes", async () => deps.userAttributeService.listAttributes());
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
    deps.userAttributeService.deleteAttribute(id);
    return reply.status(204).send();
  });
  app.put("/api/admin/user-attributes/:id/groups", async (request) => {
    const { id } = request.params as { id: string };
    const input = setUserAttributeGroupAssignmentSchema.parse(request.body);
    return deps.userAttributeService.setGroupAssignment({ attributeId: id, ...input });
  });
  app.delete("/api/admin/user-attributes/:id/groups/:groupId", async (request, reply) => {
    const { id, groupId } = request.params as { id: string; groupId: string };
    deps.userAttributeService.removeGroupAssignment({ attributeId: id, groupId });
    return reply.status(204).send();
  });

  app.get("/api/admin/policies", async () => deps.policyService.listPolicies());
  app.post("/api/admin/policies", async (request, reply) => {
    const input = createPolicySchema.parse(request.body);
    const policy = deps.policyService.createPolicy({
      key: input.key,
      name: input.name,
      description: input.description,
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
      stageBindings: input.stageBindings,
      javascriptCode: input.javascriptCode,
      enabled: input.enabled
    });
  });
  app.delete("/api/admin/policies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.policyService.deletePolicy(id);
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
      config: input.config
    });
  });
  app.delete("/api/admin/policies/:id/assignments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = removePolicyAssignmentSchema.parse(request.body);
    deps.policyService.removeAssignment({
      policyId: id,
      scopeType: input.scopeType,
      scopeId: input.scopeId
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/events/hooks", async () => deps.eventHookService.listHooks());
  app.get("/api/admin/events/types", async () => deps.eventHookService.listSystemEventTypes());
  app.post("/api/admin/events/hooks", async (request, reply) => {
    const input = createEventHookSchema.parse(request.body);
    const hook = deps.eventHookService.createHook(input);
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
    deps.eventHookService.deleteHook(id);
    return reply.status(204).send();
  });
  app.get("/api/admin/events/notifications", async (request) => {
    const { limit } = request.query as { limit?: string };
    return deps.eventHookService.listNotifications(limit ? Number(limit) : 100);
  });

  app.post("/api/admin/federation/providers", async (request, reply) => {
    const input = createFederationProviderSchema.parse(request.body);
    reply.code(201);
    const provider = deps.federationService.createProvider(input);
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
    const provider = deps.federationService.updateProvider(id, input);
    return {
      ...provider,
      clientSecret: undefined,
      hasSecret: true,
      secretPreview: `${provider.clientSecret.slice(0, 4)}...${provider.clientSecret.slice(-4)}`
    };
  });
  app.delete("/api/admin/federation/providers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.federationService.deleteProvider(id);
    return reply.status(204).send();
  });

  app.get("/auth/federation/:providerId/start", async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const redirectAfterLogin = asSafeRedirect((request.query as { redirect?: string }).redirect);
    const destination = deps.federationService.getAuthorizationRedirect(providerId, redirectAfterLogin);
    return reply.redirect(destination);
  });

  app.get("/auth/federation/:providerId/callback", async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.status(400).send({ error: "invalid_request", message: "Missing code or state" });
    }

    const completed = await deps.federationService.completeLogin({ providerId, code, state });
    deps.policyService.enforceStagePolicies({
      stage: "federation",
      user: completed.user,
      clientId: "sso-admin-ui",
      ip: request.ip
    });

    enforcePostLoginStage({
      user: completed.user,
      clientId: "sso-admin-ui",
      ip: request.ip
    });

    const session = deps.authService.sessionRepository.create({
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

    deps.auditRepository.log({
      type: "login",
      actorId: completed.user.id,
      actorType: "user",
      clientId: "sso-admin-ui",
      metadata: { method: "federation", providerId, sessionId: session.id }
    });

    reply.setCookie("sid", session.id, {
      httpOnly: true,
      secure: deps.instanceSettingsService.shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return reply.redirect(asSafeRedirect(completed.redirectAfterLogin));
  });

  app.post("/auth/logout", async (request, reply) => {
    const session = getSession(request);
    if (session) {
      deps.securityService.revokeSessionObservation(session.id);
      enforceInvalidationForSession({ session, ip: request.ip });
      deps.auditRepository.log({
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
    const { post_logout_redirect_uri, state } = request.query as Record<string, string>;
    const session = getSession(request);
    if (session) {
      deps.securityService.revokeSessionObservation(session.id);
      enforceInvalidationForSession({ session, ip: request.ip });
    }
    reply.clearCookie("sid", { path: "/" });
    if (post_logout_redirect_uri) {
      const url = new URL(post_logout_redirect_uri);
      if (state) url.searchParams.set("state", state);
      return reply.redirect(url.toString());
    }
    return reply.redirect("/login");
  });

  app.get("/oauth/frontchannel-logout", async (request, reply) => {
    const input = frontChannelLogoutSchema.parse(request.query);
    const now = new Date();

    const matchingSessions = deps.authService.sessionRepository.list().filter((session) => {
      if (input.sid && session.id === input.sid) {
        return true;
      }
      if (input.sub && session.userId === input.sub) {
        return true;
      }
      return false;
    });

    for (const session of matchingSessions) {
      enforceInvalidationForSession({ session, ip: request.ip });
      deps.securityService.revokeSessionObservation(session.id);
      if (!session.revokedAt) {
        deps.authService.sessionRepository.revoke(session.id, now);
      }
    }

    reply.clearCookie("sid", { path: "/" });

    if (input.post_logout_redirect_uri) {
      const redirectUrl = new URL(input.post_logout_redirect_uri);
      if (input.state) {
        redirectUrl.searchParams.set("state", input.state);
      }
      return reply.redirect(redirectUrl.toString());
    }

    return reply.type("text/html; charset=utf-8").send("<!DOCTYPE html><html><body>Front-channel logout complete</body></html>");
  });

  app.post("/oauth/backchannel-logout", async (request, reply) => {
    const input = backChannelLogoutSchema.parse(request.body);
    const now = new Date();

    const matchingSessions = deps.authService.sessionRepository.list().filter((session) => {
      if (input.sid && session.id === input.sid) {
        return true;
      }
      if (input.sub && session.userId === input.sub) {
        return true;
      }
      return false;
    });

    for (const session of matchingSessions) {
      enforceInvalidationForSession({ session, ip: request.ip });
      deps.securityService.revokeSessionObservation(session.id);
      if (!session.revokedAt) {
        deps.authService.sessionRepository.revoke(session.id, now);
      }
    }

    return reply.status(200).send({ revoked: matchingSessions.length });
  });

  app.post("/auth/recovery/request", async (request, reply) => {
    const input = recoveryRequestSchema.parse(request.body);
    const user = deps.userService.findUserByEmail(input.identifier) ?? deps.userService.findUserByUsername(input.identifier);

    // Keep enumeration-safe response semantics regardless of account existence.
    if (!user || !user.active) {
      return reply.status(200).send({ status: "sent_if_account_exists" });
    }

    try {
      if (isStageEnabledForDesignation("recovery", "identification")) {
        enforcePoliciesForStage({
          stage: "identification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      const challenge = deps.recoveryService.createChallenge({ userId: user.id });

      if (isStageEnabledForDesignation("recovery", "email_verification")) {
        enforcePoliciesForStage({
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
        return reply.status(err.statusCode).send({ error: "invalid_request", error_description: err.message });
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

    const user = deps.userService.findUserById(challenge.userId);
    if (!user || !user.active) {
      return reply.status(401).send({ error: "invalid_grant", error_description: "Recovery user not found" });
    }

    try {
      if (isStageEnabledForDesignation("recovery", "identification")) {
        enforcePoliciesForStage({
          stage: "identification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (isStageEnabledForDesignation("recovery", "email_verification")) {
        if (!input.verificationCode || !deps.recoveryService.verifyCode({ ticket: input.recoveryTicket, code: input.verificationCode })) {
          return reply.status(401).send({ error: "invalid_grant", error_description: "Email verification failed" });
        }
        enforcePoliciesForStage({
          stage: "email_verification",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (isStageEnabledForDesignation("recovery", "mfa_totp") && deps.totpService.requiresTotp(user.id)) {
        if (!input.code || !deps.totpService.verifyUserCode({ userId: user.id, code: input.code })) {
          return reply.status(401).send({ error: "invalid_grant", error_description: "Invalid one-time code" });
        }
        enforcePoliciesForStage({
          stage: "mfa_totp",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      if (isStageEnabledForDesignation("recovery", "prompt") && input.promptAcknowledged !== true) {
        return reply.status(400).send({ error: "invalid_request", error_description: "Prompt acknowledgement is required" });
      }

      if (isStageEnabledForDesignation("recovery", "user_write")) {
        deps.userService.resetPassword(user.id, input.newPassword);
        enforcePoliciesForStage({
          stage: "user_write",
          user,
          tenantSlug: input.tenantSlug,
          clientId: input.clientId,
          ip: request.ip
        });
      }

      deps.recoveryService.consume(input.recoveryTicket);

      if (!isStageEnabledForDesignation("recovery", "user_login")) {
        return reply.status(200).send({ status: "password_reset" });
      }

      enforcePoliciesForStage({
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
        secure: deps.instanceSettingsService.shouldUseSecureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });

      return { session, ...tokens, recovery: true };
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_grant", error_description: err.message });
      }
      throw err;
    }
  });

  app.get("/api/admin/users", async () => deps.userService.listUsers());
  app.post("/api/admin/users", async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    deps.policyService.enforceUserCreationPolicies(input.password);
    const user = deps.userService.createUser(input);
    deps.auditRepository.log({ type: "user_created", actorType: "system", metadata: { userId: user.id, email: user.email } });
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
    const { appId, isServiceUser, email, username, givenName, familyName, active, groupIds, customAttributes } = updateUserSchema.parse(request.body);
    if (appId !== undefined || isServiceUser !== undefined || email !== undefined || username !== undefined || givenName !== undefined || familyName !== undefined) {
      deps.userService.updateUserProfile(id, { appId, isServiceUser, email, username, givenName, familyName });
    }
    if (active !== undefined) deps.userService.setUserActive(id, active);
    if (customAttributes) deps.userService.setCustomAttributes(id, customAttributes);
    if (groupIds) {
      // Reset to exact set by removing all currently assigned groups first.
      const existingGroupIds = deps.groupService.listGroupIdsForUser(id);
      const next = new Set(groupIds);
      for (const groupId of existingGroupIds) {
        if (!next.has(groupId)) {
          deps.groupService.removeUserFromGroup({ userId: id, groupId });
        }
      }
      for (const groupId of groupIds) {
        deps.groupService.assignUserToGroup({ userId: id, groupId });
      }
    }
    await deps.eventHookService.emit("user.updated", {
      userId: id,
      appId,
      isServiceUser,
      active,
      email,
      username,
      givenName,
      familyName,
      updatedGroupIds: groupIds,
      updatedCustomAttributes: customAttributes ? Object.keys(customAttributes) : undefined
    });
    return { id, appId, isServiceUser, active, email, username, givenName, familyName };
  });
  app.post("/api/admin/users/:id/reset-password", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { password } = resetUserPasswordSchema.parse(request.body);

    deps.policyService.enforceUserCreationPolicies(password);
    deps.userService.resetPassword(id, password);

    const now = new Date();
    const userSessions = deps.authService.sessionRepository.list().filter((session) => session.userId === id && !session.revokedAt);
    for (const session of userSessions) {
      deps.authService.sessionRepository.revoke(session.id, now);
    }

    deps.auditRepository.log({
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
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.userService.deleteUser(id);
    await deps.eventHookService.emit("user.deleted", {
      userId: id
    });
    return reply.status(204).send();
  });
  app.get("/api/admin/clients", async () => deps.clientService.listClients());
  app.get("/api/admin/scopes", async () => deps.scopeService.listScopes());
  app.post("/api/admin/scopes", async (request, reply) => {
    const input = createScopeSchema.parse(request.body);
    const scope = deps.scopeService.createScope(input);
    reply.code(201);
    return scope;
  });
  app.delete("/api/admin/scopes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.scopeService.deleteScope(id);
    return reply.status(204).send();
  });
  app.post("/api/admin/clients", async (request, reply) => {
    const input = createClientSchema.parse(request.body);
    const client = deps.clientService.createClient(input);
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
    const client = deps.clientService.updateClient(id, input);
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
    deps.clientService.deleteClient(id);
    await deps.eventHookService.emit("client.deleted", {
      clientId: id
    });
    return reply.status(204).send();
  });
  app.get("/api/admin/roles", async () => deps.roleService.listRoles());
  app.post("/api/admin/roles", async (request, reply) => {
    const input = createRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.createRole(input);
  });
  app.delete("/api/admin/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.roleService.deleteRole(id);
    return reply.status(204).send();
  });
  app.put("/api/admin/roles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateRoleSchema.parse(request.body);
    const updated = deps.roleService.updateRole(id, input);
    if (!updated) return reply.status(404).send({ error: "Role not found" });
    return updated;
  });
  app.post("/api/admin/role-assignments", async (request, reply) => {
    const input = assignRoleSchema.parse(request.body);
    reply.code(201);
    return deps.roleService.assignRole(input);
  });
  app.get("/api/admin/groups", async () => deps.groupService.listGroups());
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
    deps.groupService.deleteGroup(id);
    return reply.status(204).send();
  });
  app.post("/api/admin/group-role-assignments", async (request, reply) => {
    const input = assignGroupRoleSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.assignRoleToGroup(input);
  });
  app.delete("/api/admin/group-role-assignments", async (request, reply) => {
    const input = assignGroupRoleSchema.parse(request.body);
    deps.groupService.removeRoleFromGroup(input);
    return reply.status(204).send();
  });
  app.post("/api/admin/user-groups", async (request, reply) => {
    const input = assignUserGroupSchema.parse(request.body);
    reply.code(201);
    return deps.groupService.assignUserToGroup(input);
  });
  app.delete("/api/admin/user-groups", async (request, reply) => {
    const input = assignUserGroupSchema.parse(request.body);
    deps.groupService.removeUserFromGroup(input);
    return reply.status(204).send();
  });
  app.get("/api/admin/tenants", async () => deps.tenantService.listTenants());
  app.get("/api/admin/apps", async () => deps.appService.listApps());
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
  app.delete("/api/admin/apps/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.appService.deleteApp(id);
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

  app.get("/api/admin/sessions", async () => deps.authService.sessionRepository.list());
  app.delete("/api/admin/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.securityService.revokeSessionObservation(id);
    deps.authService.sessionRepository.revoke(id, new Date());
    deps.auditRepository.log({ type: "session_revoked", actorType: "system", metadata: { sessionId: id } });
    await deps.eventHookService.emit("session.revoked", {
      sessionId: id,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/devices", async () => {
    const clients = deps.clientService.listClients();
    const deviceClientIds = new Set(
      clients
        .filter((client) => client.grants.includes("device_code"))
        .map((client) => client.id)
    );
    const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

    const sessions = deps.authService.sessionRepository.list()
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
    deps.auditRepository.log({
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
    deps.authService.sessionRepository.revoke(id, new Date());
    deps.auditRepository.log({
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

  app.get("/api/admin/consents", async () => deps.authService.consentRepository.list());
  app.delete("/api/admin/consents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.authService.consentRepository.revoke(id);
    deps.auditRepository.log({ type: "consent_revoked", actorType: "system", metadata: { consentId: id } });
    await deps.eventHookService.emit("consent.revoked", {
      consentId: id,
      source: "admin"
    });
    return reply.status(204).send();
  });

  app.get("/api/admin/audit", async (request) => {
    const { limit } = request.query as { limit?: string };
    return deps.auditRepository.list(limit ? Number(limit) : 200);
  });

  app.get("/users", async () => deps.userService.listUsers());
  app.get("/clients", async () => deps.clientService.listClients());
  app.get("/roles", async () => deps.roleService.listRoles());
  app.get("/groups", async () => deps.groupService.listGroups());
  app.get("/tenants", async () => deps.tenantService.listTenants());
  app.post("/users", async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    deps.policyService.enforceUserCreationPolicies(input.password);
    const user = deps.userService.createUser(input);
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

  function getPortalSession(request: any) {
    const sid = request.cookies?.sid;
    if (!sid) return null;
    const session = deps.authService.sessionRepository.findById(sid);
    if (!session || session.expiresAt.getTime() < Date.now() || session.revokedAt) return null;
    return session;
  }

  // GET /api/portal/me — current user profile + apps + custom attributes
  app.get("/api/portal/me", async (request, reply) => {
    const session = getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const user = deps.userService.findUserById(session.userId);
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    const userApps = deps.appService.listApps().filter(a => {
      // app directly assigned to user, or user has no appId restriction
      return !user.appId || a.id === user.appId;
    });
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      customAttributes: user.customAttributes,
      appId: user.appId,
      apps: userApps.map(a => ({ id: a.id, name: a.name, description: a.description, icon: a.icon, url: a.url }))
    };
  });

  // PATCH /api/portal/profile — update own profile
  app.patch("/api/portal/profile", async (request, reply) => {
    const session = getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const input = portalUpdateProfileSchema.parse(request.body);
    if (input.givenName !== undefined || input.familyName !== undefined || input.email !== undefined || input.username !== undefined) {
      deps.userService.updateUserProfile(session.userId, {
        givenName: input.givenName,
        familyName: input.familyName,
        email: input.email,
        username: input.username
      });
    }
    if (input.customAttributes !== undefined) {
      deps.userService.setCustomAttributes(session.userId, input.customAttributes);
    }
    return reply.status(204).send();
  });

  // POST /api/portal/change-password — change own password (requires current pw)
  app.post("/api/portal/change-password", async (request, reply) => {
    const session = getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    const { currentPassword, newPassword } = portalChangePasswordSchema.parse(request.body);
    const user = deps.userService.findUserById(session.userId);
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return reply.status(400).send({ error: "InvalidPassword", message: "Current password is incorrect" });
    }
    deps.policyService.enforceUserCreationPolicies(newPassword);
    deps.userService.resetPassword(session.userId, newPassword);
    return reply.status(204).send();
  });

  // DELETE /api/portal/account — delete own account
  app.delete("/api/portal/account", async (request, reply) => {
    const session = getPortalSession(request);
    if (!session) return reply.status(401).send({ error: "unauthorized" });
    // Revoke all sessions first
    const allSessions = deps.authService.sessionRepository.list().filter(s => s.userId === session.userId && !s.revokedAt);
    const now = new Date();
    for (const s of allSessions) {
      deps.securityService.revokeSessionObservation(s.id);
      deps.authService.sessionRepository.revoke(s.id, now);
    }
    deps.userService.deleteUser(session.userId);
    reply.clearCookie("sid", { path: "/" });
    return reply.status(204).send();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.name, message: error.message });
    }
    if (typeof error === "object" && error !== null && "issues" in error) {
      return reply.status(422).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: (error as { issues: unknown }).issues
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "InternalServerError", message: "Unexpected server error" });
  });
};
