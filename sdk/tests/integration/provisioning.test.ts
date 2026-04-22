import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientInstance } from "../../src/core/types.js";
import { createProvisioningAPI } from "../../src/provisioning/index.js";
import type {
  SDKScimToken,
  SDKProvisioningMapping,
  SDKProvisioningJob
} from "../../src/provisioning/types.js";

describe("Provisioning API", () => {
  let mockClient: ClientInstance;
  let mockGet: any;
  let mockPost: any;
  let mockDelete: any;

  beforeEach(() => {
    mockGet = vi.fn();
    mockPost = vi.fn();
    mockDelete = vi.fn();

    mockClient = {
      get: mockGet,
      post: mockPost,
      delete: mockDelete
    } as any;
  });

  describe("Tokens API", () => {
    it("should list SCIM tokens", async () => {
      const mockTokens: SDKScimToken[] = [
        {
          id: "token-1",
          label: "Production",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date()
        }
      ];
      mockGet.mockResolvedValue(mockTokens);

      const api = createProvisioningAPI(mockClient);
      const result = await api.tokens.list();

      expect(result).toEqual(mockTokens);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/provisioning/tokens");
    });

    it("should create a SCIM token", async () => {
      const input = { label: "New Token", expiresAt: "2025-12-31T00:00:00Z" };
      const mockCreated = {
        id: "token-new",
        label: "New Token",
        token: "xxxxxxxxxxxxx",
        expiresAt: new Date("2025-12-31"),
        createdAt: new Date()
      };
      mockPost.mockResolvedValue(mockCreated);

      const api = createProvisioningAPI(mockClient);
      const result = await api.tokens.create(input);

      expect(result).toEqual(mockCreated);
      expect(mockPost).toHaveBeenCalledWith("/api/admin/provisioning/tokens", { body: input });
    });

    it("should revoke a SCIM token", async () => {
      mockDelete.mockResolvedValue(void 0);

      const api = createProvisioningAPI(mockClient);
      await api.tokens.revoke("token-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/admin/provisioning/tokens/token-1");
    });
  });

  describe("Mappings API", () => {
    it("should list provisioning mappings", async () => {
      const mockMappings: SDKProvisioningMapping[] = [
        {
          id: "mapping-1",
          name: "Email Sync",
          sourceAttribute: "email",
          targetAttribute: "mail",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      mockGet.mockResolvedValue(mockMappings);

      const api = createProvisioningAPI(mockClient);
      const result = await api.mappings.list();

      expect(result).toEqual(mockMappings);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/provisioning/mappings");
    });

    it("should create a provisioning mapping", async () => {
      const input = {
        name: "Department Mapping",
        sourceAttribute: "department",
        targetAttribute: "ou",
        enabled: true
      };
      const mockMapping = {
        id: "mapping-new",
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPost.mockResolvedValue(mockMapping);

      const api = createProvisioningAPI(mockClient);
      const result = await api.mappings.create(input);

      expect(result).toEqual(mockMapping);
      expect(mockPost).toHaveBeenCalledWith("/api/admin/provisioning/mappings", { body: input });
    });

    it("should delete a provisioning mapping", async () => {
      mockDelete.mockResolvedValue(void 0);

      const api = createProvisioningAPI(mockClient);
      await api.mappings.delete("mapping-1");

      expect(mockDelete).toHaveBeenCalledWith("/api/admin/provisioning/mappings/mapping-1");
    });
  });

  describe("Reconciliation API", () => {
    it("should list provisioning jobs", async () => {
      const mockJobs: SDKProvisioningJob[] = [
        {
          id: "job-1",
          jobType: "reconcile",
          status: "completed",
          summary: { usersEvaluated: 50, driftDetected: 2 },
          createdAt: new Date(),
          completedAt: new Date()
        }
      ];
      mockGet.mockResolvedValue(mockJobs);

      const api = createProvisioningAPI(mockClient);
      const result = await api.reconciliation.listJobs(20);

      expect(result).toEqual(mockJobs);
      expect(mockGet).toHaveBeenCalledWith("/api/admin/provisioning/jobs", {
        query: { limit: "20" }
      });
    });

    it("should run a reconciliation job", async () => {
      const mockJob = {
        id: "job-new",
        jobType: "reconcile" as const,
        status: "completed" as const,
        summary: { usersEvaluated: 50, driftDetected: 0, updatedUsers: 0 },
        createdAt: new Date(),
        completedAt: new Date()
      };
      mockPost.mockResolvedValue(mockJob);

      const api = createProvisioningAPI(mockClient);
      const result = await api.reconciliation.runReconcile({ dryRun: false });

      expect(result).toEqual(mockJob);
      expect(mockPost).toHaveBeenCalledWith("/api/admin/provisioning/jobs/reconcile", {
        body: { dryRun: false }
      });
    });

    it("should default to dry run when no input provided", async () => {
      const mockJob = {
        id: "job-new",
        jobType: "reconcile" as const,
        status: "completed" as const,
        summary: { usersEvaluated: 50, driftDetected: 0 },
        createdAt: new Date(),
        completedAt: new Date()
      };
      mockPost.mockResolvedValue(mockJob);

      const api = createProvisioningAPI(mockClient);
      await api.reconciliation.runReconcile();

      expect(mockPost).toHaveBeenCalledWith("/api/admin/provisioning/jobs/reconcile", {
        body: { dryRun: true }
      });
    });
  });
});
