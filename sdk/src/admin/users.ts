import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  SDKUser,
  UploadUserAvatarResult,
  UserGroupsResult,
  UserPermissionsResult,
  UserRolesResult,
  UsersAPI,
  CreateUserInput,
  UpdateUserInput,
  UserListQuery
} from "./types.js";

/**
 * Creates the Users admin API module.
 *
 * Supports user CRUD, password reset, and filtered/paginated listing.
 */
export const createUsersAPI = (client: ClientInstance): UsersAPI => ({
  list: async (query?: UserListQuery) => {
    const queryParams: Record<string, string | number | boolean> = {};
    if (query?.appId) queryParams.appId = query.appId;
    if (query?.active !== undefined) queryParams.active = query.active;
    if (query?.includeServiceUsers !== undefined) queryParams.includeServiceUsers = query.includeServiceUsers;
    if (query?.search) queryParams.search = query.search;
    if (query?.group) queryParams.group = query.group;
    if (query?.page) queryParams.page = query.page;
    if (query?.pageSize) queryParams.pageSize = query.pageSize;
    if (query?.customAttributes) {
      for (const [key, value] of Object.entries(query.customAttributes)) {
        queryParams[`customAttribute.${key}`] = value;
      }
    }

    const users = await client.get<SDKUser[]>("/api/admin/users", {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined
    });

    const byApp = query?.appId ? users.filter((item) => item.appId === query.appId) : users;
    const byActive = query?.active === undefined ? byApp : byApp.filter((item) => item.active === query.active);
    const bySearch = applyTextFilter(byActive, query?.search, [
      (item) => item.username,
      (item) => item.email,
      (item) => item.givenName,
      (item) => item.familyName
    ]);

    return applyPagination(bySearch, query);
  },
  get: (id: string) => client.get<SDKUser>(`/api/admin/users/${id}`),
  create: (input: CreateUserInput) => client.post<SDKUser>("/api/admin/users", { body: input }),
  update: (id: string, input: UpdateUserInput) => client.patch<SDKUser>(`/api/admin/users/${id}`, { body: input }),
  resetPassword: async (id: string, password: string) => {
    await client.post(`/api/admin/users/${id}/reset-password`, { body: { password } });
  },
  delete: async (id: string) => {
    await client.delete(`/api/admin/users/${id}`);
  },
  getGroups: (id: string) => client.get<UserGroupsResult>(`/api/admin/users/${id}/groups`),
  getRoles: (id: string) => client.get<UserRolesResult>(`/api/admin/users/${id}/roles`),
  getPermissions: (id: string) => client.get<UserPermissionsResult>(`/api/admin/users/${id}/permissions`),
  uploadAvatar: async (id: string, file: Blob | File) => {
    const form = new FormData();
    form.set("file", file);
    return client.post<UploadUserAvatarResult>(`/api/admin/users/${id}/avatar`, { body: form });
  }
});
