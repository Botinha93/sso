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
    getJwks() {
        return {
            keys: [this.keys.jwk]
        };
    }
    async verifyAccessToken(token) {
        const { payload } = await jwtVerify(token, this.keys.publicKey, {
            issuer: this.appConfig.issuer
        });
        return payload;
    }
}
