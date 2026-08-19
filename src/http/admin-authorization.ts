export type AdminAction = "view" | "add" | "change" | "delete" | "disable";

const ADMIN_RESOURCE_MAP: Record<string, string> = {
  users: "users",
  clients: "clients",
  roles: "roles",
  groups: "groups",
  tenants: "tenants",
  devices: "sessions",
  sessions: "sessions",
  audit: "audit_log",
  consents: "consents",
  federation: "federation_providers",
  authentication: "authentication_flows",
  "user-attributes": "user_attributes",
  policies: "policies",
  events: "events",
  scopes: "scopes",
  provisioning: "administration",
  saml: "administration",
  "access-requests": "administration",
  "access-reviews": "administration",
  settings: "administration",
  administration: "administration",
  apps: "apps",
  "role-assignments": "roles",
  "group-role-assignments": "groups",
  "user-groups": "groups",
  "service-identities": "service_identities",
  "connectors": "connectors",
  "metrics": "connectors",
  "plugins": "administration",
  "suggestions": "suggestions"
};

export function toAdminResource(path: string): string | undefined {
  const relative = path.replace(/^\/api\/admin\/?/, "");
  const top = relative.split("/")[0];
  return ADMIN_RESOURCE_MAP[top];
}

export function toAdminAction(method: string): AdminAction | undefined {
  switch (method.toUpperCase()) {
    case "GET":
      return "view";
    case "POST":
      return "add";
    case "PUT":
    case "PATCH":
      return "change";
    case "DELETE":
      return "delete";
    default:
      return undefined;
  }
}

export function hasAdminPermission(input: {
  permissions: string[];
  resource?: string;
  action?: AdminAction;
}): boolean {
  if (input.permissions.includes("*:*")) {
    return true;
  }
  if (input.resource && input.permissions.includes(`${input.resource}:*`)) {
    return true;
  }
  if (input.resource && input.action && input.permissions.includes(`${input.resource}:${input.action}`)) {
    return true;
  }
  return false;
}

let cachedUngatedAdminClientIds: Set<string> | undefined;

export function parseUngatedAdminClientIds(raw = process.env.ADMIN_UNGATED_CLIENT_IDS): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }

  return new Set(
    raw
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function isUngatedAdminClientId(clientId: string): boolean {
  const normalized = clientId.trim();
  if (!normalized) {
    return false;
  }

  if (!cachedUngatedAdminClientIds) {
    cachedUngatedAdminClientIds = parseUngatedAdminClientIds();
  }

  return cachedUngatedAdminClientIds.has(normalized);
}

export function resetUngatedAdminClientIdsCache(): void {
  cachedUngatedAdminClientIds = undefined;
}

export function isBootstrapAdminServiceIdentityMetadata(
  metadata: Record<string, unknown> | undefined
): boolean {
  if (!metadata) {
    return false;
  }

  return metadata.bootstrap_admin === true || metadata.ungated_admin === true;
}