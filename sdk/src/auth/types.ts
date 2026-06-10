import type { AuthConfig } from "../core/types.js";

export interface PKCEPair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export type OAuthResponseType = "code" | "token" | "code token" | "code id_token" | "id_token token" | "code id_token token";

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

export interface OAuthUserInfo {
  /** Subject identifier (user id). */
  sub: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  /** Effective role names, including roles inherited via group membership. */
  roles?: string[];
  /** Names of groups the user belongs to. */
  groups?: string[];
  /** Flattened, de-duplicated permission strings granted by the user's effective roles. */
  permissions?: string[];
  [key: string]: unknown;
}

export interface UserInfoOptions {
  /**
   * When set to "signed" or "jwt", the server returns a signed JWT instead of
   * a JSON object. Use {@link getUserInfoSigned} to receive the raw JWT.
   */
  format?: "json" | "signed" | "jwt";
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

export interface LoginInput {
  email: string;
  password: string;
  clientId?: string;
  tenantSlug?: string;
  scope?: string[];
  captchaToken?: string;
  promptAcknowledged?: boolean;
}

export interface LoginSession {
  id: string;
  userId: string;
  clientId: string;
  createdAt?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface LoginSuccessResult extends OAuthTokenResponse {
  session: LoginSession;
}

export interface MfaLoginChallenge {
  mfaRequired: true;
  mfaTicket: string;
  expiresIn: number;
}

export interface WebauthnLoginChallenge {
  mfaRequired: true;
  mfaMethod: "webauthn";
  loginId: string;
  challenge: string;
  allowCredentials?: Array<{ id: string; transports?: string[] }>;
  rpId?: string;
  timeout?: number;
  [key: string]: unknown;
}

export type LoginResult = LoginSuccessResult | MfaLoginChallenge | WebauthnLoginChallenge;

export interface MfaLoginInput {
  mfaTicket: string;
  code: string;
}

export interface WebauthnLoginBeginInput {
  identifier: string;
  clientId?: string;
  tenantSlug?: string;
  scope?: string[];
}

export interface WebauthnLoginFinishInput {
  loginId: string;
  credentialId: string;
  signCount?: number;
}

export interface RecoveryRequestInput {
  identifier: string;
  clientId?: string;
  tenantSlug?: string;
}

export interface RecoveryRequestResult {
  status: "sent_if_account_exists";
  expiresIn?: number;
  recoveryTicket?: string;
  verificationCode?: string;
}

export interface RecoverInput {
  recoveryTicket: string;
  code?: string;
  verificationCode?: string;
  newPassword: string;
  clientId?: string;
  tenantSlug?: string;
  scope?: string[];
  promptAcknowledged?: boolean;
}

export interface RecoverPasswordResetResult {
  status: "password_reset";
}

export interface RecoverLoginResult extends LoginSuccessResult {
  recovery: true;
}

export type RecoverResult = RecoverPasswordResetResult | RecoverLoginResult;

export interface PublicFederationProvider {
  id: string;
  label: string;
}

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  device_authorization_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  [key: string]: unknown;
}

export interface JwksResponse {
  keys: Array<Record<string, unknown>>;
}

export interface IntrospectTokenInput {
  token: string;
  clientId: string;
  clientSecret: string;
  tokenTypeHint?: OAuthTokenTypeHint;
}

export interface TokenIntrospectionResult {
  active: boolean;
  [key: string]: unknown;
}

export interface DeviceAuthorizationInput {
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface DeviceVerificationInput {
  userCode: string;
  username: string;
  password: string;
  approve?: boolean;
}

export interface DeviceVerificationResult {
  status: "approved" | "denied";
  [key: string]: unknown;
}

export interface DeviceCodeTokenInput {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
}

export interface PasswordGrantInput {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  scope?: OAuthScope;
  captchaToken?: string;
  promptAcknowledged?: boolean;
}

export interface DynamicClientRegistrationInput {
  appId?: string;
  clientName?: string;
  redirectUris: string[];
  grantTypes?: OAuthGrantType[];
  responseTypes?: OAuthResponseType[];
  scope?: string;
  tokenEndpointAuthMethod?: "client_secret_post";
}

export type OAuthGrantType = "authorization_code" | "client_credentials" | "refresh_token" | "password" | "device_code" | "token_exchange" | "jwt_bearer" | "saml2_bearer" | "ciba";

export interface DynamicClientRegistrationResult {
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  app_id?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: OAuthGrantType[];
  token_endpoint_auth_method: string;
  scope: string;
}

export interface BackchannelLogoutInput {
  clientId: string;
  clientSecret: string;
  sid?: string;
  sub?: string;
}

export interface BackchannelLogoutResult {
  revoked: number;
}

export interface OAuthLogoutParams {
  postLogoutRedirectUri?: string;
  state?: string;
  clientId?: string;
  idTokenHint?: string;
}

export interface FrontChannelLogoutParams {
  sid?: string;
  sub?: string;
  postLogoutRedirectUri?: string;
  state?: string;
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
  /**
   * Fetches the OIDC UserInfo claims for the bearer token configured on the client.
   *
   * The response always includes `roles`, `groups`, and the flattened set of
   * `roles`, `groups`, and `permissions` when the corresponding scopes were granted.
   */
  getUserInfo(options?: UserInfoOptions): Promise<OAuthUserInfo>;
  /**
   * Fetches the OIDC UserInfo claims as a signed JWT (`application/jwt`).
   */
  getUserInfoSigned(): Promise<string>;
  /** Interactive username/password login. Returns tokens or an MFA challenge (`202`). */
  login(input: LoginInput): Promise<LoginResult>;
  /** Completes TOTP MFA after an interactive login challenge. */
  loginMfa(input: MfaLoginInput): Promise<LoginSuccessResult>;
  /** Starts passkey-based interactive login. */
  loginWebauthnBegin(input: WebauthnLoginBeginInput): Promise<WebauthnLoginChallenge>;
  /** Completes passkey-based interactive login. */
  loginWebauthnFinish(input: WebauthnLoginFinishInput): Promise<LoginSuccessResult>;
  /** Requests account recovery for an identifier (enumeration-safe). */
  requestRecovery(input: RecoveryRequestInput): Promise<RecoveryRequestResult>;
  /** Completes account recovery and optionally signs the user in. */
  recover(input: RecoverInput): Promise<RecoverResult>;
  /** Ends the current browser session. */
  logout(): Promise<void>;
  /** Lists enabled public federation providers for sign-in. */
  listFederationProviders(): Promise<PublicFederationProvider[]>;
  /** Fetches the OIDC discovery document. */
  getDiscoveryDocument(): Promise<OidcDiscoveryDocument>;
  /** Fetches the platform JWKS document. */
  getJwks(): Promise<JwksResponse>;
  /** Introspects an access or refresh token. */
  introspectToken(input: IntrospectTokenInput): Promise<TokenIntrospectionResult>;
  /** Starts the OAuth device authorization flow. */
  startDeviceAuthorization(input: DeviceAuthorizationInput): Promise<DeviceAuthorizationResponse>;
  /** Approves or denies a device authorization user code. */
  verifyDeviceCode(input: DeviceVerificationInput): Promise<DeviceVerificationResult>;
  /** Exchanges a device code for tokens. */
  exchangeDeviceCode(input: DeviceCodeTokenInput): Promise<OAuthTokenResponse>;
  /** Exchanges username/password credentials for tokens (resource owner password grant). */
  exchangePassword(input: PasswordGrantInput): Promise<OAuthTokenResponse>;
  /** Dynamically registers an OAuth client. */
  registerClient(input: DynamicClientRegistrationInput): Promise<DynamicClientRegistrationResult>;
  /** Performs OAuth backchannel logout for matching sessions. */
  backchannelLogout(input: BackchannelLogoutInput): Promise<BackchannelLogoutResult>;
}