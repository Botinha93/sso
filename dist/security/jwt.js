import { jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
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
        const { user, client, scope, accessTokenId, refreshTokenId, tenantId, nonce, idTokenClaims, accessTokenAuthorizationClaims } = params;
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
        const idToken = await new SignJWT({ ...(idTokenClaims ?? {}), ...(nonce ? { nonce } : {}) })
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
        const { serviceIdentity, clientId, scope, roles, permissions, audiences, accessTokenId } = params;
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
        const effectiveAudiences = audiences ?? serviceIdentity.allowedAudiences;
        if (effectiveAudiences.length > 0) {
            tokenBuilder = tokenBuilder.setAudience(effectiveAudiences);
        }
        const accessToken = await tokenBuilder.sign(this.keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: accessTtl, scope: scopeValue };
    }
    async issueNexusBusManagementToken(params) {
        const now = Math.floor(Date.now() / 1000);
        const lifetimeSeconds = Math.min(300, Math.max(1, Math.floor(params.lifetimeSeconds)));
        return await new SignJWT({
            tenant: params.tenant,
            app: params.app,
            roles: [...params.roles],
            hub_scope: { ...params.hubScope }
        })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience("nexusbus-management")
            .setSubject(params.subject)
            .setJti(params.tokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + lifetimeSeconds)
            .sign(this.keys.privateKey);
    }
    async issueNexusBusManagementEnrollmentProof(params) {
        const now = Math.floor(Date.now() / 1000);
        return await new SignJWT({
            proof_version: 1,
            purpose: "nexusbus.management-enrollment-proof",
            challenge: params.challenge,
            hub_installation_id: params.hubInstallationId,
            enrollment: {
                ...params.enrollment,
                roles: [...params.enrollment.roles].sort()
            },
            owner_consent: "not_asserted"
        })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid, typ: "nexusbus-management-enrollment-proof.v1+jwt" })
            .setIssuer(this.appConfig.issuer)
            .setAudience("nexushub-nexusbus-management-proof")
            .setSubject(params.subject)
            .setJti(randomUUID())
            .setIssuedAt(now)
            .setExpirationTime(now + 60)
            .sign(this.keys.privateKey);
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
            // Tokens minted before the issuer was normalised carry a trailing slash.
            issuer: [this.appConfig.issuer, `${this.appConfig.issuer}/`],
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
    "ERR_JWT_INVALID",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JOSE_ALG_NOT_ALLOWED",
    "ERR_JOSE_NOT_SUPPORTED",
    "ERR_JWE_INVALID"
]);
const JWT_VERIFICATION_ERROR_NAMES = new Set([
    "JWSSignatureVerificationFailed",
    "JWSInvalid",
    "JWTExpired",
    "JWTInvalid",
    "JWTClaimValidationFailed",
    "JOSEAlgNotAllowed",
    "JOSENotSupported",
    "JWEInvalid"
]);
export const isJwtVerificationError = (error) => {
    if (!error || typeof error !== "object") {
        return false;
    }
    const candidate = error;
    if (candidate.code && JWT_VERIFICATION_ERROR_CODES.has(candidate.code)) {
        return true;
    }
    return Boolean(candidate.name && JWT_VERIFICATION_ERROR_NAMES.has(candidate.name));
};
