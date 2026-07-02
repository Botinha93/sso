import { ValidationError } from "../core/errors.js";
import { canonicalizeRolePermissionDetails, flattenRolePermissions } from "../domain/permissions.js";
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
    async createRole(input) {
        if (!input.permissions.length) {
            throw new ValidationError("Role must include at least one permission");
        }
        return this.roleRepository.create(input);
    }
    async listRoles() {
        return this.roleRepository.list();
    }
    async assignRole(input) {
        if (input.tenantId && !await this.tenantRepository.findById(input.tenantId)) {
            throw new ValidationError("Tenant not found for role assignment");
        }
        return this.assignmentRepository.assign(input);
    }
    async removeRole(input) {
        await this.assignmentRepository.remove(input);
    }
    async resolveNamesForUser(userId, tenantId) {
        const assignments = await this.assignmentRepository.listByUser(userId);
        const matchingRoleIds = assignments
            .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
            .map((assignment) => assignment.roleId);
        const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
        return this.resolveNamesForAssignments(matchingRoleIds, userGroups);
    }
    async resolvePermissionsForUser(userId, tenantId) {
        const assignments = await this.assignmentRepository.listByUser(userId);
        const matchingRoleIds = assignments
            .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
            .map((assignment) => assignment.roleId);
        const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
        return this.resolvePermissionsForAssignments(matchingRoleIds, userGroups);
    }
    async resolveRolePermissionDetailsForUser(userId, tenantId) {
        const assignments = await this.assignmentRepository.listByUser(userId);
        const matchingRoleIds = assignments
            .filter((assignment) => !assignment.tenantId || assignment.tenantId === tenantId)
            .map((assignment) => assignment.roleId);
        const userGroups = (await this.userGroupAssignmentRepository.listByUser(userId)).map((assignment) => assignment.groupId);
        return this.resolveRolePermissionDetailsForAssignments(matchingRoleIds, userGroups);
    }
    async resolveEffectiveRoleIds(roleIds, groupIds) {
        const groupRoleIds = (await this.groupRoleAssignmentRepository
            .listByGroups(groupIds))
            .map((assignment) => assignment.roleId);
        return Array.from(new Set([...roleIds, ...groupRoleIds]));
    }
    async resolveNamesForAssignments(roleIds, groupIds) {
        const effectiveRoleIds = await this.resolveEffectiveRoleIds(roleIds, groupIds);
        return (await this.roleRepository.findByIds(effectiveRoleIds)).map((role) => role.name);
    }
    async resolvePermissionsForAssignments(roleIds, groupIds) {
        const effectiveRoleIds = await this.resolveEffectiveRoleIds(roleIds, groupIds);
        const roles = await this.roleRepository.findByIds(effectiveRoleIds);
        return flattenRolePermissions(roles);
    }
    async resolveRolePermissionDetailsForAssignments(roleIds, groupIds) {
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
    async listAssignmentsForUser(userId) {
        return this.assignmentRepository.listByUser(userId);
    }
    async deleteRole(id) {
        await this.roleRepository.delete(id);
    }
    async updateRole(id, input) {
        return this.roleRepository.update(id, input);
    }
}
