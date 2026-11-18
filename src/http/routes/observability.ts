import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ObservabilityService } from "../../services/observability-service.js";

const statusQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  after: z.coerce.number().int().min(0).optional()
});

/**
 * `GET /api/admin/observability/status?since=<ISO>&after=<cursor>`
 *
 * Read-only status for an external monitor: a database round trip, the
 * requests answered per minute since `since` (count, failures, duration), and
 * the server errors and warnings recorded after the cursor `after`. Guarded
 * like every `/api/admin/*` route (resource `administration`), so the
 * setup-admin worker reads it with its own token.
 */
export const registerObservabilityRoutes = (
  app: FastifyInstance,
  observabilityService: ObservabilityService,
  readDatabase: () => Promise<unknown>
) => {
  app.get("/api/admin/observability/status", async (request) => {
    const query = statusQuerySchema.parse(request.query ?? {});

    const started = process.hrtime.bigint();
    const database = { ok: true, ms: 0, error: "" };
    try {
      await readDatabase();
    } catch (error) {
      database.ok = false;
      database.error = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 255);
      request.log.error({ err: error }, "observability status: database check failed");
    }
    database.ms = Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100;

    return {
      system: "nexusid",
      now: new Date().toISOString(),
      checks: { database },
      ...(database.ok
        ? await observabilityService.snapshot({
            since: query.since ? new Date(query.since) : undefined,
            after: query.after
          })
        : { requests: [], errors: [], cursor: query.after ?? 0 })
    };
  });
};
