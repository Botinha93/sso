import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

describe("SAML Admin Routes", () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeAll(async () => {
    app = await buildApp();

    // login as admin
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "admin",
        password: "northstar-default-admin-password"
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    adminCookie = Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(";")[0]).join("; ")
      : String(setCookie).split(";")[0];
  });

  afterAll(async () => {
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

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("id");
      expect(body.entityId).toBe("https://example.com/sp");
      expect(body.enabled).toBe(true);
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

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/admin/saml/service-providers", () => {
    beforeAll(async () => {
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

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("limit");
      expect(body).toHaveProperty("offset");
    });

    it("should respect pagination limit parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/service-providers?limit=2&offset=0",
        headers: { cookie: adminCookie }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(0);
    });
  });

  describe("GET /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    beforeAll(async () => {
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

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(providerId);
      expect(body.entityId).toMatch(/fetch-sp/);
    });

    it("should return 404 for non-existent provider", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/service-providers/non-existent-id",
        headers: { cookie: adminCookie }
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    beforeAll(async () => {
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

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.enabled).toBe(false);
      expect(body.sloUrl).toBe("https://update-sp.com/saml/slo");
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

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.nameIdFormat).toBe("emailAddress");
      // Verify other fields are unchanged
      expect(body.sloUrl).toBe("https://update-sp.com/saml/slo");
    });
  });

  describe("DELETE /api/admin/saml/service-providers/:id", () => {
    let providerId: string;

    beforeAll(async () => {
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

      expect(deleteRes.statusCode).toBe(204);

      // Verify it's deleted
      const getRes = await app.inject({
        method: "GET",
        url: `/api/admin/saml/service-providers/${providerId}`,
        headers: { cookie: adminCookie }
      });

      expect(getRes.statusCode).toBe(404);
    });
  });

  describe("GET /api/admin/saml/assertions", () => {
    it("should list all SAML assertion audits", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/assertions",
        headers: { cookie: adminCookie }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body).toHaveProperty("total");
    });

    it("should support pagination on audit listing", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/saml/assertions?limit=10&offset=0",
        headers: { cookie: adminCookie }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);
    });
  });
});
