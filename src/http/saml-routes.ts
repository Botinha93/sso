import type { FastifyInstance } from "fastify";
import type { AuditRepository } from "../repositories/contracts.js";
import type { SamlServiceProviderRepository } from "../repositories/contracts.js";
import type { SamlNameIdMappingRepository } from "../repositories/contracts.js";
import type { SamlAssertionAuditRepository } from "../repositories/contracts.js";
import type { SamlService } from "../services/saml-service.js";
import {
  createServiceProviderSchema,
  updateServiceProviderSchema,
  uploadServiceProviderMetadataSchema,
  rotateServiceProviderCertificateSchema,
  listServiceProvidersSchema,
  listAssertionAuditsSchema,
} from "./saml-schemas.js";

interface SamlRouteDeps {
  samlService: SamlService;
  samlServiceProviderRepository: SamlServiceProviderRepository;
  samlNameIdMappingRepository: SamlNameIdMappingRepository;
  samlAssertionAuditRepository: SamlAssertionAuditRepository;
  auditRepository: AuditRepository;
}

export const registerSamlAdminRoutes = async (app: FastifyInstance, deps: SamlRouteDeps) => {
  // List all service providers
  app.get("/api/admin/saml/service-providers", {
    handler: async (request, reply) => {
      try {
        const query = listServiceProvidersSchema.parse(request.query);
        const enabled = query.enabled ? query.enabled === "true" : undefined;
        const sps = await deps.samlServiceProviderRepository.list();
        
        let filtered = sps;
        if (enabled !== undefined) {
          filtered = sps.filter(sp => sp.enabled === enabled);
        }
        
        const paginated = filtered.slice(query.offset, query.offset + query.limit);
        
        return reply.status(200).send({
          items: paginated,
          total: filtered.length,
          limit: query.limit,
          offset: query.offset,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Get a specific service provider
  app.get("/api/admin/saml/service-providers/:id", {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const sp = await deps.samlServiceProviderRepository.findById(id);
        
        if (!sp) {
          return reply.status(404).send({ error: "Service provider not found" });
        }
        
        const mappings = await deps.samlNameIdMappingRepository.findBySpId(id);
        
        return reply.status(200).send({
          ...sp,
          nameIdMappings: mappings,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Create a new service provider
  app.post("/api/admin/saml/service-providers", {
    handler: async (request, reply) => {
      try {
        const input = createServiceProviderSchema.parse(request.body);
        const sessionId = (request as any).sessionId || "system";
        const actorType = sessionId === "system" ? "system" : "user";
        
        const sp = await deps.samlService.createServiceProvider({
          entityId: input.entityId,
          acsUrl: input.acsUrl,
          sloUrl: input.sloUrl,
          signingCertificate: input.signingCertificate,
          encryptionCertificate: input.encryptionCertificate,
          nameIdFormat: input.nameIdFormat,
        });
        
        await deps.auditRepository.log({
          type: "saml_service_provider_created",
          actorId: sessionId,
          actorType,
          metadata: {
            serviceProviderId: sp.id,
            entityId: sp.entityId,
            acsUrl: sp.acsUrl,
            enabled: sp.enabled,
          },
        });
        
        return reply.status(201).send(sp);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Update a service provider
  app.patch("/api/admin/saml/service-providers/:id", {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const input = updateServiceProviderSchema.parse(request.body);
        const sessionId = (request as any).sessionId || "system";
        const actorType = sessionId === "system" ? "system" : "user";
        
        const existing = await deps.samlServiceProviderRepository.findById(id);
        if (!existing) {
          return reply.status(404).send({ error: "Service provider not found" });
        }
        
        const updated = await deps.samlService.updateServiceProvider(id, {
          entityId: input.entityId || existing.entityId,
          acsUrl: input.acsUrl || existing.acsUrl,
          sloUrl: input.sloUrl || existing.sloUrl,
          signingCertificate: input.signingCertificate || existing.signingCertificate,
          encryptionCertificate: input.encryptionCertificate || existing.encryptionCertificate,
          nameIdFormat: input.nameIdFormat || existing.nameIdFormat,
          enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
        });
        
        await deps.auditRepository.log({
          type: "saml_service_provider_updated",
          actorId: sessionId,
          actorType,
          metadata: {
            serviceProviderId: id,
            changes: Object.keys(input),
            entityId: updated.entityId,
          },
        });
        
        return reply.status(200).send(updated);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Upload and parse SAML metadata for an existing service provider
  app.post("/api/admin/saml/service-providers/:id/metadata", {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const input = uploadServiceProviderMetadataSchema.parse(request.body);
        const sessionId = (request as any).sessionId || "system";
        const actorType = sessionId === "system" ? "system" : "user";

        const result = await deps.samlService.uploadServiceProviderMetadata(id, {
          metadata: input.metadata,
          overwriteManualFields: input.overwriteManualFields,
        });

        await deps.auditRepository.log({
          type: "saml_service_provider_metadata_uploaded",
          actorId: sessionId,
          actorType,
          metadata: {
            serviceProviderId: id,
            overwriteManualFields: input.overwriteManualFields,
            importedEntityId: result.parsed.entityId,
            importedAcsUrl: result.parsed.acsUrl,
            importedSloUrl: result.parsed.sloUrl,
            importedSigningCertificate: Boolean(result.parsed.signingCertificate),
          },
        });

        return reply.status(200).send({
          serviceProvider: result.serviceProvider,
          imported: {
            entityId: result.parsed.entityId,
            acsUrl: result.parsed.acsUrl,
            sloUrl: result.parsed.sloUrl,
            hasSigningCertificate: Boolean(result.parsed.signingCertificate),
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Rotate service-provider certificates without requiring full object patching
  app.post("/api/admin/saml/service-providers/:id/certificates/rotate", {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const input = rotateServiceProviderCertificateSchema.parse(request.body);
        const sessionId = (request as any).sessionId || "system";
        const actorType = sessionId === "system" ? "system" : "user";

        const updated = await deps.samlService.rotateServiceProviderCertificate(id, {
          certificateType: input.certificateType,
          certificate: input.certificate,
        });

        await deps.auditRepository.log({
          type: "saml_service_provider_certificate_rotated",
          actorId: sessionId,
          actorType,
          metadata: {
            serviceProviderId: id,
            certificateType: input.certificateType,
          },
        });

        return reply.status(200).send(updated);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // Delete a service provider
  app.delete("/api/admin/saml/service-providers/:id", {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const sessionId = (request as any).sessionId || "system";
        const actorType = sessionId === "system" ? "system" : "user";
        
        const sp = await deps.samlServiceProviderRepository.findById(id);
        if (!sp) {
          return reply.status(404).send({ error: "Service provider not found" });
        }
        
        await deps.samlService.deleteServiceProvider(id);
        
        await deps.auditRepository.log({
          type: "saml_service_provider_deleted",
          actorId: sessionId,
          actorType,
          metadata: {
            serviceProviderId: id,
            entityId: sp.entityId,
          },
        });
        
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });

  // List assertion audits
  app.get("/api/admin/saml/assertions", {
    handler: async (request, reply) => {
      try {
        const query = listAssertionAuditsSchema.parse(request.query);
        const audits = await deps.samlAssertionAuditRepository.list();
        
        let filtered = audits;
        if (query.spId) {
          filtered = filtered.filter(a => a.spId === query.spId);
        }
        if (query.startDate) {
          const startTime = new Date(query.startDate).getTime();
          filtered = filtered.filter(a => a.createdAt.getTime() >= startTime);
        }
        if (query.endDate) {
          const endTime = new Date(query.endDate).getTime();
          filtered = filtered.filter(a => a.createdAt.getTime() <= endTime);
        }
        
        const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const paginated = sorted.slice(query.offset, query.offset + query.limit);
        
        return reply.status(200).send({
          items: paginated,
          total: filtered.length,
          limit: query.limit,
          offset: query.offset,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  });
};
