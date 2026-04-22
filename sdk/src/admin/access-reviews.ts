import type { ClientInstance } from "../core/types.js";
import type {
  AccessReviewDecisionInput,
  AccessReviewListQuery,
  AccessReviewsAPI,
  CreateAccessReviewCampaignInput,
  SDKAccessReviewCampaign,
  SDKAccessReviewCampaignDetails,
  SDKAccessReviewCampaignResult,
  SDKAccessReviewItem
} from "./types.js";

/**
 * Creates the Access Reviews admin API module.
 *
 * Use this module to manage review campaigns and record review decisions.
 */
export const createAccessReviewsAPI = (client: ClientInstance): AccessReviewsAPI => ({
  listCampaigns: (query?: AccessReviewListQuery) => client.get<SDKAccessReviewCampaign[]>("/api/admin/access-reviews/campaigns", { query }),
  getCampaign: (id: string) => client.get<SDKAccessReviewCampaignDetails>(`/api/admin/access-reviews/campaigns/${id}`),
  createCampaign: (input: CreateAccessReviewCampaignInput) => client.post<SDKAccessReviewCampaignResult>("/api/admin/access-reviews/campaigns", { body: input }),
  decideItem: (id: string, input: AccessReviewDecisionInput) => client.post<SDKAccessReviewItem>(`/api/admin/access-reviews/items/${id}/decision`, { body: input })
});
