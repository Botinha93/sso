import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientInstance } from "../../src/core/types.js";
import { createAuthAPI } from "../../src/auth/client.js";
import { createMeAPI } from "../../src/admin/me.js";

describe("Auth UserInfo API", () => {
  let client: ClientInstance;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn();
    client = { get } as unknown as ClientInstance;
  });

  it("fetches userinfo with roles, groups, and flattened permissions", async () => {
    get.mockResolvedValue({
      sub: "user-1",
      email: "alex@example.com",
      roles: ["platform_admin"],
      groups: ["ops"],
      permissions: ["users:view", "roles:view"]
    });

    const auth = createAuthAPI(client);
    const claims = await auth.getUserInfo();

    expect(get).toHaveBeenCalledWith("/oauth/userinfo", { query: undefined });
    expect(claims.roles).toContain("platform_admin");
    expect(claims.groups).toContain("ops");
    expect(claims.permissions).toContain("users:view");
  });

  it("requests signed userinfo as text", async () => {
    get.mockResolvedValue("header.payload.signature");

    const auth = createAuthAPI(client);
    const jwt = await auth.getUserInfoSigned();

    expect(get).toHaveBeenCalledWith("/oauth/userinfo", {
      query: { format: "signed" },
      parseAs: "text"
    });
    expect(jwt).toBe("header.payload.signature");
  });
});

describe("Admin Me API", () => {
  let client: ClientInstance;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn();
    client = { get } as unknown as ClientInstance;
  });

  it("fetches current admin user with authorization claims", async () => {
    get.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      username: "admin",
      givenName: "Admin",
      familyName: "User",
      roles: ["platform_admin"],
      groups: [],
      permissions: ["users:view"]
    });

    const me = createMeAPI(client);
    const profile = await me.get();

    expect(get).toHaveBeenCalledWith("/api/admin/me");
    expect(profile.permissions).toContain("users:view");
  });
});
