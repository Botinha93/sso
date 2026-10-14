import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type { CreateTenantInput, SDKTenant, TenantListQuery, TenantsAPI, UpdateTenantInput } from "./types.js";

/**
 * Creates the Tenants admin API module.
 *
 * Supports tenant list/create/update operations.
 */
export const createTenantsAPI = (client: ClientInstance): TenantsAPI => ({
  list: async (query?: TenantListQuery) => {
    const tenants = await client.get<SDKTenant[]>("/api/admin/tenants");
    const bySearch = applyTextFilter(tenants, query?.search, [
      (item) => item.name,
      (item) => item.slug
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateTenantInput) => client.post<SDKTenant>("/api/admin/tenants", { body: input }),
  update: (id: string, input: UpdateTenantInput) => client.put<SDKTenant>(`/api/admin/tenants/${id}`, { body: input })
});
