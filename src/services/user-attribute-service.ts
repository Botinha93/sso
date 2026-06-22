import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type {
  GroupRepository,
  GroupUserAttributeAssignmentRepository,
  UserAttributeRepository
} from "../repositories/contracts.js";
import type { UserAttributeType } from "../domain/models.js";
import {
  normalizeCustomAttributeMap,
  normalizeUserAttributeKey
} from "../domain/user-attribute-keys.js";

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
    const key = normalizeUserAttributeKey(input.key);

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

    const normalizedKey = input.key ? normalizeUserAttributeKey(input.key) : undefined;
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

  async setGroupAssignment(input: { attributeId: string; groupId: string; enabled: boolean; value?: string }) {
    const attribute = await this.userAttributeRepository.findById(input.attributeId);
    if (!attribute) {
      throw new ValidationError("User attribute not found");
    }

    const group = await this.groupRepository.findById(input.groupId);
    if (!group) {
      throw new ValidationError("Group not found");
    }

    this.validateAttributeValue(attribute.type, input.enabled ? input.value : undefined);

    return this.groupUserAttributeAssignmentRepository.upsert(input);
  }

  async removeGroupAssignment(input: { attributeId: string; groupId: string }) {
    await this.groupUserAttributeAssignmentRepository.delete(input.attributeId, input.groupId);
  }

  async listDefinitions() {
    return this.userAttributeRepository.list();
  }

  async listDefinitionsById() {
    const definitions = await this.userAttributeRepository.list();
    return new Map(definitions.map((definition) => [definition.id, definition]));
  }

  async listDefinitionsByKey() {
    const definitions = await this.userAttributeRepository.list();
    return new Map(definitions.map((definition) => [definition.key, definition]));
  }

  async validateCustomAttributeMap(customAttributes: Record<string, string>) {
    const definitionsByKey = await this.listDefinitionsByKey();
    const normalizedCustomAttributes = normalizeCustomAttributeMap(customAttributes);

    for (const [key, value] of Object.entries(normalizedCustomAttributes)) {
      const definition = definitionsByKey.get(key);
      if (!definition) {
        throw new ValidationError(`Unknown custom attribute: ${key}`);
      }
      if (!definition.enabled) {
        throw new ValidationError(`Custom attribute is disabled: ${key}`);
      }
      this.validateAttributeValue(definition.type, value);
    }
  }

  async resolveGroupCustomAttributes(groupId: string) {
    const definitionsById = await this.listDefinitionsById();
    const assignments = await this.groupUserAttributeAssignmentRepository.listByGroup(groupId);
    const resolved: Record<string, string> = {};

    for (const assignment of assignments) {
      if (!assignment.enabled || !assignment.value) {
        continue;
      }

      const definition = definitionsById.get(assignment.attributeId);
      if (!definition?.enabled) {
        continue;
      }

      resolved[definition.key] = assignment.value;
    }

    return resolved;
  }

  async setGroupCustomAttributes(groupId: string, customAttributes: Record<string, string>) {
    const normalizedCustomAttributes = normalizeCustomAttributeMap(customAttributes);
    const definitions = await this.userAttributeRepository.list();
    const enabledDefinitions = definitions.filter((definition) => definition.enabled);
    const definitionsByKey = new Map(enabledDefinitions.map((definition) => [definition.key, definition]));
    const existingAssignments = await this.groupUserAttributeAssignmentRepository.listByGroup(groupId);
    for (const [key, value] of Object.entries(normalizedCustomAttributes)) {
      const definition = definitionsByKey.get(key);
      if (!definition) {
        throw new ValidationError(`Unknown custom attribute: ${key}`);
      }
      this.validateAttributeValue(definition.type, value);
    }

    for (const assignment of existingAssignments) {
      const definition = definitions.find((item) => item.id === assignment.attributeId);
      if (!definition || !(definition.key in normalizedCustomAttributes)) {
        await this.groupUserAttributeAssignmentRepository.delete(assignment.attributeId, groupId);
      }
    }

    for (const [key, value] of Object.entries(normalizedCustomAttributes)) {
      const definition = definitionsByKey.get(key);
      if (!definition) {
        continue;
      }

      await this.groupUserAttributeAssignmentRepository.upsert({
        groupId,
        attributeId: definition.id,
        enabled: true,
        value
      });
    }
  }

  private validateAttributeValue(type: UserAttributeType, value: string | undefined) {
    if (value === undefined) {
      return;
    }

    if (type === "number" && Number.isNaN(Number(value))) {
      throw new ValidationError("Attribute value must be a valid number");
    }

    if (type === "boolean" && value !== "true" && value !== "false") {
      throw new ValidationError("Attribute value must be true or false");
    }

    if (type === "date" && Number.isNaN(Date.parse(value))) {
      throw new ValidationError("Attribute value must be a valid date");
    }

    if (type === "json") {
      try {
        JSON.parse(value);
      } catch {
        throw new ValidationError("Attribute value must be valid JSON");
      }
    }
  }
}
