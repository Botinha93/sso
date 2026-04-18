import { ValidationError } from "../core/errors.js";
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

  createRole(input: {
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

  listRoles() {
    return this.roleRepository.list();
  }

  assignRole(input: { userId: string; roleId: string; tenantId?: string }) {
    if (input.tenantId && !this.tenantRepository.findById(input.tenantId)) {
      throw new ValidationError("Tenant not found for role assignment");
    }

    return this.assignmentRepository.assign(input);
  }

  resolveNamesForUser(userId: string, tenantId?: string) {
    const assignments = this.assignmentRepository.listByUser(userId);
    const matchingRoleIds = assignments
      .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
      .map((assignment) => assignment.roleId);

    const userGroups = this.userGroupAssignmentRepository.listByUser(userId).map((assignment) => assignment.groupId);
    const groupRoleIds = this.groupRoleAssignmentRepository
      .listByGroups(userGroups)
      .map((assignment) => assignment.roleId);

    const effectiveRoleIds = Array.from(new Set([...matchingRoleIds, ...groupRoleIds]));

    return this.roleRepository.findByIds(effectiveRoleIds).map((role) => role.name);
  }

  resolvePermissionsForUser(userId: string, tenantId?: string) {
    const assignments = this.assignmentRepository.listByUser(userId);
    const matchingRoleIds = assignments
      .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
      .map((assignment) => assignment.roleId);

    const userGroups = this.userGroupAssignmentRepository.listByUser(userId).map((assignment) => assignment.groupId);
    const groupRoleIds = this.groupRoleAssignmentRepository
      .listByGroups(userGroups)
      .map((assignment) => assignment.roleId);

    const effectiveRoleIds = Array.from(new Set([...matchingRoleIds, ...groupRoleIds]));
    const permissions = this.roleRepository.findByIds(effectiveRoleIds).flatMap((role) => role.permissions);
    return Array.from(new Set(permissions));
  }

  listAssignmentsForUser(userId: string) {
    return this.assignmentRepository.listByUser(userId);
  }

  deleteRole(id: string) {
    this.roleRepository.delete(id);
  }

  updateRole(id: string, input: { appId?: string; name?: string; description?: string; permissions?: string[]; scope?: "platform" | "tenant" }) {
    return this.roleRepository.update(id, input);
  }
}
