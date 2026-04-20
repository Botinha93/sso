import type { FastifyInstance } from "fastify";
import type { ProvisioningService } from "../../services/provisioning-service.js";
import type { DeprovisioningService } from "../../services/deprovisioning-service.js";
import type { ScimTokenService } from "../../services/scim-token-service.js";
import {
  createProvisioningMappingSchema,
  createScimTokenSchema,
  reconcileProvisioningJobSchema
} from "../schemas.js";

export interface ProvisioningRouteDeps {
  scimTokenService: ScimTokenService;
  provisioningService: ProvisioningService;
  deprovisioningService: DeprovisioningService;
  requireSessionUser: (request: any, reply: any) => Promise<{ session: any; user: any } | null>;
}

export const registerProvisioningRoutes = async (app: FastifyInstance, deps: ProvisioningRouteDeps) => {
  app.get("/api/admin/provisioning/tokens", async () => deps.scimTokenService.listTokens());

  app.post("/api/admin/provisioning/tokens", async (request, reply) => {
    const input = createScimTokenSchema.parse(request.body);
    const created = await deps.scimTokenService.createToken({
      label: input.label,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined
    });
    return reply.status(201).send(created);
  });

  app.delete("/api/admin/provisioning/tokens/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.scimTokenService.revokeToken(id);
    return reply.status(204).send();
  });

  app.get("/api/admin/provisioning/mappings", async () => deps.provisioningService.listMappings());

  app.post("/api/admin/provisioning/mappings", async (request, reply) => {
    const input = createProvisioningMappingSchema.parse(request.body);
    const created = await deps.provisioningService.createMapping(input);
    return reply.status(201).send(created);
  });

  app.delete("/api/admin/provisioning/mappings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.provisioningService.deleteMapping(id);
    return reply.status(204).send();
  });

  app.get("/api/admin/provisioning/jobs", async (request) => {
    const limit = Number((request.query as { limit?: string } | undefined)?.limit ?? "20");
    return deps.provisioningService.listJobs(Number.isFinite(limit) ? limit : 20);
  });

  app.get("/api/admin/provisioning/deprovisioning-queue", async (request) => {
    const limit = Number((request.query as { limit?: string } | undefined)?.limit ?? "100");
    return deps.deprovisioningService.listQueue(Number.isFinite(limit) ? limit : 100);
  });

  app.post("/api/admin/provisioning/jobs/reconcile", async (request, reply) => {
    const input = reconcileProvisioningJobSchema.parse(request.body ?? {});
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const job = await deps.provisioningService.runReconcile({
      initiatedByUserId: auth.user.id,
      dryRun: input.dryRun
    });
    return reply.status(202).send(job);
  });
};
