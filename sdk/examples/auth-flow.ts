import {
  buildAuthorizeUrl,
  createAuthAPI,
  createClient,
  generatePKCEPair
} from "../src/index.js";

async function main() {
  const baseUrl = "https://iam.example.com";
  const client = createClient({ baseUrl });
  const auth = createAuthAPI(client);
  const pkce = await generatePKCEPair();

  const authorizeUrl = buildAuthorizeUrl(baseUrl, {
    clientId: "demo-spa",
    redirectUri: "https://app.example.com/callback",
    responseType: "code",
    scope: ["openid", "profile", "email"],
    state: "demo-state",
    codeChallenge: pkce.codeChallenge,
    codeChallengeMethod: pkce.codeChallengeMethod
  });

  console.log("Redirect the user to:", authorizeUrl);

  const token = await auth.exchangeAuthorizationCode({
    clientId: "demo-spa",
    clientSecret: "replace-with-client-secret",
    code: "authorization-code-from-callback",
    codeVerifier: pkce.codeVerifier,
    redirectUri: "https://app.example.com/callback"
  });

  console.log("Access token received:", token.access_token);

  if (token.refresh_token) {
    const refreshed = await auth.exchangeRefreshToken({
      clientId: "demo-spa",
      clientSecret: "replace-with-client-secret",
      refreshToken: token.refresh_token
    });

    console.log("Refreshed access token:", refreshed.access_token);

    await auth.revokeToken({
      token: refreshed.refresh_token ?? token.refresh_token,
      tokenTypeHint: "refresh_token"
    });
  }
}

void main();