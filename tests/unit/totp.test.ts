import test from "node:test";
import assert from "node:assert/strict";
import { buildOtpAuthUri, generateTotpSecret, generateTotpToken, verifyTotpToken } from "../../src/security/totp.js";

test("TOTP secret generation and token verification", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]+$/);

  const token = generateTotpToken(secret);
  assert.equal(token.length, 6);
  assert.equal(verifyTotpToken(secret, token), true);
  assert.equal(verifyTotpToken(secret, "000000"), false);
});

test("otp auth uri includes issuer and account", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const uri = buildOtpAuthUri({
    issuer: "NexusID",
    accountName: "admin@example.com",
    secret
  });

  assert.equal(uri.startsWith("otpauth://totp/"), true);
  assert.equal(uri.includes("secret=JBSWY3DPEHPK3PXP"), true);
  assert.equal(uri.includes("issuer=NexusID"), true);
});
