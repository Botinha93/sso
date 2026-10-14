import assert from "node:assert/strict";
import test from "node:test";
import type { Suggestion, User } from "../../src/domain/models.js";
import { canRevealSuggestionAuthor, toSuggestionDto } from "../../src/services/suggestion-service.js";

const suggestion: Suggestion = {
  id: "sug-1",
  kind: "existing_app",
  appId: "app-1",
  title: "Dark mode",
  body: "Please add dark mode",
  imageUrls: [],
  authorUserId: "user-secret",
  status: "open",
  internalNotes: "staff only",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z")
};

const author: User = {
  id: "user-secret",
  email: "author@example.com",
  username: "author",
  givenName: "Ann",
  familyName: "Author",
  passwordHash: "x",
  active: true,
  isServiceUser: false,
  customAttributes: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

test("canRevealSuggestionAuthor is only true for global wildcard", () => {
  assert.equal(canRevealSuggestionAuthor(["*:*"]), true);
  assert.equal(canRevealSuggestionAuthor(["users:view", "suggestions:view", "suggestions:change"]), false);
  assert.equal(canRevealSuggestionAuthor(["suggestions:view"]), false);
});

test("toSuggestionDto omits author and staff notes unless requested", () => {
  const hidden = toSuggestionDto(suggestion, {
    revealAuthor: false,
    includeInternalNotes: false,
    author,
    appName: "Account Portal"
  });

  assert.equal(hidden.author, undefined);
  assert.equal(hidden.internalNotes, undefined);
  assert.equal("authorUserId" in hidden, false);
  assert.equal(hidden.appName, "Account Portal");
});

test("toSuggestionDto includes author only when revealAuthor is set", () => {
  const revealed = toSuggestionDto(suggestion, {
    revealAuthor: true,
    includeInternalNotes: true,
    author
  });

  assert.deepEqual(revealed.author, {
    id: "user-secret",
    email: "author@example.com",
    username: "author",
    givenName: "Ann",
    familyName: "Author"
  });
  assert.equal(revealed.internalNotes, "staff only");
});
