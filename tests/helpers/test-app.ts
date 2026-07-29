import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

export interface TestContext {
  app: FastifyInstance;
  admin: {
    email: string;
    username: string;
    password: string;
  };
}

export const createTestContext = async (name: string): Promise<TestContext> => {
  const tempDir = mkdtempSync(join(tmpdir(), `sso-${name}-`));
  process.env.NODE_ENV = "test";
  process.env.ISSUER = "http://localhost:4000";
  process.env.DATABASE_PATH = join(tempDir, "sso.sqlite");
  process.env.RATE_LIMIT_MULTIPLIER = "1";

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();
  await app.ready();

  const admin = {
    email: "admin@example.com",
    username: "admin",
    password: "change-me-now"
  };

  const initResponse = await app.inject({
    method: "POST",
    url: "/api/setup/initialize",
    payload: {
      name: "Admin User",
      email: admin.email,
      username: admin.username,
      password: admin.password
    }
  });

  if (initResponse.statusCode !== 201) {
    throw new Error(`Test setup failed: ${initResponse.statusCode} ${initResponse.body}`);
  }

  return { app, admin };
};

export const extractCookie = (setCookieHeaders: string | string[] | undefined, cookieName: string): string => {
  if (!setCookieHeaders) {
    throw new Error(`Expected set-cookie header for ${cookieName}`);
  }

  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

  const found = headers.find((value) => value.startsWith(`${cookieName}=`));
  if (!found) {
    throw new Error(`Could not find cookie ${cookieName}`);
  }

  return found.split(";")[0];
};
