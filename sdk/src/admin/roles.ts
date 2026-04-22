import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type { AssignRoleInput, CreateRoleInput, RoleListQuery, RolesAPI, SDKRole, UpdateRoleInput } from "./types.js";

/**
 * Creates the Roles admin API module.
 *
 * Supports role CRUD, list filtering, and user role assignments.
 */
export const createRolesAPI = (client: ClientInstance): RolesAPI => ({
  list: async (query?: RoleListQuery) => {
    const roles = await client.get<SDKRole[]>("/api/admin/roles");
    const byApp = query?.appId ? roles.filter((item) => item.appId === query.appId) : roles;
    const byScope = query?.scope ? byApp.filter((item) => item.scope === query.scope) : byApp;
    const bySearch = applyTextFilter(byScope, query?.search, [
      (item) => item.name,
      (item) => item.description
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateRoleInput) => client.post<SDKRole>("/api/admin/roles", { body: input }),
  update: (id: string, input: UpdateRoleInput) => client.put<SDKRole>(`/api/admin/roles/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/roles/${id}`);
  },
  assignToUser: (input: AssignRoleInput) => client.post<unknown>("/api/admin/role-assignments", { body: input })
});