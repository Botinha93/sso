import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("access governance request intake and listing", async (t) => {
  const { app, admin } = await createTestContext("integration-access-governance-requests");
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

  const subjectCreateResponse = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      email: "access-subject@example.com",
      username: "access_subject",
      password: "Change-Me-Now1!",
      givenName: "Access",
      familyName: "Subject",
      roleIds: [],
      groupIds: []
    }
  });

  assert.equal(subjectCreateResponse.statusCode, 201);
  const subject = subjectCreateResponse.json() as { id: string };

  const roleCreateResponse = await app.inject({
    method: "POST",
    url: "/api/admin/roles",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "finance_approver",
      description: "Finance approval role",
      permissions: ["finance:approve"],
      scope: "platform"
    }
  });
  assert.equal(roleCreateResponse.statusCode, 201);
  const role = roleCreateResponse.json() as { id: string; name: string };

  const expiringRoleCreateResponse = await app.inject({
    method: "POST",
    url: "/api/admin/roles",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "finance_temp",
      description: "Temporary finance role",
      permissions: ["finance:temp"],
      scope: "platform"
    }
  });
  assert.equal(expiringRoleCreateResponse.statusCode, 201);
  const expiringRole = expiringRoleCreateResponse.json() as { id: string; name: string };

  const createRequestResponse = await app.inject({
    method: "POST",
    url: "/api/admin/access-requests",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      subjectUserId: subject.id,
      entitlementType: "role",
      entitlementValue: role.id,
      justification: "User joined AP operations and needs temporary approver access."
    }
  });

  assert.equal(createRequestResponse.statusCode, 201);
  const created = createRequestResponse.json() as {
    id: string;
    requesterId: string;
    subjectUserId: string;
    status: string;
    entitlementType: string;
    entitlementValue: string;
  };
  assert.equal(created.subjectUserId, subject.id);
  assert.equal(created.requesterId.length > 0, true);
  assert.equal(created.status, "pending");
  assert.equal(created.entitlementType, "role");
  assert.equal(created.entitlementValue, role.id);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-requests?status=pending&limit=20",
    headers: {
      cookie: sid
    }
  });

  assert.equal(listResponse.statusCode, 200);
  const requests = listResponse.json() as Array<{ id: string; status: string; subjectUserId: string }>;
  assert.ok(requests.some((request) => request.id === created.id && request.status === "pending" && request.subjectUserId === subject.id));

  const approveResponse = await app.inject({
    method: "POST",
    url: `/api/admin/access-requests/${created.id}/approve`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      rationale: "Approved by line manager"
    }
  });

  assert.equal(approveResponse.statusCode, 200);
  const approved = approveResponse.json() as { id: string; status: string };
  assert.equal(approved.id, created.id);
  assert.equal(approved.status, "approved");

  const usersAfterApprovalResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: {
      cookie: sid
    }
  });
  assert.equal(usersAfterApprovalResponse.statusCode, 200);
  const usersAfterApproval = usersAfterApprovalResponse.json() as Array<{ id: string; roles: string[] }>;
  const approvedSubject = usersAfterApproval.find((user) => user.id === subject.id);
  assert.ok(approvedSubject?.roles.includes(role.name));

  const secondRequestResponse = await app.inject({
    method: "POST",
    url: "/api/admin/access-requests",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      subjectUserId: subject.id,
      entitlementType: "role",
      entitlementValue: expiringRole.id,
      justification: "Temporary support coverage for quarter close."
    }
  });
  assert.equal(secondRequestResponse.statusCode, 201);
  const secondRequest = secondRequestResponse.json() as { id: string; status: string };
  assert.equal(secondRequest.status, "pending");

  const rejectResponse = await app.inject({
    method: "POST",
    url: `/api/admin/access-requests/${secondRequest.id}/reject`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      rationale: "Rejected due to missing business owner signoff"
    }
  });

  assert.equal(rejectResponse.statusCode, 200);
  const rejected = rejectResponse.json() as { id: string; status: string };
  assert.equal(rejected.id, secondRequest.id);
  assert.equal(rejected.status, "rejected");

  const expiringRequestResponse = await app.inject({
    method: "POST",
    url: "/api/admin/access-requests",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      subjectUserId: subject.id,
      entitlementType: "role",
      entitlementValue: expiringRole.id,
      justification: "Break-glass temporary assignment.",
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    }
  });
  assert.equal(expiringRequestResponse.statusCode, 201);
  const expiringRequest = expiringRequestResponse.json() as { id: string; status: string };
  assert.equal(expiringRequest.status, "pending");

  const approveExpiringResponse = await app.inject({
    method: "POST",
    url: `/api/admin/access-requests/${expiringRequest.id}/approve`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    }
  });
  assert.equal(approveExpiringResponse.statusCode, 200);
  const approvedExpiring = approveExpiringResponse.json() as { status: string };
  assert.equal(approvedExpiring.status, "approved");

  const processExpirationsResponse = await app.inject({
    method: "POST",
    url: "/api/admin/access-requests/process-expirations",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      dryRun: false
    }
  });
  assert.equal(processExpirationsResponse.statusCode, 200);
  const processSummary = processExpirationsResponse.json() as { revokedAssignments: number; expiredRequests: number };
  assert.equal(processSummary.expiredRequests >= 1, true);
  assert.equal(processSummary.revokedAssignments >= 1, true);

  const expiredListResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-requests?status=expired&limit=20",
    headers: {
      cookie: sid
    }
  });
  assert.equal(expiredListResponse.statusCode, 200);
  const expiredRequests = expiredListResponse.json() as Array<{ id: string; status: string }>;
  assert.ok(expiredRequests.some((request) => request.id === expiringRequest.id && request.status === "expired"));

  const usersAfterExpiryResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: {
      cookie: sid
    }
  });
  assert.equal(usersAfterExpiryResponse.statusCode, 200);
  const usersAfterExpiry = usersAfterExpiryResponse.json() as Array<{ id: string; roles: string[] }>;
  const subjectAfterExpiry = usersAfterExpiry.find((user) => user.id === subject.id);
  assert.ok(subjectAfterExpiry?.roles.includes(role.name));
  assert.equal(subjectAfterExpiry?.roles.includes(expiringRole.name), false);

  const invalidTransitionResponse = await app.inject({
    method: "POST",
    url: `/api/admin/access-requests/${created.id}/reject`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      rationale: "should fail"
    }
  });

  assert.equal(invalidTransitionResponse.statusCode, 422);
});
