import {
  createAuthAPI,
  createClient
} from "../src/index.js";

async function main() {
  const baseUrl = "https://iam.example.com";
  const auth = createAuthAPI(createClient({ baseUrl }));

  const jwtBearerToken = await auth.exchangeJwtBearer({
    clientId: "enterprise-client",
    clientSecret: "replace-with-client-secret",
    assertion: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    scope: ["openid", "profile", "email"]
  });

  console.log("JWT bearer access token:", jwtBearerToken.access_token);

  const samlAssertionXml = `<saml:Assertion xmlns:saml=\"urn:oasis:names:tc:SAML:2.0:assertion\"><saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject></saml:Assertion>`;
  const saml2BearerToken = await auth.exchangeSaml2Bearer({
    clientId: "enterprise-client",
    clientSecret: "replace-with-client-secret",
    assertion: Buffer.from(samlAssertionXml, "utf8").toString("base64"),
    scope: ["openid", "profile"]
  });

  console.log("SAML2 bearer access token:", saml2BearerToken.access_token);

  const cibaStart = await auth.startCibaAuthentication({
    clientId: "enterprise-client",
    clientSecret: "replace-with-client-secret",
    loginHint: "user@example.com",
    scope: ["openid", "profile"],
    bindingMessage: "Approve sign-in from support console"
  });

  // In real deployments approval is decoupled and handled by a user-facing channel.
  await auth.approveCibaAuthentication({
    authReqId: cibaStart.auth_req_id,
    username: "user@example.com",
    password: "replace-with-user-password",
    approve: true
  });

  const cibaToken = await auth.exchangeCibaToken({
    clientId: "enterprise-client",
    clientSecret: "replace-with-client-secret",
    authReqId: cibaStart.auth_req_id
  });

  console.log("CIBA access token:", cibaToken.access_token);
}

void main();
