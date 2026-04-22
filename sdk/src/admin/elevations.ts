import type { ClientInstance } from "../core/types.js";
import type {
  ApproveElevationInput,
  CheckElevationAccessInput,
  CheckElevationAccessResult,
  CreateBreakGlassInput,
  CreateElevationInput,
  ElevationListQuery,
  ElevationSessionsQuery,
  ElevationsAPI,
  ProcessElevationExpirationsResult,
  SDKBreakGlassResult,
  SDKElevationRequest,
  SDKElevationSession
} from "./types.js";

/**
 * Creates the Elevations admin API module.
 *
 * Use this module for elevation lifecycle actions, access checks, and break-glass flows.
 */
export const createElevationsAPI = (client: ClientInstance): ElevationsAPI => ({
  list: (query?: ElevationListQuery) => client.get<SDKElevationRequest[]>("/api/admin/elevations", { query }),
  listSessions: (query?: ElevationSessionsQuery) => client.get<SDKElevationSession[]>("/api/admin/elevations/sessions", { query }),
  get: (id: string) => client.get<SDKElevationRequest>(`/api/admin/elevations/${id}`),
  create: (input: CreateElevationInput) => client.post<SDKElevationRequest>("/api/admin/elevations", { body: input }),
  approve: (id: string, input?: ApproveElevationInput) => client.post<SDKElevationRequest>(`/api/admin/elevations/${id}/approve`, { body: input ?? {} }),
  activate: (id: string) => client.post<SDKElevationRequest>(`/api/admin/elevations/${id}/activate`, { body: {} }),
  revoke: (id: string) => client.post<SDKElevationRequest>(`/api/admin/elevations/${id}/revoke`, { body: {} }),
  processExpirations: () => client.post<ProcessElevationExpirationsResult>("/api/admin/elevations/process-expirations", { body: {} }),
  check: (input: CheckElevationAccessInput) => client.post<CheckElevationAccessResult>("/api/admin/elevations/check", { body: input }),
  breakGlass: (input: CreateBreakGlassInput) => client.post<SDKBreakGlassResult>("/api/admin/elevations/break-glass", { body: input })
});