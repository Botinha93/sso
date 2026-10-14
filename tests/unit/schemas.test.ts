import test from "node:test";
import assert from "node:assert/strict";
import {
  createUserSchema,
  updateUserSchema,
  authorizeSchema,
  dynamicClientRegistrationSchema,
  deviceAuthorizationSchema,
  deviceVerificationSchema,
  tokenSchema
} from "../../src/http/schemas.js";

test("token schema accepts device_code grant payload", () => {
  const parsed = tokenSchema.parse({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: "device-code-0123456789",
    client_id: "client-1",
    client_secret: "client-secret-123456"
  });

  assert.equal(parsed.grant_type, "urn:ietf:params:oauth:grant-type:device_code");
});

test("authorize schema accepts implicit response type", () => {
  const parsed = authorizeSchema.parse({
    response_type: "token",
    client_id: "client-1",
    redirect_uri: "http://localhost:3000/callback",
    scope: "openid profile",
    response_mode: "fragment"
  });

  assert.equal(parsed.response_type, "token");
});

test("authorize schema accepts legacy approval_prompt", () => {
  const parsed = authorizeSchema.parse({
    response_type: "code",
    client_id: "client-1",
    redirect_uri: "http://localhost:3000/callback",
    scope: "openid profile",
    approval_prompt: "force"
  });

  assert.equal(parsed.approval_prompt, "force");
});

test("dynamic registration schema accepts optional app_id", () => {
  const parsed = dynamicClientRegistrationSchema.parse({
    app_id: "app-1",
    client_name: "Dynamic App",
    redirect_uris: ["http://localhost:3000/callback"]
  });

  assert.equal(parsed.app_id, "app-1");
});

test("user schemas accept service-user flag", () => {
  const created = createUserSchema.parse({
    email: "service@example.com",
    username: "svc_account",
    password: "strong-password",
    givenName: "Service",
    familyName: "Account",
    isServiceUser: true,
    roleIds: []
  });
  assert.equal(created.isServiceUser, true);

  const updated = updateUserSchema.parse({
    isServiceUser: false
  });
  assert.equal(updated.isServiceUser, false);
});

test("device endpoint schemas validate required fields", () => {
  const deviceAuth = deviceAuthorizationSchema.parse({
    client_id: "client-1",
    client_secret: "client-secret-123456"
  });
  assert.equal(deviceAuth.client_id, "client-1");

  const verification = deviceVerificationSchema.parse({
    user_code: "ABCD1234",
    username: "admin",
    password: "change-me-now",
    approve: true
  });
  assert.equal(verification.approve, true);
});
