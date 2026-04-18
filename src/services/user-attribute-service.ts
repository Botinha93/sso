import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type {
  GroupRepository,
  GroupUserAttributeAssignmentRepository,
  UserAttributeRepository
} from "../repositories/contracts.js";
import type { UserAttributeType } from "../domain/models.js";

export class UserAttributeService {
  constructor(
    private readonly userAttributeRepository: UserAttributeRepository,
    private readonly groupUserAttributeAssignmentRepository: GroupUserAttributeAssignmentRepository,
    private readonly groupRepository: GroupRepository
  ) {}

  async listAttributes() {
    const groups = await this.groupRepository.list();
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
    const attributes = await this.userAttributeRepository.list();

    return Promise.all(attributes.map(async (attribute) => {
      const assignments = (await this.groupUserAttributeAssignmentRepository.listByAttribute(attribute.id)).map((assignment) => ({
        ...assignment,
        groupName: groupNameById.get(assignment.groupId) ?? assignment.groupId
      }));

      return {
        ...attribute,
        assignments
      };
    }));
  }

  async createAttribute(input: {
    key: string;
    name: string;
    description: string;
    type: UserAttributeType;
    enabled: boolean;
  }) {
    const key = this.normalizeKey(input.key);

    if (await this.userAttributeRepository.findByKey(key)) {
      throw new ValidationError("User attribute key already exists");
    }

    return this.userAttributeRepository.create({
      id: nanoid(),
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      enabled: input.enabled
    });
  }

  async updateAttribute(
    id: string,
    input: {
      key?: string;
      name?: string;
      description?: string;
      type?: UserAttributeType;
      enabled?: boolean;
    }
  ) {
    const existing = await this.userAttributeRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User attribute not found");
    }

    const normalizedKey = input.key ? this.normalizeKey(input.key) : undefined;
    if (normalizedKey && normalizedKey !== existing.key) {
      const duplicate = await this.userAttributeRepository.findByKey(normalizedKey);
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError("User attribute key already exists");
      }
    }

    const updated = await this.userAttributeRepository.update(id, {
      key: normalizedKey,
      name: input.name?.trim(),
      description: input.description?.trim(),
      type: input.type,
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Failed to update user attribute");
    }

    return updated;
  }

  async deleteAttribute(id: string) {
    await this.userAttributeRepository.delete(id);
  }

  async setGroupAssignment(input: { attributeId: string; groupId: string; enabled: boolean }) {
    const attribute = await this.userAttributeRepository.findById(input.attributeId);
    if (!attribute) {
      throw new ValidationError("User attribute not found");
    }

    const group = await this.groupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationError("Group not found");
    }

    return this.groupUserAttributeAssignmentRepository.upsert(input);
  }

  async removeGroupAssignment(input: { attributeId: string; groupId: string }) {
    await this.groupUserAttributeAssignmentRepository.delete(input.attributeId, input.groupId);
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!normalized || normalized.length < 2) {
      throw new ValidationError("Attribute key must be at least 2 characters");
    }
    return normalized;
  }
}
