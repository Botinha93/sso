import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("admin provisioning mappings and reconcile jobs lifecycle", async (t) => {
  const { app, admin } = await createTestContext("integration-provisioning-management");
  t.after(async () => {
    await app.close();
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: admin.username,
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
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authCookies = `${sid}; ${csrfCookie}`;

  const createMappingResponse = await app.inject({
    method: "POST",
    url: "/api/admin/provisioning/mappings",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "workday_manager",
      sourceAttribute: "enterprise.manager",
      targetAttribute: "customAttributes.managerId",
      transformExpression: "value?.toLowerCase()",
      enabled: true
    }
  });

  assert.equal(createMappingResponse.statusCode, 201);
  const createdMapping = createMappingResponse.json() as { id: string; name: string; enabled: boolean };
  assert.equal(createdMapping.name, "workday_manager");
  assert.equal(createdMapping.enabled, true);

  const listMappingsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/provisioning/mappings",
    headers: {
      cookie: sid
    }
  });

  assert.equal(listMappingsResponse.statusCode, 200);
  const mappings = listMappingsResponse.json() as Array<{ id: string; sourceAttribute: string }>;
  assert.ok(mappings.some((mapping) => mapping.id === createdMapping.id && mapping.sourceAttribute === "enterprise.manager"));

  const reconcileResponse = await app.inject({
    method: "POST",
    url: "/api/admin/provisioning/jobs/reconcile",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      dryRun: true
    }
  });

  assert.equal(reconcileResponse.statusCode, 202);
  const job = reconcileResponse.json() as { id: string; status: string; summary: Record<string, unknown> };
  assert.equal(job.status, "completed");
  assert.equal(job.summary.dryRun, true);

  const listJobsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/provisioning/jobs",
    headers: {
      cookie: sid
    }
  });

  assert.equal(listJobsResponse.statusCode, 200);
  const jobs = listJobsResponse.json() as Array<{ id: string; status: string }>;
  assert.ok(jobs.some((entry) => entry.id === job.id && entry.status === "completed"));

  const deleteMappingResponse = await app.inject({
    method: "DELETE",
    url: `/api/admin/provisioning/mappings/${createdMapping.id}`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    }
  });

  assert.equal(deleteMappingResponse.statusCode, 204);
});
