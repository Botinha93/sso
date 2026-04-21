import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type { SamlServiceProvider, SamlNameIdMapping, SamlAssertionAudit } from "../domain/models.js";
import type { 
  SamlServiceProviderRepository,
  SamlNameIdMappingRepository,
  SamlAssertionAuditRepository,
  AuditRepository
} from "../repositories/contracts.js";
import { parseSamlServiceProviderMetadata } from "./saml-metadata-parser.js";

export class SamlService {
  constructor(
    private readonly spRepository: SamlServiceProviderRepository,
    private readonly nameIdMappingRepository: SamlNameIdMappingRepository,
    private readonly assertionAuditRepository: SamlAssertionAuditRepository,
    private readonly auditRepository: AuditRepository
  ) {}

  async createServiceProvider(input: {
    entityId: string;
    acsUrl: string;
    nameIdFormat?: "persistent" | "transient" | "emailAddress";
    sloUrl?: string;
    signingCertificate?: string;
    encryptionCertificate?: string;
    appId?: string;
  }): Promise<SamlServiceProvider> {
    const entityId = input.entityId?.trim();
    if (!entityId) {
      throw new ValidationError("Entity ID is required");
    }

    const acsUrl = input.acsUrl?.trim();
    if (!acsUrl) {
      throw new ValidationError("ACS URL is required");
    }

    // Validate URL format
    try {
      new URL(acsUrl);
      if (input.sloUrl) {
        new URL(input.sloUrl);
      }
    } catch {
      throw new ValidationError("Invalid URL format for ACS or SLO URL");
    }

    const existing = await this.spRepository.findByEntityId(entityId);
    if (existing) {
      throw new ValidationError("Service provider with this entity ID already exists");
    }

    const sp = await this.spRepository.create({
      entityId,
      acsUrl,
      sloUrl: input.sloUrl,
      nameIdFormat: input.nameIdFormat || "persistent",
      signingCertificate: input.signingCertificate,
      encryptionCertificate: input.encryptionCertificate,
      appId: input.appId,
      enabled: true
    });

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: { 
        action: "saml_sp_created",
        spId: sp.id,
        entityId: sp.entityId
      }
    });

    return sp;
  }

  async getServiceProvider(id: string): Promise<SamlServiceProvider> {
    const sp = await this.spRepository.findById(id);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }
    return sp;
  }

  async listServiceProviders(): Promise<SamlServiceProvider[]> {
    return this.spRepository.list();
  }

  async updateServiceProvider(
    id: string,
    input: Partial<Omit<SamlServiceProvider, "id" | "createdAt">>
  ): Promise<SamlServiceProvider> {
    const existing = await this.spRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Service provider not found");
    }

    if (input.acsUrl) {
      try {
        new URL(input.acsUrl);
      } catch {
        throw new ValidationError("Invalid ACS URL format");
      }
    }

    if (input.sloUrl) {
      try {
        new URL(input.sloUrl);
      } catch {
        throw new ValidationError("Invalid SLO URL format");
      }
    }

    const updated = await this.spRepository.update(id, input);
    if (!updated) {
      throw new ValidationError("Failed to update service provider");
    }

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: { 
        action: "saml_sp_updated",
        spId: id
      }
    });

    return updated;
  }

  async uploadServiceProviderMetadata(
    id: string,
    input: { metadata: string; overwriteManualFields?: boolean }
  ): Promise<{ serviceProvider: SamlServiceProvider; parsed: ReturnType<typeof parseSamlServiceProviderMetadata> }> {
    const existing = await this.spRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Service provider not found");
    }

    const metadata = input.metadata.trim();
    if (!metadata) {
      throw new ValidationError("Metadata XML is required");
    }

    const parsed = parseSamlServiceProviderMetadata(metadata);
    const shouldOverwrite = input.overwriteManualFields !== false;

    const updatePayload: Partial<Omit<SamlServiceProvider, "id" | "createdAt">> = {
      metadata,
    };

    if (shouldOverwrite) {
      if (parsed.entityId) {
        updatePayload.entityId = parsed.entityId;
      }
      if (parsed.acsUrl) {
        updatePayload.acsUrl = parsed.acsUrl;
      }
      if (parsed.sloUrl) {
        updatePayload.sloUrl = parsed.sloUrl;
      }
      if (parsed.signingCertificate) {
        updatePayload.signingCertificate = parsed.signingCertificate;
      }
    }

    const updated = await this.spRepository.update(id, updatePayload);
    if (!updated) {
      throw new ValidationError("Failed to update service provider metadata");
    }

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: {
        action: "saml_sp_metadata_uploaded",
        spId: id,
        overwriteManualFields: shouldOverwrite,
      }
    });

    return { serviceProvider: updated, parsed };
  }

  async rotateServiceProviderCertificate(
    id: string,
    input: { certificateType: "signing" | "encryption"; certificate: string }
  ): Promise<SamlServiceProvider> {
    const existing = await this.spRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Service provider not found");
    }

    const certificate = input.certificate.trim();
    if (!certificate) {
      throw new ValidationError("Certificate is required");
    }

    const updatePayload: Partial<Omit<SamlServiceProvider, "id" | "createdAt">> =
      input.certificateType === "encryption"
        ? { encryptionCertificate: certificate }
        : { signingCertificate: certificate };

    const updated = await this.spRepository.update(id, updatePayload);
    if (!updated) {
      throw new ValidationError("Failed to rotate certificate");
    }

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: {
        action: "saml_sp_certificate_rotated",
        spId: id,
        certificateType: input.certificateType,
      }
    });

    return updated;
  }

  async deleteServiceProvider(id: string): Promise<void> {
    const sp = await this.spRepository.findById(id);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }

    // Clean up name ID mappings
    await this.nameIdMappingRepository.deleteBySpId(id);

    // Delete the service provider
    await this.spRepository.delete(id);

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: { 
        action: "saml_sp_deleted",
        spId: id,
        entityId: sp.entityId
      }
    });
  }

  async setNameIdMapping(
    spId: string,
    input: {
      format: "persistent" | "transient" | "emailAddress";
      sourceAttribute: string;
    }
  ): Promise<SamlNameIdMapping> {
    const sp = await this.spRepository.findById(spId);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }

    const sourceAttribute = input.sourceAttribute?.trim();
    if (!sourceAttribute) {
      throw new ValidationError("Source attribute is required");
    }

    const mapping = await this.nameIdMappingRepository.create({
      spId,
      format: input.format,
      sourceAttribute
    });

    await this.auditRepository.log({
      type: "policy_decision_evaluated",
      actorType: "system",
      metadata: { 
        action: "saml_name_id_mapping_created",
        spId,
        format: input.format
      }
    });

    return mapping;
  }

  async getNameIdMappings(spId: string): Promise<SamlNameIdMapping[]> {
    const sp = await this.spRepository.findById(spId);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }
    return this.nameIdMappingRepository.findBySpId(spId);
  }

  async recordAssertionAudit(input: {
    spId: string;
    requestId: string;
    responseId: string;
    subject: string;
    audience: string;
    assertionId: string;
    issueInstant: Date;
    notOnOrAfter: Date;
    destinationUrl: string;
    statusCode: string;
  }): Promise<SamlAssertionAudit> {
    const sp = await this.spRepository.findById(input.spId);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }

    const audit = await this.assertionAuditRepository.create({
      spId: input.spId,
      requestId: input.requestId,
      responseId: input.responseId,
      subject: input.subject,
      audience: input.audience,
      assertionId: input.assertionId,
      issueInstant: input.issueInstant,
      notOnOrAfter: input.notOnOrAfter,
      destinationUrl: input.destinationUrl,
      statusCode: input.statusCode
    });

    await this.auditRepository.log({
      type: "saml_assertion_validated",
      actorType: "system",
      metadata: { 
        spId: input.spId,
        subject: input.subject,
        statusCode: input.statusCode
      }
    });

    return audit;
  }

  async getAssertionAudit(id: string): Promise<SamlAssertionAudit> {
    const audit = await this.assertionAuditRepository.findById(id);
    if (!audit) {
      throw new ValidationError("Assertion audit not found");
    }
    return audit;
  }

  async listAssertionAudits(input?: { limit?: number; spId?: string }): Promise<SamlAssertionAudit[]> {
    return this.assertionAuditRepository.list(input);
  }

  async generateMetadata(spId: string): Promise<string> {
    const sp = await this.spRepository.findById(spId);
    if (!sp) {
      throw new ValidationError("Service provider not found");
    }

    // Generate SAML metadata XML for this IdP as seen from the SP perspective
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${sp.entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${sp.nameIdFormat === "persistent" ? "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified" : "urn:oasis:names:tc:SAML:1.1:nameid-format:" + sp.nameIdFormat}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sp.acsUrl}" index="0" isDefault="true"/>
    ${sp.sloUrl ? `<SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sp.sloUrl}"/>` : ""}
  </SPSSODescriptor>
</EntityDescriptor>`;

    return metadata;
  }
}
