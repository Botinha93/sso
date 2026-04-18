import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError, AuthenticationError } from "../core/errors.js";
import { readViewAsset } from "./view-assets.js";
import {
  assignGroupRoleSchema,
  assignRoleSchema,
  assignUserGroupSchema,
  authorizationCodeTokenSchema,
  authorizeSchema,
  clientCredentialsSchema,
  createClientSchema,
  createScopeSchema,
  createAuthenticationFlowSchema,
  createFederationProviderSchema,
  createGroupSchema,
  createUserAttributeSchema,
  createPolicySchema,
  createEventHookSchema,
  createTenantSchema,
  createRoleSchema,
  updateRoleSchema,
  createUserSchema,
  introspectSchema,
  loginSchema,
  oidcRevokeSchema,
  refreshTokenSchema,
  revokeTokenSchema,
  tokenSchema,
  setUserAttributeGroupAssignmentSchema,
  setPolicyAssignmentSchema,
  removePolicyAssignmentSchema,
  setupInitializeSchema,
  updateAuthenticationFlowSchema,
  updateClientSchema,
  updateEventHookSchema,
  updateFederationProviderSchema,
  updatePolicySchema,
  updateUserAttributeSchema,
  updateUserSchema
} from "./schemas.js";
import { AuthService } from "../services/auth-service.js";
import { AuthenticationFlowService } from "../services/authentication-flow-service.js";
import { ClientService } from "../services/client-service.js";
import { FederationService } from "../services/federation-service.js";
import { GroupService } from "../services/group-service.js";
import { OidcService } from "../services/oidc-service.js";
import { RoleService } from "../services/role-service.js";
import { ScopeService } from "../services/scope-service.js";
import { SetupService } from "../services/setup-service.js";
import { TenantService } from "../services/tenant-service.js";
import { UserService } from "../services/user-service.js";
import { UserAttributeService } from "../services/user-attribute-service.js";
import { PolicyService } from "../services/policy-service.js";
import { EventHookService } from "../services/event-hook-service.js";
import type { AuditRepository } from "../repositories/contracts.js";

interface RouteDeps {
  authService: AuthService;
  authenticationFlowService: AuthenticationFlowService;
  clientService: ClientService;
  federationService: FederationService;
  groupService: GroupService;
  oidcService: OidcService;
  roleService: RoleService;
  scopeService: ScopeService;
  setupService: SetupService;
  tenantService: TenantService;
  userService: UserService;
  userAttributeService: UserAttributeService;
  policyService: PolicyService;
  eventHookService: EventHookService;
  auditRepository: AuditRepository;
}

export const registerRoutes = async (app: FastifyInstance, deps: RouteDeps) => {

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

  function toResource(path: string): string | undefined {
    const relative = path.replace(/^\/api\/admin\/?/, "");
    const top = relative.split("/")[0];
    const map: Record<string, string> = {
      users: "users",
      clients: "clients",
      roles: "roles",
      groups: "groups",
      tenants: "tenants",
      sessions: "sessions",
      audit: "audit_log",
      consents: "consents",
      federation: "federation_providers",
      authentication: "authentication_flows",
      "user-attributes": "user_attributes",
      policies: "policies",
      events: "events",
      scopes: "scopes",
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
    if (!csrfProtectedMethods.has(request.method)) return;
    if (csrfExemptPaths.has(request.url.split("?")[0])) return;
    // Only enforce CSRF on admin and auth endpoints
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/admin") || path === "/auth/logout") {
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return { csrf_token: token };
  });

  app.get("/", async (_request, reply) => {
    const html = await readViewAsset("admin.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

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

  app.get("/oauth/authorize", async (request, reply) => {
    const input = authorizeSchema.parse(request.query);

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
    const hasConsented = input.consent === "approve";
    if (consentStageEnabled && !hasConsented && input.prompt !== "none") {
      const params = new URLSearchParams(request.query as Record<string, string>).toString();
      return reply.redirect(`/consent?${params}`);
    }
    if (consentStageEnabled && !hasConsented && input.prompt === "none") {
      const redirectUrl = new URL(input.redirect_uri);
      redirectUrl.searchParams.set("error", "interaction_required");
      if (input.state) redirectUrl.searchParams.set("state", input.state);
      return reply.redirect(redirectUrl.toString());
    }

    const authorizationCode = deps.authService.createAuthorizationCode({
      clientId: input.client_id,
      userId: user.id,
      redirectUri: input.redirect_uri,
      scope: input.scope.split(" "),
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method as "S256" | undefined
    });

    const responseMode = input.response_mode ?? "query";
    const params: Record<string, string> = { code: authorizationCode.code };
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
          codeVerifier: parsed.data.code_verifier
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
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: "invalid_grant", error_description: err.message });
      }
      throw err;
    }
    return reply.status(400).send({ error: "unsupported_grant_type" });
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
      return await deps.authService.getUserInfoFromAccessToken(authorization.slice("Bearer ".length));
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
      const identifier = input.email.trim();
      const user = deps.userService.findUserByEmail(identifier) ?? deps.userService.findUserByUsername(identifier);
      const tenant = input.tenantSlug ? deps.tenantService.listTenants().find((item) => item.slug === input.tenantSlug) : undefined;
      if (user) {
        deps.policyService.enforceLoginPolicies({ user, tenantId: tenant?.id });
      }
      const { session, tokens } = await deps.authService.login(input);
      await deps.eventHookService.emit("auth.login.succeeded", {
        userId: session.userId,
        clientId: session.clientId,
        sessionId: session.id,
        ip: request.ip
      });
      reply.setCookie("sid", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8
      });
      return { session, ...tokens };
    } catch (err) {
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
    const policy = deps.policyService.createPolicy(input);
    reply.code(201);
    return policy;
  });
  app.put("/api/admin/policies/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = updatePolicySchema.parse(request.body);
    return deps.policyService.updatePolicy(id, input);
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

    const session = deps.authService.sessionRepository.create({
      userId: completed.user.id,
      clientId: "sso-admin-ui",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return reply.redirect(asSafeRedirect(completed.redirectAfterLogin));
  });

  app.post("/auth/logout", async (request, reply) => {
    const session = getSession(request);
    if (session) {
      deps.auditRepository.log({
        type: "logout",
        actorId: session.userId,
        actorType: "user",
        metadata: { sessionId: session.id }
      });
    }
    reply.clearCookie("sid", { path: "/" });
    return reply.redirect("/login");
  });

  app.get("/oauth/logout", async (request, reply) => {
    const { post_logout_redirect_uri, state } = request.query as Record<string, string>;
    reply.clearCookie("sid", { path: "/" });
    if (post_logout_redirect_uri) {
      const url = new URL(post_logout_redirect_uri);
      if (state) url.searchParams.set("state", state);
      return reply.redirect(url.toString());
    }
    return reply.redirect("/login");
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
    const { active, groupIds, customAttributes } = updateUserSchema.parse(request.body);
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
    return { id, active };
  });
  app.delete("/api/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.userService.deleteUser(id);
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
    reply.code(201);
    return { ...client, secret: undefined, secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}` };
  });
  app.put("/api/admin/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateClientSchema.parse(request.body);
    const client = deps.clientService.updateClient(id, input);
    if (!client) return reply.status(404).send({ error: "not_found" });
    return { ...client, secret: undefined, secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}` };
  });
  app.delete("/api/admin/clients/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.clientService.deleteClient(id);
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
  app.post("/api/admin/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);
    reply.code(201);
    return deps.tenantService.createTenant(input);
  });

  app.get("/api/admin/sessions", async () => deps.authService.sessionRepository.list());
  app.delete("/api/admin/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.authService.sessionRepository.revoke(id, new Date());
    deps.auditRepository.log({ type: "session_revoked", actorType: "system", metadata: { sessionId: id } });
    return reply.status(204).send();
  });

  app.get("/api/admin/consents", async () => deps.authService.consentRepository.list());
  app.delete("/api/admin/consents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.authService.consentRepository.revoke(id);
    deps.auditRepository.log({ type: "consent_revoked", actorType: "system", metadata: { consentId: id } });
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
