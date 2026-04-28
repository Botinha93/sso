import type { ClientInstance } from "../core/types.js";
import type { AuditAPI, AuditListQuery, SDKAuditEvent } from "./types.js";

/**
 * Creates the Audit admin API module.
 *
 * Supports listing audit events.
 */
export const createAuditAPI = (client: ClientInstance): AuditAPI => ({
  list: (query?: AuditListQuery) => client.get<SDKAuditEvent[]>("/api/admin/audit", { query })
});
