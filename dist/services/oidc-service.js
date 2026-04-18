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
            registration_endpoint: `${issuer}/connect/register`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            frontchannel_logout_supported: true,
            frontchannel_logout_session_supported: true,
            backchannel_logout_supported: true,
            backchannel_logout_session_supported: true,
            response_types_supported: ["code", "token"],
            response_modes_supported: ["query", "fragment", "form_post"],
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
                "urn:ietf:params:oauth:grant-type:device_code"
            ],
            code_challenge_methods_supported: ["S256"]
        };
    }
    jwks() {
        return this.jwtService.getJwks();
    }
}
