import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
export class UserService {
    userRepository;
    appRepository;
    userAppAssignmentRepository;
    userAttributeRepository;
    roleService;
    groupService;
    constructor(userRepository, appRepository, userAppAssignmentRepository, userAttributeRepository, roleService, groupService) {
        this.userRepository = userRepository;
        this.appRepository = appRepository;
        this.userAppAssignmentRepository = userAppAssignmentRepository;
        this.userAttributeRepository = userAttributeRepository;
        this.roleService = roleService;
        this.groupService = groupService;
    }
    normalizeAppIds(input) {
        return Array.from(new Set(input.appIds ?? (input.appId ? [input.appId] : [])));
    }
    async validateAppIds(appIds) {
        const apps = await this.appRepository.list();
        const known = new Set(apps.map((app) => app.id));
        if (appIds.some((appId) => !known.has(appId))) {
            throw new ValidationError("One or more appIds are invalid");
        }
    }
    async setUserAppAssignments(userId, appIds) {
        const existingAssignments = await this.userAppAssignmentRepository.listByUser(userId);
        const next = new Set(appIds);
        for (const assignment of existingAssignments) {
            if (!next.has(assignment.appId)) {
                await this.userAppAssignmentRepository.remove(userId, assignment.appId);
            }
        }
        for (const appId of appIds) {
            await this.userAppAssignmentRepository.assign({ userId, appId });
        }
    }
    async validateCustomAttributes(customAttributes) {
        const definitions = await this.userAttributeRepository.list();
        const definitionsByKey = new Map(definitions.filter((definition) => definition.enabled).map((definition) => [definition.key, definition]));
        for (const [key, value] of Object.entries(customAttributes)) {
            const definition = definitionsByKey.get(key);
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
                }
                catch {
                    throw new ValidationError(`Custom attribute ${key} must be valid JSON`);
                }
            }
        }
    }
    async createUser(input) {
        const appIds = this.normalizeAppIds(input);
        const customAttributes = input.customAttributes ?? {};
        if (await this.userRepository.findByEmail(input.email)) {
            throw new ValidationError("A user with this email already exists");
        }
        await this.validateAppIds(appIds);
        await this.validateCustomAttributes(customAttributes);
        const user = await this.userRepository.create({
            appId: appIds[0],
            appIds,
            directAppIds: appIds,
            inheritedAppIds: [],
            externalSource: input.externalSource,
            externalId: input.externalId,
            isServiceUser: input.isServiceUser ?? false,
            avatarUrl: input.avatarUrl,
            email: input.email,
            username: input.username,
            passwordHash: hashPassword(input.password),
            givenName: input.givenName,
            familyName: input.familyName,
            customAttributes,
            active: input.active ?? true
        });
        await this.setUserAppAssignments(user.id, appIds);
        for (const roleId of input.roleIds) {
            await this.roleService.assignRole({
                userId: user.id,
                roleId
            });
        }
        for (const groupId of input.groupIds ?? []) {
            await this.groupService.assignUserToGroup({ userId: user.id, groupId });
        }
        return user;
    }
    async listUsers() {
        const users = await this.userRepository.list();
        return Promise.all(users.map(async ({ passwordHash, ...user }) => ({
            ...user,
            ...(await this.resolveCustomAttributesForUser(user.id)),
            ...(await this.resolveAppAccessForUser(user.id)),
            roles: await this.roleService.resolveNamesForUser(user.id),
            groups: await this.groupService.resolveGroupNamesForUser(user.id)
        })));
    }
    async findUserByEmail(email) {
        return this.userRepository.findByEmail(email);
    }
    async findUserByUsername(username) {
        return this.userRepository.findByUsername(username);
    }
    async findUserById(id) {
        return this.userRepository.findById(id);
    }
    async updateUserProfile(id, input) {
        const existing = await this.userRepository.findById(id);
        if (!existing) {
            throw new ValidationError("User not found");
        }
        if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
            const byEmail = await this.userRepository.findByEmail(input.email);
            if (byEmail && byEmail.id !== id) {
                throw new ValidationError("A user with this email already exists");
            }
        }
        if (input.username && input.username.toLowerCase() !== existing.username.toLowerCase()) {
            const byUsername = await this.userRepository.findByUsername(input.username);
            if (byUsername && byUsername.id !== id) {
                throw new ValidationError("A user with this username already exists");
            }
        }
        const appIds = input.appId !== undefined || input.appIds !== undefined
            ? this.normalizeAppIds(input)
            : undefined;
        if (appIds) {
            await this.validateAppIds(appIds);
        }
        if (input.customAttributes) {
            await this.validateCustomAttributes(input.customAttributes);
        }
        const updated = await this.userRepository.updateProfile(id, {
            ...input,
            appId: appIds ? appIds[0] : input.appId
        });
        if (!updated) {
            return updated;
        }
        if (appIds) {
            await this.setUserAppAssignments(id, appIds);
            return {
                ...updated,
                appId: appIds[0],
                appIds,
                directAppIds: appIds
            };
        }
        return updated;
    }
    async resetPassword(id, password) {
        const existing = await this.userRepository.findById(id);
        if (!existing) {
            throw new ValidationError("User not found");
        }
        await this.userRepository.setPasswordHash(id, hashPassword(password));
    }
    async setUserActive(id, active) {
        await this.userRepository.setActive(id, active);
    }
    async setCustomAttributes(id, customAttributes) {
        await this.validateCustomAttributes(customAttributes);
        await this.userRepository.setCustomAttributes(id, customAttributes);
    }
    async deleteUser(id) {
        const groupIds = await this.groupService.listGroupIdsForUser(id);
        for (const groupId of groupIds) {
            await this.groupService.removeUserFromGroup({ userId: id, groupId });
        }
        const appAssignments = await this.userAppAssignmentRepository.listByUser(id);
        for (const assignment of appAssignments) {
            await this.userAppAssignmentRepository.remove(id, assignment.appId);
        }
        await this.userRepository.delete(id);
    }
    async resolveAppAccessForUser(userId) {
        const user = await this.userRepository.findById(userId);
        const assignedDirectAppIds = (await this.userAppAssignmentRepository.listByUser(userId)).map((assignment) => assignment.appId);
        const directAppIds = assignedDirectAppIds.length > 0 ? assignedDirectAppIds : (user?.appId ? [user.appId] : []);
        const groupIds = await this.groupService.listGroupIdsForUser(userId);
        const inheritedAppIds = groupIds.length === 0
            ? []
            : await this.groupService.resolveAppIdsForGroups(groupIds);
        const appIds = Array.from(new Set([...directAppIds, ...inheritedAppIds]));
        return {
            appId: appIds[0],
            appIds,
            directAppIds,
            inheritedAppIds
        };
    }
    async resolveCustomAttributesForUser(userId) {
        const user = await this.userRepository.findById(userId);
        const directCustomAttributes = user?.customAttributes ?? {};
        const groupIds = await this.groupService.listGroupIdsForUser(userId);
        const inheritedCustomAttributes = {};
        for (const groupId of groupIds) {
            const groupCustomAttributes = await this.groupService.resolveCustomAttributesForGroup(groupId);
            for (const [key, value] of Object.entries(groupCustomAttributes)) {
                if (!(key in inheritedCustomAttributes)) {
                    inheritedCustomAttributes[key] = value;
                }
            }
        }
        return {
            customAttributes: {
                ...inheritedCustomAttributes,
                ...directCustomAttributes
            },
            directCustomAttributes,
            inheritedCustomAttributes
        };
    }
}
