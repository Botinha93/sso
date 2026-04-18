import type { FastifyInstance } from "fastify";
import { AppError, AuthenticationError } from "../core/errors.js";
import { readViewAsset } from "./view-assets.js";
import {
  assignRoleSchema,
  authorizationCodeTokenSchema,
  authorizeSchema,
  createTenantSchema,
  createRoleSchema,
  createUserSchema,
  loginSchema,
  refreshTokenSchema,
  revokeTokenSchema,
  tokenSchema
} from "./schemas.js";
import { AuthService } from "../services/auth-service.js";
import { ClientService } from "../services/client-service.js";
import { OidcService } from "../services/oidc-service.js";
import { RoleService } from "../services/role-service.js";
import { TenantService } from "../services/tenant-service.js";
import { UserService } from "../services/user-service.js";

interface RouteDeps {
  authService: AuthService;
  clientService: ClientService;
  oidcService: OidcService;
  roleService: RoleService;
  tenantService: TenantService;
  userService: UserService;
}

export const registerRoutes = async (app: FastifyInstance, deps: RouteDeps) => {
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
    const loginResult = await deps.authService.login({
      email: input.email,
      password: input.password,
      clientId: input.client_id,
      scope: input.scope.split(" "),
      tenantSlug: input.tenant
    });
    const { user } = loginResult;

    const authorizationCode = deps.authService.createAuthorizationCode({
      clientId: input.client_id,
      userId: user.id,
      redirectUri: input.redirect_uri,
      scope: input.scope.split(" "),
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method
    });

    const redirectUrl = new URL(input.redirect_uri);
    redirectUrl.searchParams.set("code", authorizationCode.code);

    if (input.state) {
      redirectUrl.searchParams.set("state", input.state);
    }

    return reply.redirect(redirectUrl.toString());
  });

  app.post("/oauth/token", async (request) => {
    const input = tokenSchema.parse(request.body);

    if (input.grant_type === "authorization_code") {
      const grant = authorizationCodeTokenSchema.parse(input);
      return deps.authService.exchangeAuthorizationCode({
        code: grant.code,
        clientId: grant.client_id,
        clientSecret: grant.client_secret,
        redirectUri: grant.redirect_uri,
        codeVerifier: grant.code_verifier
      });
    }

    const grant = refreshTokenSchema.parse(input);
    return deps.authService.refreshTokens({
      refreshToken: grant.refresh_token,
      clientId: grant.client_id,
      clientSecret: grant.client_secret
    });
  });

  app.post("/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    const { session, tokens } = await deps.authService.login(input);

    return {
      session,
      ...tokens
    };
  });

  app.get("/oauth/userinfo", async (request) => {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AuthenticationError("Missing bearer token");
    }

    const accessToken = authorization.slice("Bearer ".length);
    return deps.authService.getUserInfoFromAccessToken(accessToken);
  });

  app.get("/users", async () => deps.userService.listUsers());
  app.get("/clients", async () => deps.clientService.listClients());
  app.post("/users", async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    const user = deps.userService.createUser(input);
    reply.code(201);
    return {
      id: user.id,
      email: user.email,
      username: user.username
    };
  });

  app.get("/roles", async () => deps.roleService.listRoles());
  app.post("/roles", async (request, reply) => {
    const input = createRoleSchema.parse(request.body);
    const role = deps.roleService.createRole(input);
    reply.code(201);
    return role;
  });

  app.post("/role-assignments", async (request, reply) => {
    const input = assignRoleSchema.parse(request.body);
    const assignment = deps.roleService.assignRole(input);
    reply.code(201);
    return assignment;
  });

  app.get("/tenants", async () => deps.tenantService.listTenants());
  app.post("/tenants", async (request, reply) => {
    const input = createTenantSchema.parse(request.body);
    const tenant = deps.tenantService.createTenant(input);
    reply.code(201);
    return tenant;
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
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message
      });
    }

    if (typeof error === "object" && error !== null && "issues" in error) {
      return reply.status(422).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: (error as { issues: unknown }).issues
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: "InternalServerError",
      message: "Unexpected server error"
    });
  });
};
