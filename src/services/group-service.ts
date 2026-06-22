import { ValidationError } from "../core/errors.js";
import type {
  AppRepository,
  GroupAppAssignmentRepository,
  GroupUserAttributeAssignmentRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  RoleRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository
} from "../repositories/contracts.js";
import {
  normalizeCustomAttributeMap,
  normalizeUserAttributeKey
} from "../domain/user-attribute-keys.js";

export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly appRepository: AppRepository,
    private readonly groupAppAssignmentRepository: GroupAppAssignmentRepository,
    private readonly userAttributeRepository: UserAttributeRepository,
    private readonly groupUserAttributeAssignmentRepository: GroupUserAttributeAssignmentRepository,
    private readonly groupRoleAssignmentRepository: GroupRoleAssignmentRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository,
    private readonly roleRepository: RoleRepository,
    private readonly userRepository: UserRepository
  ) {}

  private normalizeAppIds(input: { appId?: string; appIds?: string[] }) {
    return Array.from(new Set(input.appIds ?? (input.appId ? [input.appId] : [])));
  }

  private async validateAppIds(appIds: string[]) {
    const apps = await this.appRepository.list();
    const known = new Set(apps.map((app) => app.id));
    if (appIds.some((appId) => !known.has(appId))) {
      throw new ValidationError("One or more appIds are invalid");
    }
  }

  private async setGroupAppAssignments(groupId: string, appIds: string[]) {
    const existingAssignments = await this.groupAppAssignmentRepository.listByGroup(groupId);
    const next = new Set(appIds);

    for (const assignment of existingAssignments) {
      if (!next.has(assignment.appId)) {
        await this.groupAppAssignmentRepository.remove(groupId, assignment.appId);
      }
    }

    for (const appId of appIds) {
      await this.groupAppAssignmentRepository.assign({ groupId, appId });
    }
  }

  private async validateCustomAttributes(customAttributes: Record<string, string>) {
    const definitions = await this.userAttributeRepository.list();
    const definitionsByKey = new Map(definitions.filter((definition) => definition.enabled).map((definition) => [definition.key, definition]));

    for (const [key, value] of Object.entries(customAttributes)) {
      const definition = definitionsByKey.get(normalizeUserAttributeKey(key));
      if (!definition) {
        throw new ValidationError(`Unknown custom attribute: ${key}`);
      }

      if (definition.type === "number" && Number.isNaN(Number(value))) {
        throw new ValidationError(`Custom attribute ${key} must be a valid number`);
      }

      if (definition.type === "boolean" && value !== "true" && value !== "false") {
        throw new ValidationError(`Custom attribute ${key} must be true or false`);
      }

      if (definition.type === "date" && Number.isNaN(Date.parse(value))) {
        throw new ValidationError(`Custom attribute ${key} must be a valid date`);
      }

      if (definition.type === "json") {
        try {
          JSON.parse(value);
        } catch {
          throw new ValidationError(`Custom attribute ${key} must be valid JSON`);
        }
      }
    }
  }

  private async setGroupCustomAttributes(groupId: string, customAttributes: Record<string, string>) {
    const normalizedCustomAttributes = normalizeCustomAttributeMap(customAttributes);
    const definitions = await this.userAttributeRepository.list();
    const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const existingAssignments = await this.groupUserAttributeAssignmentRepository.listByGroup(groupId);

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

  async resolveCustomAttributesForGroup(groupId: string) {
    const definitions = await this.userAttributeRepository.list();
    const definitionsById = new Map(definitions.filter((definition) => definition.enabled).map((definition) => [definition.id, definition]));
    const assignments = await this.groupUserAttributeAssignmentRepository.listByGroup(groupId);
    const customAttributes: Record<string, string> = {};

    for (const assignment of assignments) {
      if (!assignment.enabled || assignment.value === undefined) {
        continue;
      }

      const definition = definitionsById.get(assignment.attributeId);
      if (!definition) {
        continue;
      }

      customAttributes[definition.key] = assignment.value;
    }

    return customAttributes;
  }

  async createGroup(input: {
    appId?: string;
    appIds?: string[];
    externalSource?: string;
    externalId?: string;
    name: string;
    description: string;
    customAttributes?: Record<string, string>;
    roleIds: string[];
  }) {
    const appIds = this.normalizeAppIds(input);
    const roleIds = Array.from(new Set(input.roleIds));
    const knownRoles = await this.roleRepository.findByIds(roleIds);
    const customAttributes = normalizeCustomAttributeMap(input.customAttributes);

    await this.validateAppIds(appIds);
    await this.validateCustomAttributes(customAttributes);

    if (knownRoles.length !== roleIds.length) {
      throw new ValidationError("One or more roleIds are invalid");
    }

    const group = await this.groupRepository.create({
      appId: appIds[0],
      appIds,
      customAttributes,
      externalSource: input.externalSource,
      externalId: input.externalId,
      name: input.name,
      description: input.description
    });

    await this.setGroupAppAssignments(group.id, appIds);
    await this.setGroupCustomAttributes(group.id, customAttributes);

    for (const roleId of roleIds) {
      await this.groupRoleAssignmentRepository.assign({
        groupId: group.id,
        roleId
      });
    }

    return group;
  }

  async listGroups() {
    const groups = await this.groupRepository.list();

    return Promise.all(groups.map(async (group) => {
      const assignedAppIds = (await this.groupAppAssignmentRepository.listByGroup(group.id)).map((assignment) => assignment.appId);
      const appIds = assignedAppIds.length > 0 ? assignedAppIds : (group.appId ? [group.appId] : []);
      const customAttributes = await this.resolveCustomAttributesForGroup(group.id);
      const roleIds = (await this.groupRoleAssignmentRepository.listByGroup(group.id)).map((assignment) => assignment.roleId);
      const roleNames = (await this.roleRepository.findByIds(roleIds)).map((role) => role.name);
      return {
        ...group,
        appId: appIds[0],
        appIds,
        customAttributes,
        roleIds,
        roles: roleNames
      };
    }));
  }

  async updateGroup(id: string, input: {
    appId?: string;
    appIds?: string[];
    externalSource?: string;
    externalId?: string;
    name?: string;
    description?: string;
    customAttributes?: Record<string, string>;
  }) {
    const appIds = input.appId !== undefined || input.appIds !== undefined
      ? this.normalizeAppIds(input)
      : undefined;

    if (appIds) {
      await this.validateAppIds(appIds);
    }
    if (input.customAttributes) {
      await this.validateCustomAttributes(normalizeCustomAttributeMap(input.customAttributes));
    }

    const updated = await this.groupRepository.update(id, {
      ...input,
      appId: appIds ? appIds[0] : input.appId
    });
    if (!updated) {
      throw new ValidationError("Group not found");
    }
    if (appIds) {
      await this.setGroupAppAssignments(id, appIds);
    }
    if (input.customAttributes) {
      await this.setGroupCustomAttributes(id, input.customAttributes);
    }
    if (appIds || input.customAttributes) {
      return {
        ...updated,
        appId: appIds ? appIds[0] : updated.appId,
        appIds: appIds ?? updated.appIds,
        customAttributes: input.customAttributes ?? await this.resolveCustomAttributesForGroup(id)
      };
    }
    return updated;
  }

  async findGroupById(id: string) {
    return this.groupRepository.findById(id);
  }

  async deleteGroup(id: string) {
    const users = await this.userRepository.list();
    for (const user of users) {
      const assignments = await this.userGroupAssignmentRepository.listByUser(user.id);
      if (assignments.some((assignment) => assignment.groupId === id)) {
        await this.userGroupAssignmentRepository.remove(user.id, id);
      }
    }

    const roleAssignments = await this.groupRoleAssignmentRepository.listByGroup(id);
    for (const assignment of roleAssignments) {
      await this.groupRoleAssignmentRepository.remove(id, assignment.roleId);
    }

    const appAssignments = await this.groupAppAssignmentRepository.listByGroup(id);
    for (const assignment of appAssignments) {
      await this.groupAppAssignmentRepository.remove(id, assignment.appId);
    }

    const attributeAssignments = await this.groupUserAttributeAssignmentRepository.listByGroup(id);
    for (const assignment of attributeAssignments) {
      await this.groupUserAttributeAssignmentRepository.delete(assignment.attributeId, id);
    }

    await this.groupRepository.delete(id);
  }

  async assignRoleToGroup(input: { groupId: string; roleId: string }) {
    if (!await this.groupRepository.findById(input.groupId)) {
      throw new ValidationError("Group not found");
    }

    const role = (await this.roleRepository.findByIds([input.roleId]))[0];
    if (!role) {
      throw new ValidationError("Role not found");
    }

    return this.groupRoleAssignmentRepository.assign(input);
  }

  async removeRoleFromGroup(input: { groupId: string; roleId: string }) {
    await this.groupRoleAssignmentRepository.remove(input.groupId, input.roleId);
  }

  async assignUserToGroup(input: { userId: string; groupId: string }) {
    if (!await this.userRepository.findById(input.userId)) {
      throw new ValidationError("User not found");
    }

    if (!await this.groupRepository.findById(input.groupId)) {
      throw new ValidationError("Group not found");
    }

    return this.userGroupAssignmentRepository.assign(input);
  }

  async removeUserFromGroup(input: { userId: string; groupId: string }) {
    await this.userGroupAssignmentRepository.remove(input.userId, input.groupId);
  }

  async listGroupIdsForUser(userId: string) {
    return (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
  }

  async resolveGroupNamesForUser(userId: string) {
    const ids = await this.listGroupIdsForUser(userId);
    const all = await this.groupRepository.list();
    const allowed = new Set(ids);
    return all.filter((group) => allowed.has(group.id)).map((group) => group.name);
  }

  async resolveGroupsForUser(userId: string) {
    const ids = await this.listGroupIdsForUser(userId);
    const all = await this.groupRepository.list();
    const allowed = new Set(ids);
    return all
      .filter((group) => allowed.has(group.id))
      .map((group) => ({ id: group.id, name: group.name, description: group.description }));
  }

  async listUserIdsForGroup(groupId: string) {
    return (await this.userGroupAssignmentRepository.listByGroup(groupId)).map((assignment) => assignment.userId);
  }

  async resolveAppIdsForGroups(groupIds: string[]) {
    const groups = await Promise.all(groupIds.map((groupId) => this.groupRepository.findById(groupId)));
    const assignments = await this.groupAppAssignmentRepository.listByGroups(groupIds);
    const assignedAppIds = assignments.map((assignment) => assignment.appId);
    const legacyAppIds = groups.flatMap((group) => group?.appId ? [group.appId] : []);
    return Array.from(new Set([...legacyAppIds, ...assignedAppIds]));
  }

  async resolveAppSourcesForGroups(groupIds: string[]) {
    if (groupIds.length === 0) return [];

    const groups = await Promise.all(groupIds.map((groupId) => this.groupRepository.findById(groupId)));
    const groupsById = new Map(groups.filter((group): group is NonNullable<typeof group> => Boolean(group)).map((group) => [group.id, group]));
    const assignments = await this.groupAppAssignmentRepository.listByGroups(groupIds);

    const sources: Array<{ appId: string; groupId: string; groupName: string }> = [];
    const seen = new Set<string>();

    const addSource = (appId: string, groupId: string) => {
      const group = groupsById.get(groupId);
      if (!group) return;
      const key = `${appId}::${groupId}`;
      if (seen.has(key)) return;
      seen.add(key);
      sources.push({ appId, groupId, groupName: group.name });
    };

    for (const assignment of assignments) {
      addSource(assignment.appId, assignment.groupId);
    }

    for (const group of groupsById.values()) {
      if (group.appId) addSource(group.appId, group.id);
    }

    return sources;
  }
}
