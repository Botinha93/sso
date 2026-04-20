import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("SCIM metadata endpoints expose service provider and schema documents", async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "sso-scim-metadata-"));
  process.env.NODE_ENV = "test";
  process.env.ISSUER = "http://localhost:4000";
  process.env.DATABASE_PATH = join(tempDir, "sso.sqlite");

  const { buildApp } = await import("../../src/app.js");
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const serviceProviderConfigResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig"
  });
  assert.equal(serviceProviderConfigResponse.statusCode, 200);
  const serviceProviderConfig = serviceProviderConfigResponse.json() as {
    schemas: string[];
    patch: { supported: boolean };
    authenticationSchemes: Array<{ type: string; primary?: boolean }>;
  };
  assert.ok(serviceProviderConfig.schemas.includes("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"));
  assert.equal(serviceProviderConfig.patch.supported, true);
  assert.ok(serviceProviderConfig.authenticationSchemes.some((scheme) => scheme.type === "oauthbearertoken"));

  const schemasResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/Schemas"
  });
  assert.equal(schemasResponse.statusCode, 200);
  const schemasBody = schemasResponse.json() as {
    schemas: string[];
    totalResults: number;
    Resources: Array<{ id: string; name: string }>;
  };
  assert.ok(schemasBody.schemas.includes("urn:ietf:params:scim:api:messages:2.0:ListResponse"));
  assert.equal(schemasBody.totalResults, 2);
  assert.ok(schemasBody.Resources.some((resource) => resource.id === "urn:ietf:params:scim:schemas:core:2.0:User"));
  assert.ok(schemasBody.Resources.some((resource) => resource.id === "urn:ietf:params:scim:schemas:core:2.0:Group"));

  const resourceTypesResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ResourceTypes"
  });
  assert.equal(resourceTypesResponse.statusCode, 200);
  const resourceTypesBody = resourceTypesResponse.json() as {
    schemas: string[];
    totalResults: number;
    Resources: Array<{ id: string; endpoint: string; schema: string }>;
  };
  assert.ok(resourceTypesBody.schemas.includes("urn:ietf:params:scim:api:messages:2.0:ListResponse"));
  assert.equal(resourceTypesBody.totalResults, 2);
  assert.ok(resourceTypesBody.Resources.some((resource) => resource.id === "User" && resource.endpoint === "/Users"));
  assert.ok(resourceTypesBody.Resources.some((resource) => resource.id === "Group" && resource.endpoint === "/Groups"));
});
