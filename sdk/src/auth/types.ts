import type { AuthConfig } from "../core/types.js";

export interface PKCEPair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export type OAuthResponseType = "code" | "token" | "code token";

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

export interface JwtBearerTokenInput {
  clientId: string;
  clientSecret: string;
  assertion: string;
  scope?: OAuthScope;
}

export interface Saml2BearerTokenInput {
  clientId: string;
  clientSecret: string;
  assertion: string;
  scope?: OAuthScope;
}

export interface CibaAuthenticationRequestInput {
  clientId: string;
  clientSecret: string;
  loginHint: string;
  scope?: OAuthScope;
  bindingMessage?: string;
  userCode?: string;
}

export interface CibaAuthenticationResponse {
  auth_req_id: string;
  expires_in: number;
  interval: number;
}

export interface CibaApprovalInput {
  authReqId: string;
  username: string;
  password: string;
  approve?: boolean;
}

export interface CibaTokenInput {
  clientId: string;
  clientSecret: string;
  authReqId: string;
}

export interface RevokeTokenInput {
  token: string;
  tokenTypeHint?: OAuthTokenTypeHint;
}

export type OAuthAudience = string | string[];

export interface TokenExchangeInput {
  subjectToken: string;
  subjectTokenType: string;
  audience?: OAuthAudience;
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
   * Exchanges a JWT bearer assertion for an access token.
   */
  exchangeJwtBearer(input: JwtBearerTokenInput): Promise<OAuthTokenResponse>;
  /**
   * Exchanges a SAML2 bearer assertion for an access token.
   */
  exchangeSaml2Bearer(input: Saml2BearerTokenInput): Promise<OAuthTokenResponse>;
  /**
   * Starts a CIBA backchannel authentication request.
   */
  startCibaAuthentication(input: CibaAuthenticationRequestInput): Promise<CibaAuthenticationResponse>;
  /**
   * Approves or denies a CIBA auth request.
   */
  approveCibaAuthentication(input: CibaApprovalInput): Promise<{ status: "approved" | "denied" }>;
  /**
   * Polls CIBA token endpoint using auth_req_id.
   */
  exchangeCibaToken(input: CibaTokenInput): Promise<OAuthTokenResponse>;
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