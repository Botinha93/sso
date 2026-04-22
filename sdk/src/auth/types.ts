import type { AuthConfig } from "../core/types.js";

export interface PKCEPair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export type OAuthResponseType = "code" | "token";

export type OAuthScope = string | string[];

export type OAuthTokenTypeHint = "access_token" | "refresh_token";

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  [key: string]: unknown;
}

export interface OAuthAuthorizeParams {
  clientId: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  approvalPrompt?: "auto" | "force";
  redirectUri: string;
  responseType?: OAuthResponseType;
  scope?: OAuthScope;
  state?: string;
}

export interface SessionAuthConfig extends Extract<AuthConfig, { type: "session" }> {}

export interface BearerAuthConfig extends Extract<AuthConfig, { type: "bearer" }> {}

export interface AuthorizationCodeTokenInput {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier?: string;
  redirectUri: string;
}

export interface RefreshTokenInput {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface ClientCredentialsInput {
  clientId: string;
  clientSecret: string;
  scope?: OAuthScope;
}

export interface RevokeTokenInput {
  token: string;
  tokenTypeHint?: OAuthTokenTypeHint;
}

export interface TokenExchangeInput {
  subjectToken: string;
  subjectTokenType: string;
  audience?: string;
  clientId?: string;
  clientSecret?: string;
  requestedTokenType?: string;
  scope?: OAuthScope;
}

export interface AuthAPI {
  /**
   * Exchanges an authorization code for tokens.
   *
   * Use this after the OAuth redirect callback in authorization code flow.
   */
  exchangeAuthorizationCode(input: AuthorizationCodeTokenInput): Promise<OAuthTokenResponse>;
  /**
   * Exchanges client credentials for an access token.
   *
   * Use this for machine-to-machine integrations.
   */
  exchangeClientCredentials(input: ClientCredentialsInput): Promise<OAuthTokenResponse>;
  /**
   * Exchanges a refresh token for a new access token.
   */
  exchangeRefreshToken(input: RefreshTokenInput): Promise<OAuthTokenResponse>;
  /**
   * Performs OAuth token exchange.
   *
   * Use this to mint a token for a different audience/scope from a subject token.
   */
  exchangeToken(input: TokenExchangeInput): Promise<OAuthTokenResponse>;
  /**
   * Revokes an access or refresh token.
   */
  revokeToken(input: RevokeTokenInput): Promise<void>;
}