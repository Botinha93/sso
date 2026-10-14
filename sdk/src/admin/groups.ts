import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  AssignGroupRoleInput,
  AssignUserGroupInput,
  CreateGroupInput,
  GroupListQuery,
  GroupUsersQuery,
  GroupUsersResult,
  GroupsAPI,
  SDKGroup,
  UpdateGroupInput
} from "./types.js";

/**
 * Creates the Groups admin API module.
 *
 * Supports group CRUD, role assignment, and user membership operations.
 */
export const createGroupsAPI = (client: ClientInstance): GroupsAPI => ({
  list: async (query?: GroupListQuery) => {
    const groups = await client.get<SDKGroup[]>("/api/admin/groups");
    const byApp = query?.appId ? groups.filter((item) => item.appId === query.appId) : groups;
    const bySearch = applyTextFilter(byApp, query?.search, [
      (item) => item.name,
      (item) => item.description,
      (item) => item.externalSource,
      (item) => item.externalId
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateGroupInput) => client.post<SDKGroup>("/api/admin/groups", { body: input }),
  update: (id: string, input: UpdateGroupInput) => client.put<SDKGroup>(`/api/admin/groups/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/groups/${id}`);
  },
  assignRole: (input: AssignGroupRoleInput) => client.post<unknown>("/api/admin/group-role-assignments", { body: input }),
  removeRole: async (input: AssignGroupRoleInput) => {
    await client.delete("/api/admin/group-role-assignments", { body: input });
  },
  assignUser: (input: AssignUserGroupInput) => client.post<unknown>("/api/admin/user-groups", { body: input }),
  removeUser: async (input: AssignUserGroupInput) => {
    await client.delete("/api/admin/user-groups", { body: input });
  },
  listUsers: (id: string, query?: GroupUsersQuery) => {
    const queryParams: Record<string, string | number | boolean> = {};
    if (query?.active !== undefined) queryParams.active = query.active;
    if (query?.includeServiceUsers !== undefined) queryParams.includeServiceUsers = query.includeServiceUsers;
    if (query?.search) queryParams.search = query.search;
    if (query?.page) queryParams.page = query.page;
    if (query?.pageSize) queryParams.pageSize = query.pageSize;
    if (query?.customAttributes) {
      for (const [key, value] of Object.entries(query.customAttributes)) {
        queryParams[`customAttribute.${key}`] = value;
      }
    }
    return client.get<GroupUsersResult>(`/api/admin/groups/${id}/users`, {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined
    });
  }
});