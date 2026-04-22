import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  CreatedUserSummary,
  SDKUser,
  UpdatedUserSummary,
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
    const users = await client.get<SDKUser[]>("/api/admin/users");

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
  create: (input: CreateUserInput) => client.post<CreatedUserSummary>("/api/admin/users", { body: input }),
  update: (id: string, input: UpdateUserInput) => client.patch<UpdatedUserSummary>(`/api/admin/users/${id}`, { body: input }),
  resetPassword: async (id: string, password: string) => {
    await client.post(`/api/admin/users/${id}/reset-password`, { body: { password } });
  },
  delete: async (id: string) => {
    await client.delete(`/api/admin/users/${id}`);
  }
});