import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("Connector API: CRUD, sync, runs, mappings, and auth metrics", async (t) => {
  const { app, admin } = await createTestContext("integration-connectors");

  t.after(async () => {
    await app.close();
  });

  // Login as admin
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.email,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(login.statusCode, 200);
  const sid = extractCookie(login.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({ method: "GET", url: "/api/csrf-token", headers: { cookie: sid } });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken
  };

  let connectorId: string;

  await t.test("creates a connector", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/api/admin/connectors",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {
        name: "Test SCIM Connector",
        type: "scim",
        config: { baseUrl: "https://scim.example.com", token: "test-token" },
        schedule: "0 * * * *"
      }
    });
    assert.equal(resp.statusCode, 201);
    const body = resp.json() as any;
    assert.equal(body.name, "Test SCIM Connector");
    assert.equal(body.type, "scim");
    assert.equal(body.status, "active");
    connectorId = body.id;
  });

  await t.test("lists connectors", async () => {
    const resp = await app.inject({ method: "GET", url: "/api/admin/connectors", headers: { cookie: authHeaders.cookie } });
    assert.equal(resp.statusCode, 200);
    const body = resp.json() as any;
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((c: any) => c.id === connectorId));
  });

  await t.test("triggers a sync run", async () => {
    const resp = await app.inject({
      method: "POST",
      url: `/api/admin/connectors/${connectorId}/sync`,
      headers: authHeaders
    });
    assert.equal(resp.statusCode, 202);
    const body = resp.json() as any;
    assert.equal(body.connectorId, connectorId);
    assert.ok(["succeeded", "running", "pending"].includes(body.status));
  });

  await t.test("lists runs for connector", async () => {
    const resp = await app.inject({ method: "GET", url: `/api/admin/connectors/${connectorId}/runs`, headers: { cookie: authHeaders.cookie } });
    assert.equal(resp.statusCode, 200);
    const body = resp.json() as any;
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  await t.test("creates a field mapping", async () => {
    const resp = await app.inject({
      method: "POST",
      url: `/api/admin/connectors/${connectorId}/mappings`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { sourceField: "mail", targetField: "email" }
    });
    assert.equal(resp.statusCode, 201);
    const body = resp.json() as any;
    assert.equal(body.sourceField, "mail");
    assert.equal(body.targetField, "email");
  });

  await t.test("lists field mappings", async () => {
    const resp = await app.inject({ method: "GET", url: `/api/admin/connectors/${connectorId}/mappings`, headers: { cookie: authHeaders.cookie } });
    assert.equal(resp.statusCode, 200);
    const body = resp.json() as any;
    assert.ok(body.data.some((m: any) => m.sourceField === "mail"));
  });

  await t.test("updates connector status", async () => {
    const resp = await app.inject({
      method: "PATCH",
      url: `/api/admin/connectors/${connectorId}`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { status: "inactive" }
    });
    assert.equal(resp.statusCode, 200);
    assert.equal((resp.json() as any).status, "inactive");
  });

  await t.test("returns 404 for sync on non-existent connector", async () => {
    const resp = await app.inject({ method: "POST", url: "/api/admin/connectors/nonexistent/sync", headers: authHeaders });
    assert.equal(resp.statusCode, 404);
  });

  await t.test("auth metrics endpoint returns array", async () => {
    const resp = await app.inject({ method: "GET", url: "/api/admin/metrics/auth", headers: { cookie: authHeaders.cookie } });
    assert.equal(resp.statusCode, 200);
    assert.ok(Array.isArray((resp.json() as any).data));
  });

  await t.test("deletes a connector", async () => {
    const resp = await app.inject({ method: "DELETE", url: `/api/admin/connectors/${connectorId}`, headers: authHeaders });
    assert.equal(resp.statusCode, 204);
  });
});
