import type { ClientInstance } from "../core/types.js";
import type { MeAPI, SDKAdminMe } from "./types.js";

/**
 * Creates the Me admin API module.
 *
 * Returns the currently authenticated admin/portal user's effective profile,
 * including roles, groups, and the flattened set of permissions granted by
 * those roles (including roles inherited via group membership).
 */
export const createMeAPI = (client: ClientInstance): MeAPI => ({
  get: () => client.get<SDKAdminMe>("/api/admin/me"),
  changePassword: async (input) => {
    await client.post("/api/admin/change-password", { body: input });
  }
});
