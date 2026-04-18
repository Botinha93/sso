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

  createGroup(input: { name: string; description: string; roleIds: string[] }) {
    const roleIds = Array.from(new Set(input.roleIds));
    const knownRoles = this.roleRepository.findByIds(roleIds);

    if (knownRoles.length !== roleIds.length) {
      throw new ValidationError("One or more roleIds are invalid");
    }

    const group = this.groupRepository.create({
      name: input.name,
      description: input.description
    });

    for (const roleId of roleIds) {
      this.groupRoleAssignmentRepository.assign({
        groupId: group.id,
        roleId
      });
    }

    return group;
  }

  listGroups() {
    const groups = this.groupRepository.list();

    return groups.map((group) => {
      const roleIds = this.groupRoleAssignmentRepository.listByGroup(group.id).map((assignment) => assignment.roleId);
      const roleNames = this.roleRepository.findByIds(roleIds).map((role) => role.name);
      return {
        ...group,
        roleIds,
        roles: roleNames
      };
    });
  }

  updateGroup(id: string, input: { name?: string; description?: string }) {
    const updated = this.groupRepository.update(id, input);
    if (!updated) {
      throw new ValidationError("Group not found");
    }
    return updated;
  }

  deleteGroup(id: string) {
    this.groupRepository.delete(id);
  }

  assignRoleToGroup(input: { groupId: string; roleId: string }) {
    if (!this.groupRepository.findById(input.groupId)) {
      throw new ValidationError("Group not found");
    }

    const role = this.roleRepository.findByIds([input.roleId])[0];
    if (!role) {
      throw new ValidationError("Role not found");
    }

    return this.groupRoleAssignmentRepository.assign(input);
  }

  removeRoleFromGroup(input: { groupId: string; roleId: string }) {
    this.groupRoleAssignmentRepository.remove(input.groupId, input.roleId);
  }

  assignUserToGroup(input: { userId: string; groupId: string }) {
    if (!this.userRepository.findById(input.userId)) {
      throw new ValidationError("User not found");
    }

    if (!this.groupRepository.findById(input.groupId)) {
      throw new ValidationError("Group not found");
    }

    return this.userGroupAssignmentRepository.assign(input);
  }

  removeUserFromGroup(input: { userId: string; groupId: string }) {
    this.userGroupAssignmentRepository.remove(input.userId, input.groupId);
  }

  listGroupIdsForUser(userId: string) {
    return this.userGroupAssignmentRepository.listByUser(userId).map((assignment) => assignment.groupId);
  }

  resolveGroupNamesForUser(userId: string) {
    const ids = this.listGroupIdsForUser(userId);
    const all = this.groupRepository.list();
    const allowed = new Set(ids);
    return all.filter((group) => allowed.has(group.id)).map((group) => group.name);
  }
}
