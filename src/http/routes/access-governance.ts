import type { FastifyInstance } from "fastify";
import type { AccessGovernanceService } from "../../services/access-governance-service.js";
import type { AccessReviewService } from "../../services/access-review-service.js";
import type { AuditRepository } from "../../repositories/contracts.js";
import type { EventHookService } from "../../services/event-hook-service.js";
import {
  createAccessRequestSchema,
  createAccessReviewCampaignSchema,
  decideAccessRequestSchema,
  decideAccessReviewItemSchema,
  processExpiredAccessRequestsSchema,
  listAccessRequestsQuerySchema
} from "../schemas.js";
import { buildAccessReviewAttestationEvidence } from "./access-review-attestation.js";

export interface AccessGovernanceRouteDeps {
  accessGovernanceService: AccessGovernanceService;
  accessReviewService: AccessReviewService;
  auditRepository: AuditRepository;
  eventHookService: EventHookService;
  requireSessionUser: (request: any, reply: any) => Promise<{ session: any; user: any } | null>;
}

export const registerAccessGovernanceRoutes = async (app: FastifyInstance, deps: AccessGovernanceRouteDeps) => {
  app.get("/api/admin/access-requests", async (request) => {
    const query = listAccessRequestsQuerySchema.parse(request.query ?? {});
    return deps.accessGovernanceService.listAccessRequests({
      status: query.status,
      limit: query.limit
    });
  });

  app.get("/api/admin/access-requests/stalled", async (request) => {
    const stalledAfterMinutes = Number((request.query as { stalledAfterMinutes?: string } | undefined)?.stalledAfterMinutes ?? "60");
    return deps.accessGovernanceService.listStalledRequests({
      stalledAfterMinutes: Number.isFinite(stalledAfterMinutes) ? stalledAfterMinutes : 60
    });
  });

  app.post("/api/admin/access-requests", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const input = createAccessRequestSchema.parse(request.body);
    const created = await deps.accessGovernanceService.createAccessRequest({
      requesterId: auth.user.id,
      subjectUserId: input.subjectUserId,
      entitlementType: input.entitlementType,
      entitlementValue: input.entitlementValue,
      justification: input.justification,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    });

    return reply.status(201).send(created);
  });

  app.post("/api/admin/access-requests/:id/approve", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const input = decideAccessRequestSchema.parse(request.body ?? {});
    return deps.accessGovernanceService.approveAccessRequest({
      accessRequestId: id,
      approverId: auth.user.id,
      rationale: input.rationale
    });
  });

  app.post("/api/admin/access-requests/:id/reject", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const input = decideAccessRequestSchema.parse(request.body ?? {});
    return deps.accessGovernanceService.rejectAccessRequest({
      accessRequestId: id,
      approverId: auth.user.id,
      rationale: input.rationale
    });
  });

  app.post("/api/admin/access-requests/process-expirations", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const input = processExpiredAccessRequestsSchema.parse(request.body ?? {});
    return deps.accessGovernanceService.processExpiredAccessRequests({
      dryRun: input.dryRun,
      now: input.now ? new Date(input.now) : undefined
    });
  });

  app.post("/api/admin/access-reviews/campaigns", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const input = createAccessReviewCampaignSchema.parse(request.body ?? {});
    const created = await deps.accessReviewService.createCampaign({
      name: input.name,
      description: input.description,
      createdByUserId: auth.user.id,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined
    });

    await deps.auditRepository.log({
      type: "access_review_campaign_created",
      actorId: auth.user.id,
      actorType: "user",
      ip: request.ip,
      metadata: {
        campaignId: created.campaign.id,
        generatedItems: created.generatedItems,
        dueAt: created.campaign.dueAt?.toISOString()
      }
    });

    await deps.eventHookService.emit("access.review.campaign.created", {
      campaignId: created.campaign.id,
      createdByUserId: auth.user.id,
      generatedItems: created.generatedItems,
      dueAt: created.campaign.dueAt?.toISOString()
    });

    return reply.status(201).send(created);
  });

  app.get("/api/admin/access-reviews/campaigns/:id", async (request) => {
    const { id } = request.params as { id: string };
    return deps.accessReviewService.getCampaign(id);
  });

  app.get("/api/admin/access-reviews/campaigns", async (request) => {
    const limit = Number((request.query as { limit?: string } | undefined)?.limit ?? "20");
    return deps.accessReviewService.listCampaigns({ limit: Number.isFinite(limit) ? limit : 20 });
  });

  app.post("/api/admin/access-reviews/items/:id/decision", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const input = decideAccessReviewItemSchema.parse(request.body ?? {});
    const decided = await deps.accessReviewService.decideItem({
      itemId: id,
      decision: input.decision,
      decidedByUserId: auth.user.id,
      rationale: input.rationale
    });

    const attestationEvidence = buildAccessReviewAttestationEvidence({
      item: decided,
      reviewerUserId: auth.user.id
    });

    await deps.auditRepository.log({
      type: "access_review_item_decided",
      actorId: auth.user.id,
      actorType: "user",
      ip: request.ip,
      metadata: {
        ...attestationEvidence,
        evidenceVersion: "1.0"
      }
    });

    await deps.eventHookService.emit("access.review.item.decided", {
      ...attestationEvidence,
      evidenceVersion: "1.0"
    });

    return decided;
  });
};
