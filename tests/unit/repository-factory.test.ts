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
    trustProxy: false,
    cookieSecret: "test-cookie-secret",
    databaseProvider: "sqlite",
    databasePath: join(tempDir, "sso.sqlite"),
    externalDatabaseUrl: undefined,
    issuer: "http://localhost:4000",
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

test("repository factory requires an external database URL for external providers", async () => {
  const config = makeConfig({ databaseProvider: "postgresql", externalDatabaseUrl: undefined });

  await assert.rejects(
    createRepositoryBundle(config),
    /External database URL is required when database provider is postgresql/
  );
});

test("repository factory creates a Prisma bundle for external providers", async () => {
  const config = makeConfig({
    databaseProvider: "mysql",
    externalDatabaseUrl: "mysql://user:pass@localhost:3306/sso"
  });

  const repositories = await createRepositoryBundle(config);

  assert.ok(repositories.userRepository);
  assert.ok(repositories.clientRepository);
});
