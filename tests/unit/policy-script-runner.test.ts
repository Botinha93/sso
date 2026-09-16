import test from "node:test";
import assert from "node:assert/strict";
import { PolicyScriptRunner } from "../../src/services/policy-script-runner.js";

const policy = {
  key: "unit",
  user: { id: "u1", email: "u1@example.com", customAttributes: { department: "finance" } },
  request: { resource: "admin:users", action: "view", context: {} }
};

test("policy runner evaluates allow/deny/message results from an isolated worker", async (t) => {
  const runner = new PolicyScriptRunner();
  t.after(() => runner.dispose());

  assert.deepEqual(await runner.evaluate({ code: "return true", policy }), { allow: true });
  assert.deepEqual(await runner.evaluate({ code: "return false", policy }), { allow: false });
  assert.deepEqual(await runner.evaluate({ code: 'return "nope"', policy }), { allow: false, message: "nope" });
  assert.deepEqual(
    await runner.evaluate({ code: 'return policy.user.customAttributes.department === "finance" ? { allow: true } : { allow: false, message: "wrong dept" }', policy }),
    { allow: true }
  );
});

test("policy runner denies on runtime errors and cannot reach process or require", async (t) => {
  const runner = new PolicyScriptRunner();
  t.after(() => runner.dispose());

  const processAccess = await runner.evaluate({ code: "return typeof process !== 'undefined' && process.env ? true : false", policy });
  assert.equal(processAccess.allow, false, "process must not be reachable from a policy script");

  const requireAccess = await runner.evaluate({ code: 'return require("child_process") ? true : false', policy });
  assert.equal(requireAccess.allow, false);
  assert.equal(requireAccess.runtimeError, true);

  const constructorEscape = await runner.evaluate({
    code: 'const F = (function(){}).constructor; return F("return typeof process")() === "object"',
    policy
  });
  assert.equal(constructorEscape.allow, false, "Function constructor code generation must be disabled");

  const thrown = await runner.evaluate({ code: 'throw new Error("boom")', policy });
  assert.equal(thrown.allow, false);
  assert.equal(thrown.runtimeError, true);
  assert.match(String(thrown.message), /boom/);
});

test("policy runner times out infinite loops and recovers for the next evaluation", async (t) => {
  const runner = new PolicyScriptRunner();
  t.after(() => runner.dispose());

  const started = Date.now();
  const looped = await runner.evaluate({ code: "while (true) {}", policy, timeoutMs: 50 });
  assert.equal(looped.allow, false);
  assert.equal(looped.runtimeError, true);
  assert.ok(Date.now() - started < 5_000, "timeout must be enforced promptly");

  // The worker (or a fresh one) must keep serving afterwards.
  assert.deepEqual(await runner.evaluate({ code: "return true", policy }), { allow: true });
});
