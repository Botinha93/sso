import {
  APIResponseError,
  createAuthAPI,
  createClient
} from "../src/index.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getOAuthErrorCode = (error: APIResponseError): string | undefined => {
  const details = error.details as { error?: string } | undefined;
  return details?.error;
};

async function main() {
  const baseUrl = "https://iam.example.com";
  const auth = createAuthAPI(createClient({ baseUrl }));

  const cibaStart = await auth.startCibaAuthentication({
    clientId: "enterprise-client",
    clientSecret: "replace-with-client-secret",
    loginHint: "user@example.com",
    scope: ["openid", "profile"],
    bindingMessage: "Approve sign-in from support console"
  });

  let delayMs = cibaStart.interval * 1000;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await sleep(delayMs);

    try {
      const token = await auth.exchangeCibaToken({
        clientId: "enterprise-client",
        clientSecret: "replace-with-client-secret",
        authReqId: cibaStart.auth_req_id
      });

      console.log("CIBA approved; access token:", token.access_token);
      return;
    } catch (error) {
      if (!(error instanceof APIResponseError)) {
        throw error;
      }

      const oauthError = getOAuthErrorCode(error);

      if (oauthError === "authorization_pending") {
        console.log(`Attempt ${attempt}: authorization is still pending.`);
        continue;
      }

      if (oauthError === "slow_down") {
        delayMs += 1000;
        console.log(`Attempt ${attempt}: server requested slower polling. New interval ${delayMs}ms.`);
        continue;
      }

      // access_denied, expired_token, invalid_grant, or any other terminal error
      throw error;
    }
  }

  console.log("No terminal result yet; continue polling or request user action.");
}

void main();
