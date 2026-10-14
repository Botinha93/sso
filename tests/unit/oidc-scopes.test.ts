import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAccessTokenAuthorizationClaims,
  buildScopeGatedClaims,
  claimsWithoutSubject
} from "../../src/domain/oidc-scopes.js";
import type { User } from "../../src/domain/models.js";

const sampleUser: User = {
  id: "user-1",
  email: "alex@example.com",
  username: "alex",
  givenName: "Alex",
  familyName: "Example",
  avatarUrl: "https://cdn.example.com/alex.png",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

test("buildScopeGatedClaims returns only claims for granted scopes", async () => {
  const claims = await buildScopeGatedClaims({
    user: sampleUser,
    scopes: ["profile", "groups"],
    resolveRoles: async () => ["admin"],
    resolveGroups: async () => ["ops"],
    resolvePermissions: async () => ["users:view"]
  });

  assert.equal(claims.sub, "user-1");
  assert.equal(claims.name, "Alex Example");
  assert.equal(claims.preferred_username, "alex");
  assert.equal(claims.picture, "https://cdn.example.com/alex.png");
  assert.deepEqual(claims.groups, ["ops"]);
  assert.equal(claims.email, undefined);
  assert.equal(claims.roles, undefined);
  assert.equal(claims.permissions, undefined);
});

test("buildAccessTokenAuthorizationClaims mirrors scope gating", async () => {
  const claims = await buildAccessTokenAuthorizationClaims({
    user: sampleUser,
    scopes: ["roles", "permissions"],
    resolveRoles: async () => ["admin"],
    resolveGroups: async () => ["ops"],
    resolvePermissions: async () => ["users:view"]
  });

  assert.deepEqual(claims.roles, ["admin"]);
  assert.deepEqual(claims.permissions, ["users:view"]);
  assert.equal(claims.groups, undefined);
});

test("claimsWithoutSubject removes sub for JWT payloads", () => {
  assert.deepEqual(claimsWithoutSubject({ sub: "user-1", email: "alex@example.com" }), {
    email: "alex@example.com"
  });
});
