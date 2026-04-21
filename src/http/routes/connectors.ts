import type { FastifyInstance } from "fastify";
import type { ConnectorService, AuthMetricsService } from "../../services/connector-service.js";
import {
  createConnectorSchema,
  updateConnectorSchema,
  createConnectorMappingSchema
} from "../schemas.js";

export function registerConnectorRoutes(
  app: FastifyInstance,
  connectorService: ConnectorService,
  authMetricsService: AuthMetricsService
) {
  // ── Connectors ────────────────────────────────────────────────────────────

  app.get("/api/admin/connectors", async (_request, _reply) => {
    const connectors = await connectorService.listConnectors();
    return { data: connectors };
  });

  app.post("/api/admin/connectors", async (request, reply) => {
    const parsed = createConnectorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const connector = await connectorService.createConnector(parsed.data);
    return reply.status(201).send(connector);
  });

  app.get("/api/admin/connectors/:id", async (request: any, reply) => {
    const connector = await connectorService.getConnector(request.params.id);
    if (!connector) return reply.status(404).send({ error: "not_found" });
    return connector;
  });

  app.patch("/api/admin/connectors/:id", async (request: any, reply) => {
    const parsed = updateConnectorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const updated = await connectorService.updateConnector(request.params.id, parsed.data);
    if (!updated) return reply.status(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/api/admin/connectors/:id", async (request: any, reply) => {
    await connectorService.deleteConnector(request.params.id);
    return reply.status(204).send();
  });

  // ── Sync ──────────────────────────────────────────────────────────────────

  app.post("/api/admin/connectors/:id/sync", async (request: any, reply) => {
    try {
      const run = await connectorService.triggerSync(request.params.id);
      return reply.status(202).send(run);
    } catch (err: any) {
      if (err.message === "Connector not found") return reply.status(404).send({ error: "not_found" });
      if (err.message === "Connector is not active") return reply.status(400).send({ error: "connector_inactive" });
      throw err;
    }
  });

  // ── Runs ──────────────────────────────────────────────────────────────────

  app.get("/api/admin/connectors/:id/runs", async (request: any, reply) => {
    const connector = await connectorService.getConnector(request.params.id);
    if (!connector) return reply.status(404).send({ error: "not_found" });
    const limit = request.query?.limit ? Number(request.query.limit) : 50;
    const runs = await connectorService.listRuns(request.params.id, limit);
    return { data: runs };
  });

  // ── Mappings ──────────────────────────────────────────────────────────────

  app.get("/api/admin/connectors/:id/mappings", async (request: any, reply) => {
    const connector = await connectorService.getConnector(request.params.id);
    if (!connector) return reply.status(404).send({ error: "not_found" });
    const mappings = await connectorService.listMappings(request.params.id);
    return { data: mappings };
  });

  app.post("/api/admin/connectors/:id/mappings", async (request: any, reply) => {
    const connector = await connectorService.getConnector(request.params.id);
    if (!connector) return reply.status(404).send({ error: "not_found" });
    const parsed = createConnectorMappingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const mapping = await connectorService.createMapping(request.params.id, parsed.data);
    return reply.status(201).send(mapping);
  });

  app.delete("/api/admin/connectors/:connectorId/mappings/:mappingId", async (request: any, reply) => {
    await connectorService.deleteMapping(request.params.mappingId);
    return reply.status(204).send();
  });

  // ── Auth Metrics ──────────────────────────────────────────────────────────

  app.get("/api/admin/metrics/auth", async (request: any, reply) => {
    const { startHour, endHour, event } = request.query ?? {};
    const metrics = await authMetricsService.query({ startHour, endHour, event });
    return { data: metrics };
  });
}
