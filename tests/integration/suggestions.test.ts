import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, extractCookie } from "../helpers/test-app.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function multipartPayload(filename: string, mimeType: string, content: Buffer) {
  const boundary = "----suggestionsboundary";
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([prefix, content, suffix])
  };
}

async function login(
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
  const sid = extractCookie(response.headers["set-cookie"], "sid");
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/csrf-token",
    headers: { cookie: sid }
  });
  assert.equal(csrfResponse.statusCode, 200);
  const csrfCookie = extractCookie(csrfResponse.headers["set-cookie"], "csrf_token");
  return {
    headers: {
      cookie: `${sid}; ${csrfCookie}`,
      "x-csrf-token": String(csrfResponse.json().csrf_token)
    }
  };
}

test("portal suggestions enforce app access, anonymity, and image uploads", async (t) => {
  const { app, admin } = await createTestContext("integration-suggestions");
  t.after(async () => {
    await app.close();
  });

  const adminAuth = await login(app, admin.email, admin.password);

  const apps = await app.inject({
    method: "GET",
    url: "/api/admin/apps",
    headers: adminAuth.headers
  });
  assert.equal(apps.statusCode, 200, apps.body);
  const appList = apps.json() as Array<{ id: string; name: string }>;
  const accountPortal = appList.find((item) => item.name === "Account Portal");
  const adminPortal = appList.find((item) => item.name === "Admin Portal");
  assert.ok(accountPortal);
  assert.ok(adminPortal);

  const roles = await app.inject({
    method: "GET",
    url: "/api/admin/roles",
    headers: adminAuth.headers
  });
  assert.equal(roles.statusCode, 200, roles.body);
  const roleList = roles.json() as Array<{ id: string; name: string }>;
  const helpdeskRole = roleList.find((role) => role.name === "helpdesk");
  assert.ok(helpdeskRole);

  const authorUser = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: adminAuth.headers,
    payload: {
      email: "suggester@example.com",
      username: "suggester",
      password: "Change-Me-Now1!",
      givenName: "Sue",
      familyName: "Gester",
      appIds: [accountPortal.id]
    }
  });
  assert.equal(authorUser.statusCode, 201, authorUser.body);

  const otherUser = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: adminAuth.headers,
    payload: {
      email: "other@example.com",
      username: "otheruser",
      password: "Change-Me-Now1!",
      givenName: "Other",
      familyName: "User",
      appIds: [accountPortal.id]
    }
  });
  assert.equal(otherUser.statusCode, 201, otherUser.body);

  const helpdeskUser = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: adminAuth.headers,
    payload: {
      email: "helpdesk@example.com",
      username: "helpdeskuser",
      password: "Change-Me-Now1!",
      givenName: "Help",
      familyName: "Desk",
      roleIds: [helpdeskRole.id]
    }
  });
  assert.equal(helpdeskUser.statusCode, 201, helpdeskUser.body);

  const unauthorized = await app.inject({
    method: "GET",
    url: "/api/portal/suggestions"
  });
  assert.equal(unauthorized.statusCode, 401);

  const csrfOnly = await app.inject({
    method: "GET",
    url: "/api/csrf-token"
  });
  assert.equal(csrfOnly.statusCode, 200);
  const csrfOnlyCookie = extractCookie(csrfOnly.headers["set-cookie"], "csrf_token");
  const unauthorizedCreate = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions",
    headers: {
      cookie: csrfOnlyCookie,
      "x-csrf-token": String(csrfOnly.json().csrf_token)
    },
    payload: {
      kind: "new_system",
      title: "Nope",
      body: "Should fail"
    }
  });
  assert.equal(unauthorizedCreate.statusCode, 401);

  const authorAuth = await login(app, "suggester@example.com", "Change-Me-Now1!");
  const otherAuth = await login(app, "other@example.com", "Change-Me-Now1!");
  const helpdeskAuth = await login(app, "helpdesk@example.com", "Change-Me-Now1!");

  const deniedApp = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions",
    headers: authorAuth.headers,
    payload: {
      kind: "existing_app",
      appId: adminPortal.id,
      title: "Admin idea",
      body: "Should be rejected"
    }
  });
  assert.equal(deniedApp.statusCode, 422, deniedApp.body);

  const createdApp = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions",
    headers: authorAuth.headers,
    payload: {
      kind: "existing_app",
      appId: accountPortal.id,
      title: "Portal search",
      body: "Add search to the launcher"
    }
  });
  assert.equal(createdApp.statusCode, 201, createdApp.body);
  const createdAppBody = createdApp.json();
  assert.equal(createdAppBody.author, undefined);
  assert.equal(createdAppBody.title, "Portal search");

  const createdNew = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions",
    headers: authorAuth.headers,
    payload: {
      kind: "new_system",
      proposedName: "Time tracking",
      title: "New time clock",
      body: "A new attendance system"
    }
  });
  assert.equal(createdNew.statusCode, 201, createdNew.body);

  const otherCreated = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions",
    headers: otherAuth.headers,
    payload: {
      kind: "new_system",
      title: "Other idea",
      body: "Should stay private to other user"
    }
  });
  assert.equal(otherCreated.statusCode, 201, otherCreated.body);

  const mine = await app.inject({
    method: "GET",
    url: "/api/portal/suggestions",
    headers: authorAuth.headers
  });
  assert.equal(mine.statusCode, 200, mine.body);
  const mineItems = mine.json() as Array<{ title: string; author?: unknown }>;
  assert.equal(mineItems.length, 2);
  assert.ok(mineItems.every((item) => item.author === undefined));
  assert.ok(mineItems.every((item) => item.title !== "Other idea"));

  const rejectedPayload = multipartPayload("note.txt", "text/plain", Buffer.from("not-an-image"));
  const uploadRejected = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions/images",
    headers: {
      ...authorAuth.headers,
      "content-type": rejectedPayload.contentType
    },
    payload: rejectedPayload.payload
  });
  assert.equal(uploadRejected.statusCode, 415, uploadRejected.body);

  const acceptedPayload = multipartPayload("dot.png", "image/png", PNG_1X1);
  const uploadForm = await app.inject({
    method: "POST",
    url: "/api/portal/suggestions/images",
    headers: {
      ...authorAuth.headers,
      "content-type": acceptedPayload.contentType
    },
    payload: acceptedPayload.payload
  });
  assert.equal(uploadForm.statusCode, 200, uploadForm.body);
  assert.match(String(uploadForm.json().url), /^\/media\/uploads\/suggestions\//);

  const helpdeskList = await app.inject({
    method: "GET",
    url: "/api/admin/suggestions",
    headers: helpdeskAuth.headers
  });
  assert.equal(helpdeskList.statusCode, 200, helpdeskList.body);
  const helpdeskItems = helpdeskList.json() as Array<Record<string, unknown>>;
  assert.ok(helpdeskItems.length >= 3);
  for (const item of helpdeskItems) {
    assert.equal(item.author, undefined);
    assert.equal("authorUserId" in item, false);
  }

  const helpdeskDetail = await app.inject({
    method: "GET",
    url: `/api/admin/suggestions/${createdApp.json().id}`,
    headers: helpdeskAuth.headers
  });
  assert.equal(helpdeskDetail.statusCode, 200, helpdeskDetail.body);
  assert.equal(helpdeskDetail.json().author, undefined);

  const patched = await app.inject({
    method: "PATCH",
    url: `/api/admin/suggestions/${createdApp.json().id}`,
    headers: helpdeskAuth.headers,
    payload: {
      status: "in_review",
      internalNotes: "Looks useful"
    }
  });
  assert.equal(patched.statusCode, 200, patched.body);
  assert.equal(patched.json().status, "in_review");
  assert.equal(patched.json().internalNotes, "Looks useful");
  assert.equal(patched.json().author, undefined);

  const adminList = await app.inject({
    method: "GET",
    url: "/api/admin/suggestions",
    headers: adminAuth.headers
  });
  assert.equal(adminList.statusCode, 200, adminList.body);
  const adminItems = adminList.json() as Array<{ title: string; author?: { email: string } }>;
  const portalSearch = adminItems.find((item) => item.title === "Portal search");
  assert.ok(portalSearch?.author);
  assert.equal(portalSearch.author.email, "suggester@example.com");
});
