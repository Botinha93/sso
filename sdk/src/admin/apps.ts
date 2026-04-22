import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type { AppListQuery, AppsAPI, CreateAppInput, SDKApp, UpdateAppInput } from "./types.js";

/**
 * Creates the Apps admin API module.
 *
 * Provides app CRUD plus local list filtering/pagination helpers.
 */
export const createAppsAPI = (client: ClientInstance): AppsAPI => ({
  list: async (query?: AppListQuery) => {
    const apps = await client.get<SDKApp[]>("/api/admin/apps");
    const filtered = applyTextFilter(apps, query?.search, [
      (item) => item.name,
      (item) => item.description,
      (item) => item.url
    ]);
    return applyPagination(filtered, query);
  },
  create: (input: CreateAppInput) => client.post<SDKApp>("/api/admin/apps", { body: input }),
  update: (id: string, input: UpdateAppInput) => client.put<SDKApp>(`/api/admin/apps/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/apps/${id}`);
  }
});