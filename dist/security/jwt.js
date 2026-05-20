import { jwtVerify, SignJWT } from "jose";
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
            .setExpirationTime(now + this.appConfig.ttl.accessTokenSeconds)
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
            .setExpirationTime(now + this.appConfig.ttl.idTokenSeconds)
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
            .setExpirationTime(now + this.appConfig.ttl.refreshTokenSeconds)
            .sign(this.keys.privateKey);
        return {
            accessToken,
            idToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: this.appConfig.ttl.accessTokenSeconds,
            scope: scopeValue
        };
    }
    async issueClientCredentialsToken(params) {
        const { client, scope, accessTokenId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
        const accessToken = await new SignJWT({ scope: scopeValue, client_id: client.id })
            .setProtectedHeader({ alg: "RS256", kid: this.keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setAudience(client.id)
            .setJti(accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + this.appConfig.ttl.accessTokenSeconds)
            .sign(this.keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: this.appConfig.ttl.accessTokenSeconds, scope: scopeValue };
    }
    async issueServiceIdentityToken(params) {
        const { serviceIdentity, clientId, scope, roles, permissions, accessTokenId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
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
            .setExpirationTime(now + this.appConfig.ttl.accessTokenSeconds);
        if (serviceIdentity.allowedAudiences.length > 0) {
            tokenBuilder = tokenBuilder.setAudience(serviceIdentity.allowedAudiences);
        }
        const accessToken = await tokenBuilder.sign(this.keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: this.appConfig.ttl.accessTokenSeconds, scope: scopeValue };
    }
    async issueUserAccessToken(params) {
        const { user, client, scope, roles, accessTokenId, tenantId } = params;
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = scope.join(" ");
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
            .setExpirationTime(now + this.appConfig.ttl.accessTokenSeconds)
            .sign(this.keys.privateKey);
        return {
            accessToken,
            tokenType: "Bearer",
            expiresIn: this.appConfig.ttl.accessTokenSeconds,
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
            .setExpirationTime(now + this.appConfig.ttl.idTokenSeconds)
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
            .setExpirationTime(now + this.appConfig.ttl.idTokenSeconds)
            .sign(this.keys.privateKey);
    }
}
