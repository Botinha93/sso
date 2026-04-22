import { createAccessReviewsAPI } from "./access-reviews.js";
import { createAccessRequestsAPI } from "./access-requests.js";
import { createClient } from "../core/client.js";
import type { AuthConfig, ClientOptions } from "../core/types.js";
import { createAppsAPI } from "./apps.js";
import { createClientsAPI } from "./clients.js";
import { createConnectorsAPI } from "./connectors.js";
import { createElevationsAPI } from "./elevations.js";
import { createGroupsAPI } from "./groups.js";
import { createRolesAPI } from "./roles.js";
import { createScopesAPI } from "./scopes.js";
import type { AdminClient } from "./types.js";
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
    clients: createClientsAPI(client),
    connectors: createConnectorsAPI(client),
    elevations: createElevationsAPI(client),
    groups: createGroupsAPI(client),
    provisioning: createProvisioningAPI(client),
    roles: createRolesAPI(client),
    saml: createSamlAdminAPI(client),
    scopes: createScopesAPI(client),
    serviceIdentities: createWorkloadAPI(client),
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