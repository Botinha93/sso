import type { ClientInstance } from "../core/types.js";
import type {
  PluginsAPI,
  SDKPlugin,
  UploadPluginInput,
  ValidatePluginInput,
  ValidatePluginResult
} from "./types.js";

/**
 * Creates the Plugins admin API module.
 */
export const createPluginsAPI = (client: ClientInstance): PluginsAPI => ({
  list: async () => {
    const response = await client.get<{ data: SDKPlugin[] }>("/api/admin/plugins");
    return response.data;
  },
  validate: (input: ValidatePluginInput) => client.post<ValidatePluginResult>("/api/admin/plugins/validate", { body: input }),
  upload: (input: UploadPluginInput) => client.post<SDKPlugin>("/api/admin/plugins", { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/plugins/${id}`);
  }
});
