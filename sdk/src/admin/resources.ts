import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  CreateOAuthScopeInput,
  ResourcesAPI,
  ResourceListQuery,
  SDKOAuthScope
} from "./types.js";

/**
 * Creates a compatibility Resources API backed by admin scopes.
 *
 * Resource names map to OAuth scope records on this platform.
 */
export const createResourcesAPI = (client: ClientInstance): ResourcesAPI => ({
  list: async (query?: ResourceListQuery) => {
    const scopes = await client.get<SDKOAuthScope[]>("/api/admin/scopes");
    const bySearch = applyTextFilter(scopes, query?.search, [
      (item) => item.name,
      (item) => item.description
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateOAuthScopeInput) => client.post<SDKOAuthScope>("/api/admin/scopes", { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/scopes/${id}`);
  }
});
