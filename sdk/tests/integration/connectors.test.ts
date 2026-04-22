import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConnectorsAPI } from "../../src/admin/connectors.js";
import type { ClientInstance } from "../../src/core/types.js";
import type { SDKConnector, SDKConnectorMapping, SDKConnectorRun } from "../../src/admin/types.js";

describe("Connectors API", () => {
  let mockClient: ClientInstance;
  let mockGet: ReturnType<typeof vi.fn>;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockPatch: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

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
    } as unknown as ClientInstance;
  });

  it("lists connectors", async () => {
    const data: SDKConnector[] = [
      {
        id: "conn-1",
        name: "HR LDAP",
        type: "ldap",
        status: "active",
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    mockGet.mockResolvedValue({ data });

    const api = createConnectorsAPI(mockClient);
    const result = await api.list();

    expect(result).toEqual(data);
    expect(mockGet).toHaveBeenCalledWith("/api/admin/connectors");
  });

  it("gets connector by id", async () => {
    const connector: SDKConnector = {
      id: "conn-1",
      name: "HR LDAP",
      type: "ldap",
      status: "active",
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockGet.mockResolvedValue(connector);

    const api = createConnectorsAPI(mockClient);
    const result = await api.get("conn-1");

    expect(result).toEqual(connector);
    expect(mockGet).toHaveBeenCalledWith("/api/admin/connectors/conn-1");
  });

  it("creates connector", async () => {
    const created: SDKConnector = {
      id: "conn-1",
      name: "HR LDAP",
      type: "ldap",
      status: "active",
      config: { baseDn: "dc=example,dc=com" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockPost.mockResolvedValue(created);

    const api = createConnectorsAPI(mockClient);
    const result = await api.create({
      name: "HR LDAP",
      type: "ldap",
      config: { baseDn: "dc=example,dc=com" }
    });

    expect(result).toEqual(created);
    expect(mockPost).toHaveBeenCalledWith("/api/admin/connectors", {
      body: {
        name: "HR LDAP",
        type: "ldap",
        config: { baseDn: "dc=example,dc=com" }
      }
    });
  });

  it("updates connector", async () => {
    const updated: SDKConnector = {
      id: "conn-1",
      name: "HR SCIM",
      type: "scim",
      status: "inactive",
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockPatch.mockResolvedValue(updated);

    const api = createConnectorsAPI(mockClient);
    const result = await api.update("conn-1", { name: "HR SCIM", type: "scim", status: "inactive" });

    expect(result).toEqual(updated);
    expect(mockPatch).toHaveBeenCalledWith("/api/admin/connectors/conn-1", {
      body: { name: "HR SCIM", type: "scim", status: "inactive" }
    });
  });

  it("deletes connector", async () => {
    mockDelete.mockResolvedValue(undefined);
    const api = createConnectorsAPI(mockClient);

    await api.delete("conn-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/admin/connectors/conn-1");
  });

  it("triggers connector sync", async () => {
    const run: SDKConnectorRun = {
      id: "run-1",
      connectorId: "conn-1",
      status: "running",
      recordsImported: 0,
      recordsFailed: 0,
      createdAt: new Date().toISOString()
    };
    mockPost.mockResolvedValue(run);

    const api = createConnectorsAPI(mockClient);
    const result = await api.triggerSync("conn-1");

    expect(result).toEqual(run);
    expect(mockPost).toHaveBeenCalledWith("/api/admin/connectors/conn-1/sync", { body: {} });
  });

  it("lists connector runs", async () => {
    const data: SDKConnectorRun[] = [
      {
        id: "run-1",
        connectorId: "conn-1",
        status: "succeeded",
        recordsImported: 120,
        recordsFailed: 0,
        createdAt: new Date().toISOString()
      }
    ];
    mockGet.mockResolvedValue({ data });

    const api = createConnectorsAPI(mockClient);
    const result = await api.listRuns("conn-1", { limit: 25 });

    expect(result).toEqual(data);
    expect(mockGet).toHaveBeenCalledWith("/api/admin/connectors/conn-1/runs", { query: { limit: 25 } });
  });

  it("lists connector mappings", async () => {
    const data: SDKConnectorMapping[] = [
      {
        id: "map-1",
        connectorId: "conn-1",
        sourceField: "department",
        targetField: "ou",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    mockGet.mockResolvedValue({ data });

    const api = createConnectorsAPI(mockClient);
    const result = await api.listMappings("conn-1");

    expect(result).toEqual(data);
    expect(mockGet).toHaveBeenCalledWith("/api/admin/connectors/conn-1/mappings");
  });

  it("creates connector mapping", async () => {
    const mapping: SDKConnectorMapping = {
      id: "map-1",
      connectorId: "conn-1",
      sourceField: "department",
      targetField: "ou",
      transform: "toUpperCase()",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockPost.mockResolvedValue(mapping);

    const api = createConnectorsAPI(mockClient);
    const result = await api.createMapping("conn-1", {
      sourceField: "department",
      targetField: "ou",
      transform: "toUpperCase()"
    });

    expect(result).toEqual(mapping);
    expect(mockPost).toHaveBeenCalledWith("/api/admin/connectors/conn-1/mappings", {
      body: {
        sourceField: "department",
        targetField: "ou",
        transform: "toUpperCase()"
      }
    });
  });

  it("deletes connector mapping", async () => {
    mockDelete.mockResolvedValue(undefined);
    const api = createConnectorsAPI(mockClient);

    await api.deleteMapping("conn-1", "map-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/admin/connectors/conn-1/mappings/map-1");
  });
});