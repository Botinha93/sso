import type { ClientInstance } from "../core/types.js";
import type {
  AccessRequestsAPI,
  AccessRequestDecisionInput,
  AccessRequestListQuery,
  CreateAccessRequestInput,
  ProcessExpiredAccessRequestsInput,
  SDKAccessRequest,
  StalledAccessRequestsResponse,
  ProcessExpiredAccessRequestsResult
} from "./types.js";

/**
 * Creates the Access Requests admin API module.
 *
 * Use this module to create, list, approve, reject, and expire access requests.
 */
export const createAccessRequestsAPI = (client: ClientInstance): AccessRequestsAPI => ({
  list: (query?: AccessRequestListQuery) => client.get<SDKAccessRequest[]>("/api/admin/access-requests", { query }),
  listStalled: (stalledAfterMinutes?: number) => client.get<StalledAccessRequestsResponse>("/api/admin/access-requests/stalled", {
    query: stalledAfterMinutes !== undefined ? { stalledAfterMinutes } : undefined
  }),
  create: (input: CreateAccessRequestInput) => client.post<SDKAccessRequest>("/api/admin/access-requests", { body: input }),
  approve: (id: string, input?: AccessRequestDecisionInput) => client.post<SDKAccessRequest>(`/api/admin/access-requests/${id}/approve`, { body: input ?? {} }),
  reject: (id: string, input?: AccessRequestDecisionInput) => client.post<SDKAccessRequest>(`/api/admin/access-requests/${id}/reject`, { body: input ?? {} }),
  processExpirations: (input?: ProcessExpiredAccessRequestsInput) => client.post<ProcessExpiredAccessRequestsResult>("/api/admin/access-requests/process-expirations", { body: input ?? {} })
});