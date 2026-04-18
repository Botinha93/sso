import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { AuthenticationError, ValidationError } from "../core/errors.js";
import { verifyPassword } from "../security/password.js";
import { hashOpaqueToken } from "../security/token-hash.js";
export class AuthService {
    userService;
    roleService;
    authenticationFlowService;
    clientRepository;
    sessionRepository;
    authorizationCodeRepository;
    consentRepository;
    refreshTokenRepository;
    accessTokenRepository;
    tenantRepository;
    jwtService;
    auditRepository;
    deviceAuthorizations = new Map();
    constructor(userService, roleService, authenticationFlowService, clientRepository, sessionRepository, authorizationCodeRepository, consentRepository, refreshTokenRepository, accessTokenRepository, tenantRepository, jwtService, auditRepository) {
        this.userService = userService;
        this.roleService = roleService;
        this.authenticationFlowService = authenticationFlowService;
        this.clientRepository = clientRepository;
        this.sessionRepository = sessionRepository;
        this.authorizationCodeRepository = authorizationCodeRepository;
        this.consentRepository = consentRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.accessTokenRepository = accessTokenRepository;
        this.tenantRepository = tenantRepository;
        this.jwtService = jwtService;
        this.auditRepository = auditRepository;
    }
    async login(input) {
        this.authenticationFlowService.assertGrantSupported("authorization_code");
        this.authenticationFlowService.assertStageEnabled("password");
        const user = this.validateUserCredentials(input.email, input.password);
        return this.completeLoginForUser({
            userId: user.id,
            clientId: input.clientId,
            scope: input.scope,
            tenantSlug: input.tenantSlug
        });
    }
    validateUserCredentials(identifier, password) {
        const normalized = identifier.trim();
        const user = this.userService.findUserByEmail(normalized) ?? this.userService.findUserByUsername(normalized);
        if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
            throw new AuthenticationError("Invalid credentials");
        }
        return user;
    }
    async completeLoginForUser(input) {
        const user = this.userService.findUserById(input.userId);
        if (!user || !user.active) {
            throw new AuthenticationError("User no longer exists");
        }
        const client = this.requireClient(input.clientId);
        this.assertClientSupportsActiveFlow(client);
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
        this.auditRepository.log({
            type: "login",
            actorId: user.id,
            actorType: "user",
            clientId: client.id,
            metadata: { sessionId: session.id }
        });
        return {
            user,
            session,
            tenant,
            tokens
        };
    }
    createAuthorizationCode(input) {
        this.authenticationFlowService.assertGrantSupported("authorization_code");
        const client = this.requireClient(input.clientId);
        this.assertClientSupportsActiveFlow(client);
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
    async exchangeAuthorizationCode(input) {
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
    requireClient(clientId) {
        const client = this.clientRepository.findById(clientId);
        if (!client) {
            throw new AuthenticationError("Unknown client");
        }
        return client;
    }
    assertClientSupportsActiveFlow(client) {
        const activeFlow = this.authenticationFlowService.getActiveFlow();
        if (!activeFlow) {
            return;
        }
        if (client.flowIds.length > 0 && !client.flowIds.includes(activeFlow.id)) {
            throw new AuthenticationError("Client is not allowed to use the active authentication flow");
        }
    }
    async refreshTokens(input) {
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
    async issueClientCredentialsTokens(input) {
        const client = this.requireClient(input.clientId);
        if (client.secret !== input.clientSecret) {
            throw new AuthenticationError("Invalid client credentials");
        }
        if (!client.grants.includes("client_credentials")) {
            throw new AuthenticationError("Client does not support client_credentials grant");
        }
        const requestedScope = input.scope ? input.scope.split(" ") : client.allowedScopes;
        const allowedScope = requestedScope.filter((s) => client.allowedScopes.includes(s));
        const accessTokenId = nanoid();
        const { accessToken, expiresIn, tokenType } = await this.jwtService.issueClientCredentialsToken({
            client,
            scope: allowedScope,
            accessTokenId
        });
        // No DB session for client_credentials (machine-to-machine)
        this.auditRepository.log({
            type: "token_issued",
            actorType: "client",
            clientId: client.id,
            metadata: { grant: "client_credentials", scope: allowedScope }
        });
        return { access_token: accessToken, token_type: tokenType, expires_in: expiresIn, scope: allowedScope.join(" ") };
    }
    async issuePasswordGrantTokens(input) {
        this.authenticationFlowService.assertGrantSupported("password");
        this.authenticationFlowService.assertStageEnabled("password");
        const client = this.requireClient(input.clientId);
        this.assertClientSupportsActiveFlow(client);
        if (client.secret !== input.clientSecret) {
            throw new AuthenticationError("Invalid client credentials");
        }
        const identifier = input.username.trim();
        const user = this.userService.findUserByEmail(identifier) ?? this.userService.findUserByUsername(identifier);
        if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
            throw new AuthenticationError("Invalid credentials");
        }
        const requestedScope = input.scope ? input.scope.split(" ") : client.allowedScopes;
        const allowedScope = requestedScope.filter((scope) => client.allowedScopes.includes(scope));
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
            scope: allowedScope
        });
        this.auditRepository.log({
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
    createDeviceAuthorization(input) {
        this.authenticationFlowService.assertGrantSupported("device_code");
        const client = this.requireClient(input.clientId);
        this.assertClientSupportsActiveFlow(client);
        if (client.secret !== input.clientSecret) {
            throw new AuthenticationError("Invalid client credentials");
        }
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
    verifyDeviceUserCode(input) {
        const normalizedUserCode = input.userCode.trim().toUpperCase();
        const record = Array.from(this.deviceAuthorizations.values()).find((item) => item.userCode === normalizedUserCode);
        if (!record || record.expiresAt.getTime() < Date.now()) {
            throw new ValidationError("Device user code is invalid or expired");
        }
        if (record.status === "consumed") {
            throw new ValidationError("Device code already consumed");
        }
        const identifier = input.username.trim();
        const user = this.userService.findUserByEmail(identifier) ?? this.userService.findUserByUsername(identifier);
        if (!user || !user.active || !verifyPassword(input.password, user.passwordHash)) {
            throw new AuthenticationError("Invalid credentials");
        }
        if (!input.approve) {
            record.status = "denied";
            record.userId = user.id;
            return { status: "denied" };
        }
        record.status = "approved";
        record.userId = user.id;
        return { status: "approved" };
    }
    async exchangeDeviceCode(input) {
        const client = this.requireClient(input.clientId);
        if (client.secret !== input.clientSecret) {
            throw new AuthenticationError("Invalid client credentials");
        }
        const record = this.deviceAuthorizations.get(input.deviceCode);
        if (!record) {
            return { error: "invalid_grant", error_description: "Unknown device code" };
        }
        if (record.clientId !== client.id) {
            return { error: "invalid_grant", error_description: "Device code does not belong to this client" };
        }
        if (record.expiresAt.getTime() < Date.now()) {
            this.deviceAuthorizations.delete(input.deviceCode);
            return { error: "expired_token", error_description: "Device code has expired" };
        }
        const now = Date.now();
        if (record.lastPolledAt &&
            now - record.lastPolledAt.getTime() < record.intervalSeconds * 1000) {
            record.lastPolledAt = new Date(now);
            return { error: "slow_down", error_description: "Polling too quickly" };
        }
        record.lastPolledAt = new Date(now);
        if (record.status === "pending") {
            return { error: "authorization_pending", error_description: "Authorization is pending" };
        }
        if (record.status === "denied") {
            this.deviceAuthorizations.delete(input.deviceCode);
            return { error: "access_denied", error_description: "End-user denied the request" };
        }
        if (record.status === "consumed") {
            return { error: "invalid_grant", error_description: "Device code already consumed" };
        }
        if (!record.userId) {
            return { error: "invalid_grant", error_description: "Approved device code is missing user identity" };
        }
        const user = this.userService.findUserById(record.userId);
        if (!user || !user.active) {
            this.deviceAuthorizations.delete(input.deviceCode);
            return { error: "invalid_grant", error_description: "User not available" };
        }
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
            scope: record.scope
        });
        record.status = "consumed";
        this.auditRepository.log({
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
    revokeDeviceAuthorization(deviceCode) {
        return this.deviceAuthorizations.delete(deviceCode);
    }
    async issueImplicitToken(input) {
        const user = this.userService.findUserById(input.userId);
        if (!user || !user.active) {
            throw new AuthenticationError("User is not available for implicit flow");
        }
        const client = this.requireClient(input.clientId);
        this.assertClientSupportsActiveFlow(client);
        const allowedScope = input.scope.filter((scope) => client.allowedScopes.includes(scope));
        const session = this.sessionRepository.create({
            userId: user.id,
            clientId: client.id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8)
        });
        const accessTokenId = nanoid();
        const token = await this.jwtService.issueUserAccessToken({
            user,
            client,
            scope: allowedScope,
            roles: this.roleService.resolveNamesForUser(user.id, input.tenantId),
            accessTokenId,
            tenantId: input.tenantId
        });
        this.accessTokenRepository.create({
            tokenId: accessTokenId,
            userId: user.id,
            clientId: client.id,
            sessionId: session.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15)
        });
        this.auditRepository.log({
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
    async introspectToken(token) {
        try {
            const payload = await this.jwtService.verifyAccessToken(token);
            const tokenId = payload.jti;
            if (!tokenId || this.accessTokenRepository.isRevoked(String(tokenId))) {
                return { active: false };
            }
            return { active: true, ...payload };
        }
        catch {
            return { active: false };
        }
    }
    revokeAccessToken(tokenId) {
        this.accessTokenRepository.revokeByTokenId(tokenId, new Date());
    }
    revokeRefreshToken(tokenId) {
        this.refreshTokenRepository.revokeByTokenId(tokenId, new Date());
    }
    async getUserInfoFromAccessToken(accessToken) {
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
        const scopes = Array.isArray(payload.scope)
            ? payload.scope
            : typeof payload.scope === "string"
                ? payload.scope.split(" ")
                : [];
        const claims = { sub: user.id };
        if (scopes.includes("profile")) {
            claims.preferred_username = user.username;
            claims.given_name = user.givenName;
            claims.family_name = user.familyName;
            claims.roles = this.roleService.resolveNamesForUser(user.id, tenantId);
        }
        if (scopes.includes("email")) {
            claims.email = user.email;
            claims.email_verified = true;
        }
        // Always include roles if explicitly in scope
        if (scopes.includes("roles") && !claims.roles) {
            claims.roles = this.roleService.resolveNamesForUser(user.id, tenantId);
        }
        return claims;
    }
    async issuePersistedTokens(input) {
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
