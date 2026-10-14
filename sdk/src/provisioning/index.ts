import type { ClientInstance } from "../core/types.js";
import type {
  DeprovisioningQueueListQuery,
  ProvisioningAPI,
  ProvisioningTokensAPI,
  ProvisioningMappingsAPI,
  ReconciliationAPI,
  SDKDeprovisioningQueueItem,
  SDKScimToken,
  SDKCreatedScimToken,
  CreateScimTokenInput,
  SDKProvisioningMapping,
  CreateProvisioningMappingInput,
  SDKProvisioningJob,
  ReconciliationInput
} from "./types.js";

const createTokensAPI = (client: ClientInstance): ProvisioningTokensAPI => ({
  list: () => client.get<SDKScimToken[]>("/api/admin/provisioning/tokens"),

  create: (input: CreateScimTokenInput) =>
    client.post<SDKCreatedScimToken>("/api/admin/provisioning/tokens", { body: input }),

  revoke: (id: string) => client.delete(`/api/admin/provisioning/tokens/${id}`)
});

const createMappingsAPI = (client: ClientInstance): ProvisioningMappingsAPI => ({
  list: () => client.get<SDKProvisioningMapping[]>("/api/admin/provisioning/mappings"),

  create: (input: CreateProvisioningMappingInput) =>
    client.post<SDKProvisioningMapping>("/api/admin/provisioning/mappings", { body: input }),

  delete: (id: string) => client.delete(`/api/admin/provisioning/mappings/${id}`)
});

const createReconciliationAPI = (client: ClientInstance): ReconciliationAPI => ({
  listJobs: (limit = 20) =>
    client.get<SDKProvisioningJob[]>("/api/admin/provisioning/jobs", {
      query: { limit: String(limit) }
    }),

  runReconcile: (input?: ReconciliationInput) =>
    client.post<SDKProvisioningJob>("/api/admin/provisioning/jobs/reconcile", {
      body: input ?? { dryRun: true }
    })
});

/**
 * Creates the Provisioning admin API module.
 *
 * Includes token management, mapping management, and reconciliation operations.
 */
export const createProvisioningAPI = (client: ClientInstance): ProvisioningAPI => ({
  tokens: createTokensAPI(client),
  mappings: createMappingsAPI(client),
  reconciliation: createReconciliationAPI(client),
  deprovisioningQueue: (query?: DeprovisioningQueueListQuery) => {
    const limit = query?.limit ?? 100;
    return client.get<SDKDeprovisioningQueueItem[]>("/api/admin/provisioning/deprovisioning-queue", {
      query: { limit: String(limit) }
    });
  }
});
