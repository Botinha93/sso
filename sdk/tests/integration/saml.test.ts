import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientInstance } from "../../src/core/types.js";
import { createSamlAdminAPI } from "../../src/federation/index.js";
import type {
  SDKSamlServiceProvider,
  SDKSamlAssertionAudit,
  PaginatedResponse
} from "../../src/federation/types.js";

describe("SAML Admin API", () => {
  let mockClient: ClientInstance;
  let mockGet: any;
  let mockPost: any;
  let mockPatch: any;
  let mockDelete: any;

  beforeEach(() => {
    mockGet = vi.fn();
    mockPost = vi.fn();
    mockPatch = vi.fn();
    mockDelete = vi.fn();

    mockClient = {
      get: mockGet,
      post: mockPost,
      patch: mockPatch,
      delete: mockDelete
    } as any;
  });

  describe("Service Providers API", () => {
    it("should list service providers with pagination", async () => {
      const mockResponse: PaginatedResponse<SDKSamlServiceProvider> = {
        items: [
          {
            id: "sp-1",
            entityId: "https://app.example.com/saml",
            acsUrl: "https://app.example.com/saml/acs",
            nameIdFormat: "emailAddress",
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1,
        limit: 20,
        offset: 0
      };
      mockGet.mockResolvedValue(mockResponse);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.list({ enabled: "true", limit: 20, offset: 0 });

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/saml/service-providers", {
        query: { enabled: "true", limit: "20", offset: "0" }
      });
    });

    it("should get a specific service provider with mappings", async () => {
      const mockSP = {
        id: "sp-1",
        entityId: "https://app.example.com/saml",
        acsUrl: "https://app.example.com/saml/acs",
        nameIdFormat: "emailAddress" as const,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        nameIdMappings: [
          {
            id: "mapping-1",
            spId: "sp-1",
            format: "emailAddress" as const,
            sourceAttribute: "email",
            createdAt: new Date()
          }
        ]
      };
      mockGet.mockResolvedValue(mockSP);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.get("sp-1");

      expect(result).toEqual(mockSP);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/saml/service-providers/sp-1");
    });

    it("should create a service provider", async () => {
      const input = {
        entityId: "https://app.example.com/saml",
        acsUrl: "https://app.example.com/saml/acs",
        nameIdFormat: "emailAddress" as const
      };
      const mockSP = {
        id: "sp-new",
        ...input,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPost.mockResolvedValue(mockSP);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.create(input);

      expect(result).toEqual(mockSP);
      expect(mockPost).toHaveBeenCalledWith("/api/admin/saml/service-providers", { body: input });
    });

    it("should update a service provider", async () => {
      const input = { acsUrl: "https://new-app.example.com/saml/acs", enabled: false };
      const mockSP = {
        id: "sp-1",
        entityId: "https://app.example.com/saml",
        acsUrl: "https://new-app.example.com/saml/acs",
        nameIdFormat: "emailAddress" as const,
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPatch.mockResolvedValue(mockSP);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.update("sp-1", input);

      expect(result).toEqual(mockSP);
      expect(mockPatch).toHaveBeenCalledWith("/api/admin/saml/service-providers/sp-1", { body: input });
    });

    it("should upload SAML metadata", async () => {
      const input = {
        metadata: "<EntityDescriptor>...</EntityDescriptor>",
        overwriteManualFields: true
      };
      const mockResult = {
        serviceProvider: {
          id: "sp-1",
          entityId: "https://app.example.com/saml",
          acsUrl: "https://app.example.com/saml/acs",
          nameIdFormat: "persistent" as const,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        imported: {
          entityId: "https://app.example.com/saml",
          acsUrl: "https://app.example.com/saml/acs",
          hasSigningCertificate: true
        }
      };
      mockPost.mockResolvedValue(mockResult);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.uploadMetadata("sp-1", input);

      expect(result).toEqual(mockResult);
      expect(mockPost).toHaveBeenCalledWith("/api/admin/saml/service-providers/sp-1/metadata", {
        body: input
      });
    });

    it("should rotate service provider certificate", async () => {
      const input = {
        certificateType: "signing" as const,
        certificate: "-----BEGIN CERTIFICATE-----..."
      };
      const mockSP = {
        id: "sp-1",
        entityId: "https://app.example.com/saml",
        acsUrl: "https://app.example.com/saml/acs",
        signingCertificate: "-----BEGIN CERTIFICATE-----...",
        nameIdFormat: "emailAddress" as const,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPost.mockResolvedValue(mockSP);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.serviceProviders.rotateCertificate("sp-1", input);

      expect(result).toEqual(mockSP);
      expect(mockPost).toHaveBeenCalledWith(
        "/api/admin/saml/service-providers/sp-1/certificates/rotate",
        { body: input }
      );
    });

    it("should delete a service provider", async () => {
      mockDelete.mockResolvedValue(void 0);

      const api = createSamlAdminAPI(mockClient);
      await api.serviceProviders.delete("sp-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/admin/saml/service-providers/sp-1");
    });
  });

  describe("Assertions API", () => {
    it("should list assertion audits with filters", async () => {
      const mockResponse: PaginatedResponse<SDKSamlAssertionAudit> = {
        items: [
          {
            id: "audit-1",
            spId: "sp-1",
            requestId: "req-123",
            responseId: "resp-123",
            subject: "user@example.com",
            audience: "https://app.example.com",
            assertionId: "assert-123",
            issueInstant: new Date(),
            notOnOrAfter: new Date(),
            destinationUrl: "https://app.example.com/saml/acs",
            statusCode: "urn:oasis:names:tc:SAML:2.0:status:Success",
            createdAt: new Date()
          }
        ],
        total: 1,
        limit: 20,
        offset: 0
      };
      mockGet.mockResolvedValue(mockResponse);

      const api = createSamlAdminAPI(mockClient);
      const result = await api.assertions.list({
        spId: "sp-1",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        limit: 20,
        offset: 0
      });

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/saml/assertions", {
        query: {
          spId: "sp-1",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          limit: "20",
          offset: "0"
        }
      });
    });

    it("should list assertion audits without filters", async () => {
      const mockResponse: PaginatedResponse<SDKSamlAssertionAudit> = {
        items: [],
        total: 0,
        limit: 20,
        offset: 0
      };
      mockGet.mockResolvedValue(mockResponse);

      const api = createSamlAdminAPI(mockClient);
      await api.assertions.list();

      expect(mockGet).toHaveBeenCalledWith("/api/admin/saml/assertions", { query: undefined });
    });
  });
});
