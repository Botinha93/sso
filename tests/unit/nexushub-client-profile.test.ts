import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  deriveLiberIDEClientProfile,
  deriveNexusHubClientProfile,
  liberIDEClientProfileDigest,
  NexusHubClientProfileError,
  nexusHubClientProfileDigest
} from "../../src/services/nexushub-client-profile.js";

const enrollment = { profileId: "nexushub", profileVersion: 1, publicOrigin: "https://hub.example.test" };

test("derives the reviewed OAuth profile from only the issuer-pinned origin", () => {
  const profile = deriveNexusHubClientProfile(enrollment);
  assert.deepEqual(profile.redirectUris, ["https://hub.example.test/auth/callback"]);
  assert.deepEqual(profile.grants, ["authorization_code", "refresh_token", "token_exchange"]);
  assert.equal(profile.requirePkce, true);
  assert.equal(profile.tokenEndpointAuthMethod, "client_secret_post");
  assert.equal(profile.allowedScopes.length, 12);
});

test("matches the checked-in NexusHub OIDC profile scope and grant contract", () => {
  const configured = JSON.parse(readFileSync(new URL("../../config/nexushub-oidc-profile.json", import.meta.url), "utf8"));
  const profile = deriveNexusHubClientProfile(enrollment);
  assert.equal(configured.profileId, profile.profileId);
  assert.equal(configured.profileVersion, profile.profileVersion);
  assert.deepEqual(configured.grantTypes, profile.grants);
  assert.deepEqual(configured.identityScopes.concat(configured.hubScopes.map((scope: { name: string }) => scope.name)).sort(), [...profile.allowedScopes].sort());
  assert.equal(configured.redirectPath, "/auth/callback");
  assert.equal(configured.tokenEndpointAuthMethod, profile.tokenEndpointAuthMethod);
});

test("rejects unsupported profile versions and caller-selected registration fields", () => {
  assert.throws(() => deriveNexusHubClientProfile({ ...enrollment, profileVersion: 2 }), NexusHubClientProfileError);
  assert.throws(() => deriveNexusHubClientProfile({ ...enrollment, profileId: "other" }), NexusHubClientProfileError);
  // Extra request properties cannot override the server-derived redirect or scopes.
  const profile = deriveNexusHubClientProfile({ ...enrollment, redirectUris: ["https://attacker.test/callback"], scopes: ["*"], grants: ["client_credentials"] });
  assert.deepEqual(profile.redirectUris, ["https://hub.example.test/auth/callback"]);
  assert.equal(profile.allowedScopes.includes("*" as never), false);
  assert.equal(profile.grants.includes("client_credentials" as never), false);
});

test("requires the enrolled origin to be a canonical HTTPS origin", () => {
  for (const publicOrigin of ["http://hub.example.test", "https://hub.example.test/path", "https://hub.example.test?x=1", "https://user:pass@hub.example.test", "https://hub.example.test/"]) {
    assert.throws(() => deriveNexusHubClientProfile({ ...enrollment, publicOrigin }), NexusHubClientProfileError, publicOrigin);
  }
});

test("canonical profile digest is stable and origin-specific", () => {
  const first = deriveNexusHubClientProfile(enrollment);
  const second = deriveNexusHubClientProfile({ ...enrollment, publicOrigin: "https://hub.example.test" });
  const other = deriveNexusHubClientProfile({ ...enrollment, publicOrigin: "https://other.example.test" });
  assert.equal(nexusHubClientProfileDigest(first), nexusHubClientProfileDigest(second));
  assert.notEqual(nexusHubClientProfileDigest(first), nexusHubClientProfileDigest(other));
});

test("LiberIDE profile derives one issuer-enrolled HTTPS callback and least-privilege login scope", () => {
  const input = { profileId: "liberide", profileVersion: 1, publicOrigin: "https://ide.example.test" };
  const profile = deriveLiberIDEClientProfile(input);
  assert.deepEqual(profile.redirectUris, ["https://ide.example.test/api/auth/nexusid/callback"]);
  assert.deepEqual(profile.allowedScopes, ["openid", "profile", "email"]);
  assert.deepEqual(profile.grants, ["authorization_code"]);
  assert.equal(profile.requirePkce, true);
  assert.equal(profile.tokenEndpointAuthMethod, "client_secret_post");
  assert.equal(liberIDEClientProfileDigest(profile), liberIDEClientProfileDigest(deriveLiberIDEClientProfile(input)));
  for (const publicOrigin of ["http://ide.example.test", "https://ide.example.test/path", "https://ide.example.test?x=1", "https://ide.example.test/"]) {
    assert.throws(() => deriveLiberIDEClientProfile({ ...input, publicOrigin }), NexusHubClientProfileError);
  }
});
