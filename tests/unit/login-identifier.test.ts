import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../../src/domain/models.js";
import { pickUserForLoginIdentifier, uniqueUsers } from "../../src/domain/login-identifier.js";

const user = (id: string, email: string, username: string): User => ({
  id,
  email,
  username,
  givenName: id,
  familyName: id,
  passwordHash: "x",
  active: true,
  isServiceUser: false,
  customAttributes: {},
  createdAt: new Date(),
  updatedAt: new Date()
});

test("pickUserForLoginIdentifier prefers email when the identifier contains @", () => {
  const byEmail = user("email-user", "jane@example.com", "jane.other");
  const byUsername = user("username-user", "other@example.com", "jane@example.com");

  const picked = pickUserForLoginIdentifier("Jane@example.com", [byUsername, byEmail]);
  assert.equal(picked?.id, "email-user");
});

test("pickUserForLoginIdentifier prefers username when the identifier has no @", () => {
  const byEmail = user("email-user", "jane", "unused");
  const byUsername = user("username-user", "jane@example.com", "jane");

  const picked = pickUserForLoginIdentifier("JANE", [byEmail, byUsername]);
  assert.equal(picked?.id, "username-user");
});

test("uniqueUsers drops duplicate ids", () => {
  const first = user("same", "a@example.com", "a");
  const copy = user("same", "a@example.com", "a");
  assert.equal(uniqueUsers([first, undefined, copy]).length, 1);
});
