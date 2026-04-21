import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

describe("SAML Protocol Routes", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let spId: string;
  let alternateSpId: string;
  let testDatabasePath = "";
  let previousDatabaseProvider: string | undefined;
  let previousDatabasePath: string | undefined;

  before(async () => {
    previousDatabaseProvider = process.env.DATABASE_PROVIDER;
    previousDatabasePath = process.env.DATABASE_PATH;
    testDatabasePath = join(process.cwd(), "data", `saml-protocol-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);

    process.env.DATABASE_PROVIDER = "sqlite";
    process.env.DATABASE_PATH = testDatabasePath;

    app = await buildApp();

    const setupStatusRes = await app.inject({
      method: "GET",
      url: "/api/setup/status"
    });

    assert.equal(setupStatusRes.statusCode, 200);
    const setupStatus = JSON.parse(setupStatusRes.body) as { requiresSetup?: boolean };

    if (setupStatus.requiresSetup) {
      const setupRes = await app.inject({
        method: "POST",
        url: "/api/setup/initialize",
        payload: {
          name: "Northstar Admin",
          email: "admin@example.com",
          username: "admin",
          password: "northstar-default-admin-password",
          databaseProvider: "sqlite"
        }
      });

      assert.equal(setupRes.statusCode, 201);
    }

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "northstar-default-admin-password"
      }
    });

    assert.equal(loginRes.statusCode, 200);
    const setCookie = loginRes.headers["set-cookie"];
    adminCookie = Array.isArray(setCookie)
      ? setCookie.map((entry) => entry.split(";")[0]).join("; ")
      : String(setCookie).split(";")[0];

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/saml/service-providers",
      headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
      cookies: { csrf_token: "test-token" },
      payload: {
        entityId: "https://protocol-test-sp.example/sp",
        acsUrl: "https://protocol-test-sp.example/saml/acs",
        signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        nameIdFormat: "emailAddress",
        enabled: true
      }
    });

    assert.equal(createRes.statusCode, 201);
    const createBody = JSON.parse(createRes.body);
    spId = createBody.id;

    const alternateSpRes = await app.inject({
      method: "POST",
      url: "/api/admin/saml/service-providers",
      headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
      cookies: { csrf_token: "test-token" },
      payload: {
        entityId: "https://alternate-protocol-test-sp.example/sp",
        acsUrl: "https://alternate-protocol-test-sp.example/saml/acs",
        signingCertificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        nameIdFormat: "emailAddress",
        enabled: true
      }
    });

    assert.equal(alternateSpRes.statusCode, 201);
    const alternateBody = JSON.parse(alternateSpRes.body);
    alternateSpId = alternateBody.id;
  });

  after(async () => {
    await app.close();

    if (previousDatabaseProvider === undefined) {
      delete process.env.DATABASE_PROVIDER;
    } else {
      process.env.DATABASE_PROVIDER = previousDatabaseProvider;
    }

    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }

    rmSync(testDatabasePath, { force: true });
  });

  it("serves service-provider metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/saml/metadata?spId=${spId}`
    });

    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers["content-type"]), /application\/samlmetadata\+xml/);
    assert.match(res.body, /EntityDescriptor/);
    assert.match(res.body, /protocol-test-sp\.example/);
  });

  it("creates a SAML response for SSO and accepts it on ACS", async () => {
    const ssoRes = await app.inject({
      method: "POST",
      url: "/saml/sso",
      headers: { cookie: adminCookie },
      payload: {
        spId,
        relayState: "relay-123",
        responseMode: "json"
      }
    });

    assert.equal(ssoRes.statusCode, 200);
    const ssoBody = JSON.parse(ssoRes.body);
    assert.equal(ssoBody.destination, "https://protocol-test-sp.example/saml/acs");
    assert.equal(typeof ssoBody.samlResponse, "string");

    const acsRes = await app.inject({
      method: "POST",
      url: `/saml/acs/${spId}`,
      payload: {
        SAMLResponse: ssoBody.samlResponse,
        RelayState: ssoBody.relayState
      }
    });

    assert.equal(acsRes.statusCode, 200);
    const acsBody = JSON.parse(acsRes.body);
    assert.equal(acsBody.ok, true);
    assert.equal(acsBody.relayState, "relay-123");
  });

  it("blocks replayed ACS payloads for the same response ID", async () => {
    const ssoRes = await app.inject({
      method: "POST",
      url: "/saml/sso",
      headers: { cookie: adminCookie },
      payload: {
        spId,
        relayState: "relay-replay",
        responseMode: "json"
      }
    });

    assert.equal(ssoRes.statusCode, 200);
    const ssoBody = JSON.parse(ssoRes.body) as { samlResponse: string; relayState: string };

    const firstAcs = await app.inject({
      method: "POST",
      url: `/saml/acs/${spId}`,
      payload: {
        SAMLResponse: ssoBody.samlResponse,
        RelayState: ssoBody.relayState
      }
    });

    assert.equal(firstAcs.statusCode, 200);

    const replayedAcs = await app.inject({
      method: "POST",
      url: `/saml/acs/${spId}`,
      payload: {
        SAMLResponse: ssoBody.samlResponse,
        RelayState: ssoBody.relayState
      }
    });

    assert.equal(replayedAcs.statusCode, 422);
    assert.match(JSON.parse(replayedAcs.body).error, /replay/i);
  });

  it("rejects tampered signed ACS payloads", async () => {
    const ssoRes = await app.inject({
      method: "POST",
      url: "/saml/sso",
      headers: { cookie: adminCookie },
      payload: {
        spId,
        relayState: "relay-tamper",
        responseMode: "json"
      }
    });

    assert.equal(ssoRes.statusCode, 200);
    const ssoBody = JSON.parse(ssoRes.body) as { samlResponse: string };
    const xml = Buffer.from(ssoBody.samlResponse, "base64").toString("utf-8");
    const tamperedXml = xml.replace("https://protocol-test-sp.example/sp", "https://wrong-audience.example/sp");
    const forgedResponse = Buffer.from(tamperedXml, "utf-8").toString("base64");

    const res = await app.inject({
      method: "POST",
      url: `/saml/acs/${spId}`,
      payload: { SAMLResponse: forgedResponse }
    });

    assert.equal(res.statusCode, 422);
    assert.match(JSON.parse(res.body).error, /signature/i);
  });

  it("rejects signed responses when posted to a different service provider ACS", async () => {
    const ssoRes = await app.inject({
      method: "POST",
      url: "/saml/sso",
      headers: { cookie: adminCookie },
      payload: {
        spId,
        relayState: "relay-cross-sp",
        responseMode: "json"
      }
    });

    assert.equal(ssoRes.statusCode, 200);
    const ssoBody = JSON.parse(ssoRes.body) as { samlResponse: string };

    const res = await app.inject({
      method: "POST",
      url: `/saml/acs/${alternateSpId}`,
      payload: { SAMLResponse: ssoBody.samlResponse }
    });

    assert.equal(res.statusCode, 422);
    assert.match(JSON.parse(res.body).error, /(audience|destination)/i);
  });

  it("revokes current session through SLO", async () => {
    const freshLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "northstar-default-admin-password"
      }
    });

    assert.equal(freshLogin.statusCode, 200);
    const freshSetCookie = freshLogin.headers["set-cookie"];
    const freshCookie = Array.isArray(freshSetCookie)
      ? freshSetCookie.map((entry) => entry.split(";")[0]).join("; ")
      : String(freshSetCookie).split(";")[0];

    const sloRes = await app.inject({
      method: "POST",
      url: "/saml/slo",
      headers: { cookie: freshCookie },
      payload: { reason: "integration-test" }
    });

    assert.equal(sloRes.statusCode, 200);
    assert.equal(JSON.parse(sloRes.body).sessionRevoked, true);

    const meRes = await app.inject({
      method: "GET",
      url: "/api/admin/me",
      headers: { cookie: freshCookie }
    });

    assert.equal(meRes.statusCode, 401);
  });
});
