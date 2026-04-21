import type { FastifyInstance } from "fastify";
import type { ServiceIdentityService } from "../../services/service-identity-service.js";
import {
  createServiceIdentitySchema,
  updateServiceIdentitySchema,
  issueServiceIdentityCredentialSchema
} from "../schemas.js";

export function registerServiceIdentityRoutes(app: FastifyInstance, serviceIdentityService: ServiceIdentityService) {
  app.get("/api/admin/service-identities", async (request, reply) => {
    const identities = await serviceIdentityService.listServiceIdentities();
    return { data: identities };
  });

  app.post("/api/admin/service-identities", async (request, reply) => {
    const parsed = createServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const identity = await serviceIdentityService.createServiceIdentity(parsed.data);
    return reply.status(201).send(identity);
  });

  app.get("/api/admin/service-identities/:id", async (request: any, reply) => {
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (!identity) return reply.status(404).send({ error: "not_found" });
    return identity;
  });

  app.patch("/api/admin/service-identities/:id", async (request: any, reply) => {
    const parsed = updateServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const updated = await serviceIdentityService.updateServiceIdentity(request.params.id, parsed.data);
    if (!updated) return reply.status(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/api/admin/service-identities/:id", async (request: any, reply) => {
    await serviceIdentityService.deleteServiceIdentity(request.params.id);
    return reply.status(204).send();
  });

  app.post("/api/admin/service-identities/:id/credentials", async (request: any, reply) => {
    const parsed = issueServiceIdentityCredentialSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const result = await serviceIdentityService.issueCredential(request.params.id, parsed.data.expiresInDays);
    return reply.status(201).send(result);
  });

  app.post("/api/admin/service-identities/:id/credentials/rotate", async (request: any, reply) => {
    const { credentialId, expiresInDays } = (request.body ?? {}) as { credentialId?: string; expiresInDays?: number };
    if (!credentialId) {
      return reply.status(400).send({ error: "credentialId required" });
    }
    const result = await serviceIdentityService.rotateCredential(request.params.id, credentialId, expiresInDays);
    return reply.status(201).send(result);
  });

  app.delete("/api/admin/service-identities/:id/credentials/:credentialId", async (request: any, reply) => {
    await serviceIdentityService.revokeCredential(request.params.id, request.params.credentialId);
    return reply.status(204).send();
  });

  app.get("/api/admin/service-identities/:id/usage", async (request: any, reply) => {
    const usage = await serviceIdentityService.getUsage(request.params.id);
    return { data: usage };
  });
}
