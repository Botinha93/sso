import type { AccessReviewItem } from "../../domain/models.js";

export interface AccessReviewAttestationEvidence {
  evidenceType: "access_review_attestation";
  campaignId: string;
  itemId: string;
  decision: "certified" | "revoked";
  reviewerUserId: string;
  subjectUserId: string;
  entitlementType: "role" | "group";
  entitlementValue: string;
  rationale?: string;
  decidedAt?: string;
}

export const buildAccessReviewAttestationEvidence = (input: {
  item: AccessReviewItem;
  reviewerUserId: string;
}): AccessReviewAttestationEvidence => {
  return {
    evidenceType: "access_review_attestation",
    campaignId: input.item.campaignId,
    itemId: input.item.id,
    decision: input.item.decision!,
    reviewerUserId: input.reviewerUserId,
    subjectUserId: input.item.subjectUserId,
    entitlementType: input.item.entitlementType,
    entitlementValue: input.item.entitlementValue,
    rationale: input.item.decisionRationale,
    decidedAt: input.item.decidedAt?.toISOString(),
  };
};
