import { createHash, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { AppError, AuthenticationError, ValidationError } from "../core/errors.js";
import type { JWTPayload } from "jose";
import type { OAuthClient, User } from "../domain/models.js";
import type {
  AccessTokenRepository,
  AuditRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ConsentRepository,
  RefreshTokenRepository,
  SessionRepository,
  TenantRepository
} from "../repositories/contracts.js";
import { verifyPassword } from "../security/password.js";
import { hashOpaqueToken } from "../security/token-hash.js";
import { JwtService, resolveAccessTokenTtlSeconds, resolveRefreshTokenTtlSeconds } from "../security/jwt.js";
import { AuthenticationFlowService } from "./authentication-flow-service.js";
import { GroupService } from "./group-service.js";
import { RoleService } from "./role-service.js";
import { SecurityService } from "./security-service.js";
import { ServiceIdentityService } from "./service-identity-service.js";
import { UserService } from "./user-service.js";
import {
  buildAccessTokenAuthorizationClaims,
  buildScopeGatedClaims,
  claimsWithoutSubject,
  type ScopeClaimResolverContext
} from "../domain/oidc-scopes.js";

interface DeviceAuthorizationRecord {
  deviceCode: string;
  userCode: string;
  clientId: string;
  scope: string[];
  createdAt: Date;
  expiresAt: Date;
  intervalSeconds: number;
  status: "pending" | "approved" | "denied" | "consumed";
  userId?: string;
  lastPolledAt?: Date;
}

interface CibaAuthorizationRecord {
  authReqId: string;
  clientId: string;
  scope: string[];
  loginHint: string;
  bindingMessage?: string;
  deliveryMode: "poll" | "ping" | "push";
  clientNotificationEndpoint?: string;
  clientNotificationToken?: string;
  userCode?: string;
  createdAt: Date;
  expiresAt: Date;
  intervalSeconds: number;
  status: "pending" | "approved" | "denied" | "consumed";
  userId?: string;
  lastPolledAt?: Date;
}

export class AuthService {
  private readonly deviceAuthorizations = new Map<string, DeviceAuthorizationRecord>();
  private readonly cibaAuthorizations = new Map<string, CibaAuthorizationRecord>();

  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService,
    private readonly authenticationFlowService: AuthenticationFlowService,
    private readonly clientRepository: ClientRepository,
    readonly sessionRepository: SessionRepository,
    private readonly authorizationCodeRepository: AuthorizationCodeRepository,
    readonly consentRepository: ConsentRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly accessTokenRepository: AccessTokenRepository,
    private readonly tenantRepository: TenantRepository,
    readonly jwtService: JwtService,
    readonly auditRepository: AuditRepository,
    private readonly securityService: SecurityService,
    private readonly serviceIdentityService?: ServiceIdentityService
  ) {}

  async login(input: {
    email: string;
    password: string;
    clientId: string;
    scope: string[];
    tenantSlug?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("authorization_code");
    await this.authenticationFlowService.assertStageEnabled("password");

    const user = await this.validateUserCredentials(input.email, input.password);
    return this.completeLoginForUser({
      userId: user.id,
      clientId: input.clientId,
      scope: input.scope,
      tenantSlug: input.tenantSlug
    });
  }

  async validateUserCredentials(identifier: string, password: string): Promise<User> {
    const normalized = identifier.trim();
    await this.securityService.assertLoginAllowed(normalized);
    const user = await this.userService.findUserByEmail(normalized) ?? await this.userService.findUserByUsername(normalized);

    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      throw new AuthenticationError("Invalid credentials");
    }

    return user;
  }

  async completeLoginForUser(input: {
    userId: string;
    clientId: string;
    scope: string[];
    tenantSlug?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const user = await this.userService.findUserById(input.userId);
    if (!user || !user.active) {
      throw new AuthenticationError("User no longer exists");
    }

    const client = await this.requireClient(input.clientId);
    await this.assertClientSupportsActiveFlow(client);
    const allowedScope = input.scope.filter((scope) => client.allowedScopes.includes(scope));
    const tenant = input.tenantSlug ? await this.tenantRepository.findBySlug(input.tenantSlug) : undefined;

    const session = await this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    const tokens = await this.issuePersistedTokens({
      user,
      client,
      sessionId: session.id,
      scope: allowedScope,
      tenantId: tenant?.id
    });

    await this.auditRepository.log({
      type: "login",
      actorId: user.id,
      actorType: "user",
      clientId: client.id,
      ip: input.ip,
      metadata: { sessionId: session.id, userAgent: input.userAgent }
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: user.id,
      clientId: client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    return {
      user,
      session,
      tenant,
      tokens
    };
  }

  async createAuthorizationCode(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string[];
    codeChallenge?: string;
    codeChallengeMethod?: "S256";
  }) {
    await this.authenticationFlowService.assertGrantSupported("authorization_code");
    const client = await this.requireClient(input.clientId);
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("authorization_code")) {
      throw new AuthenticationError("Client does not support authorization_code grant");
    }

    if (!client.redirectUris.includes(input.redirectUri)) {
      throw new ValidationError("Invalid redirect_uri for client");
    }

    if (client.requirePkce && !input.codeChallenge) {
      throw new ValidationError("PKCE is required for this client");
    }

    this.consentRepository.upsert({
      userId: input.userId,
      clientId: client.id,
      scope: input.scope.filter((scope) => client.allowedScopes.includes(scope))
    });

    return this.authorizationCodeRepository.create({
      code: nanoid(48),
      clientId: client.id,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scope: input.scope.filter((scope) => client.allowedScopes.includes(scope)),
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    });
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    codeVerifier?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const authorizationCode = await this.authorizationCodeRepository.consume(input.code);

    if (!authorizationCode) {
      throw new ValidationError("Authorization code is invalid or already used");
    }

    if (authorizationCode.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Authorization code has expired");
    }

    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });

    if (!client.grants.includes("authorization_code")) {
      throw new AuthenticationError("Client does not support authorization_code grant");
    }

    if (authorizationCode.clientId !== client.id || authorizationCode.redirectUri !== input.redirectUri) {
      throw new ValidationError("Authorization code does not match client request");
    }

    if (authorizationCode.codeChallenge) {
      if (!input.codeVerifier) {
        throw new ValidationError("code_verifier is required for this authorization code");
      }

      const challenge = createHash("sha256")
        .update(input.codeVerifier)
        .digest("base64url");

      if (challenge !== authorizationCode.codeChallenge) {
        throw new ValidationError("code_verifier does not satisfy the stored PKCE challenge");
      }
    }

    const user = await this.userService.findUserById(authorizationCode.userId);

    if (!user) {
      throw new AuthenticationError("User no longer exists");
    }

    const session = await this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: user.id,
      clientId: client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    return this.issuePersistedTokens({
      user,
      client,
      sessionId: session.id,
      scope: authorizationCode.scope
    });
  }

  async requireClient(clientId: string) {
    const client = await this.clientRepository.findById(clientId);

    if (!client) {
      throw new AuthenticationError("Unknown client");
    }

    return client;
  }

  async authenticateClient(input: { clientId: string; clientSecret: string }) {
    const client = await this.requireClient(input.clientId);
    const provided = Buffer.from(input.clientSecret);
    const actual = Buffer.from(client.secret);

    if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
      throw new AuthenticationError("Invalid client credentials");
    }

    return client;
  }

  private async assertClientSupportsActiveFlow(client: Awaited<ReturnType<AuthService["requireClient"]>>) {
    const activeFlow = await this.authenticationFlowService.getActiveFlow();
    if (!activeFlow) {
      return;
    }

    if (client.flowIds.length > 0 && !client.flowIds.includes(activeFlow.id)) {
      throw new AuthenticationError("Client is not allowed to use the active authentication flow");
    }
  }

  async refreshTokens(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("refresh_token");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });

    if (!client.grants.includes("refresh_token")) {
      throw new AuthenticationError("Client does not support refresh_token grant");
    }

    const payload = await this.jwtService.verifyAccessToken(input.refreshToken);

    if (payload.type !== "refresh" || !payload.jti || !payload.sub) {
      throw new AuthenticationError("Invalid refresh token");
    }

    const refreshRecord = await this.refreshTokenRepository.findActiveByHash(hashOpaqueToken(input.refreshToken));

    if (!refreshRecord) {
      await this.refreshTokenRepository.revokeTokenFamily(String(payload.jti), new Date());
      throw new AuthenticationError("Refresh token was revoked or already used");
    }

    if (refreshRecord.expiresAt.getTime() < Date.now()) {
      await this.refreshTokenRepository.revokeByTokenId(refreshRecord.tokenId, new Date());
      throw new AuthenticationError("Refresh token has expired");
    }

    await this.refreshTokenRepository.markConsumed(refreshRecord.tokenId, new Date());

    const user = await this.userService.findUserById(String(payload.sub));

    if (!user) {
      throw new AuthenticationError("User no longer exists");
    }

    return this.issuePersistedTokens({
      user,
      client,
      sessionId: refreshRecord.sessionId,
      scope: refreshRecord.scope,
      rotatedFromTokenId: refreshRecord.tokenId,
      tenantId: typeof payload.tenant_id === "string" ? payload.tenant_id : undefined
    });
  }

  async issueClientCredentialsTokens(input: {
    clientId: string;
    clientSecret: string;
    scope?: string;
  }) {
    const client = await this.clientRepository.findById(input.clientId);

    if (!client) {
      return this.issueServiceIdentityClientCredentialsTokens(input);
    }

    await this.authenticationFlowService.assertGrantSupported("client_credentials");

    const authenticatedClient = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });

    if (!authenticatedClient.grants.includes("client_credentials")) {
      throw new AuthenticationError("Client does not support client_credentials grant");
    }

    const requestedScope = input.scope ? input.scope.split(" ") : authenticatedClient.allowedScopes;
    const allowedScope = requestedScope.filter((s) => authenticatedClient.allowedScopes.includes(s));

    const accessTokenId = nanoid();
    const { accessToken, expiresIn, tokenType } = await this.jwtService.issueClientCredentialsToken({
      client: authenticatedClient,
      scope: allowedScope,
      accessTokenId
    });

    // No DB session for client_credentials (machine-to-machine)
    await this.auditRepository.log({
      type: "token_issued",
      actorType: "client",
      clientId: authenticatedClient.id,
      metadata: { grant: "client_credentials", scope: allowedScope }
    });

    return { access_token: accessToken, token_type: tokenType, expires_in: expiresIn, scope: allowedScope.join(" ") };
  }

  private async issueServiceIdentityClientCredentialsTokens(input: {
    clientId: string;
    clientSecret: string;
    scope?: string;
  }) {
    if (!this.serviceIdentityService) {
      throw new AuthenticationError("Unknown client");
    }

    const serviceIdentity = await this.serviceIdentityService.verifyCredential(input.clientId, input.clientSecret);
    if (!serviceIdentity) {
      throw new AuthenticationError("Invalid client credentials");
    }

    const requestedScope = input.scope
      ? input.scope.split(" ").map((scope) => scope.trim()).filter(Boolean)
      : serviceIdentity.allowedScopes;
    const allowedScopes = new Set(serviceIdentity.allowedScopes);

    if (requestedScope.some((scope) => !allowedScopes.has(scope))) {
      throw new AppError("Requested scope exceeds service identity policy", 400);
    }

    const accessTokenId = nanoid();
    const { accessToken, expiresIn, tokenType } = await this.jwtService.issueServiceIdentityToken({
      serviceIdentity,
      clientId: input.clientId,
      scope: requestedScope,
      roles: await this.roleService.resolveNamesForUser(serviceIdentity.id),
      permissions: await this.roleService.resolvePermissionsForUser(serviceIdentity.id),
      accessTokenId
    });

    await this.auditRepository.log({
      type: "token_issued",
      actorType: "client",
      clientId: input.clientId,
      metadata: {
        grant: "client_credentials",
        scope: requestedScope,
        serviceIdentityId: serviceIdentity.id,
        serviceIdentityClientId: input.clientId
      }
    });

    return { access_token: accessToken, token_type: tokenType, expires_in: expiresIn, scope: requestedScope.join(" ") };
  }

  async issuePasswordGrantTokens(input: {
    username: string;
    password: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("password");
    await this.authenticationFlowService.assertStageEnabled("password");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("password")) {
      throw new AuthenticationError("Client does not support password grant");
    }

    const identifier = input.username.trim();
    await this.securityService.assertLoginAllowed(identifier);
    const user = await this.userService.findUserByEmail(identifier) ?? await this.userService.findUserByUsername(identifier);
    if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthenticationError("Invalid credentials");
    }

    await this.securityService.clearLoginFailures(identifier);

    const requestedScope = input.scope ? input.scope.split(" ") : client.allowedScopes;
    const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));

    const session = await this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: user.id,
      clientId: client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    const tokens = await this.issuePersistedTokens({
      user,
      client,
      sessionId: session.id,
      scope: allowedScope
    });

    await this.auditRepository.log({
      type: "token_issued",
      actorId: user.id,
      actorType: "user",
      clientId: client.id,
      metadata: { grant: "password", scope: allowedScope }
    });

    return {
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      id_token: tokens.idToken,
      scope: tokens.scope
    };
  }

  async createDeviceAuthorization(input: {
    clientId: string;
    clientSecret: string;
    scope?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("device_code");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("device_code")) {
      throw new AuthenticationError("Client does not support device_code grant");
    }

    const requestedScope = input.scope ? input.scope.split(" ") : client.allowedScopes;
    const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));

    const deviceCode = nanoid(64);
    const userCode = nanoid(12).toUpperCase();
    const expiresIn = 600;
    const interval = 5;

    this.deviceAuthorizations.set(deviceCode, {
      deviceCode,
      userCode,
      clientId: client.id,
      scope: allowedScope,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      intervalSeconds: interval,
      status: "pending"
    });

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: "/oauth/device/verify",
      verification_uri_complete: `/oauth/device/verify?user_code=${encodeURIComponent(userCode)}`,
      expires_in: expiresIn,
      interval
    };
  }

  async createCibaAuthenticationRequest(input: {
    clientId: string;
    clientSecret: string;
    loginHint: string;
    scope?: string;
    requestedDeliveryMode?: "poll" | "ping" | "push";
    clientNotificationEndpoint?: string;
    clientNotificationToken?: string;
    bindingMessage?: string;
    userCode?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("ciba");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("ciba")) {
      throw new AuthenticationError("Client does not support ciba grant");
    }

    const requestedScope = input.scope ? input.scope.split(" ") : client.allowedScopes;
    const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));
    const deliveryMode = input.requestedDeliveryMode ?? "poll";

    if ((deliveryMode === "ping" || deliveryMode === "push") && !input.clientNotificationEndpoint) {
      throw new ValidationError("client_notification_endpoint is required for CIBA ping/push delivery mode");
    }

    const authReqId = nanoid(56);
    const expiresIn = 600;
    const interval = 5;

    this.cibaAuthorizations.set(authReqId, {
      authReqId,
      clientId: client.id,
      scope: allowedScope,
      loginHint: input.loginHint.trim(),
      bindingMessage: input.bindingMessage,
      deliveryMode,
      clientNotificationEndpoint: input.clientNotificationEndpoint,
      clientNotificationToken: input.clientNotificationToken,
      userCode: input.userCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      intervalSeconds: interval,
      status: "pending"
    });

    return {
      auth_req_id: authReqId,
      expires_in: expiresIn,
      interval,
      requested_delivery_mode: deliveryMode
    };
  }

  async approveCibaAuthenticationRequest(input: {
    authReqId: string;
    username: string;
    password: string;
    approve: boolean;
  }) {
    const record = this.cibaAuthorizations.get(input.authReqId);
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("CIBA auth_req_id is invalid or expired");
    }

    if (record.status === "consumed") {
      throw new ValidationError("CIBA auth_req_id already consumed");
    }

    const identifier = input.username.trim();
    const user = await this.userService.findUserByEmail(identifier) ?? await this.userService.findUserByUsername(identifier);
    if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthenticationError("Invalid credentials");
    }

    if (!input.approve) {
      record.status = "denied";
      record.userId = user.id;
      return { status: "denied" as const };
    }

    if (record.deliveryMode === "push") {
      const client = await this.requireClient(record.clientId);
      const token = await this.issueUserScopedAccessToken({
        user,
        client,
        scope: record.scope,
        grant: "ciba"
      });

      record.status = "consumed";
      record.userId = user.id;

      await this.sendCibaClientNotification(record, {
        event: "ciba_push",
        auth_req_id: record.authReqId,
        ...token
      });

      return { status: "approved" as const };
    }

    record.status = "approved";
    record.userId = user.id;

    if (record.deliveryMode === "ping") {
      await this.sendCibaClientNotification(record, {
        event: "ciba_ping",
        auth_req_id: record.authReqId
      });
    }

    return { status: "approved" as const };
  }

  async exchangeCibaAuthenticationRequest(input: {
    authReqId: string;
    clientId: string;
    clientSecret: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("ciba");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("ciba")) {
      throw new AuthenticationError("Client does not support ciba grant");
    }

    const record = this.cibaAuthorizations.get(input.authReqId);
    if (!record) {
      return { error: "invalid_grant", error_description: "Unknown auth_req_id" } as const;
    }

    if (record.clientId !== client.id) {
      return { error: "invalid_grant", error_description: "auth_req_id does not belong to this client" } as const;
    }

    if (record.expiresAt.getTime() < Date.now()) {
      this.cibaAuthorizations.delete(input.authReqId);
      return { error: "expired_token", error_description: "auth_req_id has expired" } as const;
    }

    if (record.deliveryMode === "push") {
      return { error: "invalid_grant", error_description: "auth_req_id is configured for push delivery mode" } as const;
    }

    const now = Date.now();
    if (record.lastPolledAt && now - record.lastPolledAt.getTime() < record.intervalSeconds * 1000) {
      record.lastPolledAt = new Date(now);
      return { error: "slow_down", error_description: "Polling too quickly" } as const;
    }
    record.lastPolledAt = new Date(now);

    if (record.status === "pending") {
      return { error: "authorization_pending", error_description: "Authorization is pending" } as const;
    }

    if (record.status === "denied") {
      this.cibaAuthorizations.delete(input.authReqId);
      return { error: "access_denied", error_description: "End-user denied the request" } as const;
    }

    if (record.status === "consumed") {
      return { error: "invalid_grant", error_description: "auth_req_id already consumed" } as const;
    }

    if (!record.userId) {
      return { error: "invalid_grant", error_description: "Approved auth_req_id is missing user identity" } as const;
    }

    const user = await this.userService.findUserById(record.userId);
    if (!user || !user.active) {
      this.cibaAuthorizations.delete(input.authReqId);
      return { error: "invalid_grant", error_description: "User not available" } as const;
    }

    const token = await this.issueUserScopedAccessToken({
      user,
      client,
      scope: record.scope,
      grant: "ciba",
      ip: input.ip,
      userAgent: input.userAgent
    });

    record.status = "consumed";
    return token;
  }

  async issueJwtBearerGrantTokens(input: {
    assertion: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("jwt_bearer");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("jwt_bearer")) {
      throw new AuthenticationError("Client does not support jwt_bearer grant");
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAccessToken(input.assertion);
    } catch {
      throw new AuthenticationError("JWT bearer assertion validation failed");
    }

    const subject = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!subject) {
      throw new ValidationError("JWT bearer assertion is missing subject");
    }

    const user = await this.userService.findUserById(subject);
    if (!user || !user.active) {
      throw new AuthenticationError("User not available for JWT bearer assertion");
    }

    const requestedScope = input.scope ? input.scope.split(" ").map((value) => value.trim()).filter(Boolean) : client.allowedScopes;
    const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));

    return this.issueUserScopedAccessToken({
      user,
      client,
      scope: allowedScope,
      grant: "jwt_bearer",
      ip: input.ip,
      userAgent: input.userAgent
    });
  }

  async issueSaml2BearerGrantTokens(input: {
    assertion: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("saml2_bearer");
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("saml2_bearer")) {
      throw new AuthenticationError("Client does not support saml2_bearer grant");
    }

    const rawAssertion = input.assertion.includes("<")
      ? input.assertion
      : Buffer.from(input.assertion, "base64").toString("utf8");

    const nameIdMatch = rawAssertion.match(/<(?:[A-Za-z0-9_:-]+:)?NameID[^>]*>([^<]+)<\/(?:[A-Za-z0-9_:-]+:)?NameID>/);
    const subject = nameIdMatch?.[1]?.trim();
    if (!subject) {
      throw new ValidationError("SAML bearer assertion is missing NameID subject");
    }

    const user = await this.userService.findUserById(subject)
      ?? await this.userService.findUserByEmail(subject)
      ?? await this.userService.findUserByUsername(subject);

    if (!user || !user.active) {
      throw new AuthenticationError("User not available for SAML bearer assertion");
    }

    const requestedScope = input.scope ? input.scope.split(" ").map((value) => value.trim()).filter(Boolean) : client.allowedScopes;
    const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));

    return this.issueUserScopedAccessToken({
      user,
      client,
      scope: allowedScope,
      grant: "saml2_bearer",
      ip: input.ip,
      userAgent: input.userAgent
    });
  }

  async verifyDeviceUserCode(input: {
    userCode: string;
    username: string;
    password: string;
    approve: boolean;
  }) {
    const normalizedUserCode = input.userCode.trim().toUpperCase();
    const record = Array.from(this.deviceAuthorizations.values()).find((item) => item.userCode === normalizedUserCode);

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Device user code is invalid or expired");
    }

    if (record.status === "consumed") {
      throw new ValidationError("Device code already consumed");
    }

    const identifier = input.username.trim();
    const user = await this.userService.findUserByEmail(identifier) ?? await this.userService.findUserByUsername(identifier);
    if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthenticationError("Invalid credentials");
    }

    if (!input.approve) {
      record.status = "denied";
      record.userId = user.id;
      return { status: "denied" as const };
    }

    record.status = "approved";
    record.userId = user.id;
    return { status: "approved" as const };
  }

  async exchangeDeviceCode(input: {
    clientId: string;
    clientSecret: string;
    deviceCode: string;
    ip?: string;
    userAgent?: string;
  }) {
    const client = await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });

    const record = this.deviceAuthorizations.get(input.deviceCode);
    if (!record) {
      return { error: "invalid_grant", error_description: "Unknown device code" } as const;
    }

    if (record.clientId !== client.id) {
      return { error: "invalid_grant", error_description: "Device code does not belong to this client" } as const;
    }

    if (record.expiresAt.getTime() < Date.now()) {
      this.deviceAuthorizations.delete(input.deviceCode);
      return { error: "expired_token", error_description: "Device code has expired" } as const;
    }

    const now = Date.now();
    if (
      record.lastPolledAt &&
      now - record.lastPolledAt.getTime() < record.intervalSeconds * 1000
    ) {
      record.lastPolledAt = new Date(now);
      return { error: "slow_down", error_description: "Polling too quickly" } as const;
    }
    record.lastPolledAt = new Date(now);

    if (record.status === "pending") {
      return { error: "authorization_pending", error_description: "Authorization is pending" } as const;
    }

    if (record.status === "denied") {
      this.deviceAuthorizations.delete(input.deviceCode);
      return { error: "access_denied", error_description: "End-user denied the request" } as const;
    }

    if (record.status === "consumed") {
      return { error: "invalid_grant", error_description: "Device code already consumed" } as const;
    }

    if (!record.userId) {
      return { error: "invalid_grant", error_description: "Approved device code is missing user identity" } as const;
    }

    const user = await this.userService.findUserById(record.userId);
    if (!user || !user.active) {
      this.deviceAuthorizations.delete(input.deviceCode);
      return { error: "invalid_grant", error_description: "User not available" } as const;
    }

    const session = await this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: user.id,
      clientId: client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    const tokens = await this.issuePersistedTokens({
      user,
      client,
      sessionId: session.id,
      scope: record.scope
    });

    record.status = "consumed";

    await this.auditRepository.log({
      type: "token_issued",
      actorId: user.id,
      actorType: "user",
      clientId: client.id,
      metadata: { grant: "device_code", scope: record.scope }
    });

    return {
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      id_token: tokens.idToken,
      scope: tokens.scope
    };
  }

  listDeviceAuthorizations() {
    const now = Date.now();
    return Array.from(this.deviceAuthorizations.values())
      .filter((record) => record.expiresAt.getTime() >= now)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((record) => ({ ...record }));
  }

  revokeDeviceAuthorization(deviceCode: string) {
    return this.deviceAuthorizations.delete(deviceCode);
  }

  async issueImplicitToken(input: {
    userId: string;
    clientId: string;
    scope: string[];
    tenantId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.authenticationFlowService.assertGrantSupported("authorization_code");
    const user = await this.userService.findUserById(input.userId);
    if (!user || !user.active) {
      throw new AuthenticationError("User is not available for implicit flow");
    }

    const client = await this.requireClient(input.clientId);
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("authorization_code")) {
      throw new AuthenticationError("Client does not support authorization_code grant");
    }

    const allowedScope = input.scope.filter((scope) => client.allowedScopes.includes(scope));

    const session = await this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: user.id,
      clientId: client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    const accessTokenId = nanoid();
    const claimContext = this.scopeClaimContext(user, allowedScope, input.tenantId);
    const token = await this.jwtService.issueUserAccessToken({
      user,
      client,
      scope: allowedScope,
      accessTokenId,
      tenantId: input.tenantId,
      accessTokenAuthorizationClaims: await buildAccessTokenAuthorizationClaims(claimContext)
    });

    await this.accessTokenRepository.create({
      tokenId: accessTokenId,
      userId: user.id,
      clientId: client.id,
      sessionId: session.id,
      expiresAt: new Date(Date.now() + resolveAccessTokenTtlSeconds(client) * 1000)
    });

    await this.auditRepository.log({
      type: "token_issued",
      actorId: user.id,
      actorType: "user",
      clientId: client.id,
      metadata: { grant: "implicit", scope: allowedScope }
    });

    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      scope: token.scope
    };
  }

  async issueFrontChannelIdToken(input: {
    userId: string;
    clientId: string;
    nonce: string;
    scope: string[];
  }) {
    await this.authenticationFlowService.assertGrantSupported("authorization_code");

    const user = await this.userService.findUserById(input.userId);
    if (!user || !user.active) {
      throw new AuthenticationError("User is not available for ID token flow");
    }

    const client = await this.requireClient(input.clientId);
    await this.assertClientSupportsActiveFlow(client);

    if (!client.grants.includes("authorization_code")) {
      throw new AuthenticationError("Client does not support authorization_code grant");
    }

    const allowedScope = input.scope.filter((scope) => client.allowedScopes.includes(scope));
    const claimContext = this.scopeClaimContext(user, allowedScope);
    const claims = claimsWithoutSubject(await buildScopeGatedClaims(claimContext));

    return await this.jwtService.issueIdToken({
      user,
      client,
      nonce: input.nonce,
      claims
    });
  }

  private async issueUserScopedAccessToken(input: {
    user: User;
    client: OAuthClient;
    scope: string[];
    grant: "jwt_bearer" | "saml2_bearer" | "ciba";
    ip?: string;
    userAgent?: string;
  }) {
    const session = await this.sessionRepository.create({
      userId: input.user.id,
      clientId: input.client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    await this.securityService.observeSessionStart({
      sessionId: session.id,
      userId: input.user.id,
      clientId: input.client.id,
      ip: input.ip,
      userAgent: input.userAgent
    });

    const accessTokenId = nanoid();
    const claimContext = this.scopeClaimContext(input.user, input.scope);
    const token = await this.jwtService.issueUserAccessToken({
      user: input.user,
      client: input.client,
      scope: input.scope,
      accessTokenId,
      accessTokenAuthorizationClaims: await buildAccessTokenAuthorizationClaims(claimContext)
    });

    await this.accessTokenRepository.create({
      tokenId: accessTokenId,
      userId: input.user.id,
      clientId: input.client.id,
      sessionId: session.id,
      expiresAt: new Date(Date.now() + resolveAccessTokenTtlSeconds(input.client) * 1000)
    });

    await this.auditRepository.log({
      type: "token_issued",
      actorId: input.user.id,
      actorType: "user",
      clientId: input.client.id,
      ip: input.ip,
      metadata: { grant: input.grant, scope: input.scope }
    });

    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      scope: token.scope
    };
  }

  async introspectToken(input: { token: string; clientId: string; clientSecret: string }) {
    await this.authenticateClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret
    });

    try {
      const payload = await this.jwtService.verifyAccessToken(input.token);
      const tokenId = payload.jti;
      if (!tokenId || await this.accessTokenRepository.isRevoked(String(tokenId))) {
        return { active: false };
      }
      return { active: true, ...payload };
    } catch {
      return { active: false };
    }
  }

  private async sendCibaClientNotification(record: CibaAuthorizationRecord, payload: Record<string, unknown>) {
    if (!record.clientNotificationEndpoint) {
      return;
    }

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (record.clientNotificationToken) {
      headers.authorization = `Bearer ${record.clientNotificationToken}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(record.clientNotificationEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch {
      // Notification delivery is best-effort; clients can still complete via token polling when applicable.
    }
  }

  async revokeAccessToken(tokenId: string) {
    await this.accessTokenRepository.revokeByTokenId(tokenId, new Date());
  }

  async revokeRefreshToken(tokenId: string) {
    await this.refreshTokenRepository.revokeByTokenId(tokenId, new Date());
  }

  async getUserFromAccessToken(accessToken: string): Promise<{ user: User; payload: JWTPayload }> {
    const payload = await this.jwtService.verifyAccessToken(accessToken);
    const subject = payload.sub;
    const tokenId = payload.jti;

    if (!subject) {
      throw new AuthenticationError("Access token subject is missing");
    }

    if (!tokenId || await this.accessTokenRepository.isRevoked(String(tokenId))) {
      throw new AuthenticationError("Access token has been revoked");
    }

    const user = await this.userService.findUserById(subject);

    if (!user) {
      throw new AuthenticationError("User not found for access token");
    }

    return { user, payload };
  }

  async getUserInfoFromAccessToken(accessToken: string) {
    const { user, payload } = await this.getUserFromAccessToken(accessToken);

    const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id : undefined;

    const scopes = Array.isArray(payload.scope)
      ? payload.scope
      : typeof payload.scope === "string"
        ? payload.scope.split(" ")
        : [];

    return await buildScopeGatedClaims(this.scopeClaimContext(user, scopes, tenantId));
  }

  private scopeClaimContext(user: User, scopes: string[], tenantId?: string): ScopeClaimResolverContext {
    return {
      user,
      scopes,
      tenantId,
      resolveRoles: () => this.roleService.resolveNamesForUser(user.id, tenantId),
      resolveGroups: () => this.groupService.resolveGroupNamesForUser(user.id),
      resolvePermissions: () => this.roleService.resolvePermissionsForUser(user.id, tenantId)
    };
  }

  private async issuePersistedTokens(input: {
    user: NonNullable<Awaited<ReturnType<UserService["findUserById"]>>>;
    client: Awaited<ReturnType<AuthService["requireClient"]>>;
    sessionId: string;
    scope: string[];
    tenantId?: string;
    rotatedFromTokenId?: string;
  }) {
    const accessTokenId = nanoid();
    const refreshTokenId = nanoid();

    const claimContext = this.scopeClaimContext(input.user, input.scope, input.tenantId);
    const [idTokenClaims, accessTokenAuthorizationClaims] = await Promise.all([
      buildScopeGatedClaims(claimContext).then(claimsWithoutSubject),
      buildAccessTokenAuthorizationClaims(claimContext)
    ]);

    const tokens = await this.jwtService.issueTokens({
      user: input.user,
      client: input.client,
      scope: input.scope,
      accessTokenId,
      refreshTokenId,
      tenantId: input.tenantId,
      idTokenClaims,
      accessTokenAuthorizationClaims
    });

    const accessTtlSeconds = resolveAccessTokenTtlSeconds(input.client);
    const refreshTtlSeconds = resolveRefreshTokenTtlSeconds(input.client);

    await this.accessTokenRepository.create({
      tokenId: accessTokenId,
      userId: input.user.id,
      clientId: input.client.id,
      sessionId: input.sessionId,
      expiresAt: new Date(Date.now() + accessTtlSeconds * 1000)
    });

    await this.refreshTokenRepository.create({
      tokenId: refreshTokenId,
      tokenHash: hashOpaqueToken(tokens.refreshToken),
      userId: input.user.id,
      clientId: input.client.id,
      sessionId: input.sessionId,
      scope: input.scope,
      expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
      rotatedFromTokenId: input.rotatedFromTokenId
    });

    return tokens;
  }
}
