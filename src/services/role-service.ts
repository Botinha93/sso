import { ValidationError } from "../core/errors.js";
import { canonicalizeRolePermissionDetails, flattenRolePermissions } from "../domain/permissions.js";
import type {
  GroupRoleAssignmentRepository,
  TenantRepository,
  UserGroupAssignmentRepository,
  UserRoleAssignmentRepository,
  RoleRepository
} from "../repositories/contracts.js";

export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly assignmentRepository: UserRoleAssignmentRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository,
    private readonly groupRoleAssignmentRepository: GroupRoleAssignmentRepository
  ) {}

  async createRole(input: {
    appId?: string;
    name: string;
    description: string;
    permissions: string[];
    scope: "platform" | "tenant";
  }) {
    if (!input.permissions.length) {
      throw new ValidationError("Role must include at least one permission");
    }

    return this.roleRepository.create(input);
  }

  async listRoles() {
    return this.roleRepository.list();
  }

  async assignRole(input: { userId: string; roleId: string; tenantId?: string }) {
    if (input.tenantId && !await this.tenantRepository.findById(input.tenantId)) {
      throw new ValidationError("Tenant not found for role assignment");
    }

    return this.assignmentRepository.assign(input);
  }

  async removeRole(input: { userId: string; roleId: string; tenantId?: string }) {
    await this.assignmentRepository.remove(input);
  }

  async resolveNamesForUser(userId: string, tenantId?: string) {
    const assignments = await this.assignmentRepository.listByUser(userId);
    const matchingRoleIds = assignments
      .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
      .map((assignment) => assignment.roleId);

    const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
    return this.resolveNamesForAssignments(matchingRoleIds, userGroups);
  }

  async resolvePermissionsForUser(userId: string, tenantId?: string) {
    const assignments = await this.assignmentRepository.listByUser(userId);
    const matchingRoleIds = assignments
      .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
      .map((assignment) => assignment.roleId);

    const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
    return this.resolvePermissionsForAssignments(matchingRoleIds, userGroups);
  }

  async resolveRolePermissionDetailsForUser(userId: string, tenantId?: string) {
    const assignments = await this.assignmentRepository.listByUser(userId);
    const matchingRoleIds = assignments
      .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
      .map((assignment) => assignment.roleId);

    const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
    return this.resolveRolePermissionDetailsForAssignments(matchingRoleIds, userGroups);
  }

  private async resolveEffectiveRoleIds(roleIds: string[], groupIds: string[]) {
    const groupRoleIds = (await this.groupRoleAssignmentRepository
      .listByGroups(groupIds))
      .map((assignment) => assignment.roleId);

    return Array.from(new Set([...roleIds, ...groupRoleIds]));
  }

  async resolveNamesForAssignments(roleIds: string[], groupIds: string[]) {
    const effectiveRoleIds = await this.resolveEffectiveRoleIds(roleIds, groupIds);
    return (await this.roleRepository.findByIds(effectiveRoleIds)).map((role) => role.name);
  }

  async resolvePermissionsForAssignments(roleIds: string[], groupIds: string[]) {
    const effectiveRoleIds = await this.resolveEffectiveRoleIds(roleIds, groupIds);
    const roles = await this.roleRepository.findByIds(effectiveRoleIds);
    return flattenRolePermissions(roles);
  }

  async resolveRolePermissionDetailsForAssignments(roleIds: string[], groupIds: string[]) {
    const effectiveRoleIds = await this.resolveEffectiveRoleIds(roleIds, groupIds);
    const roles = await this.roleRepository.findByIds(effectiveRoleIds);

    return roles.map((role) => canonicalizeRolePermissionDetails({
      id: role.id,
      name: role.name,
      scope: role.scope,
      appId: role.appId,
      permissions: role.permissions
    }));
  }

  async listAssignmentsForUser(userId: string) {
    return this.assignmentRepository.listByUser(userId);
  }

  async deleteRole(id: string) {
    await this.roleRepository.delete(id);
  }

  async updateRole(id: string, input: { appId?: string; name?: string; description?: string; permissions?: string[]; scope?: "platform" | "tenant" }) {
    return this.roleRepository.update(id, input);
  }
}
