import type { ClientInstance } from "../core/types.js";
import { applyPagination } from "../core/list-helpers.js";
import type { SDKSession, SessionListQuery, SessionsAPI } from "./types.js";

/**
 * Creates the Sessions admin API module.
 *
 * Supports listing and revoking user sessions.
 */
export const createSessionsAPI = (client: ClientInstance): SessionsAPI => ({
  list: async (query?: SessionListQuery) => {
    const sessions = await client.get<SDKSession[]>("/api/admin/sessions");
    return applyPagination(sessions, query);
  },
  revoke: async (id: string) => {
    await client.delete(`/api/admin/sessions/${id}`);
  }
});
