import type { FrontChannelLogoutParams, OAuthAuthorizeParams, OAuthLogoutParams } from "./types.js";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const serializeScope = (scope?: OAuthAuthorizeParams["scope"]): string | undefined => {
  if (!scope) {
    return undefined;
  }

  return Array.isArray(scope) ? scope.join(" ") : scope;
};

/**
 * Builds a complete OAuth authorize URL from strongly typed authorize parameters.
 *
 * Use this in browser/server redirect flows before sending the user to the
 * identity provider authorization screen.
 *
 * @param baseUrl Platform base URL.
 * @param params OAuth authorize request parameters (client id, redirect URI, scopes, PKCE fields, and optional state).
 * @returns The full authorize endpoint URL including query string parameters.
 */
export const buildAuthorizeUrl = (baseUrl: string, params: OAuthAuthorizeParams): string => {
  const url = new URL(`${trimTrailingSlashes(baseUrl)}/oauth/authorize`);

  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", params.responseType ?? "code");

  const scope = serializeScope(params.scope);
  if (scope) {
    url.searchParams.set("scope", scope);
  }

  if (params.state) {
    url.searchParams.set("state", params.state);
  }

  if (params.approvalPrompt) {
    url.searchParams.set("approval_prompt", params.approvalPrompt);
  }

  if (params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge);
  }

  if (params.codeChallengeMethod) {
    url.searchParams.set("code_challenge_method", params.codeChallengeMethod);
  }

  return url.toString();
};

/**
 * Builds a federation provider start URL for external IdP sign-in.
 */
export const buildFederationStartUrl = (
  baseUrl: string,
  providerId: string,
  redirect?: string
): string => {
  const url = new URL(`${trimTrailingSlashes(baseUrl)}/auth/federation/${encodeURIComponent(providerId)}/start`);
  if (redirect) {
    url.searchParams.set("redirect", redirect);
  }
  return url.toString();
};

/**
 * Builds an RP-initiated OAuth logout URL.
 */
export const buildLogoutUrl = (baseUrl: string, params?: OAuthLogoutParams): string => {
  const url = new URL(`${trimTrailingSlashes(baseUrl)}/oauth/logout`);
  if (params?.postLogoutRedirectUri) {
    url.searchParams.set("post_logout_redirect_uri", params.postLogoutRedirectUri);
  }
  if (params?.state) {
    url.searchParams.set("state", params.state);
  }
  if (params?.clientId) {
    url.searchParams.set("client_id", params.clientId);
  }
  if (params?.idTokenHint) {
    url.searchParams.set("id_token_hint", params.idTokenHint);
  }
  return url.toString();
};

/**
 * Builds a front-channel logout URL.
 */
export const buildFrontchannelLogoutUrl = (
  baseUrl: string,
  params?: FrontChannelLogoutParams
): string => {
  const url = new URL(`${trimTrailingSlashes(baseUrl)}/oauth/frontchannel-logout`);
  if (params?.sid) {
    url.searchParams.set("sid", params.sid);
  }
  if (params?.sub) {
    url.searchParams.set("sub", params.sub);
  }
  if (params?.postLogoutRedirectUri) {
    url.searchParams.set("post_logout_redirect_uri", params.postLogoutRedirectUri);
  }
  if (params?.state) {
    url.searchParams.set("state", params.state);
  }
  return url.toString();
};