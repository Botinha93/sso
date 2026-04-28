import type { FastifyInstance } from "fastify";
import type { ServiceIdentityService } from "../../services/service-identity-service.js";
import type { GroupService } from "../../services/group-service.js";
import type { RoleService } from "../../services/role-service.js";
import {
  createServiceIdentitySchema,
  updateServiceIdentitySchema,
  issueServiceIdentityCredentialSchema
} from "../schemas.js";

export function registerServiceIdentityRoutes(
  app: FastifyInstance,
  serviceIdentityService: ServiceIdentityService,
  roleService: RoleService,
  groupService: GroupService
) {
  const enrichIdentity = async <T extends { id: string }>(identity: T) => {
    const [assignments, groupIds] = await Promise.all([
      roleService.listAssignmentsForUser(identity.id),
      groupService.listGroupIdsForUser(identity.id)
    ]);

    const roleIds = Array.from(new Set(assignments
      .filter((assignment) => !assignment.tenantId)
      .map((assignment) => assignment.roleId)));

    return {
      ...identity,
      roleIds,
      groupIds
    };
  };

  const syncRoleAssignments = async (userId: string, nextRoleIds: string[]) => {
    const existingAssignments = await roleService.listAssignmentsForUser(userId);
    const existingRoleIds = Array.from(new Set(existingAssignments
      .filter((assignment) => !assignment.tenantId)
      .map((assignment) => assignment.roleId)));
    const next = new Set(nextRoleIds);

    for (const roleId of existingRoleIds) {
      if (!next.has(roleId)) {
        await roleService.removeRole({ userId, roleId });
      }
    }

    for (const roleId of nextRoleIds) {
      if (!existingRoleIds.includes(roleId)) {
        await roleService.assignRole({ userId, roleId });
      }
    }
  };

  const syncGroupAssignments = async (userId: string, nextGroupIds: string[]) => {
    const existingGroupIds = await groupService.listGroupIdsForUser(userId);
    const next = new Set(nextGroupIds);

    for (const groupId of existingGroupIds) {
      if (!next.has(groupId)) {
        await groupService.removeUserFromGroup({ userId, groupId });
      }
    }

    for (const groupId of nextGroupIds) {
      if (!existingGroupIds.includes(groupId)) {
        await groupService.assignUserToGroup({ userId, groupId });
      }
    }
  };

  app.get("/api/admin/service-identities", async (request, reply) => {
    const identities = await serviceIdentityService.listServiceIdentities();
    return { data: await Promise.all(identities.map((identity) => enrichIdentity(identity))) };
  });

  app.post("/api/admin/service-identities", async (request, reply) => {
    const parsed = createServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const { roleIds, groupIds, ...serviceIdentityInput } = parsed.data;
    const identity = await serviceIdentityService.createServiceIdentity(serviceIdentityInput);

    await syncRoleAssignments(identity.id, roleIds);
    await syncGroupAssignments(identity.id, groupIds);

    const refreshed = await serviceIdentityService.getServiceIdentity(identity.id);
    return reply.status(201).send(await enrichIdentity(refreshed ?? identity));
  });

  app.get("/api/admin/service-identities/:id", async (request: any, reply) => {
    const identity = await serviceIdentityService.getServiceIdentity(request.params.id);
    if (!identity) return reply.status(404).send({ error: "not_found" });
    return enrichIdentity(identity);
  });

  app.patch("/api/admin/service-identities/:id", async (request: any, reply) => {
    const parsed = updateServiceIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error", issues: parsed.error.issues });
    }
    const { roleIds, groupIds, ...serviceIdentityInput } = parsed.data;
    const updated = await serviceIdentityService.updateServiceIdentity(request.params.id, serviceIdentityInput);
    if (!updated) return reply.status(404).send({ error: "not_found" });

    if (roleIds !== undefined) {
      await syncRoleAssignments(request.params.id, roleIds);
    }

    if (groupIds !== undefined) {
      await syncGroupAssignments(request.params.id, groupIds);
    }

    const refreshed = await serviceIdentityService.getServiceIdentity(request.params.id);
    return enrichIdentity(refreshed ?? updated);
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
