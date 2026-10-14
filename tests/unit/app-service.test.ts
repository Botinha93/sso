import test from "node:test";
import assert from "node:assert/strict";
import { AppService } from "../../src/services/app-service.js";
import type { AppRepository } from "../../src/repositories/contracts.js";

test("AppService updateApp persists resources list", async () => {
  const existing = {
    id: "app-1",
    name: "Sample App",
    description: "desc",
    icon: undefined,
    imageUrl: undefined,
    url: "https://example.com",
    resources: ["orders"],
    createdAt: new Date()
  };

  let updatedInput: Parameters<AppRepository["update"]>[1] | undefined;

  const repo: AppRepository = {
    create: async () => existing,
    list: async () => [existing],
    findById: async () => existing,
    update: async (_id, input) => {
      updatedInput = input;
      return {
        ...existing,
        ...input,
        resources: input.resources ?? existing.resources
      };
    },
    delete: async () => undefined
  };

  const service = new AppService(repo);
  const result = await service.updateApp("app-1", {
    resources: ["orders", "inventory", "billing"]
  });

  assert.deepEqual(updatedInput?.resources, ["orders", "inventory", "billing"]);
  assert.deepEqual(result.resources, ["orders", "inventory", "billing"]);
});
