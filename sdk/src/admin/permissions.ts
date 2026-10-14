import type { ClientInstance } from "../core/types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";
import type {
  PermissionListQuery,
  PermissionsAPI,
  SDKPermission,
  SDKRole
} from "./types.js";

/**
 * Creates a compatibility Permissions API derived from role definitions.
 *
 * The platform stores permission strings inside roles rather than a standalone
 * permissions resource endpoint.
 */
export const createPermissionsAPI = (client: ClientInstance): PermissionsAPI => ({
  list: async (query?: PermissionListQuery) => {
    const roles = await client.get<SDKRole[]>("/api/admin/roles");
    const roleNamesByPermission = new Map<string, Set<string>>();

    for (const role of roles) {
      for (const permission of role.permissions) {
        const roleNames = roleNamesByPermission.get(permission) ?? new Set<string>();
        roleNames.add(role.name);
        roleNamesByPermission.set(permission, roleNames);
      }
    }

    const permissions: SDKPermission[] = Array.from(roleNamesByPermission.entries())
      .map(([value, roleNames]) => ({ value, roleNames: Array.from(roleNames).sort() }))
      .sort((left, right) => left.value.localeCompare(right.value));

    const bySearch = applyTextFilter(permissions, query?.search, [
      (item) => item.value,
      (item) => item.roleNames.join(" ")
    ]);

    return applyPagination(bySearch, query);
  }
});
