import type { ClientInstance } from "../core/types.js";
import type { SDKAdminSettings, SettingsAPI, UpdateAdminSettingsInput } from "./types.js";

/**
 * Creates the Settings admin API module.
 *
 * Supports reading and updating admin configuration settings.
 */
export const createSettingsAPI = (client: ClientInstance): SettingsAPI => ({
  get: () => client.get<SDKAdminSettings>("/api/admin/settings"),
  update: (input: UpdateAdminSettingsInput) => client.put<SDKAdminSettings>("/api/admin/settings", { body: input })
});
