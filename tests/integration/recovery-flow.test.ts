import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext } from "../helpers/test-app.js";

test("recovery uses one-time ticket and verification code", async (t) => {
  const { app, admin } = await createTestContext("integration-recovery");

  t.after(async () => {
    await app.close();
  });

  const requestResponse = await app.inject({
    method: "POST",
    url: "/auth/recovery/request",
    payload: {
      identifier: admin.email,
      clientId: "sso-admin-ui"
    }
  });

  assert.equal(requestResponse.statusCode, 200);
  const requestPayload = requestResponse.json() as {
    recoveryTicket?: string;
    verificationCode?: string;
  };

  assert.ok(requestPayload.recoveryTicket);
  assert.ok(requestPayload.verificationCode);

  const recoveryResponse = await app.inject({
    method: "POST",
    url: "/auth/recovery",
    payload: {
      recoveryTicket: requestPayload.recoveryTicket,
      verificationCode: requestPayload.verificationCode,
      promptAcknowledged: true,
      newPassword: "changed-password-123",
      clientId: "sso-admin-ui"
    }
  });

  assert.equal(recoveryResponse.statusCode, 200);
  const recoveryPayload = recoveryResponse.json() as {
    recovery?: boolean;
    session?: { id: string };
  };

  assert.equal(recoveryPayload.recovery, true);
  assert.ok(recoveryPayload.session?.id);

  const reuseResponse = await app.inject({
    method: "POST",
    url: "/auth/recovery",
    payload: {
      recoveryTicket: requestPayload.recoveryTicket,
      verificationCode: requestPayload.verificationCode,
      promptAcknowledged: true,
      newPassword: "another-password-123",
      clientId: "sso-admin-ui"
    }
  });

  assert.equal(reuseResponse.statusCode, 401);

  const loginWithNewPassword = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: "changed-password-123",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(loginWithNewPassword.statusCode, 200);
});
