import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type { CreateOAuthScopeInput, ScopeListQuery, SDKOAuthScope, ScopesAPI } from "./types.js";

/**
 * Creates the OAuth Scopes admin API module.
 *
 * Supports scope creation, deletion, and searchable list retrieval.
 */
export const createScopesAPI = (client: ClientInstance): ScopesAPI => ({
  list: async (query?: ScopeListQuery) => {
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