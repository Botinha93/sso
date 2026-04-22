import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppsAPI } from "../../src/admin/apps.js";
import { createClientsAPI } from "../../src/admin/clients.js";
import { createUsersAPI } from "../../src/admin/users.js";
import type { ClientInstance } from "../../src/core/types.js";

describe("list filtering and pagination helpers", () => {
  let client: ClientInstance;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn();
    client = { get } as unknown as ClientInstance;
  });

  it("filters and paginates apps by search", async () => {
    get.mockResolvedValue([
      { id: "a1", name: "Support", description: "Support app", createdAt: "x" },
      { id: "a2", name: "Billing", description: "Billing app", createdAt: "x" },
      { id: "a3", name: "Support Ops", description: "Ops app", createdAt: "x" }
    ]);

    const api = createAppsAPI(client);
    const result = await api.list({ search: "support", page: 1, pageSize: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("filters users by app and active status", async () => {
    get.mockResolvedValue([
      { id: "u1", appId: "app-1", active: true, username: "alice", email: "a@x", givenName: "A", familyName: "A", customAttributes: {}, createdAt: "x", updatedAt: "x", isServiceUser: false },
      { id: "u2", appId: "app-2", active: true, username: "bob", email: "b@x", givenName: "B", familyName: "B", customAttributes: {}, createdAt: "x", updatedAt: "x", isServiceUser: false },
      { id: "u3", appId: "app-1", active: false, username: "carol", email: "c@x", givenName: "C", familyName: "C", customAttributes: {}, createdAt: "x", updatedAt: "x", isServiceUser: false }
    ]);

    const api = createUsersAPI(client);
    const result = await api.list({ appId: "app-1", active: true });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });

  it("filters clients by grant and scope", async () => {
    get.mockResolvedValue([
      { id: "c1", name: "Console", appId: "app-1", grants: ["authorization_code"], allowedScopes: ["tickets.read"], redirectUris: [], requirePkce: true, resources: [], flowIds: [], createdAt: "x" },
      { id: "c2", name: "Worker", appId: "app-1", grants: ["client_credentials"], allowedScopes: ["tickets.write"], redirectUris: [], requirePkce: false, resources: [], flowIds: [], createdAt: "x" }
    ]);

    const api = createClientsAPI(client);
    const result = await api.list({ appId: "app-1", grant: "client_credentials", scope: "tickets.write" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c2");
  });
});
