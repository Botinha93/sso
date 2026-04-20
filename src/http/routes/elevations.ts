import type { FastifyInstance } from "fastify";
import type { ElevationService } from "../../services/elevation-service.js";
import {
  approveElevationRequestSchema,
  createElevationRequestSchema,
  listElevationRequestsQuerySchema
} from "../schemas.js";

export interface ElevationRouteDeps {
  elevationService: ElevationService;
  requireSessionUser: (request: any, reply: any) => Promise<{ session: any; user: any } | null>;
}

export const registerElevationRoutes = async (app: FastifyInstance, deps: ElevationRouteDeps) => {
  app.get("/api/admin/elevations", async (request) => {
    const query = listElevationRequestsQuerySchema.parse(request.query ?? {});
    return deps.elevationService.listRequests({ status: query.status, limit: query.limit });
  });

  app.get("/api/admin/elevations/:id", async (request) => {
    const { id } = request.params as { id: string };
    return deps.elevationService.getRequest(id);
  });

  app.post("/api/admin/elevations", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const input = createElevationRequestSchema.parse(request.body);
    const created = await deps.elevationService.createRequest({
      requesterId: auth.user.id,
      justification: input.justification,
      resource: input.resource,
      action: input.action,
      durationMinutes: input.durationMinutes
    });

    return reply.status(201).send(created);
  });

  app.post("/api/admin/elevations/:id/approve", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    approveElevationRequestSchema.parse(request.body ?? {});
    return deps.elevationService.approveRequest({
      elevationRequestId: id,
      approverId: auth.user.id
    });
  });

  app.post("/api/admin/elevations/:id/activate", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    return deps.elevationService.activateRequest({
      elevationRequestId: id,
      actorId: auth.user.id
    });
  });

  app.post("/api/admin/elevations/:id/revoke", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    return deps.elevationService.revokeRequest({
      elevationRequestId: id,
      revokedByUserId: auth.user.id
    });
  });

  app.post("/api/admin/elevations/process-expirations", async (_request, reply) => {
    const result = await deps.elevationService.processExpiredRequests();
    return reply.status(200).send(result);
  });
};
