import type { ClientInstance } from "../core/types.js";
import { applyPagination } from "../core/list-helpers.js";
import type { ConsentListQuery, ConsentsAPI, SDKConsent } from "./types.js";

/**
 * Creates the Consents admin API module.
 *
 * Supports listing and revoking OAuth consents.
 */
export const createConsentsAPI = (client: ClientInstance): ConsentsAPI => ({
  list: async (query?: ConsentListQuery) => {
    const consents = await client.get<SDKConsent[]>("/api/admin/consents");
    return applyPagination(consents, query);
  },
  revoke: async (id: string) => {
    await client.delete(`/api/admin/consents/${id}`);
  }
});
