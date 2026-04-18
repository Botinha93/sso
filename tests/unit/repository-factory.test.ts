import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "../../src/core/config.js";
import { createRepositoryBundle } from "../../src/repositories/factory.js";

const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig => {
  const tempDir = mkdtempSync(join(tmpdir(), "sso-factory-test-"));

  return {
    port: 4000,
    host: "127.0.0.1",
    databaseProvider: "sqlite",
    databasePath: join(tempDir, "sso.sqlite"),
    externalDatabaseUrl: undefined,
    issuer: "http://localhost:4000",
    ttl: {
      accessTokenSeconds: 900,
      idTokenSeconds: 900,
      refreshTokenSeconds: 60 * 60 * 24 * 30
    },
    admin: {
      email: "admin@example.com",
      password: "change-me-now"
    },
    federation: {
      providers: []
    },
    ...overrides
  };
};

test("repository factory requires DATABASE_URL for external providers", () => {
  const config = makeConfig({ databaseProvider: "postgresql", externalDatabaseUrl: undefined });

  assert.throws(
    () => createRepositoryBundle(config),
    /DATABASE_URL is required when DATABASE_PROVIDER=postgresql/
  );
});

test("repository factory runs compatibility mode for external providers", () => {
  const config = makeConfig({
    databaseProvider: "mysql",
    externalDatabaseUrl: "mysql://user:pass@localhost:3306/sso"
  });

  const warnings: string[] = [];
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error) => {
    warnings.push(typeof warning === "string" ? warning : warning.message);
  }) as typeof process.emitWarning;

  try {
    const repositories = createRepositoryBundle(config);
    assert.ok(repositories.userRepository);
  } finally {
    process.emitWarning = originalEmitWarning;
  }

  assert.ok(
    warnings.some((message) => message.includes("compatibility mode")),
    "Expected compatibility mode warning when using external provider"
  );
});
