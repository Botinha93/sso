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

test("ISSUER trailing slashes are normalised so discovery URLs and iss claims are canonical", async () => {
  const previous = process.env.ISSUER;
  process.env.ISSUER = "https://auth.example.com/";
  try {
    const { loadConfig } = await import("../../src/core/config.js");
    assert.equal(loadConfig().issuer, "https://auth.example.com");
  } finally {
    if (previous === undefined) {
      delete process.env.ISSUER;
    } else {
      process.env.ISSUER = previous;
    }
  }
});
