import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("administration settings update security thresholds immediately", async (t) => {
  const { app, admin } = await createTestContext("integration-administration-settings");

  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(loginResponse.statusCode, 200);
  const sid = extractCookie(loginResponse.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: {
      cookie: sid
    }
  });

  assert.equal(csrfResponse.statusCode, 200);
  const csrfToken = String(csrfResponse.json().csrf_token);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");

  const updateResponse = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers: {
      cookie: `${sid}; ${csrfCookie}`,
      "x-csrf-token": csrfToken
    },
    payload: {
      databaseProvider: "sqlite",
      databasePath: "./data/sso.sqlite",
      loginFailureWindowMs: 60_000,
      loginLockoutThreshold: 2,
      loginLockoutDurationMs: 60_000,
      sessionAnomalyConcurrencyThreshold: 3
    }
  });

  assert.equal(updateResponse.statusCode, 200);

  const settingsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/settings",
    headers: {
      cookie: sid
    }
  });

  assert.equal(settingsResponse.statusCode, 200);
  const settings = settingsResponse.json() as Record<string, unknown>;
  assert.equal(settings.databaseProvider, "sqlite");
  assert.equal(settings.databasePath, "./data/sso.sqlite");
  assert.equal(settings.loginLockoutThreshold, 2);
  assert.equal(settings.loginFailureWindowMs, 60_000);
  assert.equal(settings.loginLockoutDurationMs, 60_000);
  assert.equal(settings.sessionAnomalyConcurrencyThreshold, 3);

  const invalidDbTest = await app.inject({
    method: "POST",
    url: "/api/admin/settings/database/test",
    headers: {
      cookie: `${sid}; ${csrfCookie}`,
      "x-csrf-token": csrfToken
    },
    payload: {
      provider: "postgresql",
      externalDatabaseUrl: "not-a-url"
    }
  });

  assert.equal(invalidDbTest.statusCode, 422);

  const invalidDbMigrate = await app.inject({
    method: "POST",
    url: "/api/admin/settings/database/migrate",
    headers: {
      cookie: `${sid}; ${csrfCookie}`,
      "x-csrf-token": csrfToken
    },
    payload: {
      provider: "mysql",
      externalDatabaseUrl: "not-a-url"
    }
  });

  assert.equal(invalidDbMigrate.statusCode, 422);

  const createUserResponse = await app.inject({
    method: "POST",
    url: "/users",
    payload: {
      email: "threshold@example.com",
      username: "threshold-user",
      password: "Change-Me-Now1",
      givenName: "Threshold",
      familyName: "Tester"
    }
  });

  assert.equal(createUserResponse.statusCode, 201);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const failedLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "threshold@example.com",
        password: "wrong-password",
        clientId: "sso-admin-ui",
        scope: ["openid", "profile", "email"]
      }
    });

    assert.equal(failedLogin.statusCode, 401);
  }

  const lockedLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "threshold@example.com",
      password: "Change-Me-Now1",
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });

  assert.equal(lockedLogin.statusCode, 401);
  assert.match(lockedLogin.body, /temporarily locked/i);
});