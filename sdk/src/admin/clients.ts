import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  ClientsAPI,
  CreateOAuthClientInput,
  OAuthClientListQuery,
  SDKOAuthClient,
  UpdateOAuthClientInput
} from "./types.js";

/**
 * Creates the OAuth Clients admin API module.
 *
 * Provides client CRUD plus optional app/grant/scope/search filtering for list calls.
 */
export const createClientsAPI = (client: ClientInstance): ClientsAPI => ({
  list: async (query?: OAuthClientListQuery) => {
    const clients = await client.get<SDKOAuthClient[]>("/api/admin/clients");
    const byApp = query?.appId ? clients.filter((item) => item.appId === query.appId) : clients;
    const byGrant = query?.grant ? byApp.filter((item) => item.grants.includes(query.grant!)) : byApp;
    const byScope = query?.scope ? byGrant.filter((item) => item.allowedScopes.includes(query.scope!)) : byGrant;
    const bySearch = applyTextFilter(byScope, query?.search, [
      (item) => item.id,
      (item) => item.name
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateOAuthClientInput) => client.post<SDKOAuthClient>("/api/admin/clients", { body: input }),
  update: (id: string, input: UpdateOAuthClientInput) => client.put<SDKOAuthClient>(`/api/admin/clients/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/clients/${id}`);
  }
});