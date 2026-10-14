import type { ClientInstance } from "../core/types.js";
import type { AuthMetricsAPI, AuthMetricsListQuery, SDKAuthMetric } from "./types.js";

/**
 * Creates the Metrics admin API module.
 */
export const createMetricsAPI = (client: ClientInstance): AuthMetricsAPI => ({
  auth: async (query?: AuthMetricsListQuery) => {
    const response = await client.get<{ data: SDKAuthMetric[] }>("/api/admin/metrics/auth", { query });
    return response.data;
  }
});
