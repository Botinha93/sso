import type { DeprovisioningQueueRepository } from "../repositories/contracts.js";

export class DeprovisioningService {
  constructor(private readonly deprovisioningQueueRepository: DeprovisioningQueueRepository) {}

  async listQueue(limit = 100) {
    return this.deprovisioningQueueRepository.list(limit);
  }

  async enqueueUserOffboard(input: { userId: string; source: "scim" | "admin" }) {
    return this.deprovisioningQueueRepository.enqueue({
      subjectType: "user",
      subjectId: input.userId,
      actionType: "user_offboard",
      status: "pending",
      payload: {
        source: input.source,
        requestedAt: new Date().toISOString()
      },
      processedAt: undefined,
      error: undefined
    });
  }

  async enqueueGroupCleanup(input: { groupId: string; source: "scim" | "admin" }) {
    return this.deprovisioningQueueRepository.enqueue({
      subjectType: "group",
      subjectId: input.groupId,
      actionType: "group_cleanup",
      status: "pending",
      payload: {
        source: input.source,
        requestedAt: new Date().toISOString()
      },
      processedAt: undefined,
      error: undefined
    });
  }
}
