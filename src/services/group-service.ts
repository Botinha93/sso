import { ValidationError } from "../core/errors.js";
import type {
  GroupRepository,
  GroupRoleAssignmentRepository,
  RoleRepository,
  UserGroupAssignmentRepository,
  UserRepository
} from "../repositories/contracts.js";

export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly groupRoleAssignmentRepository: GroupRoleAssignmentRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository,
    private readonly roleRepository: RoleRepository,
    private readonly userRepository: UserRepository
  ) {}

  async createGroup(input: { appId?: string; name: string; description: string; roleIds: string[] }) {
    const roleIds = Array.from(new Set(input.roleIds));
    const knownRoles = await this.roleRepository.findByIds(roleIds);

    if (knownRoles.length !== roleIds.length) {
      throw new ValidationError("One or more roleIds are invalid");
    }

    const group = await this.groupRepository.create({
      appId: input.appId,
      name: input.name,
      description: input.description
    });

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
      const roleIds = (await this.groupRoleAssignmentRepository.listByGroup(group.id)).map((assignment) => assignment.roleId);
      const roleNames = (await this.roleRepository.findByIds(roleIds)).map((role) => role.name);
      return {
        ...group,
        roleIds,
        roles: roleNames
      };
    }));
  }

  async updateGroup(id: string, input: { appId?: string; name?: string; description?: string }) {
    const updated = await this.groupRepository.update(id, input);
    if (!updated) {
      throw new ValidationError("Group not found");
    }
    return updated;
  }

  async deleteGroup(id: string) {
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
}
