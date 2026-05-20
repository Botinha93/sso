export class OidcService {
    appConfig;
    jwtService;
    constructor(appConfig, jwtService) {
        this.appConfig = appConfig;
        this.jwtService = jwtService;
    }
    discoveryDocument() {
        const issuer = this.appConfig.issuer;
        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            device_authorization_endpoint: `${issuer}/oauth/device/authorize`,
            backchannel_authentication_endpoint: `${issuer}/oauth/ciba/authenticate`,
            registration_endpoint: `${issuer}/connect/register`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            frontchannel_logout_supported: true,
            frontchannel_logout_session_supported: true,
            backchannel_logout_supported: true,
            backchannel_logout_session_supported: true,
            response_types_supported: ["code", "token", "code token", "code id_token", "id_token token", "code id_token token"],
            response_modes_supported: ["query", "fragment", "form_post"],
            backchannel_token_delivery_modes_supported: ["poll", "ping", "push"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
            token_endpoint_auth_methods_supported: ["client_secret_post"],
            scopes_supported: ["openid", "profile", "email", "offline_access", "roles"],
            claims_supported: [
                "sub",
                "iss",
                "aud",
                "exp",
                "iat",
                "email",
                "preferred_username",
                "given_name",
                "family_name"
            ],
            grant_types_supported: [
                "authorization_code",
                "refresh_token",
                "client_credentials",
                "password",
                "urn:ietf:params:oauth:grant-type:device_code",
                "urn:ietf:params:oauth:grant-type:token-exchange",
                "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "urn:ietf:params:oauth:grant-type:saml2-bearer",
                "urn:openid:params:grant-type:ciba"
            ],
            code_challenge_methods_supported: ["S256"]
        };
    }
    jwks() {
        return this.jwtService.getJwks();
    }
    async mintExchangeToken(input) {
        const { nanoid } = await import("nanoid");
        const { SignJWT } = await import("jose");
        const keys = this.jwtService.getSigningKeys();
        const now = Math.floor(Date.now() / 1000);
        const scopeValue = input.scopes.join(" ");
        let tokenBuilder = new SignJWT({ scope: scopeValue })
            .setProtectedHeader({ alg: "RS256", kid: keys.kid })
            .setIssuer(this.appConfig.issuer)
            .setSubject(input.sub)
            .setJti(input.accessTokenId)
            .setIssuedAt(now)
            .setExpirationTime(now + this.appConfig.ttl.accessTokenSeconds);
        if (input.audiences && input.audiences.length > 0) {
            tokenBuilder = tokenBuilder.setAudience(input.audiences);
        }
        const accessToken = await tokenBuilder.sign(keys.privateKey);
        return { accessToken, tokenType: "Bearer", expiresIn: this.appConfig.ttl.accessTokenSeconds, scope: scopeValue };
    }
}
