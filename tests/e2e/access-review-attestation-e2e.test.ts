import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

test("reviewer recertification emits attestation audit evidence", async (t) => {
  const { app, admin } = await createTestContext("e2e-access-review-attestation");
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
      email: "e2e-review-subject@example.com",
      username: "e2e_review_subject",
      password: "Change-Me-Now1!",
      givenName: "E2E",
      familyName: "Review",
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
      name: "e2e_review_role",
      description: "Role for e2e attestation test",
      permissions: ["review:e2e"],
      scope: "platform"
    }
  });
  assert.equal(roleCreate.statusCode, 201);
  const role = roleCreate.json() as { id: string };

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

  const createCampaign = await app.inject({
    method: "POST",
    url: "/api/admin/access-reviews/campaigns",
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "E2E Attestation Campaign",
      description: "Validate reviewer evidence generation"
    }
  });
  assert.equal(createCampaign.statusCode, 201);

  const created = createCampaign.json() as { campaign: { id: string } };

  const getCampaign = await app.inject({
    method: "GET",
    url: `/api/admin/access-reviews/campaigns/${created.campaign.id}`,
    headers: {
      cookie: sid
    }
  });
  assert.equal(getCampaign.statusCode, 200);

  const payload = getCampaign.json() as {
    items: Array<{ id: string; subjectUserId: string; entitlementType: string; entitlementValue: string }>;
  };

  const roleItem = payload.items.find((item) =>
    item.subjectUserId === subject.id && item.entitlementType === "role" && item.entitlementValue === role.id
  );
  assert.ok(roleItem);

  const decisionResponse = await app.inject({
    method: "POST",
    url: `/api/admin/access-reviews/items/${roleItem!.id}/decision`,
    headers: {
      cookie: authCookies,
      "x-csrf-token": csrfToken
    },
    payload: {
      decision: "revoked",
      rationale: "No longer required"
    }
  });
  assert.equal(decisionResponse.statusCode, 200);

  const auditResponse = await app.inject({
    method: "GET",
    url: "/api/admin/audit?limit=200",
    headers: { cookie: sid }
  });
  assert.equal(auditResponse.statusCode, 200);

  const events = auditResponse.json() as Array<{ type: string; metadata?: Record<string, unknown> }>;
  const attestationEvent = events.find((event) =>
    event.type === "access_review_item_decided" && event.metadata?.itemId === roleItem!.id
  );

  assert.ok(attestationEvent);
  assert.equal(attestationEvent?.metadata?.evidenceType, "access_review_attestation");
  assert.equal(attestationEvent?.metadata?.decision, "revoked");
  assert.equal(attestationEvent?.metadata?.subjectUserId, subject.id);
  assert.equal(attestationEvent?.metadata?.entitlementType, "role");
  assert.equal(attestationEvent?.metadata?.evidenceVersion, "1.0");
});
