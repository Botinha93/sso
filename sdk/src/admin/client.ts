import { createAccessReviewsAPI } from "./access-reviews.js";
import { createAccessRequestsAPI } from "./access-requests.js";
import { createClient } from "../core/client.js";
import type { AuthConfig, ClientOptions } from "../core/types.js";
import { createAppsAPI } from "./apps.js";
import { createAuditAPI } from "./audit.js";
import { createAuthenticationFlowsAPI } from "./authentication-flows.js";
import { createClientsAPI } from "./clients.js";
import { createConsentsAPI } from "./consents.js";
import { createConnectorsAPI } from "./connectors.js";
import { createDevicesAPI } from "./devices.js";
import { createElevationsAPI } from "./elevations.js";
import { createEventHooksAPI } from "./event-hooks.js";
import { createFederationAPI } from "./federation.js";
import { createGroupsAPI } from "./groups.js";
import { createPermissionsAPI } from "./permissions.js";
import { createPoliciesAPI } from "./policies.js";
import { createResourcesAPI } from "./resources.js";
import { createRolesAPI } from "./roles.js";
import { createScopesAPI } from "./scopes.js";
import { createSecurityAPI } from "./security.js";
import { createSessionsAPI } from "./sessions.js";
import { createSettingsAPI } from "./settings.js";
import { createTenantsAPI } from "./tenants.js";
import type { AdminClient } from "./types.js";
import { createUserAttributesAPI } from "./user-attributes.js";
import { createUsersAPI } from "./users.js";
import { createWorkloadAPI } from "../workload/service-identities.js";
import { createProvisioningAPI } from "../provisioning/index.js";
import { createSamlAdminAPI } from "../federation/index.js";

const createAdminClientInternal = (options: ClientOptions): AdminClient => {
  const client = createClient(options);

  return {
    ...client,
    accessReviews: createAccessReviewsAPI(client),
    accessRequests: createAccessRequestsAPI(client),
    apps: createAppsAPI(client),
    audit: createAuditAPI(client),
    authenticationFlows: createAuthenticationFlowsAPI(client),
    clients: createClientsAPI(client),
    consents: createConsentsAPI(client),
    connectors: createConnectorsAPI(client),
    devices: createDevicesAPI(client),
    elevations: createElevationsAPI(client),
    eventHooks: createEventHooksAPI(client),
    federation: createFederationAPI(client),
    groups: createGroupsAPI(client),
    permissions: createPermissionsAPI(client),
    policies: createPoliciesAPI(client),
    provisioning: createProvisioningAPI(client),
    resources: createResourcesAPI(client),
    roles: createRolesAPI(client),
    saml: createSamlAdminAPI(client),
    scopes: createScopesAPI(client),
    security: createSecurityAPI(client),
    sessions: createSessionsAPI(client),
    serviceIdentities: createWorkloadAPI(client),
    settings: createSettingsAPI(client),
    tenants: createTenantsAPI(client),
    userAttributes: createUserAttributesAPI(client),
    users: createUsersAPI(client),
    withAuth: (auth: AuthConfig) => createAdminClientInternal({ ...options, auth })
  };
};

/**
 * Creates an admin-scoped SDK client that exposes typed administrative APIs.
 *
 * Use this client for privileged operations such as user/group/role management,
 * governance workflows, connector operations, and enterprise integrations.
 *
 * @param options Client configuration including base URL and optional auth/retry settings.
 * @returns A fully composed admin client with modules such as `users`, `roles`, `elevations`, `provisioning`, and `saml`.
 */
export const createAdminClient = (options: ClientOptions): AdminClient => createAdminClientInternal(options);