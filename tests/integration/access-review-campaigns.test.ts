import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("access review campaign generation and revocation decisions", async (t) => {
  const { app, admin } = await createTestContext("integration-access-review-campaigns");
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
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);

  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  const csrfToken = String(csrfResponse.json().csrf_token);
  const authCookies = `${sid}; ${csrfCookie}`;

  const subjectCreate = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      email: "review-subject@example.com",
      username: "review_subject",
      password: "Change-Me-Now1!",
      givenName: "Review",
      familyName: "Subject",
      roleIds: [],
      groupIds: []
    }
  });
  assert.equal(subjectCreate.statusCode, 201);
  const subject = subjectCreate.json() as { id: string };

  const roleCreate = await app.inject({
    method: "POST",
    url: "/api/admin/roles",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "review_role",
      description: "Role for access review integration test",
      permissions: ["review:test"],
      scope: "platform"
    }
  });
  assert.equal(roleCreate.statusCode, 201);
  const role = roleCreate.json() as { id: string; name: string };

  const groupCreate = await app.inject({
    method: "POST",
    url: "/api/admin/groups",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "review_group",
      description: "Group for access review integration test"
    }
  });
  assert.equal(groupCreate.statusCode, 201);
  const group = groupCreate.json() as { id: string; name: string };

  const assignRole = await app.inject({
    method: "POST",
    url: "/api/admin/role-assignments",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: subject.id,
      roleId: role.id
    }
  });
  assert.equal(assignRole.statusCode, 201);

  const assignGroup = await app.inject({
    method: "POST",
    url: "/api/admin/user-groups",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      userId: subject.id,
      groupId: group.id
    }
  });
  assert.equal(assignGroup.statusCode, 201);

  const createCampaign = await app.inject({
    method: "POST",
    url: "/api/admin/access-reviews/campaigns",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "Quarterly Test Campaign",
      description: "Validate assignment import into review items"
    }
  });
  assert.equal(createCampaign.statusCode, 201);

  const created = createCampaign.json() as {
    campaign: { id: string; status: string };
    generatedItems: number;
  };
  assert.equal(created.campaign.status, "active");
  assert.equal(created.generatedItems > 0, true);

  const getCampaign = await app.inject({
    method: "GET",
    url: `/api/admin/access-reviews/campaigns/${created.campaign.id}`,
    headers: {
      cookie: sid
    }
  });
  assert.equal(getCampaign.statusCode, 200);

  const payload = getCampaign.json() as {
    campaign: { id: string; status: string };
    items: Array<{ id: string; subjectUserId: string; entitlementType: string; entitlementValue: string; decision?: string }>;
  };

  const roleItem = payload.items.find((item) =>
    item.subjectUserId === subject.id && item.entitlementType === "role" && item.entitlementValue === role.id
  );
  const groupItem = payload.items.find((item) =>
    item.subjectUserId === subject.id && item.entitlementType === "group" && item.entitlementValue === group.id
  );

  assert.ok(roleItem);
  assert.ok(groupItem);

  const revokeRoleDecision = await app.inject({
    method: "POST",
    url: `/api/admin/access-reviews/items/${roleItem!.id}/decision`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      decision: "revoked",
      rationale: "No longer needed"
    }
  });
  assert.equal(revokeRoleDecision.statusCode, 200);
  const revoked = revokeRoleDecision.json() as { decision: string };
  assert.equal(revoked.decision, "revoked");

  const usersAfterDecision = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: { cookie: sid }
  });
  assert.equal(usersAfterDecision.statusCode, 200);
  const users = usersAfterDecision.json() as Array<{ id: string; roles: string[] }>;
  const subjectAfterDecision = users.find((user) => user.id === subject.id);
  assert.equal(subjectAfterDecision?.roles.includes(role.name), false);

  const auditEventsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/audit?limit=200",
    headers: { cookie: sid }
  });
  assert.equal(auditEventsResponse.statusCode, 200);

  const auditEvents = auditEventsResponse.json() as Array<{ type: string; metadata?: Record<string, unknown> }>;
  const attestationEvent = auditEvents.find((event) =>
    event.type === "access_review_item_decided" && event.metadata?.itemId === roleItem!.id
  );

  assert.ok(attestationEvent);
  assert.equal(attestationEvent?.metadata?.evidenceType, "access_review_attestation");
  assert.equal(attestationEvent?.metadata?.decision, "revoked");
  assert.equal(attestationEvent?.metadata?.campaignId, created.campaign.id);
});
