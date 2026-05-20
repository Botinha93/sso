import { createHash, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { AppError, AuthenticationError, ValidationError } from "../core/errors.js";
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
    securityService;
    serviceIdentityService;
    deviceAuthorizations = new Map();
    cibaAuthorizations = new Map();
    constructor(userService, roleService, authenticationFlowService, clientRepository, sessionRepository, authorizationCodeRepository, consentRepository, refreshTokenRepository, accessTokenRepository, tenantRepository, jwtService, auditRepository, securityService, serviceIdentityService) {
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
        this.securityService = securityService;
        this.serviceIdentityService = serviceIdentityService;
    }
    async login(input) {
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
    async validateUserCredentials(identifier, password) {
        const normalized = identifier.trim();
        await this.securityService.assertLoginAllowed(normalized);
        const user = await this.userService.findUserByEmail(normalized) ?? await this.userService.findUserByUsername(normalized);
        if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
            throw new AuthenticationError("Invalid credentials");
        }
        return user;
    }
    async completeLoginForUser(input) {
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
    async createAuthorizationCode(input) {
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
    async exchangeAuthorizationCode(input) {
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
    async requireClient(clientId) {
        const client = await this.clientRepository.findById(clientId);
        if (!client) {
            throw new AuthenticationError("Unknown client");
        }
        return client;
    }
    async authenticateClient(input) {
        const client = await this.requireClient(input.clientId);
        const provided = Buffer.from(input.clientSecret);
        const actual = Buffer.from(client.secret);
        if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
            throw new AuthenticationError("Invalid client credentials");
        }
        return client;
    }
    async assertClientSupportsActiveFlow(client) {
        const activeFlow = await this.authenticationFlowService.getActiveFlow();
        if (!activeFlow) {
            return;
        }
        if (client.flowIds.length > 0 && !client.flowIds.includes(activeFlow.id)) {
            throw new AuthenticationError("Client is not allowed to use the active authentication flow");
        }
    }
    async refreshTokens(input) {
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
    async issueClientCredentialsTokens(input) {
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
    async issueServiceIdentityClientCredentialsTokens(input) {
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
    async issuePasswordGrantTokens(input) {
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
    async createDeviceAuthorization(input) {
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
    async createCibaAuthenticationRequest(input) {
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
    async approveCibaAuthenticationRequest(input) {
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
            return { status: "denied" };
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
            return { status: "approved" };
        }
        record.status = "approved";
        record.userId = user.id;
        if (record.deliveryMode === "ping") {
            await this.sendCibaClientNotification(record, {
                event: "ciba_ping",
                auth_req_id: record.authReqId
            });
        }
        return { status: "approved" };
    }
    async exchangeCibaAuthenticationRequest(input) {
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
            return { error: "invalid_grant", error_description: "Unknown auth_req_id" };
        }
        if (record.clientId !== client.id) {
            return { error: "invalid_grant", error_description: "auth_req_id does not belong to this client" };
        }
        if (record.expiresAt.getTime() < Date.now()) {
            this.cibaAuthorizations.delete(input.authReqId);
            return { error: "expired_token", error_description: "auth_req_id has expired" };
        }
        if (record.deliveryMode === "push") {
            return { error: "invalid_grant", error_description: "auth_req_id is configured for push delivery mode" };
        }
        const now = Date.now();
        if (record.lastPolledAt && now - record.lastPolledAt.getTime() < record.intervalSeconds * 1000) {
            record.lastPolledAt = new Date(now);
            return { error: "slow_down", error_description: "Polling too quickly" };
        }
        record.lastPolledAt = new Date(now);
        if (record.status === "pending") {
            return { error: "authorization_pending", error_description: "Authorization is pending" };
        }
        if (record.status === "denied") {
            this.cibaAuthorizations.delete(input.authReqId);
            return { error: "access_denied", error_description: "End-user denied the request" };
        }
        if (record.status === "consumed") {
            return { error: "invalid_grant", error_description: "auth_req_id already consumed" };
        }
        if (!record.userId) {
            return { error: "invalid_grant", error_description: "Approved auth_req_id is missing user identity" };
        }
        const user = await this.userService.findUserById(record.userId);
        if (!user || !user.active) {
            this.cibaAuthorizations.delete(input.authReqId);
            return { error: "invalid_grant", error_description: "User not available" };
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
    async issueJwtBearerGrantTokens(input) {
        await this.authenticationFlowService.assertGrantSupported("jwt_bearer");
        const client = await this.authenticateClient({
            clientId: input.clientId,
            clientSecret: input.clientSecret
        });
        await this.assertClientSupportsActiveFlow(client);
        if (!client.grants.includes("jwt_bearer")) {
            throw new AuthenticationError("Client does not support jwt_bearer grant");
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAccessToken(input.assertion);
        }
        catch {
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
    async issueSaml2BearerGrantTokens(input) {
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
    async verifyDeviceUserCode(input) {
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
            return { status: "denied" };
        }
        record.status = "approved";
        record.userId = user.id;
        return { status: "approved" };
    }
    async exchangeDeviceCode(input) {
        const client = await this.authenticateClient({
            clientId: input.clientId,
            clientSecret: input.clientSecret
        });
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
        const user = await this.userService.findUserById(record.userId);
        if (!user || !user.active) {
            this.deviceAuthorizations.delete(input.deviceCode);
            return { error: "invalid_grant", error_description: "User not available" };
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
    revokeDeviceAuthorization(deviceCode) {
        return this.deviceAuthorizations.delete(deviceCode);
    }
    async issueImplicitToken(input) {
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
        const token = await this.jwtService.issueUserAccessToken({
            user,
            client,
            scope: allowedScope,
            roles: await this.roleService.resolveNamesForUser(user.id, input.tenantId),
            accessTokenId,
            tenantId: input.tenantId
        });
        await this.accessTokenRepository.create({
            tokenId: accessTokenId,
            userId: user.id,
            clientId: client.id,
            sessionId: session.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15)
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
    async issueFrontChannelIdToken(input) {
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
        return await this.jwtService.issueIdToken({
            user,
            client,
            nonce: input.nonce
        });
    }
    async issueUserScopedAccessToken(input) {
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
        const token = await this.jwtService.issueUserAccessToken({
            user: input.user,
            client: input.client,
            scope: input.scope,
            roles: await this.roleService.resolveNamesForUser(input.user.id),
            accessTokenId
        });
        await this.accessTokenRepository.create({
            tokenId: accessTokenId,
            userId: input.user.id,
            clientId: input.client.id,
            sessionId: session.id,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15)
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
    async introspectToken(input) {
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
        }
        catch {
            return { active: false };
        }
    }
    async sendCibaClientNotification(record, payload) {
        if (!record.clientNotificationEndpoint) {
            return;
        }
        const headers = {
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
        }
        catch {
            // Notification delivery is best-effort; clients can still complete via token polling when applicable.
        }
    }
    async revokeAccessToken(tokenId) {
        await this.accessTokenRepository.revokeByTokenId(tokenId, new Date());
    }
    async revokeRefreshToken(tokenId) {
        await this.refreshTokenRepository.revokeByTokenId(tokenId, new Date());
    }
    async getUserInfoFromAccessToken(accessToken) {
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
            claims.roles = await this.roleService.resolveNamesForUser(user.id, tenantId);
        }
        if (scopes.includes("email")) {
            claims.email = user.email;
            claims.email_verified = true;
        }
        // Always include roles if explicitly in scope
        if (scopes.includes("roles") && !claims.roles) {
            claims.roles = await this.roleService.resolveNamesForUser(user.id, tenantId);
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
            roles: await this.roleService.resolveNamesForUser(input.user.id, input.tenantId),
            accessTokenId,
            refreshTokenId,
            tenantId: input.tenantId
        });
        await this.accessTokenRepository.create({
            tokenId: accessTokenId,
            userId: input.user.id,
            clientId: input.client.id,
            sessionId: input.sessionId,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15)
        });
        await this.refreshTokenRepository.create({
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
