import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesAuthorizationRequest,
  resolvePolicyDecisionStrategy,
  resolvePolicyEffect,
  resolvePolicyPriority,
  summarizeAuthorizationDecision
} from "../../src/services/policy-authorization-evaluator.js";

test("matchesAuthorizationRequest applies wildcard patterns", () => {
  const matches = matchesAuthorizationRequest(
    {
      resourcePattern: "finance:*",
      actionPattern: "write"
    },
    "finance:invoice:123",
    "write"
  );
  assert.equal(matches.matches, true);

  const skippedByResource = matchesAuthorizationRequest(
    {
      resourcePattern: "hr:*"
    },
    "finance:invoice:123",
    "write"
  );
  assert.equal(skippedByResource.matches, false);
  assert.match(String(skippedByResource.reason ?? ""), /resourcePattern/i);

  const skippedByAction = matchesAuthorizationRequest(
    {
      action_pattern: "admin:*"
    },
    "finance:invoice:123",
    "write"
  );
  assert.equal(skippedByAction.matches, false);
  assert.match(String(skippedByAction.reason ?? ""), /actionPattern/i);
});

test("resolve helpers normalize effect priority and strategy", () => {
  assert.equal(resolvePolicyEffect({ effect: "allow" }), "allow");
  assert.equal(resolvePolicyEffect({ effect: "deny" }), "deny");

  assert.equal(resolvePolicyPriority({ priority: 10.9 }), 10);
  assert.equal(resolvePolicyPriority({ priority: "25" }), 25);
  assert.equal(resolvePolicyPriority({ priority: "not-a-number" }), 0);

  assert.equal(resolvePolicyDecisionStrategy(undefined), "deny_overrides");
  assert.equal(resolvePolicyDecisionStrategy("allow_overrides"), "allow_overrides");
});

test("summarizeAuthorizationDecision respects strategy precedence", () => {
  const decisions = [
    { key: "deny_high", applied: true, allow: false },
    { key: "allow_low", applied: true, allow: true }
  ];

  const denyOverrides = summarizeAuthorizationDecision("deny_overrides", decisions);
  assert.equal(denyOverrides.allow, false);
  assert.deepEqual(denyOverrides.deniedBy, ["deny_high"]);

  const allowOverrides = summarizeAuthorizationDecision("allow_overrides", decisions);
  assert.equal(allowOverrides.allow, true);
  assert.deepEqual(allowOverrides.deniedBy, []);

  const firstApplicable = summarizeAuthorizationDecision("first_applicable", decisions);
  assert.equal(firstApplicable.allow, false);
  assert.deepEqual(firstApplicable.deniedBy, ["deny_high"]);
});