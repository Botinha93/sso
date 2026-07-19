import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { decodeJwt } from "jose";
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

  const directRoleResp = await app.inject({
    method: "POST",
    url: "/api/admin/roles",
    payload: {
      name: "report_reader",
      description: "Can read service identity reports",
      permissions: ["reports:read"],
      scope: "platform"
    },
    headers: authHeaders
  });
  assert.equal(directRoleResp.statusCode, 201);
  const directRole = directRoleResp.json();

  const groupRoleResp = await app.inject({
    method: "POST",
    url: "/api/admin/roles",
    payload: {
      name: "report_operator",
      description: "Can operate service identity reports",
      permissions: ["reports:operate"],
      scope: "platform"
    },
    headers: authHeaders
  });
  assert.equal(groupRoleResp.statusCode, 201);
  const groupRole = groupRoleResp.json();

  const groupResp = await app.inject({
    method: "POST",
    url: "/api/admin/groups",
    payload: {
      name: "report-workers",
      description: "Report workload identities",
      roleIds: [groupRole.id]
    },
    headers: authHeaders
  });
  assert.equal(groupResp.statusCode, 201);
  const group = groupResp.json();

  // Create a service identity
  const createResp = await app.inject({
    method: "POST",
    url: "/api/admin/service-identities",
    payload: {
      name: "test-worker",
      description: "Test worker service",
      status: "active",
      allowedScopes: ["read:reports", "roles", "permissions"],
      allowedAudiences: ["api.example.com"],
      roleIds: [directRole.id],
      groupIds: [group.id]
    },
    headers: authHeaders
  });

  assert.equal(createResp.statusCode, 201);
  const identity = createResp.json();
  assert.equal(identity.name, "test-worker");
  assert.deepEqual(identity.allowedScopes, ["read:reports", "roles", "permissions"]);
  assert.deepEqual(identity.roleIds, [directRole.id]);
  assert.deepEqual(identity.groupIds, [group.id]);

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

  const flowsResp = await app.inject({
    method: "GET",
    url: "/api/admin/authentication/flows",
    headers: { cookie: authHeaders.cookie }
  });
  assert.equal(flowsResp.statusCode, 200);
  const activeAuthenticationFlow = (flowsResp.json() as Array<{ id: string; enabled: boolean; designation: string; grantTypes: string[] }>)
    .find((flow) => flow.enabled && flow.designation === "authentication");
  assert.ok(activeAuthenticationFlow);

  const restrictActiveFlowResp = await app.inject({
    method: "PUT",
    url: `/api/admin/authentication/flows/${activeAuthenticationFlow.id}`,
    payload: { grantTypes: ["authorization_code"] },
    headers: authHeaders
  });
  assert.equal(restrictActiveFlowResp.statusCode, 200);

  const tokenResp = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: issued.credential.clientId,
      client_secret: issued.plainClientSecret,
      scope: "read:reports"
    }
  });

  assert.equal(tokenResp.statusCode, 200);
  const tokenPayload = tokenResp.json() as { access_token?: string; token_type?: string; scope?: string };
  assert.ok(typeof tokenPayload.access_token === "string" && tokenPayload.access_token.length > 0);
  assert.equal(tokenPayload.token_type, "Bearer");
  assert.equal(tokenPayload.scope, "read:reports");
  const tokenClaims = decodeJwt(tokenPayload.access_token) as { roles?: string[]; permissions?: string[]; service_identity_id?: string };
  assert.equal(tokenClaims.service_identity_id, identity.id);
  // Authorization claims are scope-gated: not requested, so not embedded.
  assert.equal(tokenClaims.roles, undefined);
  assert.equal(tokenClaims.permissions, undefined);

  const authorizationClaimsTokenResp = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: issued.credential.clientId,
      client_secret: issued.plainClientSecret,
      scope: "read:reports roles permissions"
    }
  });

  assert.equal(authorizationClaimsTokenResp.statusCode, 200);
  const authorizationClaimsPayload = authorizationClaimsTokenResp.json() as { access_token: string };
  const authorizationClaims = decodeJwt(authorizationClaimsPayload.access_token) as { roles?: string[]; permissions?: string[] };
  assert.deepEqual(authorizationClaims.roles?.sort(), ["report_operator", "report_reader"]);
  assert.deepEqual(authorizationClaims.permissions?.sort(), ["reports:operate", "reports:read"]);

  const restoreActiveFlowResp = await app.inject({
    method: "PUT",
    url: `/api/admin/authentication/flows/${activeAuthenticationFlow.id}`,
    payload: { grantTypes: activeAuthenticationFlow.grantTypes },
    headers: authHeaders
  });
  assert.equal(restoreActiveFlowResp.statusCode, 200);

  const disallowedScopeResp = await app.inject({
    method: "POST",
    url: "/oauth/token",
    payload: {
      grant_type: "client_credentials",
      client_id: issued.credential.clientId,
      client_secret: issued.plainClientSecret,
      scope: "write:reports"
    }
  });

  assert.equal(disallowedScopeResp.statusCode, 400);

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
    payload: { status: "suspended", roleIds: [directRole.id], groupIds: [group.id] },
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

test("service identity usage telemetry updates on token exchange and rejects revoked/expired credentials", async (t) => {
  const { app, admin } = await createTestContext("integration-service-identities-usage");

  t.after(async () => {
    await app.close();
  });

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

  const createResp = await app.inject({
    method: "POST",
    url: "/api/admin/service-identities",
    payload: {
      name: "usage-worker",
      description: "Service identity usage linkage test",
      status: "active",
      allowedScopes: ["openid", "profile"],
      allowedAudiences: ["api.example.com"]
    },
    headers: authHeaders
  });
  assert.equal(createResp.statusCode, 201);
  const identity = createResp.json();

  const issueResp = await app.inject({
    method: "POST",
    url: `/api/admin/service-identities/${identity.id}/credentials`,
    payload: { expiresInDays: 30 },
    headers: authHeaders
  });
  assert.equal(issueResp.statusCode, 201);
  const issued = issueResp.json();

  const subjectLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
      password: admin.password,
      clientId: "sso-admin-ui",
      scope: ["openid", "profile", "email"]
    }
  });
  assert.equal(subjectLogin.statusCode, 200);
  const subjectPayload = subjectLogin.json() as { accessToken?: string; access_token?: string };
  const subjectToken = subjectPayload.accessToken ?? subjectPayload.access_token;
  assert.ok(typeof subjectToken === "string" && subjectToken.length > 0);

  const exchangeOk = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile",
      client_id: issued.credential.clientId,
      client_secret: issued.plainClientSecret
    }
  });
  assert.equal(exchangeOk.statusCode, 200);

  const usageAfterExchange = await app.inject({
    method: "GET",
    url: `/api/admin/service-identities/${identity.id}/usage`,
    headers: { cookie: authHeaders.cookie }
  });
  assert.equal(usageAfterExchange.statusCode, 200);
  const usagePayload = usageAfterExchange.json() as { data: Array<{ credentialId: string; status: string; lastUsedAt?: string }> };
  const activeRow = usagePayload.data.find((row) => row.credentialId === issued.credential.id);
  assert.ok(activeRow);
  assert.equal(activeRow?.status, "active");
  assert.ok(Boolean(activeRow?.lastUsedAt), "Expected lastUsedAt to be set after token exchange using service identity credential");

  const revokeResp = await app.inject({
    method: "DELETE",
    url: `/api/admin/service-identities/${identity.id}/credentials/${issued.credential.id}`,
    headers: authHeaders
  });
  assert.equal(revokeResp.statusCode, 204);

  const exchangeRevoked = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile",
      client_id: issued.credential.clientId,
      client_secret: issued.plainClientSecret
    }
  });
  assert.equal(exchangeRevoked.statusCode, 401);

  const issueExpiredResp = await app.inject({
    method: "POST",
    url: `/api/admin/service-identities/${identity.id}/credentials`,
    payload: { expiresInDays: 1 },
    headers: authHeaders
  });
  assert.equal(issueExpiredResp.statusCode, 201);
  const expiredIssued = issueExpiredResp.json();

  const db = new Database(String(process.env.DATABASE_PATH));
  try {
    db.prepare("UPDATE service_identity_credentials SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 60_000).toISOString(), expiredIssued.credential.id);
  } finally {
    db.close();
  }

  const exchangeExpired = await app.inject({
    method: "POST",
    url: "/oauth/token/exchange",
    headers: { "content-type": "application/json" },
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid profile",
      client_id: expiredIssued.credential.clientId,
      client_secret: expiredIssued.plainClientSecret
    }
  });
  assert.equal(exchangeExpired.statusCode, 401);
});
