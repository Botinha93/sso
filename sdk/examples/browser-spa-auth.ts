import {
  buildAuthorizeUrl,
  createAuthAPI,
  createClient,
  generatePKCEPair
} from "../src/index.js";

async function startBrowserSpaAuthFlow() {
  const baseUrl = "https://iam.example.com";
  const clientId = "portal-spa";
  const redirectUri = "https://app.example.com/callback";

  const client = createClient({ baseUrl });
  const auth = createAuthAPI(client);
  const pkce = await generatePKCEPair();

  sessionStorage.setItem("pkce_verifier", pkce.codeVerifier);

  const authorizeUrl = buildAuthorizeUrl(baseUrl, {
    clientId,
    redirectUri,
    responseType: "code",
    scope: ["openid", "profile", "email"],
    state: "spa-demo-state",
    codeChallenge: pkce.codeChallenge,
    codeChallengeMethod: pkce.codeChallengeMethod
  });

  console.log("Redirect to:", authorizeUrl);

  const callbackCode = "authorization-code-from-callback";
  const codeVerifier = sessionStorage.getItem("pkce_verifier")!;

  const token = await auth.exchangeAuthorizationCode({
    clientId,
    clientSecret: "replace-with-spa-client-secret",
    code: callbackCode,
    redirectUri,
    codeVerifier
  });

  console.log("Access token:", token.access_token);

  if (token.refresh_token) {
    const refreshed = await auth.exchangeRefreshToken({
      clientId,
      clientSecret: "replace-with-spa-client-secret",
      refreshToken: token.refresh_token
    });

    console.log("Refreshed access token:", refreshed.access_token);
  }
}

void startBrowserSpaAuthFlow();
