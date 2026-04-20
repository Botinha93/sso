import test from "node:test";
import assert from "node:assert/strict";
import type {
  PolicyAssignment,
  PolicyDefinition,
  User,
  UserGroupAssignment
} from "../../src/domain/models.js";
import {
  type PolicyAssignmentRepository,
  type PolicyDefinitionRepository,
  type UserGroupAssignmentRepository
} from "../../src/repositories/contracts.js";
import { PolicyService } from "../../src/services/policy-service.js";

class InMemoryPolicyDefinitionRepository implements PolicyDefinitionRepository {
  constructor(private readonly rows: PolicyDefinition[]) {}

  async list(): Promise<PolicyDefinition[]> {
    return [...this.rows];
  }

  async findById(id: string): Promise<PolicyDefinition | undefined> {
    return this.rows.find((row) => row.id === id);
  }

  async findByKey(key: string): Promise<PolicyDefinition | undefined> {
    return this.rows.find((row) => row.key === key);
  }

  async create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): Promise<PolicyDefinition> {
    const row: PolicyDefinition = { ...input, createdAt: new Date(), updatedAt: new Date() };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>
  ): Promise<PolicyDefinition | undefined> {
    const existing = this.rows.find((row) => row.id === id);
    if (!existing) {
      return undefined;
    }

    Object.assign(existing, input, { updatedAt: new Date() });
    return existing;
  }

  async delete(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
  }
}

class InMemoryPolicyAssignmentRepository implements PolicyAssignmentRepository {
  constructor(private readonly rows: PolicyAssignment[]) {}

  async list(): Promise<PolicyAssignment[]> {
    return [...this.rows];
  }

  async listByPolicy(policyId: string): Promise<PolicyAssignment[]> {
    return this.rows.filter((row) => row.policyId === policyId);
  }

  async upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): Promise<PolicyAssignment> {
    const existing = this.rows.find(
      (row) => row.policyId === input.policyId && row.scopeType === input.scopeType && row.scopeId === input.scopeId
    );

    if (existing) {
      existing.enabled = input.enabled;
      existing.config = input.config;
      existing.updatedAt = new Date();
      return existing;
    }

    const created: PolicyAssignment = {
      ...input,
      id: `assignment-${this.rows.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.rows.push(created);
    return created;
  }

  async delete(policyId: string, scopeType: PolicyAssignment["scopeType"], scopeId: string): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.policyId === policyId && row.scopeType === scopeType && row.scopeId === scopeId
    );
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
  }
}

class InMemoryUserGroupAssignmentRepository implements UserGroupAssignmentRepository {
  async assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): Promise<UserGroupAssignment> {
    return {
      ...input,
      id: "group-assignment",
      createdAt: new Date()
    };
  }

  async listByUser(_userId: string): Promise<UserGroupAssignment[]> {
    return [];
  }

  async remove(_userId: string, _groupId: string): Promise<void> {
    return;
  }
}

const makeUser = (): User => ({
  id: "user-1",
  email: "unit@example.com",
  username: "unit",
  passwordHash: "hash",
  givenName: "Unit",
  familyName: "Tester",
  isServiceUser: false,
  customAttributes: {},
  active: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

const makePolicy = (input: {
  id: string;
  key: string;
  javascriptCode: string;
  effect?: "allow" | "deny";
  resourcePattern?: string;
  actionPattern?: string;
}): PolicyDefinition => ({
  id: input.id,
  key: input.key,
  name: input.key,
  description: input.key,
  category: "authorization",
  effect: input.effect,
  resourcePattern: input.resourcePattern,
  actionPattern: input.actionPattern,
  stageBindings: [],
  javascriptCode: input.javascriptCode,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

const makeGlobalAssignment = (input: {
  policyId: string;
  effect: "allow" | "deny";
  priority: number;
}): PolicyAssignment => ({
  id: `${input.policyId}-assignment`,
  policyId: input.policyId,
  scopeType: "global",
  scopeId: "global",
  enabled: true,
  config: {
    effect: input.effect,
    priority: input.priority
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

test("PolicyService applies priority ordering with first_applicable strategy", async () => {
  const definitions = [
    makePolicy({ id: "deny", key: "deny_high", javascriptCode: "return false" }),
    makePolicy({ id: "allow", key: "allow_low", javascriptCode: "return true" })
  ];
  const assignments = [
    makeGlobalAssignment({ policyId: "deny", effect: "deny", priority: 100 }),
    makeGlobalAssignment({ policyId: "allow", effect: "allow", priority: 10 })
  ];

  const service = new PolicyService(
    new InMemoryPolicyDefinitionRepository(definitions),
    new InMemoryPolicyAssignmentRepository(assignments),
    new InMemoryUserGroupAssignmentRepository()
  );

  const result = await service.evaluateAuthorizationPolicies({
    user: makeUser(),
    resource: "admin:users",
    action: "view",
    decisionStrategy: "first_applicable"
  });

  assert.equal(result.allow, false);
  assert.deepEqual(result.deniedBy, ["deny_high"]);
  assert.equal(result.decisions[0]?.key, "deny_high");
});

test("PolicyService supports allow_overrides semantics", async () => {
  const definitions = [
    makePolicy({ id: "deny", key: "deny_high", javascriptCode: "return false" }),
    makePolicy({ id: "allow", key: "allow_low", javascriptCode: "return true" })
  ];
  const assignments = [
    makeGlobalAssignment({ policyId: "deny", effect: "deny", priority: 100 }),
    makeGlobalAssignment({ policyId: "allow", effect: "allow", priority: 10 })
  ];

  const service = new PolicyService(
    new InMemoryPolicyDefinitionRepository(definitions),
    new InMemoryPolicyAssignmentRepository(assignments),
    new InMemoryUserGroupAssignmentRepository()
  );

  const result = await service.evaluateAuthorizationPolicies({
    user: makeUser(),
    resource: "admin:users",
    action: "view",
    decisionStrategy: "allow_overrides"
  });

  assert.equal(result.allow, true);
  assert.deepEqual(result.deniedBy, []);
});

test("PolicyService denies when policy script exceeds VM timeout", async () => {
  const definitions = [
    makePolicy({ id: "allow-timeout", key: "allow_timeout", javascriptCode: "while (true) {}" })
  ];
  const assignments = [
    makeGlobalAssignment({ policyId: "allow-timeout", effect: "allow", priority: 10 })
  ];

  const service = new PolicyService(
    new InMemoryPolicyDefinitionRepository(definitions),
    new InMemoryPolicyAssignmentRepository(assignments),
    new InMemoryUserGroupAssignmentRepository()
  );

  const result = await service.evaluateAuthorizationPolicies({
    user: makeUser(),
    resource: "admin:users",
    action: "view",
    decisionStrategy: "deny_overrides"
  });

  assert.equal(result.allow, false);
  assert.ok(result.deniedBy.includes("allow_timeout"));
  const timedOutDecision = result.decisions.find((item) => item.key === "allow_timeout");
  assert.equal(timedOutDecision?.allow, false);
  assert.equal(timedOutDecision?.applied, true);
  assert.match(String(timedOutDecision?.message ?? ""), /rejected request/i);
});

test("PolicyService guards against process access in policy scripts", async () => {
  const definitions = [
    makePolicy({ id: "allow-process", key: "allow_process", javascriptCode: "return process.exit(0)" })
  ];
  const assignments = [
    makeGlobalAssignment({ policyId: "allow-process", effect: "allow", priority: 10 })
  ];

  const service = new PolicyService(
    new InMemoryPolicyDefinitionRepository(definitions),
    new InMemoryPolicyAssignmentRepository(assignments),
    new InMemoryUserGroupAssignmentRepository()
  );

  const result = await service.evaluateAuthorizationPolicies({
    user: makeUser(),
    resource: "admin:users",
    action: "view",
    decisionStrategy: "deny_overrides"
  });

  assert.equal(result.allow, false);
  assert.ok(result.deniedBy.includes("allow_process"));
  const denied = result.decisions.find((item) => item.key === "allow_process");
  assert.equal(denied?.allow, false);
  assert.match(String(denied?.message ?? ""), /process is not defined|rejected request/i);
});

test("PolicyService uses definition effect/pattern and assignment strategy/priority fields", async () => {
  const definitions = [
    makePolicy({
      id: "deny-by-definition",
      key: "deny_by_definition",
      javascriptCode: "return false",
      effect: "deny",
      resourcePattern: "admin:users",
      actionPattern: "view"
    }),
    makePolicy({
      id: "allow-by-definition",
      key: "allow_by_definition",
      javascriptCode: "return true",
      effect: "allow"
    })
  ];

  const assignments: PolicyAssignment[] = [
    {
      id: "deny-assignment",
      policyId: "deny-by-definition",
      scopeType: "global",
      scopeId: "global",
      enabled: true,
      priority: 200,
      decisionStrategy: "first_applicable",
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "allow-assignment",
      policyId: "allow-by-definition",
      scopeType: "global",
      scopeId: "global",
      enabled: true,
      priority: 100,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const service = new PolicyService(
    new InMemoryPolicyDefinitionRepository(definitions),
    new InMemoryPolicyAssignmentRepository(assignments),
    new InMemoryUserGroupAssignmentRepository()
  );

  const result = await service.evaluateAuthorizationPolicies({
    user: makeUser(),
    resource: "admin:users",
    action: "view"
  });

  assert.equal(result.decisionStrategy, "first_applicable");
  assert.equal(result.allow, false);
  assert.ok(result.deniedBy.includes("deny_by_definition"));
});