import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProvisioningMappings } from "../../src/services/provisioning-mapping-engine.js";

const timestamp = new Date("2026-04-20T00:00:00.000Z");

test("mapping engine detects drift and computes next custom attributes", () => {
  const result = evaluateProvisioningMappings({
    customAttributes: {
      "enterprise.manager": "A.Manager",
      managerId: "stale-manager"
    },
    mappings: [
      {
        id: "map-1",
        name: "manager-map",
        sourceAttribute: "enterprise.manager",
        targetAttribute: "customAttributes.managerId",
        transformExpression: "value?.toLowerCase()",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  });

  assert.equal(result.drift.length, 1);
  assert.equal(result.drift[0]?.targetAttribute, "managerId");
  assert.equal(result.nextCustomAttributes.managerId, "a.manager");
});

test("mapping engine ignores disabled mappings and unknown source attributes", () => {
  const result = evaluateProvisioningMappings({
    customAttributes: {
      managerId: "keep-me"
    },
    mappings: [
      {
        id: "map-2",
        name: "disabled-map",
        sourceAttribute: "enterprise.manager",
        targetAttribute: "customAttributes.managerId",
        transformExpression: "lowercase",
        enabled: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  });

  assert.equal(result.drift.length, 0);
  assert.equal(result.nextCustomAttributes.managerId, "keep-me");
});

test("mapping engine supports simple pipeline transforms", () => {
  const result = evaluateProvisioningMappings({
    customAttributes: {
      department: "  CORE-OPS  "
    },
    mappings: [
      {
        id: "map-3",
        name: "department-map",
        sourceAttribute: "department",
        targetAttribute: "customAttributes.departmentSlug",
        transformExpression: "trim|lowercase",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  });

  assert.equal(result.drift.length, 1);
  assert.equal(result.nextCustomAttributes.departmentSlug, "core-ops");
});