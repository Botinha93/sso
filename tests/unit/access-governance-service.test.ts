import test from "node:test";
import assert from "node:assert/strict";
import { AccessGovernanceService } from "../../src/services/access-governance-service.js";

test("access governance service enforces pending-only decisions", async () => {
  const accessRequests = new Map<string, any>([
    [
      "ar_pending",
      {
        id: "ar_pending",
        requesterId: "u_requester",
        subjectUserId: "u_subject",
        entitlementType: "role",
        entitlementValue: "role_finance_temp",
        status: "pending",
        justification: "Need finance approval access",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:00:00.000Z")
      }
    ],
    [
      "ar_done",
      {
        id: "ar_done",
        requesterId: "u_requester",
        subjectUserId: "u_subject",
        entitlementType: "role",
        entitlementValue: "role_finance_temp",
        status: "approved",
        justification: "Need finance approval access",
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
        updatedAt: new Date("2026-04-20T10:05:00.000Z")
      }
    ]
  ]);

  const approvals: Array<{ accessRequestId: string; decision: string; approverId: string; rationale?: string }> = [];
  const roleRemovals: Array<{ userId: string; roleId: string }> = [];

  const service = new AccessGovernanceService(
    {
      list: async () => Array.from(accessRequests.values()),
      findById: async (id: string) => accessRequests.get(id),
      create: async () => {
        throw new Error("not needed in this test");
      },
      update: async (id: string, input: any) => {
        const existing = accessRequests.get(id);
        if (!existing) {
          return undefined;
        }
        const updated = {
          ...existing,
          ...input,
          updatedAt: new Date("2026-04-20T11:00:00.000Z")
        };
        accessRequests.set(id, updated);
        return updated;
      }
    },
    {
      listByAccessRequestId: async (accessRequestId: string) => approvals.filter((entry) => entry.accessRequestId === accessRequestId) as any,
      create: async (input: any) => {
        approvals.push(input);
        return {
          id: `appr_${approvals.length}`,
          ...input,
          createdAt: new Date("2026-04-20T11:00:00.000Z")
        };
      }
    },
    {
      findById: async (id: string) => (id === "u_approver" || id === "u_requester" || id === "u_subject"
        ? {
            id,
            email: `${id}@example.com`,
            username: id,
            passwordHash: "hash",
            givenName: "Test",
            familyName: "User",
            customAttributes: {},
            active: true,
            isServiceUser: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        : undefined),
      list: async () => [],
      create: async () => {
        throw new Error("not needed in this test");
      },
      findByEmail: async () => undefined,
      findByUsername: async () => undefined,
      findByLoginIdentifier: async () => [],
      updateProfile: async () => undefined,
      setPasswordHash: async () => undefined,
      setActive: async () => undefined,
      setCustomAttributes: async () => undefined,
      delete: async () => undefined
    },
    {
      list: async () => [{ id: "role_finance_temp", name: "finance_temp" }] as any,
      create: async () => {
        throw new Error("not needed in this test");
      },
      update: async () => undefined,
      findByIds: async () => [],
      findByName: async () => undefined,
      delete: async () => undefined
    } as any,
    {
      list: async () => [],
      create: async () => {
        throw new Error("not needed in this test");
      },
      findById: async () => undefined,
      update: async () => undefined,
      delete: async () => undefined
    } as any,
    {
      assignRole: async () => undefined,
      removeRole: async (input: { userId: string; roleId: string }) => {
        roleRemovals.push(input);
      }
    } as any,
    {
      assignUserToGroup: async () => undefined,
      removeUserFromGroup: async () => undefined
    } as any
  );

  const approved = await service.approveAccessRequest({
    accessRequestId: "ar_pending",
    approverId: "u_approver",
    rationale: "Business owner signoff recorded"
  });

  assert.equal(approved.status, "approved");
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].decision, "approved");

  await assert.rejects(
    () => service.rejectAccessRequest({
      accessRequestId: "ar_done",
      approverId: "u_approver",
      rationale: "Should fail"
    }),
    /Only pending access requests can be decided/
  );

  accessRequests.set("ar_expired", {
    id: "ar_expired",
    requesterId: "u_requester",
    subjectUserId: "u_subject",
    entitlementType: "role",
    entitlementValue: "role_finance_temp",
    status: "approved",
    justification: "temporary",
    expiresAt: new Date("2026-04-20T09:00:00.000Z"),
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-20T08:00:00.000Z")
  });

  const expiryResult = await service.processExpiredAccessRequests({ now: new Date("2026-04-20T10:00:00.000Z") });
  assert.equal(expiryResult.expiredRequests, 1);
  assert.equal(expiryResult.revokedAssignments, 1);
  assert.equal(roleRemovals.length, 1);
  assert.deepEqual(roleRemovals[0], { userId: "u_subject", roleId: "role_finance_temp" });
});
