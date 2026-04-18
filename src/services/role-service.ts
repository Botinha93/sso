import { ValidationError } from "../core/errors.js";
import type { RoleRepository, TenantRepository, UserRoleAssignmentRepository } from "../repositories/contracts.js";

export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly assignmentRepository: UserRoleAssignmentRepository,
    private readonly tenantRepository: TenantRepository
  ) {}

  createRole(input: {
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

    return this.roleRepository.findByIds(matchingRoleIds).map((role) => role.name);
  }

  listAssignmentsForUser(userId: string) {
    return this.assignmentRepository.listByUser(userId);
  }
}
