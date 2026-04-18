import type { AppConfig } from "../core/config.js";
import { JwtService } from "../security/jwt.js";

export class OidcService {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly jwtService: JwtService
  ) {}

  discoveryDocument() {
    const issuer = this.appConfig.issuer;

    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      response_types_supported: ["code"],
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
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      code_challenge_methods_supported: ["S256"]
    };
  }

  jwks() {
    return this.jwtService.getJwks();
  }
}
