import type { FastifyInstance } from "fastify";
import type { SuggestionService } from "../../services/suggestion-service.js";
import { canRevealSuggestionAuthor } from "../../services/suggestion-service.js";
import type { RoleService } from "../../services/role-service.js";
import type { MediaService } from "../../services/media-service.js";
import { createPortalSuggestionSchema, updateAdminSuggestionSchema } from "../schemas.js";
import { filterAdminList } from "../list-search.js";

export interface SuggestionRouteDeps {
  suggestionService: SuggestionService;
  roleService: RoleService;
  mediaService: MediaService;
  getPortalUserId: (request: any) => Promise<string | null>;
  requireSessionUser: (request: any, reply: any) => Promise<{ session: any; user: any } | null>;
  readImageUpload: (request: any, reply: any) => Promise<{ bytes: Buffer; mimeType: string } | null>;
}

export const registerSuggestionRoutes = async (app: FastifyInstance, deps: SuggestionRouteDeps) => {
  app.get("/api/portal/suggestions", async (request, reply) => {
    const userId = await deps.getPortalUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    return deps.suggestionService.listForUser(userId);
  });

  app.post("/api/portal/suggestions", async (request, reply) => {
    const userId = await deps.getPortalUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const input = createPortalSuggestionSchema.parse(request.body);
    const created = await deps.suggestionService.createForUser({
      authorUserId: userId,
      kind: input.kind,
      appId: input.appId,
      proposedName: input.proposedName,
      title: input.title,
      body: input.body,
      imageUrls: input.imageUrls
    });
    return reply.status(201).send(created);
  });

  app.post("/api/portal/suggestions/images", async (request, reply) => {
    const userId = await deps.getPortalUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthorized" });

    const uploaded = await deps.readImageUpload(request, reply);
    if (!uploaded) {
      return;
    }

    const saved = await deps.mediaService.saveUploadedImage({
      bucket: "suggestions",
      ownerId: userId,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType
    });

    return reply.status(200).send({ url: saved.url });
  });

  app.get("/api/admin/suggestions", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;
    const permissions = await deps.roleService.resolvePermissionsForUser(auth.user.id);
    const revealAuthor = canRevealSuggestionAuthor(permissions);
    const items = await deps.suggestionService.listForAdmin({ revealAuthor });
    const fields: Array<(item: (typeof items)[number]) => unknown> = [
      (item) => item.id,
      (item) => item.title,
      (item) => item.body,
      (item) => item.kind,
      (item) => item.status,
      (item) => item.appName,
      (item) => item.proposedName
    ];
    if (revealAuthor) {
      fields.push(
        (item) => item.author?.email,
        (item) => item.author?.username,
        (item) => item.author?.id
      );
    }
    return filterAdminList(items, request.query as Record<string, unknown>, fields);
  });

  app.get("/api/admin/suggestions/:id", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const permissions = await deps.roleService.resolvePermissionsForUser(auth.user.id);
    const item = await deps.suggestionService.getForAdmin(id, {
      revealAuthor: canRevealSuggestionAuthor(permissions)
    });
    if (!item) return reply.status(404).send({ error: "not_found" });
    return item;
  });

  app.patch("/api/admin/suggestions/:id", async (request, reply) => {
    const auth = await deps.requireSessionUser(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const input = updateAdminSuggestionSchema.parse(request.body ?? {});
    const permissions = await deps.roleService.resolvePermissionsForUser(auth.user.id);
    const updated = await deps.suggestionService.updateForAdmin({
      id,
      actorUserId: auth.user.id,
      revealAuthor: canRevealSuggestionAuthor(permissions),
      status: input.status,
      internalNotes: input.internalNotes
    });
    if (!updated) return reply.status(404).send({ error: "not_found" });
    return updated;
  });
};
