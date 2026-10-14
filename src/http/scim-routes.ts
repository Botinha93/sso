import type { FastifyInstance } from "fastify";
import type { AuditRepository } from "../repositories/contracts.js";
import type { DeprovisioningService } from "../services/deprovisioning-service.js";
import type { EventHookService } from "../services/event-hook-service.js";
import type { ScimService } from "../services/scim-service.js";
import type { ScimTokenService } from "../services/scim-token-service.js";
import {
  scimCreateGroupSchema,
  scimCreateUserSchema,
  scimListQuerySchema,
  scimPatchSchema,
  scimReplaceGroupSchema,
  scimReplaceUserSchema
} from "./scim-schemas.js";

interface ScimRouteDeps {
  scimService: ScimService;
  scimTokenService: ScimTokenService;
  auditRepository: AuditRepository;
  eventHookService: EventHookService;
  deprovisioningService: DeprovisioningService;
}

export const registerScimRoutes = async (app: FastifyInstance, deps: ScimRouteDeps) => {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/scim/v2")) {
      return;
    }

    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return reply.status(401).send({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "401",
        detail: "Missing SCIM bearer token"
      });
    }

    const token = authorization.slice("Bearer ".length).trim();
    const valid = await deps.scimTokenService.authenticateBearerToken(token);
    if (!valid) {
      return reply.status(401).send({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "401",
        detail: "Invalid SCIM bearer token"
      });
    }
  });

  app.get("/scim/v2/ServiceProviderConfig", async () => deps.scimService.getServiceProviderConfig());
  app.get("/scim/v2/Schemas", async () => deps.scimService.getSchemas());
  app.get("/scim/v2/ResourceTypes", async () => deps.scimService.getResourceTypes());

  app.get("/scim/v2/Users", async (request) => {
    const query = scimListQuerySchema.parse(request.query ?? {});
    return deps.scimService.listUsers(query);
  });

  app.post("/scim/v2/Users", async (request, reply) => {
    const input = scimCreateUserSchema.parse(request.body);
    const created = await deps.scimService.createUser(input);
    await deps.auditRepository.log({
      type: "scim_user_created",
      actorType: "system",
      metadata: {
        source: "scim",
        userId: created.id,
        userName: created.userName
      }
    });
    await deps.eventHookService.emit("scim.user.created", {
      source: "scim",
      userId: created.id,
      userName: created.userName,
      active: created.active
    });
    return reply.status(201).send(created);
  });

  app.get("/scim/v2/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await deps.scimService.getUserById(id);
    if (!user) {
      return reply.status(404).send({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: "404", detail: "Resource not found" });
    }
    return user;
  });

  app.put("/scim/v2/Users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = scimReplaceUserSchema.parse(request.body);
    const updated = await deps.scimService.replaceUser(id, input);
    await deps.auditRepository.log({
      type: "scim_user_updated",
      actorType: "system",
      metadata: {
        source: "scim",
        userId: updated.id,
        userName: updated.userName,
        method: "put"
      }
    });
    await deps.eventHookService.emit("scim.user.updated", {
      source: "scim",
      userId: updated.id,
      userName: updated.userName,
      active: updated.active,
      method: "put"
    });
    return updated;
  });

  app.patch("/scim/v2/Users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = scimPatchSchema.parse(request.body);
    const updated = await deps.scimService.patchUser(id, input.Operations);
    await deps.auditRepository.log({
      type: "scim_user_updated",
      actorType: "system",
      metadata: {
        source: "scim",
        userId: updated.id,
        userName: updated.userName,
        method: "patch",
        operationCount: input.Operations.length
      }
    });
    await deps.eventHookService.emit("scim.user.updated", {
      source: "scim",
      userId: updated.id,
      userName: updated.userName,
      active: updated.active,
      method: "patch",
      operationCount: input.Operations.length
    });
    return updated;
  });

  app.delete("/scim/v2/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.scimService.deleteUser(id);
    await deps.deprovisioningService.enqueueUserOffboard({ userId: id, source: "scim" });
    await deps.auditRepository.log({
      type: "scim_user_deleted",
      actorType: "system",
      metadata: {
        source: "scim",
        userId: id
      }
    });
    await deps.eventHookService.emit("scim.user.deleted", {
      source: "scim",
      userId: id
    });
    return reply.status(204).send();
  });

  app.get("/scim/v2/Groups", async (request) => {
    const query = scimListQuerySchema.parse(request.query ?? {});
    return deps.scimService.listGroups(query);
  });

  app.post("/scim/v2/Groups", async (request, reply) => {
    const input = scimCreateGroupSchema.parse(request.body);
    const created = await deps.scimService.createGroup(input);
    await deps.auditRepository.log({
      type: "scim_group_created",
      actorType: "system",
      metadata: {
        source: "scim",
        groupId: created.id,
        displayName: created.displayName
      }
    });
    await deps.eventHookService.emit("scim.group.created", {
      source: "scim",
      groupId: created.id,
      displayName: created.displayName,
      memberCount: created.members.length
    });
    return reply.status(201).send(created);
  });

  app.get("/scim/v2/Groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await deps.scimService.getGroupById(id);
    if (!group) {
      return reply.status(404).send({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: "404", detail: "Resource not found" });
    }
    return group;
  });

  app.put("/scim/v2/Groups/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = scimReplaceGroupSchema.parse(request.body);
    const updated = await deps.scimService.replaceGroup(id, input);
    await deps.auditRepository.log({
      type: "scim_group_updated",
      actorType: "system",
      metadata: {
        source: "scim",
        groupId: updated.id,
        displayName: updated.displayName,
        method: "put"
      }
    });
    await deps.eventHookService.emit("scim.group.updated", {
      source: "scim",
      groupId: updated.id,
      displayName: updated.displayName,
      memberCount: updated.members.length,
      method: "put"
    });
    return updated;
  });

  app.patch("/scim/v2/Groups/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = scimPatchSchema.parse(request.body);
    const updated = await deps.scimService.patchGroup(id, input.Operations);
    await deps.auditRepository.log({
      type: "scim_group_updated",
      actorType: "system",
      metadata: {
        source: "scim",
        groupId: updated.id,
        displayName: updated.displayName,
        method: "patch",
        operationCount: input.Operations.length
      }
    });
    await deps.eventHookService.emit("scim.group.updated", {
      source: "scim",
      groupId: updated.id,
      displayName: updated.displayName,
      memberCount: updated.members.length,
      method: "patch",
      operationCount: input.Operations.length
    });
    return updated;
  });

  app.delete("/scim/v2/Groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.scimService.deleteGroup(id);
    await deps.deprovisioningService.enqueueGroupCleanup({ groupId: id, source: "scim" });
    await deps.auditRepository.log({
      type: "scim_group_deleted",
      actorType: "system",
      metadata: {
        source: "scim",
        groupId: id
      }
    });
    await deps.eventHookService.emit("scim.group.deleted", {
      source: "scim",
      groupId: id
    });
    return reply.status(204).send();
  });
};