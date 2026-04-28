import type { ClientInstance } from "../core/types.js";
import type {
  CreateFederationProviderInput,
  FederationAPI,
  FederationProviderListQuery,
  SDKFederationProvider,
  UpdateFederationProviderInput
} from "./types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";

/**
 * Creates the Federation Providers admin API module.
 *
 * Supports CRUD for non-SAML federation providers.
 */
export const createFederationAPI = (client: ClientInstance): FederationAPI => ({
  list: async (query?: FederationProviderListQuery) => {
    const providers = await client.get<SDKFederationProvider[]>("/api/admin/federation/providers");
    const bySearch = applyTextFilter(providers, query?.search, [
      (item) => item.id,
      (item) => item.name,
      (item) => item.type
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateFederationProviderInput) => client.post<SDKFederationProvider>("/api/admin/federation/providers", { body: input }),
  update: (id: string, input: UpdateFederationProviderInput) => client.put<SDKFederationProvider>(`/api/admin/federation/providers/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/federation/providers/${id}`);
  }
});
