import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext, getCsrf, loginAsAdmin } from "../helpers/test-app.js";

test("SCIM metadata endpoints expose service provider and schema documents", async (t) => {
  const { app, admin } = await createTestContext("integration-scim-metadata");
  t.after(async () => {
    await app.close();
  });

  // Every /scim/v2 path, including discovery, requires a provisioning token.
  const sid = await loginAsAdmin(app, admin);
  const csrf = await getCsrf(app, sid);
  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/admin/provisioning/tokens",
    headers: csrf.headers,
    payload: { label: "metadata-test" }
  });
  assert.equal(tokenResponse.statusCode, 201, tokenResponse.body);
  const scimHeaders = { authorization: `Bearer ${(tokenResponse.json() as { token: string }).token}` };

  const serviceProviderConfigResponse = await app.inject({
    method: "GET",
    url: "/scim/v2/ServiceProviderConfig",
    headers: scimHeaders
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
    url: "/scim/v2/Schemas",
    headers: scimHeaders
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
    url: "/scim/v2/ResourceTypes",
    headers: scimHeaders
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

  // Discovery documents are not public.
  const anonymous = await app.inject({ method: "GET", url: "/scim/v2/ServiceProviderConfig" });
  assert.equal(anonymous.statusCode, 401);
});
