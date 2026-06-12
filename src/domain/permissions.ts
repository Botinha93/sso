const PLATFORM_RESOURCES = new Set([
  "users",
  "groups",
  "roles",
  "clients",
  "sessions",
  "audit_log",
  "consents",
  "tenants",
  "apps",
  "federation_providers",
  "authentication_flows",
  "user_attributes",
  "policies",
  "events",
  "scopes",
  "administration",
  "portal"
]);

const PLATFORM_ACTIONS = new Set(["view", "add", "change", "delete", "disable", "read"]);

export type PermissionRoleContext = {
  appId?: string;
  scope: "platform" | "tenant";
};

const segmentCount = (permission: string) => (permission.match(/:/g) ?? []).length + 1;

export const isPlatformPermission = (permission: string) => {
  if (permission === "*:*") {
    return true;
  }

  if (segmentCount(permission) !== 2) {
    return false;
  }

  const [resource, action] = permission.split(":");
  return PLATFORM_RESOURCES.has(resource) && PLATFORM_ACTIONS.has(action);
};

/**
 * Ensures app-scoped permissions keep their app boundary when flattened.
 * Two-part keys on app-bound roles are prefixed with role.appId so permissions
 * from different apps do not collapse during de-duplication.
 * Platform / portal permissions remain in their internal two-part form.
 */
export const canonicalizeRolePermission = (permission: string, role: PermissionRoleContext) => {
  if (permission === "*:*" || segmentCount(permission) >= 3) {
    return permission;
  }

  if (role.scope === "platform" || isPlatformPermission(permission)) {
    return permission;
  }

  if (role.appId) {
    return `${role.appId}:${permission}`;
  }

  return permission;
};

export const flattenRolePermissions = (
  roles: Array<PermissionRoleContext & { permissions: string[] }>
) => {
  const flattened = new Set<string>();

  for (const role of roles) {
    for (const permission of role.permissions) {
      flattened.add(canonicalizeRolePermission(permission, role));
    }
  }

  return Array.from(flattened);
};

export const canonicalizeRolePermissionDetails = <TRole extends PermissionRoleContext & { permissions: string[] }>(
  role: TRole
) => ({
  ...role,
  permissions: role.permissions.map((permission) => canonicalizeRolePermission(permission, role))
});
