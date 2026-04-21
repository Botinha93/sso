import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

describe("SAML Admin Metadata and Certificate Endpoints", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let spId: string;
  let testDatabasePath = "";
  let previousDatabaseProvider: string | undefined;
  let previousDatabasePath: string | undefined;

  before(async () => {
    previousDatabaseProvider = process.env.DATABASE_PROVIDER;
    previousDatabasePath = process.env.DATABASE_PATH;
    testDatabasePath = join(process.cwd(), "data", `saml-admin-endpoints-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);

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
        entityId: "https://initial-admin-sp.example/sp",
        acsUrl: "https://initial-admin-sp.example/saml/acs",
        signingCertificate: "-----BEGIN CERTIFICATE-----\nINITIAL\n-----END CERTIFICATE-----",
        nameIdFormat: "persistent",
        enabled: true
      }
    });

    assert.equal(createRes.statusCode, 201);
    spId = JSON.parse(createRes.body).id;
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

  it("uploads metadata and applies extracted endpoint values", async () => {
    const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://metadata-imported.example/sp">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>MIICMETADATAUPLOADEDCERT</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://metadata-imported.example/saml/acs" index="0" isDefault="true"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://metadata-imported.example/saml/slo"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/admin/saml/service-providers/${spId}/metadata`,
      headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
      cookies: { csrf_token: "test-token" },
      payload: {
        metadata: metadataXml,
        overwriteManualFields: true
      }
    });

    assert.equal(uploadRes.statusCode, 200);
    const uploadBody = JSON.parse(uploadRes.body) as {
      serviceProvider: { entityId: string; acsUrl: string; sloUrl?: string; signingCertificate?: string; metadata?: string };
      imported: { entityId?: string; acsUrl?: string; sloUrl?: string; hasSigningCertificate: boolean };
    };

    assert.equal(uploadBody.serviceProvider.entityId, "https://metadata-imported.example/sp");
    assert.equal(uploadBody.serviceProvider.acsUrl, "https://metadata-imported.example/saml/acs");
    assert.equal(uploadBody.serviceProvider.sloUrl, "https://metadata-imported.example/saml/slo");
    assert.equal(uploadBody.imported.hasSigningCertificate, true);
    assert.match(String(uploadBody.serviceProvider.signingCertificate), /BEGIN CERTIFICATE/);
    assert.match(String(uploadBody.serviceProvider.metadata), /EntityDescriptor/);
  });

  it("rotates signing and encryption certificates independently", async () => {
    const signingRotateRes = await app.inject({
      method: "POST",
      url: `/api/admin/saml/service-providers/${spId}/certificates/rotate`,
      headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
      cookies: { csrf_token: "test-token" },
      payload: {
        certificateType: "signing",
        certificate: "-----BEGIN CERTIFICATE-----\nNEWSIGNINGCERT\n-----END CERTIFICATE-----"
      }
    });

    assert.equal(signingRotateRes.statusCode, 200);
    const signingBody = JSON.parse(signingRotateRes.body) as { signingCertificate?: string; encryptionCertificate?: string };
    assert.match(String(signingBody.signingCertificate), /NEWSIGNINGCERT/);

    const encryptionRotateRes = await app.inject({
      method: "POST",
      url: `/api/admin/saml/service-providers/${spId}/certificates/rotate`,
      headers: { cookie: adminCookie, "x-csrf-token": "test-token" },
      cookies: { csrf_token: "test-token" },
      payload: {
        certificateType: "encryption",
        certificate: "-----BEGIN CERTIFICATE-----\nNEWENCRYPTIONCERT\n-----END CERTIFICATE-----"
      }
    });

    assert.equal(encryptionRotateRes.statusCode, 200);
    const encryptionBody = JSON.parse(encryptionRotateRes.body) as { signingCertificate?: string; encryptionCertificate?: string };
    assert.match(String(encryptionBody.encryptionCertificate), /NEWENCRYPTIONCERT/);
    assert.match(String(encryptionBody.signingCertificate), /NEWSIGNINGCERT/);
  });
});
