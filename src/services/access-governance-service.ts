import { ValidationError } from "../core/errors.js";
import type { AccessRequest } from "../domain/models.js";
import type { GroupRepository, RoleRepository } from "../repositories/contracts.js";
import type { AccessRequestApprovalRepository, AccessRequestRepository, UserRepository } from "../repositories/contracts.js";
import { GroupService } from "./group-service.js";
import { RoleService } from "./role-service.js";

export class AccessGovernanceService {
  constructor(
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly accessRequestApprovalRepository: AccessRequestApprovalRepository,
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly groupRepository: GroupRepository,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService
  ) {}

  async listAccessRequests(input?: { limit?: number; status?: AccessRequest["status"] }) {
    return this.accessRequestRepository.list(input);
  }

  async createAccessRequest(input: {
    requesterId: string;
    subjectUserId: string;
    entitlementType: string;
    entitlementValue: string;
    justification: string;
    expiresAt?: Date;
  }) {
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester) {
      throw new ValidationError("Requester user not found");
    }

    const subject = await this.userRepository.findById(input.subjectUserId);
    if (!subject) {
      throw new ValidationError("Subject user not found");
    }

    const entitlementType = input.entitlementType.trim();
    const entitlementValue = input.entitlementValue.trim();
    const justification = input.justification.trim();

    if (!entitlementType) {
      throw new ValidationError("Entitlement type is required");
    }
    if (!entitlementValue) {
      throw new ValidationError("Entitlement value is required");
    }
    if (!justification) {
      throw new ValidationError("Justification is required");
    }

    if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) {
      throw new ValidationError("Invalid expiration date");
    }

    const normalizedEntitlementType = entitlementType.toLowerCase();
    if (normalizedEntitlementType !== "role" && normalizedEntitlementType !== "group") {
      throw new ValidationError("Entitlement type must be role or group");
    }

    return this.accessRequestRepository.create({
      requesterId: input.requesterId,
      subjectUserId: input.subjectUserId,
      entitlementType: normalizedEntitlementType,
      entitlementValue,
      status: "pending",
      justification,
      expiresAt: input.expiresAt
    });
  }

  async approveAccessRequest(input: {
    accessRequestId: string;
    approverId: string;
    rationale?: string;
  }) {
    return this.decideAccessRequest({
      ...input,
      decision: "approved"
    });
  }

  async rejectAccessRequest(input: {
    accessRequestId: string;
    approverId: string;
    rationale?: string;
  }) {
    return this.decideAccessRequest({
      ...input,
      decision: "rejected"
    });
  }

  private async decideAccessRequest(input: {
    accessRequestId: string;
    approverId: string;
    decision: "approved" | "rejected";
    rationale?: string;
  }) {
    const approver = await this.userRepository.findById(input.approverId);
    if (!approver) {
      throw new ValidationError("Approver user not found");
    }

    const request = await this.accessRequestRepository.findById(input.accessRequestId);
    if (!request) {
      throw new ValidationError("Access request not found");
    }

    if (request.status !== "pending") {
      throw new ValidationError("Only pending access requests can be decided");
    }

    const rationale = input.rationale?.trim();

    if (input.decision === "approved") {
      await this.applyEntitlementGrant(request);
    }

    await this.accessRequestApprovalRepository.create({
      accessRequestId: request.id,
      approverId: input.approverId,
      decision: input.decision,
      rationale: rationale || undefined
    });

    const updated = await this.accessRequestRepository.update(request.id, {
      status: input.decision
    });

    if (!updated) {
      throw new ValidationError("Access request not found");
    }

    return updated;
  }

  async processExpiredAccessRequests(input?: { dryRun?: boolean; now?: Date }) {
    const now = input?.now ?? new Date();
    const dryRun = input?.dryRun ?? false;
    const approved = await this.accessRequestRepository.list({ limit: 500, status: "approved" });
    const expired = approved.filter((request) => request.expiresAt && request.expiresAt.getTime() <= now.getTime());

    let revoked = 0;
    for (const request of expired) {
      if (!dryRun) {
        await this.revokeEntitlementGrant(request);
        await this.accessRequestRepository.update(request.id, {
          status: "expired"
        });
      }
      revoked += 1;
    }

    return {
      dryRun,
      evaluatedApprovedRequests: approved.length,
      expiredRequests: expired.length,
      revokedAssignments: revoked
    };
  }

  private async applyEntitlementGrant(request: AccessRequest) {
    if (request.entitlementType === "role") {
      const role = await this.resolveRoleByEntitlementValue(request.entitlementValue);
      if (!role) {
        throw new ValidationError("Entitlement role not found");
      }

      await this.roleService.assignRole({
        userId: request.subjectUserId,
        roleId: role.id
      });
      return;
    }

    if (request.entitlementType === "group") {
      const group = await this.resolveGroupByEntitlementValue(request.entitlementValue);
      if (!group) {
        throw new ValidationError("Entitlement group not found");
      }

      await this.groupService.assignUserToGroup({
        userId: request.subjectUserId,
        groupId: group.id
      });
      return;
    }

    throw new ValidationError("Unsupported entitlement type");
  }

  private async revokeEntitlementGrant(request: AccessRequest) {
    if (request.entitlementType === "role") {
      const role = await this.resolveRoleByEntitlementValue(request.entitlementValue);
      if (!role) {
        return;
      }

      await this.roleService.removeRole({
        userId: request.subjectUserId,
        roleId: role.id
      });
      return;
    }

    if (request.entitlementType === "group") {
      const group = await this.resolveGroupByEntitlementValue(request.entitlementValue);
      if (!group) {
        return;
      }

      await this.groupService.removeUserFromGroup({
        userId: request.subjectUserId,
        groupId: group.id
      });
    }
  }

  private async resolveRoleByEntitlementValue(entitlementValue: string) {
    const roles = await this.roleRepository.list();
    return roles.find((role) => role.id === entitlementValue || role.name === entitlementValue);
  }

  private async resolveGroupByEntitlementValue(entitlementValue: string) {
    const groups = await this.groupRepository.list();
    return groups.find((group) => group.id === entitlementValue || group.name === entitlementValue);
  }
}
