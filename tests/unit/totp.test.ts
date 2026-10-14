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

test("findTotpTokenStep reports the matched time step so replays can be refused", async () => {
  const { findTotpTokenStep } = await import("../../src/security/totp.js");
  const secret = generateTotpSecret();
  const now = Date.now();
  const token = generateTotpToken(secret, now);
  const step = findTotpTokenStep(secret, token, 1, now);
  assert.equal(typeof step, "number");
  assert.equal(step, Math.floor(now / 1000 / 30));

  const previous = generateTotpToken(secret, now - 30_000);
  assert.equal(findTotpTokenStep(secret, previous, 1, now), Math.floor(now / 1000 / 30) - 1);
  assert.equal(findTotpTokenStep(secret, "000000", 1, now), undefined);
  assert.equal(findTotpTokenStep(secret, "12345", 1, now), undefined);
});

test("TotpService refuses a code that was already accepted", async () => {
  const { TotpService } = await import("../../src/services/totp-service.js");
  const secret = generateTotpSecret();
  const credential = { userId: "user-1", secret, enabled: true, createdAt: new Date(), updatedAt: new Date() };
  const service = new TotpService(
    { issuer: "http://localhost:4000" } as never,
    {
      findByUserId: async () => credential,
      upsert: async (input: { userId: string; secret: string; enabled: boolean }) => ({ ...input, createdAt: new Date(), updatedAt: new Date() }),
      delete: async () => undefined
    }
  );

  const code = generateTotpToken(secret);
  assert.equal(await service.verifyUserCode({ userId: "user-1", code }), true);
  assert.equal(await service.verifyUserCode({ userId: "user-1", code }), false, "same code must not be accepted twice");

  // A different user is tracked independently.
  assert.equal(await service.verifyUserCode({ userId: "user-2", code }), true);
});
