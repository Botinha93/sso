import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../../src/domain/models.js";
import { PASSWORD_CHANGED_AT_BACKFILL_DATE, buildPasswordExpirationNotice, evaluatePasswordExpiration, needsPasswordChangedAtBackfill, passwordChangedAtDateValue, passwordChangedAtTodayIso, resolvePasswordChangedAt, serverPasswordChangedAtDateValue, toDateAttributeValue } from "../../src/services/password-expiration.js";

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

test("resolvePasswordChangedAt defaults missing attribute to the user's created date", () => {
  const createdAt = new Date("2024-03-15T18:45:00.000Z");
  const baseline = resolvePasswordChangedAt(makeUser({ createdAt }));
  assert.equal(baseline.toISOString(), passwordChangedAtTodayIso(createdAt));
});

test("resolvePasswordChangedAt accepts ISO timestamps and date-only values", () => {
  const fromIso = resolvePasswordChangedAt(makeUser({
    customAttributes: { password_changed_at: "2024-03-15T18:45:00.000Z" }
  }));
  assert.equal(fromIso.toISOString(), "2024-03-15T00:00:00.000Z");

  const fromDateOnly = resolvePasswordChangedAt(makeUser({
    customAttributes: { password_changed_at: "2024-03-15" }
  }));
  assert.equal(fromDateOnly.toISOString(), "2024-03-15T00:00:00.000Z");
});

test("toDateAttributeValue and passwordChangedAtDateValue store calendar dates", () => {
  assert.equal(toDateAttributeValue("2024-03-15T18:45:00.000Z"), "2024-03-15");
  assert.equal(toDateAttributeValue("2024-03-15"), "2024-03-15");
  assert.equal(toDateAttributeValue("  "), undefined);
  assert.equal(passwordChangedAtDateValue(new Date("2024-03-15T18:45:00.000Z")), "2024-03-15");
});

test("needsPasswordChangedAtBackfill targets active non-service users not already on the backfill date", () => {
  assert.equal(needsPasswordChangedAtBackfill(makeUser()), true);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({
    customAttributes: { password_changed_at: PASSWORD_CHANGED_AT_BACKFILL_DATE }
  })), false);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({
    customAttributes: { password_changed_at: "2026-08-01T12:00:00.000Z" }
  })), false);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({
    customAttributes: { password_changed_at: "2026-08-18" }
  })), false);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({
    customAttributes: { password_changed_at: "2026-07-01" }
  })), true);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({ active: false })), false);
  assert.equal(needsPasswordChangedAtBackfill(makeUser({ isServiceUser: true })), false);
});

test("serverPasswordChangedAtDateValue uses the server clock, not a client-supplied date", () => {
  assert.equal(serverPasswordChangedAtDateValue(), passwordChangedAtDateValue(new Date()));
  assert.notEqual(passwordChangedAtDateValue(new Date("2024-03-15T18:45:00.000Z")), serverPasswordChangedAtDateValue());
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
