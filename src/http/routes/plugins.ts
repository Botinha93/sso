import type { FastifyInstance } from "fastify";
import type { PluginService } from "../../services/plugin-service.js";
import type { PluginRuntimeService } from "../../services/plugin-runtime-service.js";
import { uploadPluginSchema, validatePluginSchema } from "../schemas.js";

export function registerPluginRoutes(
  app: FastifyInstance,
  pluginService: PluginService,
  pluginRuntimeService: PluginRuntimeService
) {
  app.get("/api/admin/plugins", async () => {
    const plugins = await pluginService.listPlugins();
    return { data: plugins };
  });

  app.post("/api/admin/plugins/validate", async (request, reply) => {
    const parsed = validatePluginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }

    const result = await pluginService.validate(parsed.data);
    return result;
  });

  app.post("/api/admin/plugins", async (request, reply) => {
    const parsed = uploadPluginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }

    try {
      const plugin = await pluginService.upload(parsed.data);
      await pluginRuntimeService.reload();
      return reply.status(201).send(plugin);
    } catch (error: any) {
      if (error?.details) {
        return reply.status(400).send({
          error: "validation_error",
          ...error.details
        });
      }
      throw error;
    }
  });

  app.delete("/api/admin/plugins/:id", async (request: any, reply) => {
    const removed = await pluginService.remove(request.params.id);
    if (!removed) {
      return reply.status(404).send({ error: "not_found" });
    }
    await pluginRuntimeService.reload();
    return reply.status(204).send();
  });
}
