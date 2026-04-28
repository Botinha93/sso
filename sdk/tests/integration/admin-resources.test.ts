import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuditAPI } from "../../src/admin/audit.js";
import { createAuthenticationFlowsAPI } from "../../src/admin/authentication-flows.js";
import { createAppsAPI } from "../../src/admin/apps.js";
import { createClientsAPI } from "../../src/admin/clients.js";
import { createConsentsAPI } from "../../src/admin/consents.js";
import { createDevicesAPI } from "../../src/admin/devices.js";
import { createEventHooksAPI } from "../../src/admin/event-hooks.js";
import { createFederationAPI } from "../../src/admin/federation.js";
import { createGroupsAPI } from "../../src/admin/groups.js";
import { createPoliciesAPI } from "../../src/admin/policies.js";
import { createRolesAPI } from "../../src/admin/roles.js";
import { createScopesAPI } from "../../src/admin/scopes.js";
import { createSecurityAPI } from "../../src/admin/security.js";
import { createSessionsAPI } from "../../src/admin/sessions.js";
import { createSettingsAPI } from "../../src/admin/settings.js";
import { createTenantsAPI } from "../../src/admin/tenants.js";
import { createUserAttributesAPI } from "../../src/admin/user-attributes.js";
import { createUsersAPI } from "../../src/admin/users.js";
import type { ClientInstance } from "../../src/core/types.js";

describe("core admin resource APIs", () => {
  let client: ClientInstance;
  let get: ReturnType<typeof vi.fn>;
  let post: ReturnType<typeof vi.fn>;
  let put: ReturnType<typeof vi.fn>;
  let patch: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn();
    post = vi.fn();
    put = vi.fn();
    patch = vi.fn();
    del = vi.fn();

    client = {
      get,
      post,
      put,
      patch,
      delete: del
    } as unknown as ClientInstance;
  });

  it("apps list and create hit expected endpoints", async () => {
    get.mockResolvedValue([{ id: "a1", name: "App" }]);
    post.mockResolvedValue({ id: "a2", name: "New App" });

    const api = createAppsAPI(client);
    await api.list();
    await api.create({ name: "New App", description: "desc" });

    expect(get).toHaveBeenCalledWith("/api/admin/apps");
    expect(post).toHaveBeenCalledWith("/api/admin/apps", {
      body: { name: "New App", description: "desc" }
    });
  });

  it("users create and patch hit expected endpoints", async () => {
    post.mockResolvedValue({ id: "u1", username: "user", email: "user@example.com" });
    patch.mockResolvedValue({ id: "u1", active: true });

    const api = createUsersAPI(client);
    await api.create({
      username: "user",
      email: "user@example.com",
      password: "ChangeMe123!",
      givenName: "Test",
      familyName: "User"
    });
    await api.update("u1", { active: true });

    expect(post).toHaveBeenCalledWith("/api/admin/users", {
      body: {
        username: "user",
        email: "user@example.com",
        password: "ChangeMe123!",
        givenName: "Test",
        familyName: "User"
      }
    });
    expect(patch).toHaveBeenCalledWith("/api/admin/users/u1", { body: { active: true } });
  });

  it("roles, groups, clients and scopes call expected paths", async () => {
    post.mockResolvedValue({ id: "x1" });
    put.mockResolvedValue({ id: "x1" });

    const roles = createRolesAPI(client);
    const groups = createGroupsAPI(client);
    const clients = createClientsAPI(client);
    const scopes = createScopesAPI(client);

    await roles.create({
      name: "operator",
      description: "desc",
      permissions: ["connectors.read"],
      scope: "platform"
    });
    await groups.assignUser({ groupId: "g1", userId: "u1" });
    await clients.update("c1", { name: "Updated Client" });
    await scopes.create({ name: "tickets.read", description: "read tickets" });

    expect(post).toHaveBeenCalledWith("/api/admin/roles", expect.any(Object));
    expect(post).toHaveBeenCalledWith("/api/admin/user-groups", {
      body: { groupId: "g1", userId: "u1" }
    });
    expect(put).toHaveBeenCalledWith("/api/admin/clients/c1", {
      body: { name: "Updated Client" }
    });
    expect(post).toHaveBeenCalledWith("/api/admin/scopes", {
      body: { name: "tickets.read", description: "read tickets" }
    });
  });

  it("new admin modules target expected endpoints", async () => {
    get.mockResolvedValue([]);
    post.mockResolvedValue({ id: "x1" });
    put.mockResolvedValue({ id: "x1" });

    const tenants = createTenantsAPI(client);
    const sessions = createSessionsAPI(client);
    const consents = createConsentsAPI(client);
    const devices = createDevicesAPI(client);
    const audit = createAuditAPI(client);
    const flows = createAuthenticationFlowsAPI(client);
    const userAttributes = createUserAttributesAPI(client);
    const policies = createPoliciesAPI(client);
    const eventHooks = createEventHooksAPI(client);
    const federation = createFederationAPI(client);
    const settings = createSettingsAPI(client);
    const security = createSecurityAPI(client);

    await tenants.create({ name: "Tenant 1", slug: "tenant-1" });
    await sessions.revoke("sess-1");
    await consents.revoke("cons-1");
    await devices.revokeRequest("dev-code");
    await devices.revokeSession("dev-sess-1");
    await audit.list({ limit: 10 });
    await flows.create({ name: "Default Flow" });
    await userAttributes.setGroupAssignment("attr-1", { groupId: "g1" });
    await policies.evaluate({ action: "read" });
    await eventHooks.test("hook-1", { sample: true });
    await federation.create({ name: "Google", type: "oidc" });
    await settings.update({ security: { mfaRequired: true } });
    await security.riskEvents({ limit: 5 });

    expect(post).toHaveBeenCalledWith("/api/admin/tenants", { body: { name: "Tenant 1", slug: "tenant-1" } });
    expect(del).toHaveBeenCalledWith("/api/admin/sessions/sess-1");
    expect(del).toHaveBeenCalledWith("/api/admin/consents/cons-1");
    expect(del).toHaveBeenCalledWith("/api/admin/devices/requests/dev-code");
    expect(del).toHaveBeenCalledWith("/api/admin/devices/sessions/dev-sess-1");
    expect(get).toHaveBeenCalledWith("/api/admin/audit", { query: { limit: 10 } });
    expect(post).toHaveBeenCalledWith("/api/admin/authentication/flows", { body: { name: "Default Flow" } });
    expect(put).toHaveBeenCalledWith("/api/admin/user-attributes/attr-1/groups", { body: { groupId: "g1" } });
    expect(post).toHaveBeenCalledWith("/api/admin/policies/evaluate", { body: { action: "read" } });
    expect(post).toHaveBeenCalledWith("/api/admin/events/hooks/hook-1/test", { body: { sample: true } });
    expect(post).toHaveBeenCalledWith("/api/admin/federation/providers", { body: { name: "Google", type: "oidc" } });
    expect(put).toHaveBeenCalledWith("/api/admin/settings", { body: { security: { mfaRequired: true } } });
    expect(get).toHaveBeenCalledWith("/api/admin/security/risk-events", { query: { limit: 5 } });
  });
});
