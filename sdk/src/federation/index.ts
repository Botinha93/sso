import type { ClientInstance } from "../core/types.js";
import type {
  SamlAdminAPI,
  SamlServiceProvidersAPI,
  SamlAssertionAuditsAPI,
  SDKSamlServiceProvider,
  SDKSamlServiceProviderDetail,
  CreateServiceProviderInput,
  UpdateServiceProviderInput,
  UploadServiceProviderMetadataInput,
  RotateServiceProviderCertificateInput,
  ListServiceProvidersQuery,
  ListAssertionAuditsQuery,
  PaginatedResponse,
  SDKSamlAssertionAudit,
  UploadMetadataResult
} from "./types.js";

const createServiceProvidersAPI = (client: ClientInstance): SamlServiceProvidersAPI => ({
  list: (query?: ListServiceProvidersQuery) =>
    client.get<PaginatedResponse<SDKSamlServiceProvider>>("/api/admin/saml/service-providers", {
      query: query ? {
        enabled: query.enabled,
        offset: String(query.offset ?? 0),
        limit: String(query.limit ?? 20)
      } : undefined
    }),

  get: (id: string) =>
    client.get<SDKSamlServiceProviderDetail>(`/api/admin/saml/service-providers/${id}`),

  create: (input: CreateServiceProviderInput) =>
    client.post<SDKSamlServiceProvider>("/api/admin/saml/service-providers", { body: input }),

  update: (id: string, input: UpdateServiceProviderInput) =>
    client.patch<SDKSamlServiceProvider>(`/api/admin/saml/service-providers/${id}`, { body: input }),

  uploadMetadata: (id: string, input: UploadServiceProviderMetadataInput) =>
    client.post<UploadMetadataResult>(`/api/admin/saml/service-providers/${id}/metadata`, {
      body: input
    }),

  rotateCertificate: (id: string, input: RotateServiceProviderCertificateInput) =>
    client.post<SDKSamlServiceProvider>(
      `/api/admin/saml/service-providers/${id}/certificates/rotate`,
      { body: input }
    ),

  delete: (id: string) => client.delete(`/api/admin/saml/service-providers/${id}`)
});

const createAssertionAuditsAPI = (client: ClientInstance): SamlAssertionAuditsAPI => ({
  list: (query?: ListAssertionAuditsQuery) =>
    client.get<PaginatedResponse<SDKSamlAssertionAudit>>("/api/admin/saml/assertions", {
      query: query ? {
        spId: query.spId,
        startDate: query.startDate,
        endDate: query.endDate,
        offset: String(query.offset ?? 0),
        limit: String(query.limit ?? 20)
      } : undefined
    })
});

/**
 * Creates the SAML admin API module.
 *
 * Includes service provider administration and assertion audit retrieval.
 */
export const createSamlAdminAPI = (client: ClientInstance): SamlAdminAPI => ({
  serviceProviders: createServiceProvidersAPI(client),
  assertions: createAssertionAuditsAPI(client)
});
