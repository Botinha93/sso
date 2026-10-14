import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

async function loginUser(
  app: Awaited<ReturnType<typeof createTestContext>>["app"],
  email: string,
  password: string
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email,
      password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  return {
    sid: extractCookie(response.headers["set-cookie"], "sid"),
    accessToken: String(response.json().accessToken ?? response.json().access_token)
  };
}

async function createAdminSession(app: Awaited<ReturnType<typeof createTestContext>>["app"], admin: { email: string; password: string }) {
  const login = await loginUser(app, admin.email, admin.password);
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: login.sid }
  });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  return {
    headers: {
      cookie: `${login.sid}; ${csrfCookie}`,
      "x-csrf-token": String(csrfResponse.json().csrf_token)
    }
  };
}

test("portal /me prefers bearer token over stale session cookie", async (t) => {
  const { app, admin } = await createTestContext("integration-portal-me-auth");
  t.after(async () => {
    await app.close();
  });

  const { headers: adminHeaders } = await createAdminSession(app, admin);

  const diegoPayload = {
    email: "diego@example.com",
    username: "diego.maciel",
    password: "Change-Me-Now1!",
    givenName: "Diego",
    familyName: "Maciel"
  };
  const emilyPayload = {
    email: "emily@example.com",
    username: "emily",
    password: "Change-Me-Now1!",
    givenName: "Emily",
    familyName: "Example"
  };

  for (const payload of [diegoPayload, emilyPayload]) {
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: adminHeaders,
      payload
    });
    assert.equal(created.statusCode, 201, created.body);
  }

  const diegoSession = await loginUser(app, diegoPayload.email, diegoPayload.password);
  const emilySession = await loginUser(app, emilyPayload.email, emilyPayload.password);

  const mixedAuthResponse = await app.inject({
    method: "GET",
    url: "/api/portal/me",
    headers: {
      cookie: diegoSession.sid,
      authorization: `Bearer ${emilySession.accessToken}`
    }
  });

  assert.equal(mixedAuthResponse.statusCode, 200);
  const mixedAuthBody = mixedAuthResponse.json() as { email?: string; givenName?: string; familyName?: string };
  assert.equal(mixedAuthBody.email, emilyPayload.email);
  assert.equal(mixedAuthBody.givenName, emilyPayload.givenName);
  assert.equal(mixedAuthBody.familyName, emilyPayload.familyName);

  const cookieOnlyResponse = await app.inject({
    method: "GET",
    url: "/api/portal/me",
    headers: { cookie: diegoSession.sid }
  });
  assert.equal(cookieOnlyResponse.statusCode, 200);
  const cookieOnlyBody = cookieOnlyResponse.json() as { email?: string };
  assert.equal(cookieOnlyBody.email, diegoPayload.email);
});
