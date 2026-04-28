import test from "node:test";
import assert from "node:assert/strict";
import { emitStartupConfigWarnings } from "../../src/app.js";

test("emitStartupConfigWarnings logs warning when implicit flow is enabled", async () => {
  const warnings: Array<{ metadata: Record<string, unknown>; message: string }> = [];

  const app = {
    log: {
      warn(metadata: Record<string, unknown>, message: string) {
        warnings.push({ metadata, message });
      }
    }
  };

  await emitStartupConfigWarnings(app as any, {
    async getSettings() {
      return { allowImplicitFlow: true };
    }
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /implicit flow is enabled/i);
  assert.equal(warnings[0].metadata.setting, "allowImplicitFlow");
});

test("emitStartupConfigWarnings stays quiet when implicit flow is disabled", async () => {
  const warnings: Array<{ metadata: Record<string, unknown>; message: string }> = [];

  const app = {
    log: {
      warn(metadata: Record<string, unknown>, message: string) {
        warnings.push({ metadata, message });
      }
    }
  };

  await emitStartupConfigWarnings(app as any, {
    async getSettings() {
      return { allowImplicitFlow: false };
    }
  });

  assert.equal(warnings.length, 0);
});
