import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  AuthenticationFlowListQuery,
  AuthenticationFlowsAPI,
  CreateAuthenticationFlowInput,
  SDKAuthenticationFlow,
  UpdateAuthenticationFlowInput
} from "./types.js";

/**
 * Creates the Authentication Flows admin API module.
 *
 * Supports CRUD operations for configured login/authentication flows.
 */
export const createAuthenticationFlowsAPI = (client: ClientInstance): AuthenticationFlowsAPI => ({
  list: async (query?: AuthenticationFlowListQuery) => {
    const flows = await client.get<SDKAuthenticationFlow[]>("/api/admin/authentication/flows");
    const bySearch = applyTextFilter(flows, query?.search, [
      (item) => item.id,
      (item) => item.name
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateAuthenticationFlowInput) => client.post<SDKAuthenticationFlow>("/api/admin/authentication/flows", { body: input }),
  update: (id: string, input: UpdateAuthenticationFlowInput) => client.put<SDKAuthenticationFlow>(`/api/admin/authentication/flows/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/authentication/flows/${id}`);
  }
});
