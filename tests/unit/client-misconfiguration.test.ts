import test from "node:test";
import assert from "node:assert/strict";
import { findClientMisconfiguration } from "../../src/services/auth-service.js";

const configured = {
  secret: "a-perfectly-good-client-secret",
  grants: ["authorization_code" as const],
  allowedScopes: ["openid"],
  redirectUris: ["http://localhost:3000/callback"]
};

test("a fully configured client has no misconfiguration", () => {
  assert.equal(findClientMisconfiguration(configured, { requireRedirectUris: true }), undefined);
});

test("a blank secret is reported as client_secret_missing", () => {
  assert.equal(findClientMisconfiguration({ ...configured, secret: "" }), "client_secret_missing");
  assert.equal(findClientMisconfiguration({ ...configured, secret: "   " }), "client_secret_missing");
});

test("empty grants and scopes are reported", () => {
  assert.equal(findClientMisconfiguration({ ...configured, grants: [] }), "grants_missing");
  assert.equal(findClientMisconfiguration({ ...configured, allowedScopes: [] }), "allowed_scopes_missing");
});

test("redirect URIs are only required for redirecting flows", () => {
  const client = { ...configured, redirectUris: [] };
  assert.equal(findClientMisconfiguration(client), undefined);
  assert.equal(findClientMisconfiguration(client, { requireRedirectUris: true }), "redirect_uris_missing");
});
