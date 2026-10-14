import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  CreateUserAttributeInput,
  SetUserAttributeGroupAssignmentInput,
  SDKUserAttributeDefinition,
  UpdateUserAttributeInput,
  UserAttributeListQuery,
  UserAttributesAPI
} from "./types.js";

/**
 * Creates the User Attributes admin API module.
 *
 * Supports CRUD and group assignment operations for attribute definitions.
 */
export const createUserAttributesAPI = (client: ClientInstance): UserAttributesAPI => ({
  list: async (query?: UserAttributeListQuery) => {
    const attributes = await client.get<SDKUserAttributeDefinition[]>("/api/admin/user-attributes");
    const bySearch = applyTextFilter(attributes, query?.search, [
      (item) => item.name,
      (item) => item.description,
      (item) => item.key
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateUserAttributeInput) => client.post<SDKUserAttributeDefinition>("/api/admin/user-attributes", { body: input }),
  update: (id: string, input: UpdateUserAttributeInput) => client.put<SDKUserAttributeDefinition>(`/api/admin/user-attributes/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/user-attributes/${id}`);
  },
  setGroupAssignment: async (id: string, input: SetUserAttributeGroupAssignmentInput) => {
    await client.put(`/api/admin/user-attributes/${id}/groups`, { body: input });
  },
  removeGroupAssignment: async (id: string, groupId: string) => {
    await client.delete(`/api/admin/user-attributes/${id}/groups/${groupId}`);
  }
});
