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
        const { user, client, scope, roles, accessTokenId, refreshTokenId, tenantId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = resolveAccessTokenTtlSeconds(client);
        const refreshTtl = resolveRefreshTokenTtlSeconds(client);
        const accessToken = await new SignJWT({
            scope: scopeValue,
            roles,
            client_id: client.id,
            tenant_id: tenantId
        })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setSubject(user.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + accessTtl)
            .sign(this.keys.privateKey);
        const idToken = await new SignJWT({
            email: user.email,
            preferred_username: user.username,
            given_name: user.givenName,
            family_name: user.familyName
        })
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
        let tokenBuilder = new SignJWT({
            scope: scopeValue,
            client_id: clientId,
            service_identity_id: serviceIdentity.id,
            actor_type: "service_identity",
            roles,
            permissions
        })
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
        const { user, client, scope, roles, accessTokenId, tenantId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessTtl = resolveAccessTokenTtlSeconds(client);
        const accessToken = await new SignJWT({
            scope: scopeValue,
            roles,
            client_id: client.id,
            tenant_id: tenantId
        })
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
        const { user, client, nonce } = params;
        const now = Math.floor(Date.now() / 1000);
        return await new SignJWT({
            email: user.email,
            preferred_username: user.username,
            given_name: user.givenName,
            family_name: user.familyName,
            nonce
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
