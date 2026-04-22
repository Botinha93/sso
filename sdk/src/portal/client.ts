import type { ClientInstance } from "../core/types.js";
import type {
  ChangePortalPasswordInput,
  PortalAPI,
  SDKPortalMe,
  UpdatePortalProfileInput,
  UploadPortalAvatarResult
} from "./types.js";

/**
 * Creates the portal self-service API module for the currently logged-in user.
 *
 * Use this for user-facing account operations such as profile updates,
 * password changes, account deletion, and avatar upload.
 */
export const createPortalAPI = (client: ClientInstance): PortalAPI => ({
  getMe: () => client.get<SDKPortalMe>("/api/portal/me"),
  updateProfile: async (input: UpdatePortalProfileInput) => {
    await client.patch("/api/portal/profile", { body: input });
  },
  changePassword: async (input: ChangePortalPasswordInput) => {
    await client.post("/api/portal/change-password", { body: input });
  },
  deleteAccount: async () => {
    await client.delete("/api/portal/account");
  },
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.set("file", file);
    return client.post<UploadPortalAvatarResult>("/api/portal/avatar", { body: form });
  }
});
