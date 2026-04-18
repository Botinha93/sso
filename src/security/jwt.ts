import { jwtVerify, SignJWT } from "jose";
import type { SigningKeys } from "./keys.js";
import type { AppConfig } from "../core/config.js";
import type { OAuthClient, TokenBundle, User } from "../domain/models.js";

export class JwtService {
  constructor(
    private readonly keys: SigningKeys,
    private readonly appConfig: AppConfig
  ) {}

  async issueTokens(params: {
    user: User;
    client: OAuthClient;
    scope: string[];
    roles: string[];
    accessTokenId: string;
    refreshTokenId: string;
    tenantId?: string;
  }): Promise<TokenBundle> {
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

  async issueClientCredentialsToken(params: {
    client: OAuthClient;
    scope: string[];
    accessTokenId: string;
  }) {
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

  async issueUserAccessToken(params: {
    user: User;
    client: OAuthClient;
    scope: string[];
    roles: string[];
    accessTokenId: string;
    tenantId?: string;
  }) {
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
      tokenType: "Bearer" as const,
      expiresIn: this.appConfig.ttl.accessTokenSeconds,
      scope: scopeValue
    };
  }

  getJwks() {
    return {
      keys: [this.keys.jwk]
    };
  }

  async verifyAccessToken(token: string) {
    const { payload } = await jwtVerify(token, this.keys.publicKey, {
      issuer: this.appConfig.issuer
    });

    return payload;
  }

  async signUserInfoClaims(params: {
    claims: Record<string, unknown>;
    audience: string;
    subject: string;
  }) {
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
