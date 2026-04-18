import { ValidationError } from "../core/errors.js";
export class RoleService {
    roleRepository;
    assignmentRepository;
    tenantRepository;
    userGroupAssignmentRepository;
    groupRoleAssignmentRepository;
    constructor(roleRepository, assignmentRepository, tenantRepository, userGroupAssignmentRepository, groupRoleAssignmentRepository) {
        this.roleRepository = roleRepository;
        this.assignmentRepository = assignmentRepository;
        this.tenantRepository = tenantRepository;
        this.userGroupAssignmentRepository = userGroupAssignmentRepository;
        this.groupRoleAssignmentRepository = groupRoleAssignmentRepository;
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
        const userGroups = this.userGroupAssignmentRepository.listByUser(userId).map((assignment) => assignment.groupId);
        const groupRoleIds = this.groupRoleAssignmentRepository
            .listByGroups(userGroups)
            .map((assignment) => assignment.roleId);
        const effectiveRoleIds = Array.from(new Set([...matchingRoleIds, ...groupRoleIds]));
        return this.roleRepository.findByIds(effectiveRoleIds).map((role) => role.name);
    }
    resolvePermissionsForUser(userId, tenantId) {
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
    listAssignmentsForUser(userId) {
        return this.assignmentRepository.listByUser(userId);
    }
    deleteRole(id) {
        this.roleRepository.delete(id);
    }
    updateRole(id, input) {
        return this.roleRepository.update(id, input);
    }
}
