import { jwtVerify, SignJWT } from "jose";
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
export const DEFAULT_ID_TOKEN_TTL_SECONDS = 900;
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const resolveAccessTokenTtlSeconds = (client) => {
    const value = client?.accessTokenTtlSeconds;
    return typeof value === "number" && value > 0 ? value : DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
};
export const resolveRefreshTokenTtlSeconds = (client) => {
    const value = client?.refreshTokenTtlSeconds;
    return typeof value === "number" && value > 0 ? value : DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
};
export class JwtService {
    keys;
    appConfig;
    constructor(keys, appConfig) {
        this.keys = keys;
        this.appConfig = appConfig;
    }
    async issueTokens(params) {
        const { user, client, scope, accessTokenId, refreshTokenId, tenantId, idTokenClaims, accessTokenAuthorizationClaims } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = resolveAccessTokenTtlSeconds(client);
        const refreshTtl = resolveRefreshTokenTtlSeconds(client);
        const accessTokenPayload = {
            scope: scopeValue,
            client_id: client.id,
            tenant_id: tenantId
        };
        if (accessTokenAuthorizationClaims?.roles) {
            accessTokenPayload.roles = accessTokenAuthorizationClaims.roles;
        }
        if (accessTokenAuthorizationClaims?.groups) {
            accessTokenPayload.groups = accessTokenAuthorizationClaims.groups;
        }
        if (accessTokenAuthorizationClaims?.permissions) {
            accessTokenPayload.permissions = accessTokenAuthorizationClaims.permissions;
        }
        const accessToken = await new SignJWT(accessTokenPayload)
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + accessTtl)
            .sign(this.keys.privateKey);
        const idToken = await new SignJWT(idTokenClaims ?? {})
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setIssuedAt(now)
            .setExpirationTime(now + DEFAULT_ID_TOKEN_TTL_SECONDS)
            .sign(this.keys.privateKey);
        const refreshToken = await new SignJWT({
            type: "refresh",
            client_id: client.id
        })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setJti(refreshTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + refreshTtl)
            .sign(this.keys.privateKey);
        return {
            accessToken,
            idToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: accessTtl,
            scope: scopeValue
        };
    }
    async issueClientCredentialsToken(params) {
        const { client, scope, accessTokenId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = resolveAccessTokenTtlSeconds(client);
        const accessToken = await new SignJWT({ scope: scopeValue, client_id: client.id })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + accessTtl)
            .sign(this.keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: accessTtl, scope: scopeValue };
    }
    async issueServiceIdentityToken(params) {
        const { serviceIdentity, clientId, scope, roles, permissions, accessTokenId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
        const payload = {
            scope: scopeValue,
            client_id: clientId,
            service_identity_id: serviceIdentity.id,
            actor_type: "service_identity"
        };
        if (roles) {
            payload.roles = roles;
        }
        if (permissions) {
            payload.permissions = permissions;
        }
        let tokenBuilder = new SignJWT(payload)
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setSubject(serviceIdentity.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + accessTtl);
        if (serviceIdentity.allowedAudiences.length > 0) {
            tokenBuilder = tokenBuilder.setAudience(serviceIdentity.allowedAudiences);
        }
        const accessToken = await tokenBuilder.sign(this.keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: accessTtl, scope: scopeValue };
    }
    async issueUserAccessToken(params) {
        const { user, client, scope, accessTokenId, tenantId, accessTokenAuthorizationClaims } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = resolveAccessTokenTtlSeconds(client);
        const accessTokenPayload = {
            scope: scopeValue,
            client_id: client.id,
            tenant_id: tenantId
        };
        if (accessTokenAuthorizationClaims?.roles) {
            accessTokenPayload.roles = accessTokenAuthorizationClaims.roles;
        }
        if (accessTokenAuthorizationClaims?.groups) {
            accessTokenPayload.groups = accessTokenAuthorizationClaims.groups;
        }
        if (accessTokenAuthorizationClaims?.permissions) {
            accessTokenPayload.permissions = accessTokenAuthorizationClaims.permissions;
        }
        const accessToken = await new SignJWT(accessTokenPayload)
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + accessTtl)
            .sign(this.keys.privateKey);
        return {
            accessToken,
            tokenType: "Bearer",
            expiresIn: accessTtl,
            scope: scopeValue
        };
    }
    async issueIdToken(params) {
        const { user, client, nonce, claims } = params;
        const now = Math.floor(Date.now() / 1000);
        return await new SignJWT({
            ...(claims ?? {}),
            ...(nonce ? { nonce } : {})
        })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setIssuedAt(now)
            .setExpirationTime(now + DEFAULT_ID_TOKEN_TTL_SECONDS)
            .sign(this.keys.privateKey);
    }
    getJwks() {
        return {
            keys: [this.keys.jwk]
        };
    }
    getSigningKeys() {
        return this.keys;
    }
    async verifyAccessToken(token) {
        const { payload } = await jwtVerify(token, this.keys.publicKey, {
            issuer: this.appConfig.issuer,
            algorithms: ["RS256"]
        });
        return payload;
    }
    async signUserInfoClaims(params) {
        const now = Math.floor(Date.now() / 1000);
        return await new SignJWT(params.claims)
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid, typ: "JWT" })
            .setIssuer(this.appConfig.issuer)
            .setAudience(params.audience)
            .setSubject(params.subject)
            .setIssuedAt(now)
            .setExpirationTime(now + DEFAULT_ID_TOKEN_TTL_SECONDS)
            .sign(this.keys.privateKey);
    }
}
const JWT_VERIFICATION_ERROR_CODES = new Set([
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWS_INVALID",
    "ERR_JWT_EXPIRED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWS_ALG_NOT_ALLOWED"
]);
export const isJwtVerificationError = (error) => {
    if (!error || typeof error !== "object") {
        return false;
    }
    const candidate = error;
    if (candidate.code && JWT_VERIFICATION_ERROR_CODES.has(candidate.code)) {
        return true;
    }
    return candidate.name === "JWSSignatureVerificationFailed"
        || candidate.name === "JWSInvalid"
        || candidate.name === "JWTExpired"
        || candidate.name === "JWTClaimValidationFailed";
};
