import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { AuthenticationError, ValidationError } from "../core/errors.js";
import type {
  AccessTokenRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ConsentRepository,
  RefreshTokenRepository,
  SessionRepository,
  TenantRepository
} from "../repositories/contracts.js";
import { verifyPassword } from "../security/password.js";
import { hashOpaqueToken } from "../security/token-hash.js";
import { JwtService } from "../security/jwt.js";
import { RoleService } from "./role-service.js";
import { UserService } from "./user-service.js";

export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly clientRepository: ClientRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly authorizationCodeRepository: AuthorizationCodeRepository,
    private readonly consentRepository: ConsentRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly accessTokenRepository: AccessTokenRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly jwtService: JwtService
  ) {}

  async login(input: {
    email: string;
    password: string;
    clientId: string;
    scope: string[];
    tenantSlug?: string;
  }) {
    const user = this.userService.findUserByEmail(input.email);

    if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthenticationError("Invalid credentials");
    }

    const client = this.requireClient(input.clientId);
    const allowedScope = input.scope.filter((scope) => client.allowedScopes.includes(scope));
    const tenant = input.tenantSlug ? this.tenantRepository.findBySlug(input.tenantSlug) : undefined;

    const session = this.sessionRepository.create({
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

    return {
      user,
      session,
      tenant,
      tokens
    };
  }

  createAuthorizationCode(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string[];
    codeChallenge?: string;
    codeChallengeMethod?: "S256";
  }) {
    const client = this.requireClient(input.clientId);

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
  }) {
    const authorizationCode = this.authorizationCodeRepository.consume(input.code);

    if (!authorizationCode) {
      throw new ValidationError("Authorization code is invalid or already used");
    }

    if (authorizationCode.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Authorization code has expired");
    }

    const client = this.requireClient(input.clientId);

    if (client.secret !== input.clientSecret) {
      throw new AuthenticationError("Invalid client credentials");
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

    const user = this.userService.findUserById(authorizationCode.userId);

    if (!user) {
      throw new AuthenticationError("User no longer exists");
    }

    const session = this.sessionRepository.create({
      userId: user.id,
      clientId: client.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
    });

    return this.issuePersistedTokens({
      user,
      client,
      sessionId: session.id,
      scope: authorizationCode.scope
    });
  }

  requireClient(clientId: string) {
    const client = this.clientRepository.findById(clientId);

    if (!client) {
      throw new AuthenticationError("Unknown client");
    }

    return client;
  }

  async refreshTokens(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) {
    const client = this.requireClient(input.clientId);

    if (client.secret !== input.clientSecret) {
      throw new AuthenticationError("Invalid client credentials");
    }

    const payload = await this.jwtService.verifyAccessToken(input.refreshToken);

    if (payload.type !== "refresh" || !payload.jti || !payload.sub) {
      throw new AuthenticationError("Invalid refresh token");
    }

    const refreshRecord = this.refreshTokenRepository.findActiveByHash(hashOpaqueToken(input.refreshToken));

    if (!refreshRecord) {
      this.refreshTokenRepository.revokeTokenFamily(String(payload.jti), new Date());
      throw new AuthenticationError("Refresh token was revoked or already used");
    }

    if (refreshRecord.expiresAt.getTime() < Date.now()) {
      this.refreshTokenRepository.revokeByTokenId(refreshRecord.tokenId, new Date());
      throw new AuthenticationError("Refresh token has expired");
    }

    this.refreshTokenRepository.markConsumed(refreshRecord.tokenId, new Date());

    const user = this.userService.findUserById(String(payload.sub));

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

  revokeAccessToken(tokenId: string) {
    this.accessTokenRepository.revokeByTokenId(tokenId, new Date());
  }

  revokeRefreshToken(tokenId: string) {
    this.refreshTokenRepository.revokeByTokenId(tokenId, new Date());
  }

  async getUserInfoFromAccessToken(accessToken: string) {
    const payload = await this.jwtService.verifyAccessToken(accessToken);
    const subject = payload.sub;
    const tokenId = payload.jti;

    if (!subject) {
      throw new AuthenticationError("Access token subject is missing");
    }

    if (!tokenId || this.accessTokenRepository.isRevoked(String(tokenId))) {
      throw new AuthenticationError("Access token has been revoked");
    }

    const user = this.userService.findUserById(subject);

    if (!user) {
      throw new AuthenticationError("User not found for access token");
    }

    const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id : undefined;

    return {
      sub: user.id,
      email: user.email,
      preferred_username: user.username,
      given_name: user.givenName,
      family_name: user.familyName,
      roles: this.roleService.resolveNamesForUser(user.id, tenantId)
    };
  }

  private async issuePersistedTokens(input: {
    user: NonNullable<ReturnType<UserService["findUserById"]>>;
    client: ReturnType<AuthService["requireClient"]>;
    sessionId: string;
    scope: string[];
    tenantId?: string;
    rotatedFromTokenId?: string;
  }) {
    const accessTokenId = nanoid();
    const refreshTokenId = nanoid();

    const tokens = await this.jwtService.issueTokens({
      user: input.user,
      client: input.client,
      scope: input.scope,
      roles: this.roleService.resolveNamesForUser(input.user.id, input.tenantId),
      accessTokenId,
      refreshTokenId,
      tenantId: input.tenantId
    });

    this.accessTokenRepository.create({
      tokenId: accessTokenId,
      userId: input.user.id,
      clientId: input.client.id,
      sessionId: input.sessionId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15)
    });

    this.refreshTokenRepository.create({
      tokenId: refreshTokenId,
      tokenHash: hashOpaqueToken(tokens.refreshToken),
      userId: input.user.id,
      clientId: input.client.id,
      sessionId: input.sessionId,
      scope: input.scope,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      rotatedFromTokenId: input.rotatedFromTokenId
    });

    return tokens;
  }
}
