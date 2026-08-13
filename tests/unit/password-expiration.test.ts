import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../../src/domain/models.js";
import { buildPasswordExpirationNotice, evaluatePasswordExpiration, passwordChangedAtTodayIso, resolvePasswordChangedAt } from "../../src/services/password-expiration.js";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "unit@example.com",
  username: "unit",
  passwordHash: "hash",
  givenName: "Unit",
  familyName: "Tester",
  isServiceUser: false,
  customAttributes: {},
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides
});

test("evaluatePasswordExpiration returns inactive when policy days are disabled", () => {
  const result = evaluatePasswordExpiration({
    user: makeUser(),
    config: { days: 0 }
  });

  assert.deepEqual(result, { active: false });
});

test("evaluatePasswordExpiration warns when password is close to expiry", () => {
  const changedAt = new Date(Date.now() - (88 * 24 * 60 * 60 * 1000));
  const result = evaluatePasswordExpiration({
    user: makeUser({
      customAttributes: {
        password_changed_at: changedAt.toISOString()
      }
    }),
    config: { days: 90, warnDaysBefore: 14 }
  });

  assert.equal(result.active, true);
  if (!result.active) {
    assert.fail("expected active expiration evaluation");
  }
  assert.equal(result.status, "warning");
  assert.ok(result.daysRemaining <= 3);
});

test("evaluatePasswordExpiration marks expired passwords", () => {
  const changedAt = new Date(Date.now() - (120 * 24 * 60 * 60 * 1000));
  const result = evaluatePasswordExpiration({
    user: makeUser({
      customAttributes: {
        password_changed_at: changedAt.toISOString()
      }
    }),
    config: { days: 90, warnDaysBefore: 14 }
  });

  assert.equal(result.active, true);
  if (!result.active) {
    assert.fail("expected active expiration evaluation");
  }
  assert.equal(result.status, "expired");
  assert.equal(result.daysRemaining, 0);
});

test("resolvePasswordChangedAt defaults missing attribute to start of today", () => {
  const baseline = resolvePasswordChangedAt(makeUser());
  assert.equal(baseline.toISOString(), passwordChangedAtTodayIso());
});

test("buildPasswordExpirationNotice returns warning and expired messages", () => {
  const warning = buildPasswordExpirationNotice(evaluatePasswordExpiration({
    user: makeUser({
      customAttributes: {
        password_changed_at: new Date(Date.now() - (88 * 24 * 60 * 60 * 1000)).toISOString()
      }
    }),
    config: { days: 90, warnDaysBefore: 14 }
  }));
  assert.equal(warning?.status, "warning");
  assert.match(String(warning?.message), /expires in/i);

  const expired = buildPasswordExpirationNotice(evaluatePasswordExpiration({
    user: makeUser({
      customAttributes: {
        password_changed_at: new Date(Date.now() - (120 * 24 * 60 * 60 * 1000)).toISOString()
      }
    }),
    config: { days: 90, warnDaysBefore: 14 }
  }));
  assert.equal(expired?.status, "expired");
  assert.match(String(expired?.message), /expired/i);
});
