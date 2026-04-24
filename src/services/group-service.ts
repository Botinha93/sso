import { ValidationError } from "../core/errors.js";
import type {
  AppRepository,
  GroupAppAssignmentRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  RoleRepository,
  UserGroupAssignmentRepository,
  UserRepository
} from "../repositories/contracts.js";

export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly appRepository: AppRepository,
    private readonly groupAppAssignmentRepository: GroupAppAssignmentRepository,
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

  async createGroup(input: {
    appId?: string;
    appIds?: string[];
    externalSource?: string;
    externalId?: string;
    name: string;
    description: string;
    roleIds: string[];
  }) {
    const appIds = this.normalizeAppIds(input);
    const roleIds = Array.from(new Set(input.roleIds));
    const knownRoles = await this.roleRepository.findByIds(roleIds);

    await this.validateAppIds(appIds);

    if (knownRoles.length !== roleIds.length) {
      throw new ValidationError("One or more roleIds are invalid");
    }

    const group = await this.groupRepository.create({
      appId: appIds[0],
      appIds,
      externalSource: input.externalSource,
      externalId: input.externalId,
      name: input.name,
      description: input.description
    });

    await this.setGroupAppAssignments(group.id, appIds);

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
      const roleIds = (await this.groupRoleAssignmentRepository.listByGroup(group.id)).map((assignment) => assignment.roleId);
      const roleNames = (await this.roleRepository.findByIds(roleIds)).map((role) => role.name);
      return {
        ...group,
        appId: appIds[0],
        appIds,
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
  }) {
    const appIds = input.appId !== undefined || input.appIds !== undefined
      ? this.normalizeAppIds(input)
      : undefined;

    if (appIds) {
      await this.validateAppIds(appIds);
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
      return { ...updated, appId: appIds[0], appIds };
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

  async resolveAppIdsForGroups(groupIds: string[]) {
    const groups = await Promise.all(groupIds.map((groupId) => this.groupRepository.findById(groupId)));
    const assignments = await this.groupAppAssignmentRepository.listByGroups(groupIds);
    const assignedAppIds = assignments.map((assignment) => assignment.appId);
    const legacyAppIds = groups.flatMap((group) => group?.appId ? [group.appId] : []);
    return Array.from(new Set([...legacyAppIds, ...assignedAppIds]));
  }
}
