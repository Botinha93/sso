import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie, registerClientAsAdmin } from "../helpers/test-app.js";

test("OAuth token exchange: valid access token yields new exchanged token", async (t) => {
  const { app, admin } = await createTestContext("integration-token-exchange");

  t.after(async () => {
    await app.close();
  });

  // Obtain a valid access token from interactive login response
  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(loginResponse.statusCode, 200);
  const loginPayload = loginResponse.json() as { accessToken?: string; access_token?: string };
  const accessToken = loginPayload.accessToken ?? loginPayload.access_token;
  assert.ok(typeof accessToken === "string" && accessToken.length > 0);

  const registered = await registerClientAsAdmin(app, admin, {
    client_name: "Exchange Client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["token_exchange"],
    scope: "openid profile email"
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const exchangeClient = registered.json() as { client_id: string; client_secret: string };

  // Exchange without client authentication must be refused.
  const anonymousExchange = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile"
    }
  });
  assert.equal(anonymousExchange.statusCode, 401);

  // Scope can be narrowed but never widened beyond the subject token.
  const escalatedExchange = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile permissions",
      client_id: exchangeClient.client_id,
      client_secret: exchangeClient.client_secret
    }
  });
  assert.equal(escalatedExchange.statusCode, 400);

  // Perform token exchange
  const exchangeResponse = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: accessToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile",
      client_id: exchangeClient.client_id,
      client_secret: exchangeClient.client_secret
    },
  });

  assert.equal(exchangeResponse.statusCode, 200, exchangeResponse.body);
  const exchanged = exchangeResponse.json() as {
    access_token: string;
    token_type: string;
    issued_token_type: string;
  };
  assert.ok(typeof exchanged.access_token === "string" && exchanged.access_token.length > 0);
  assert.equal(exchanged.token_type, "Bearer");
  assert.equal(exchanged.issued_token_type, "urn:ietf:params:oauth:token-type:access_token");
  assert.notEqual(exchanged.access_token, accessToken, "Exchanged token must differ from original");
});

test("OAuth token exchange: invalid subject_token returns 401", async (t) => {
  const { app } = await createTestContext("integration-token-exchange-invalid");

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "invalid.jwt.token",
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
    },
  });

  assert.equal(response.statusCode, 401);
});
