import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { approveConsent, createTestContext, loginAsAdmin, registerClientAsAdmin } from "../helpers/test-app.js";

test("prompt=select_account shows account selection before issuing an authorization response", async (t) => {
  const { app, admin } = await createTestContext("oauth-account-selection");
  t.after(async () => app.close());

  const registration = await registerClientAsAdmin(app, admin, {
    client_name: "Account selection client",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "openid profile email"
  });
  assert.equal(registration.statusCode, 201);
  const clientId = String(registration.json().client_id);
  const sid = await loginAsAdmin(app, admin);
  const challenge = createHash("sha256").update("account-selection").digest("base64url");
  const authorizeUrl = `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent("http://localhost:3000/callback")}&scope=openid%20profile%20email&prompt=select_account&code_challenge=${challenge}&code_challenge_method=S256`;
  await approveConsent(app, sid, authorizeUrl);

  const selection = await app.inject({ method: "GET", url: authorizeUrl, headers: { cookie: sid } });
  assert.equal(selection.statusCode, 302);
  const selectionLocation = String(selection.headers.location);
  assert.match(selectionLocation, /^\/login\?/);
  assert.match(selectionLocation, /account_selection=1/);

  const continued = await app.inject({ method: "GET", url: `${authorizeUrl}&account_selection=continue`, headers: { cookie: sid } });
  assert.equal(continued.statusCode, 302);
  assert.match(String(continued.headers.location), /^http:\/\/localhost:3000\/callback\?code=/);
});
