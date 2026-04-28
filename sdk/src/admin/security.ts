import type { ClientInstance } from "../core/types.js";
import type { RiskEventListQuery, SDKRiskEvent, SecurityAPI } from "./types.js";

/**
 * Creates the Security admin API module.
 *
 * Supports querying security risk events.
 */
export const createSecurityAPI = (client: ClientInstance): SecurityAPI => ({
  riskEvents: (query?: RiskEventListQuery) => client.get<SDKRiskEvent[]>("/api/admin/security/risk-events", { query })
});
