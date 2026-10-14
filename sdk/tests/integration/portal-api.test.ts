import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientInstance } from "../../src/core/types.js";
import { createPortalAPI } from "../../src/portal/client.js";

describe("Portal API", () => {
  let client: ClientInstance;
  let get: ReturnType<typeof vi.fn>;
  let patch: ReturnType<typeof vi.fn>;
  let post: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn();
    patch = vi.fn();
    post = vi.fn();
    del = vi.fn();

    client = {
      get,
      patch,
      post,
      delete: del
    } as unknown as ClientInstance;
  });

  it("gets current portal user context with apps, roles, and permissions", async () => {
    get.mockResolvedValue({
      id: "user-1",
      email: "alex@example.com",
      username: "alex",
      givenName: "Alex",
      familyName: "Brown",
      customAttributes: {},
      apps: [],
      roles: ["platform_admin"],
      groups: ["ops"],
      permissions: ["users.read"],
      rolePermissions: [{ id: "role-1", name: "platform_admin", scope: "platform", permissions: ["users.read"] }]
    });

    const portal = createPortalAPI(client);
    const me = await portal.getMe();

    expect(get).toHaveBeenCalledWith("/api/portal/me");
    expect(me.roles).toContain("platform_admin");
    expect(me.permissions).toContain("users.read");
  });

  it("updates profile", async () => {
    patch.mockResolvedValue(undefined);

    const portal = createPortalAPI(client);
    await portal.updateProfile({ givenName: "A" });

    expect(patch).toHaveBeenCalledWith("/api/portal/profile", { body: { givenName: "A" } });
  });

  it("changes password", async () => {
    post.mockResolvedValue(undefined);

    const portal = createPortalAPI(client);
    await portal.changePassword({ currentPassword: "old", newPassword: "new" });

    expect(post).toHaveBeenCalledWith("/api/portal/change-password", {
      body: { currentPassword: "old", newPassword: "new" }
    });
  });

  it("deletes account", async () => {
    del.mockResolvedValue(undefined);

    const portal = createPortalAPI(client);
    await portal.deleteAccount();

    expect(del).toHaveBeenCalledWith("/api/portal/account");
  });

  it("uploads avatar using form data", async () => {
    post.mockResolvedValue({ avatarUrl: "https://cdn.example/avatar.png" });

    const portal = createPortalAPI(client);
    const result = await portal.uploadAvatar(new Blob(["fake"], { type: "image/png" }));

    expect(post).toHaveBeenCalledWith(
      "/api/portal/avatar",
      expect.objectContaining({
        body: expect.any(FormData)
      })
    );
    expect(result.avatarUrl).toContain("avatar.png");
  });
});
