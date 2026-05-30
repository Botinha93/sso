import type { ClientInstance } from "../core/types.js";
import type {
  AuthAPI,
  AuthorizationCodeTokenInput,
  CibaApprovalInput,
  CibaAuthenticationRequestInput,
  CibaAuthenticationResponse,
  CibaTokenInput,
  ClientCredentialsInput,
  JwtBearerTokenInput,
  OAuthTokenResponse,
  OAuthUserInfo,
  RefreshTokenInput,
  RevokeTokenInput,
  Saml2BearerTokenInput,
  TokenExchangeInput,
  UserInfoOptions
} from "./types.js";

const serializeScope = (scope?: string | string[]): string | undefined => {
  if (!scope) {
    return undefined;
  }

  return Array.isArray(scope) ? scope.join(" ") : scope;
};

const serializeAudience = (audience?: string | string[]): string | undefined => {
  if (!audience) {
    return undefined;
  }

  return Array.isArray(audience) ? audience.join(" ") : audience;
};

const authorizationCodeBody = (input: AuthorizationCodeTokenInput) => ({
  grant_type: "authorization_code" as const,
  code: input.code,
  client_id: input.clientId,
  client_secret: input.clientSecret,
  redirect_uri: input.redirectUri,
  code_verifier: input.codeVerifier
});

const refreshTokenBody = (input: RefreshTokenInput) => ({
  grant_type: "refresh_token" as const,
  refresh_token: input.refreshToken,
  client_id: input.clientId,
  client_secret: input.clientSecret
});

const clientCredentialsBody = (input: ClientCredentialsInput) => ({
  grant_type: "client_credentials" as const,
  client_id: input.clientId,
  client_secret: input.clientSecret,
  scope: serializeScope(input.scope)
});

const jwtBearerBody = (input: JwtBearerTokenInput) => ({
  grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" as const,
  assertion: input.assertion,
  client_id: input.clientId,
  client_secret: input.clientSecret,
  scope: serializeScope(input.scope)
});

const saml2BearerBody = (input: Saml2BearerTokenInput) => ({
  grant_type: "urn:ietf:params:oauth:grant-type:saml2-bearer" as const,
  assertion: input.assertion,
  client_id: input.clientId,
  client_secret: input.clientSecret,
  scope: serializeScope(input.scope)
});

const cibaTokenBody = (input: CibaTokenInput) => ({
  grant_type: "urn:openid:params:grant-type:ciba" as const,
  auth_req_id: input.authReqId,
  client_id: input.clientId,
  client_secret: input.clientSecret
});

const revokeTokenBody = (input: RevokeTokenInput) => ({
  token: input.token,
  token_type_hint: input.tokenTypeHint
});

const tokenExchangeBody = (input: TokenExchangeInput) => ({
  grant_type: "urn:ietf:params:oauth:grant-type:token-exchange" as const,
  subject_token: input.subjectToken,
  subject_token_type: input.subjectTokenType,
  requested_token_type: input.requestedTokenType,
  audience: serializeAudience(input.audience),
  scope: serializeScope(input.scope),
  client_id: input.clientId,
  client_secret: input.clientSecret
});

/**
 * Creates a typed OAuth helper API over the provided SDK client.
 *
 * Use this for token lifecycle operations (authorization code, refresh, client
 * credentials, token exchange, and revoke) against the platform OAuth endpoints.
 *
 * @param client Base client instance used to perform OAuth endpoint calls.
 * @returns An auth API with helpers for authorization code, refresh token, client credentials, token exchange, and revoke flows.
 */
export const createAuthAPI = (client: ClientInstance): AuthAPI => ({
  exchangeAuthorizationCode: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: authorizationCodeBody(input) }),
  exchangeRefreshToken: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: refreshTokenBody(input) }),
  exchangeClientCredentials: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: clientCredentialsBody(input) }),
  exchangeJwtBearer: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: jwtBearerBody(input) }),
  exchangeSaml2Bearer: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: saml2BearerBody(input) }),
  startCibaAuthentication: (input: CibaAuthenticationRequestInput) => client.post<CibaAuthenticationResponse>("/oauth/ciba/authenticate", {
    body: {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      login_hint: input.loginHint,
      scope: serializeScope(input.scope),
      binding_message: input.bindingMessage,
      user_code: input.userCode
    }
  }),
  approveCibaAuthentication: (input: CibaApprovalInput) => client.post<{ status: "approved" | "denied" }>("/oauth/ciba/approve", {
    body: {
      auth_req_id: input.authReqId,
      username: input.username,
      password: input.password,
      approve: input.approve ?? true
    }
  }),
  exchangeCibaToken: (input) => client.post<OAuthTokenResponse>("/oauth/token", { body: cibaTokenBody(input) }),
  exchangeToken: (input) => client.post<OAuthTokenResponse>("/oauth/token/exchange", { body: tokenExchangeBody(input) }),
  revokeToken: async (input: RevokeTokenInput) => {
    await client.post("/oauth/token/revoke", { body: revokeTokenBody(input) });
  },
  getUserInfo: (options?: UserInfoOptions) => {
    const format = options?.format;
    const query = format && format !== "json" ? { format } : undefined;
    return client.get<OAuthUserInfo>("/oauth/userinfo", { query });
  },
  getUserInfoSigned: () => client.get<string>("/oauth/userinfo", {
    query: { format: "signed" },
    parseAs: "text"
  })
});