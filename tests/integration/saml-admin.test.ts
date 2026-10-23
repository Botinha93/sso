import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";
import { createTestContext } from "../helpers/test-app.js";

describe("SAML Admin Routes", () => {
  let app: FastifyInstance;
  let adminCookie: string;

  before(async () => {
    const context = await createTestContext("integration-saml-admin");
    app = context.app;

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: context.admin.username,
        password: context.admin.password,
        clientId: "sso-admin-ui",
        scope: ["openid", "profile", "email"]
      }
    });

    assert.equal(loginRes.statusCode, 200, loginRes.body);
    const setCookie = loginRes.headers["set-cookie"];
    adminCookie = Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(";")[0]).join("; ")
      : String(setCookie).split(";")[0];
  });

  after(async () => {
    await app.close();
  });

  describe("POST /api/admin/saml/service-providers", () => {
    it("should create a SAML service provider", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://example.com/sp",
          acsUrl: "https://example.com/saml/acs",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "emailAddress",
          enabled: true
        }
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.ok(Object.hasOwn(body, "id"));
      assert.equal(body.entityId, "https://example.com/sp");
      assert.equal(body.enabled, true);
    });

    it("should reject with invalid ACS URL", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://example.com/sp2",
          acsUrl: "not-a-url",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "persistent",
          enabled: true
        }
      });

      assert.equal(res.statusCode, 400);
    });
  });

  describe("GET /api/admin/saml/service-providers", () => {
    before(async () => {
      // Create a test provider
      await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://test-sp.com/sp",
          acsUrl: "https://test-sp.com/saml/acs",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "persistent",
          enabled: true
        }
      });
    });

    it("should list all SAML service providers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Object.hasOwn(body, "items"));
      assert.equal(Array.isArray(body.items), true);
      assert.ok(Object.hasOwn(body, "total"));
      assert.ok(Object.hasOwn(body, "limit"));
      assert.ok(Object.hasOwn(body, "offset"));
    });

    it("should respect pagination limit parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/service-providers?limit=2&offset=0",
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.limit, 2);
      assert.equal(body.offset, 0);
    });
  });

  describe("GET /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    before(async () => {
      // Create a test provider and extract ID
      const createRes = await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://fetch-sp.com/sp",
          acsUrl: "https://fetch-sp.com/saml/acs",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "transient",
          enabled: false
        }
      });

      const body = JSON.parse(createRes.body);
      providerId = body.id;
    });

    it("should fetch a specific SAML service provider", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.id, providerId);
      assert.match(body.entityId, /fetch-sp/);
    });

    it("should return 404 for non-existent provider", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/service-providers/non-existent-id",
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 404);
    });
  });

  describe("PATCH /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    before(async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://update-sp.com/sp",
          acsUrl: "https://update-sp.com/saml/acs",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "persistent",
          enabled: true
        }
      });

      const body = JSON.parse(createRes.body);
      providerId = body.id;
    });

    it("should update a SAML service provider", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          enabled: false,
          sloUrl: "https://update-sp.com/saml/slo"
        }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.enabled, false);
      assert.equal(body.sloUrl, "https://update-sp.com/saml/slo");
    });

    it("should apply partial updates", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          nameIdFormat: "emailAddress"
        }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.nameIdFormat, "emailAddress");
      // Verify other fields are unchanged
      assert.equal(body.sloUrl, "https://update-sp.com/saml/slo");
    });
  });

  describe("DELETE /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    before(async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/admin/saml/service-providers",
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" },
        payload: {
          entityId: "https://delete-sp.com/sp",
          acsUrl: "https://delete-sp.com/saml/acs",
          signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
          nameIdFormat: "persistent",
          enabled: true
        }
      });

      const body = JSON.parse(createRes.body);
      providerId = body.id;
    });

    it("should delete a SAML service provider", async () => {
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
        cookies: { csrf_token: "test-token" }
      });

      assert.equal(deleteRes.statusCode, 204);

      // Verify it's deleted
      const getRes = await app.inject({
        method: "GET",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie }
      });

      assert.equal(getRes.statusCode, 404);
    });
  });

  describe("GET /api/admin/saml/assertions", () => {
    it("should list all SAML assertion audits", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/assertions",
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Object.hasOwn(body, "items"));
      assert.equal(Array.isArray(body.items), true);
      assert.ok(Object.hasOwn(body, "total"));
    });

    it("should support pagination on audit listing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/assertions?limit=10&offset=0",
        headers: { cookie: adminCookie }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.limit, 10);
      assert.equal(body.offset, 0);
    });
  });
});
