import { ValidationError } from "../core/errors.js";
import type { AccessReviewCampaign, AccessReviewItem } from "../domain/models.js";
import type {
  AccessReviewCampaignRepository,
  AccessReviewItemRepository,
  GroupRepository,
  RoleRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository
} from "../repositories/contracts.js";
import { GroupService } from "./group-service.js";
import { RoleService } from "./role-service.js";

export class AccessReviewService {
  constructor(
    private readonly campaignRepository: AccessReviewCampaignRepository,
    private readonly itemRepository: AccessReviewItemRepository,
    private readonly userRepository: UserRepository,
    private readonly assignmentRepository: UserRoleAssignmentRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository,
    private readonly roleRepository: RoleRepository,
    private readonly groupRepository: GroupRepository,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService
  ) {}

  async createCampaign(input: {
    name: string;
    description?: string;
    createdByUserId: string;
    dueAt?: Date;
  }) {
    const creator = await this.userRepository.findById(input.createdByUserId);
    if (!creator) {
      throw new ValidationError("Campaign creator not found");
    }

    const name = input.name.trim();
    if (!name) {
      throw new ValidationError("Campaign name is required");
    }

    if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
      throw new ValidationError("Invalid due date");
    }

    const description = input.description?.trim() || undefined;

    const campaign = await this.campaignRepository.create({
      name,
      description,
      status: "active",
      createdByUserId: input.createdByUserId,
      dueAt: input.dueAt
    });

    const users = await this.userRepository.list();
    const seen = new Set<string>();
    let generatedItems = 0;

    for (const user of users) {
      const directRoles = await this.assignmentRepository.listByUser(user.id);
      for (const assignment of directRoles) {
        const key = `${user.id}:role:${assignment.roleId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        await this.itemRepository.create({
          campaignId: campaign.id,
          subjectUserId: user.id,
          entitlementType: "role",
          entitlementValue: assignment.roleId,
          currentState: "granted"
        });
        generatedItems += 1;
      }

      const groups = await this.userGroupAssignmentRepository.listByUser(user.id);
      for (const assignment of groups) {
        const key = `${user.id}:group:${assignment.groupId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        await this.itemRepository.create({
          campaignId: campaign.id,
          subjectUserId: user.id,
          entitlementType: "group",
          entitlementValue: assignment.groupId,
          currentState: "granted"
        });
        generatedItems += 1;
      }
    }

    return {
      campaign,
      generatedItems
    };
  }

  async getCampaign(id: string) {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new ValidationError("Review campaign not found");
    }

    const items = await this.itemRepository.listByCampaignId(id);
    return {
      campaign,
      items
    };
  }

  async decideItem(input: {
    itemId: string;
    decision: "certified" | "revoked";
    decidedByUserId: string;
    rationale?: string;
  }) {
    const decider = await this.userRepository.findById(input.decidedByUserId);
    if (!decider) {
      throw new ValidationError("Reviewer user not found");
    }

    const item = await this.itemRepository.findById(input.itemId);
    if (!item) {
      throw new ValidationError("Review item not found");
    }

    const campaign = await this.campaignRepository.findById(item.campaignId);
    if (!campaign) {
      throw new ValidationError("Review campaign not found");
    }
    if (campaign.status !== "active") {
      throw new ValidationError("Only active campaigns can accept decisions");
    }

    if (item.decision) {
      throw new ValidationError("Review item already decided");
    }

    const rationale = input.rationale?.trim() || undefined;

    if (input.decision === "revoked") {
      await this.revokeEntitlement(item);
    }

    const decided = await this.itemRepository.update(item.id, {
      decision: input.decision,
      decidedByUserId: input.decidedByUserId,
      decisionRationale: rationale,
      decidedAt: new Date()
    });

    if (!decided) {
      throw new ValidationError("Review item not found");
    }

    const remaining = (await this.itemRepository.listByCampaignId(item.campaignId)).filter((entry) => !entry.decision);
    if (remaining.length === 0) {
      await this.campaignRepository.update(item.campaignId, { status: "closed" });
    }

    return decided;
  }

  async listCampaigns(input?: { limit?: number; status?: AccessReviewCampaign["status"] }) {
    return this.campaignRepository.list(input);
  }

  private async revokeEntitlement(item: AccessReviewItem) {
    if (item.entitlementType === "role") {
      const [role] = await this.roleRepository.findByIds([item.entitlementValue]);
      if (!role) {
        return;
      }

      await this.roleService.removeRole({
        userId: item.subjectUserId,
        roleId: role.id
      });
      return;
    }

    const group = await this.groupRepository.findById(item.entitlementValue);
    if (!group) {
      return;
    }

    await this.groupService.removeUserFromGroup({
      userId: item.subjectUserId,
      groupId: group.id
    });
  }
}
