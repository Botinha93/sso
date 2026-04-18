import { ValidationError } from "../core/errors.js";
export class RoleService {
    roleRepository;
    assignmentRepository;
    tenantRepository;
    constructor(roleRepository, assignmentRepository, tenantRepository) {
        this.roleRepository = roleRepository;
        this.assignmentRepository = assignmentRepository;
        this.tenantRepository = tenantRepository;
    }
    createRole(input) {
        if (!input.permissions.length) {
            throw new ValidationError("Role must include at least one permission");
        }
        return this.roleRepository.create(input);
    }
    listRoles() {
        return this.roleRepository.list();
    }
    assignRole(input) {
        if (input.tenantId && !this.tenantRepository.findById(input.tenantId)) {
            throw new ValidationError("Tenant not found for role assignment");
        }
        return this.assignmentRepository.assign(input);
    }
    resolveNamesForUser(userId, tenantId) {
        const assignments = this.assignmentRepository.listByUser(userId);
        const matchingRoleIds = assignments
            .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
            .map((assignment) => assignment.roleId);
        return this.roleRepository.findByIds(matchingRoleIds).map((role) => role.name);
    }
    listAssignmentsForUser(userId) {
        return this.assignmentRepository.listByUser(userId);
    }
}
