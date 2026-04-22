import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppsAPI } from "../../src/admin/apps.js";
import { createClientsAPI } from "../../src/admin/clients.js";
import { createGroupsAPI } from "../../src/admin/groups.js";
import { createRolesAPI } from "../../src/admin/roles.js";
import { createScopesAPI } from "../../src/admin/scopes.js";
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
});
