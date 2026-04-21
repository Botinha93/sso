import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("service identity CRUD and credential lifecycle", async (t) => {
  const { app, admin } = await createTestContext("integration-service-identities");

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
      scope: ["openid", "profile", "email"],
    },
  });

  assert.equal(login.statusCode, 200);
  const sid = extractCookie(login.headers["set-cookie"], "sid");

  const csrfResponse = await app.inject({ method: "GET", url: "/api/csrf-token", headers: { cookie: sid } });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authHeaders = {
    cookie: `${sid}; ${csrfCookie}`,
    "x-csrf-token": csrfToken,
  };

  // Create a service identity
  const createResp = await app.inject({
    method: "POST",
    url: "/api/admin/service-identities",
    payload: {
      name: "test-worker",
      description: "Test worker service",
      status: "active",
      allowedScopes: ["read:reports"],
      allowedAudiences: ["api.example.com"]
    },
    headers: authHeaders
  });

  assert.equal(createResp.statusCode, 201);
  const identity = createResp.json();
  assert.equal(identity.name, "test-worker");
  assert.deepEqual(identity.allowedScopes, ["read:reports"]);

  // List service identities
  const listResp = await app.inject({
    method: "GET",
    url: "/api/admin/service-identities",
    headers: { cookie: authHeaders.cookie }
  });

  assert.equal(listResp.statusCode, 200);
  const list = listResp.json();
  assert.ok(list.data.length >= 1);
  assert.ok(list.data.some((si: any) => si.id === identity.id));

  // Get service identity detail
  const detailResp = await app.inject({
    method: "GET",
    url: `/api/admin/service-identities/${identity.id}`,
    headers: { cookie: authHeaders.cookie }
  });

  assert.equal(detailResp.statusCode, 200);
  const detail = detailResp.json();
  assert.equal(detail.id, identity.id);
  assert.ok(Array.isArray(detail.credentials));

  // Issue credential
  const issueResp = await app.inject({
    method: "POST",
    url: `/api/admin/service-identities/${identity.id}/credentials`,
    payload: { expiresInDays: 30 },
    headers: authHeaders
  });

  assert.equal(issueResp.statusCode, 201);
  const issued = issueResp.json();
  assert.ok(typeof issued.credential.clientId === "string");
  assert.ok(typeof issued.plainClientSecret === "string");
  assert.ok(issued.plainClientSecret.length > 0);

  const credentialId = issued.credential.id;

  // Get usage
  const usageResp = await app.inject({
    method: "GET",
    url: `/api/admin/service-identities/${identity.id}/usage`,
    headers: { cookie: authHeaders.cookie }
  });

  assert.equal(usageResp.statusCode, 200);
  const usage = usageResp.json();
  assert.ok(usage.data.length === 1);
  assert.equal(usage.data[0].status, "active");

  // Rotate credential
  const rotateResp = await app.inject({
    method: "POST",
    url: `/api/admin/service-identities/${identity.id}/credentials/rotate`,
    payload: { credentialId, expiresInDays: 90 },
    headers: authHeaders
  });

  assert.equal(rotateResp.statusCode, 201);
  const rotated = rotateResp.json();
  assert.ok(rotated.credential.id !== credentialId);
  assert.ok(typeof rotated.plainClientSecret === "string");

  // Revoke the new credential
  const revokeResp = await app.inject({
    method: "DELETE",
    url: `/api/admin/service-identities/${identity.id}/credentials/${rotated.credential.id}`,
    headers: authHeaders
  });

  assert.equal(revokeResp.statusCode, 204);

  // Update service identity status
  const patchResp = await app.inject({
    method: "PATCH",
    url: `/api/admin/service-identities/${identity.id}`,
    payload: { status: "suspended" },
    headers: authHeaders
  });

  assert.equal(patchResp.statusCode, 200);
  assert.equal(patchResp.json().status, "suspended");

  // Delete service identity
  const deleteResp = await app.inject({
    method: "DELETE",
    url: `/api/admin/service-identities/${identity.id}`,
    headers: authHeaders
  });

  assert.equal(deleteResp.statusCode, 204);

  // Verify gone
  const goneResp = await app.inject({
    method: "GET",
    url: `/api/admin/service-identities/${identity.id}`,
    headers: { cookie: authHeaders.cookie }
  });

  assert.equal(goneResp.statusCode, 404);
});
