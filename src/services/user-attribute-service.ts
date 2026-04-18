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

  listAttributes() {
    const groups = this.groupRepository.list();
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

    return this.userAttributeRepository.list().map((attribute) => {
      const assignments = this.groupUserAttributeAssignmentRepository.listByAttribute(attribute.id).map((assignment) => ({
        ...assignment,
        groupName: groupNameById.get(assignment.groupId) ?? assignment.groupId
      }));

      return {
        ...attribute,
        assignments
      };
    });
  }

  createAttribute(input: {
    key: string;
    name: string;
    description: string;
    type: UserAttributeType;
    enabled: boolean;
  }) {
    const key = this.normalizeKey(input.key);

    if (this.userAttributeRepository.findByKey(key)) {
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

  updateAttribute(
    id: string,
    input: {
      key?: string;
      name?: string;
      description?: string;
      type?: UserAttributeType;
      enabled?: boolean;
    }
  ) {
    const existing = this.userAttributeRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User attribute not found");
    }

    const normalizedKey = input.key ? this.normalizeKey(input.key) : undefined;
    if (normalizedKey && normalizedKey !== existing.key) {
      const duplicate = this.userAttributeRepository.findByKey(normalizedKey);
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError("User attribute key already exists");
      }
    }

    const updated = this.userAttributeRepository.update(id, {
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

  deleteAttribute(id: string) {
    this.userAttributeRepository.delete(id);
  }

  setGroupAssignment(input: { attributeId: string; groupId: string; enabled: boolean }) {
    const attribute = this.userAttributeRepository.findById(input.attributeId);
    if (!attribute) {
      throw new ValidationError("User attribute not found");
    }

    const group = this.groupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationError("Group not found");
    }

    return this.groupUserAttributeAssignmentRepository.upsert(input);
  }

  removeGroupAssignment(input: { attributeId: string; groupId: string }) {
    this.groupUserAttributeAssignmentRepository.delete(input.attributeId, input.groupId);
  }

  private normalizeKey(key: string) {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!normalized || normalized.length < 2) {
      throw new ValidationError("Attribute key must be at least 2 characters");
    }
    return normalized;
  }
}
