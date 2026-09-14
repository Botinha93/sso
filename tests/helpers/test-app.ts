import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";

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
  // Client registration requires administrator credentials; the helpers below
  // authenticate as the bootstrap admin when a test needs a client.
  process.env.DYNAMIC_CLIENT_REGISTRATION = process.env.DYNAMIC_CLIENT_REGISTRATION ?? "admin";

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

/**
 * Obtains a CSRF double-submit token for a session. Returns the cookie
 * fragment to append to the Cookie header and the header value.
 */
export const getCsrf = async (app: FastifyInstance, sid: string) => {
  const response = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  if (response.statusCode !== 200) {
    throw new Error(`Could not obtain CSRF token: ${response.statusCode} ${response.body}`);
  }
  const token = String((response.json() as { csrf_token: string }).csrf_token);
  const cookie = extractCookie(response.headers["set-cookie"], "csrf_token");
  return { token, cookie, headers: { cookie: `${sid}; ${cookie}`, "x-csrf-token": token } };
};

export const loginAsAdmin = async (app: FastifyInstance, admin: TestContext["admin"]) => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  if (response.statusCode !== 200) {
    throw new Error(`Admin login failed: ${response.statusCode} ${response.body}`);
  }
  return extractCookie(response.headers["set-cookie"], "sid");
};

/**
 * Registers an OAuth client through /connect/register using administrator
 * credentials (the endpoint no longer accepts anonymous registrations).
 */
export const registerClientAsAdmin = async (
  app: FastifyInstance,
  admin: TestContext["admin"],
  payload: Record<string, unknown>
): Promise<LightMyRequestResponse> => {
  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  return app.inject({
    method: "POST",
    url: "/connect/register",
    headers: csrf.headers,
    payload
  });
};

/**
 * Records consent for the client/scope/redirect_uri found in an authorize
 * URL, the way the consent screen does (POST /oauth/consent with the session
 * cookie and CSRF token).
 */
export const approveConsent = async (app: FastifyInstance, sid: string, authorizeUrl: string) => {
  const url = new URL(authorizeUrl, "http://localhost");
  const csrf = await getCsrf(app, sid);
  const response = await app.inject({
    method: "POST",
    url: "/oauth/consent",
    headers: csrf.headers,
    payload: {
      client_id: url.searchParams.get("client_id"),
      redirect_uri: url.searchParams.get("redirect_uri"),
      scope: url.searchParams.get("scope") ?? "openid",
      decision: "approve"
    }
  });
  if (response.statusCode !== 200) {
    throw new Error(`Consent approval failed: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { decision: string; scope: string[] };
};
