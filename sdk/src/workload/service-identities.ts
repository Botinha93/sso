import type { ClientInstance } from "../core/types.js";
import type {
  CreateServiceIdentityInput,
  RotateServiceIdentityCredentialInput,
  SDKIssuedServiceIdentityCredential,
  SDKServiceIdentity,
  SDKServiceIdentityUsage,
  ServiceIdentityCredentialIssueInput,
  ServiceIdentityWithCredentials,
  UpdateServiceIdentityInput,
  WorkloadAPI
} from "./types.js";

/**
 * Creates the Workload Identities admin API module.
 *
 * Supports service identity lifecycle, credential issuance/rotation, and usage inspection.
 */
export const createWorkloadAPI = (client: ClientInstance): WorkloadAPI => ({
  listServiceIdentities: async () => {
    const response = await client.get<{ data: SDKServiceIdentity[] }>("/api/admin/service-identities");
    return response.data;
  },
  getServiceIdentity: (id: string) => client.get<ServiceIdentityWithCredentials>(`/api/admin/service-identities/${id}`),
  createServiceIdentity: (input: CreateServiceIdentityInput) => client.post<SDKServiceIdentity>("/api/admin/service-identities", { body: input }),
  updateServiceIdentity: (id: string, input: UpdateServiceIdentityInput) => client.patch<SDKServiceIdentity>(`/api/admin/service-identities/${id}`, { body: input }),
  deleteServiceIdentity: async (id: string) => {
    await client.delete(`/api/admin/service-identities/${id}`);
  },
  issueCredential: (id: string, input?: ServiceIdentityCredentialIssueInput) => client.post<SDKIssuedServiceIdentityCredential>(`/api/admin/service-identities/${id}/credentials`, { body: input ?? {} }),
  rotateCredential: (id: string, input: RotateServiceIdentityCredentialInput) => client.post<SDKIssuedServiceIdentityCredential>(`/api/admin/service-identities/${id}/credentials/rotate`, { body: input }),
  revokeCredential: async (id: string, credentialId: string) => {
    await client.delete(`/api/admin/service-identities/${id}/credentials/${credentialId}`);
  },
  getUsage: async (id: string) => {
    const response = await client.get<{ data: SDKServiceIdentityUsage[] }>(`/api/admin/service-identities/${id}/usage`);
    return response.data;
  }
});
