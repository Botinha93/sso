import type { ClientInstance } from "../core/types.js";
import type {
  ConnectorsAPI,
  ConnectorRunListQuery,
  CreateConnectorInput,
  CreateConnectorMappingInput,
  SDKConnector,
  SDKConnectorMapping,
  SDKConnectorRun,
  UpdateConnectorInput
} from "./types.js";

/**
 * Creates the Connectors admin API module.
 *
 * Supports connector CRUD, run execution/history, and mapping management.
 */
export const createConnectorsAPI = (client: ClientInstance): ConnectorsAPI => ({
  list: async () => {
    const response = await client.get<{ data: SDKConnector[] }>("/api/admin/connectors");
    return response.data;
  },
  get: (id: string) => client.get<SDKConnector>(`/api/admin/connectors/${id}`),
  create: (input: CreateConnectorInput) => client.post<SDKConnector>("/api/admin/connectors", { body: input }),
  update: (id: string, input: UpdateConnectorInput) =>
    client.patch<SDKConnector>(`/api/admin/connectors/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/connectors/${id}`);
  },
  triggerSync: (id: string) => client.post<SDKConnectorRun>(`/api/admin/connectors/${id}/sync`, { body: {} }),
  listRuns: async (id: string, query?: ConnectorRunListQuery) => {
    const response = await client.get<{ data: SDKConnectorRun[] }>(`/api/admin/connectors/${id}/runs`, {
      query: query ? { limit: query.limit } : undefined
    });
    return response.data;
  },
  listMappings: async (id: string) => {
    const response = await client.get<{ data: SDKConnectorMapping[] }>(`/api/admin/connectors/${id}/mappings`);
    return response.data;
  },
  createMapping: (id: string, input: CreateConnectorMappingInput) =>
    client.post<SDKConnectorMapping>(`/api/admin/connectors/${id}/mappings`, { body: input }),
  deleteMapping: async (connectorId: string, mappingId: string) => {
    await client.delete(`/api/admin/connectors/${connectorId}/mappings/${mappingId}`);
  }
});