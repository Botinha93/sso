import test from "node:test";
import assert from "node:assert/strict";
import { PluginRuntimeService } from "../../src/services/plugin-runtime-service.js";
import type { PluginRecord } from "../../src/services/plugin-service.js";

const plugin = (overrides: Partial<PluginRecord> = {}): PluginRecord => ({
  id: "sandbox-plugin",
  name: "Sandbox Plugin",
  version: "1.0.0",
  entrypoint: "index.js",
  permissions: [],
  hooks: ["auth.login.succeeded"],
  status: "active",
  uploadedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  bundleChecksum: "abc",
  bundleBytes: 12,
  ...overrides
});

const createRuntime = (source: string, record: PluginRecord = plugin()) => {
  const audits: Array<{ type: string; metadata?: Record<string, unknown> }> = [];
  const runtime = new PluginRuntimeService(
    {
      listActivePlugins: async () => [record],
      loadEntrypointSource: async () => ({ plugin: record, source })
    } as any,
    {
      log: async (entry: { type: string; metadata?: Record<string, unknown> }) => {
        audits.push(entry);
      }
    } as any
  );
  return { runtime, audits };
};

test("plugin runtime denies child_process from a vm-escape payload", async () => {
  const source = [
    "const P = exports.constructor.constructor(\"return process\")();",
    "try {",
    "  P.mainModule.require(\"child_process\").execSync(\"id\");",
    "  module.exports.onEvent = () => { throw new Error(\"escape succeeded\"); };",
    "} catch (error) {",
    "  module.exports.onEvent = () => {};",
    "}"
  ].join("\n");

  const { runtime, audits } = createRuntime(source);
  try {
    await runtime.dispatch("auth.login.succeeded", { hello: "world" });
    assert.ok(audits.some((entry) => entry.type === "plugin_runtime_executed"));
    assert.equal(audits.some((entry) => entry.type === "plugin_runtime_failed" && String(entry.metadata?.error ?? "").includes("escape succeeded")), false);
  } finally {
    await runtime.dispose();
  }
});

test("plugin runtime terminates a synchronous infinite loop", async () => {
  const source = "module.exports.onEvent = () => { while (true) {} };";
  const { runtime, audits } = createRuntime(source);
  const started = Date.now();
  try {
    await runtime.dispatch("auth.login.succeeded", {});
    assert.ok(Date.now() - started < 8_000);
    assert.ok(audits.some((entry) => entry.type === "plugin_runtime_failed"));
  } finally {
    await runtime.dispose();
  }
});

test("plugin runtime log metadata cannot overwrite pluginId", async () => {
  const source = "module.exports.onEvent = (_event, api) => { api.log(\"hi\", { pluginId: \"forged\", version: \"9.9.9\" }); };";
  const { runtime, audits } = createRuntime(source);
  try {
    await runtime.dispatch("auth.login.succeeded", {});
    const log = audits.find((entry) => entry.type === "plugin_runtime_log");
    assert.ok(log);
    assert.equal(log?.metadata?.pluginId, "sandbox-plugin");
    assert.equal(log?.metadata?.version, "1.0.0");
  } finally {
    await runtime.dispose();
  }
});
