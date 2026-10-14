import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
import { normalizeCustomAttributeMap, normalizeUserAttributeKey } from "../domain/user-attribute-keys.js";
import { passwordChangedAtTodayIso } from "./password-expiration.js";
import { buildAdminUserListCache, serializeAdminUserFromCache } from "./admin-user-list-cache.js";
import { applyListPagination, applyListSearch } from "../http/list-search.js";
export class UserService {
    userRepository;
    appRepository;
    userAppAssignmentRepository;
    userAttributeRepository;
    userGroupAssignmentRepository;
    userRoleAssignmentRepository;
    groupRepository;
    roleRepository;
    groupAppAssignmentRepository;
    groupRoleAssignmentRepository;
    groupUserAttributeAssignmentRepository;
    roleService;
    groupService;
    adminUserListCache;
    adminUserListCacheLoadedAt = 0;
    static ADMIN_USER_LIST_CACHE_TTL_MS = 5_000;
    constructor(userRepository, appRepository, userAppAssignmentRepository, userAttributeRepository, userGroupAssignmentRepository, userRoleAssignmentRepository, groupRepository, roleRepository, groupAppAssignmentRepository, groupRoleAssignmentRepository, groupUserAttributeAssignmentRepository, roleService, groupService) {
        this.userRepository = userRepository;
        this.appRepository = appRepository;
        this.userAppAssignmentRepository = userAppAssignmentRepository;
        this.userAttributeRepository = userAttributeRepository;
        this.userGroupAssignmentRepository = userGroupAssignmentRepository;
        this.userRoleAssignmentRepository = userRoleAssignmentRepository;
        this.groupRepository = groupRepository;
        this.roleRepository = roleRepository;
        this.groupAppAssignmentRepository = groupAppAssignmentRepository;
        this.groupRoleAssignmentRepository = groupRoleAssignmentRepository;
        this.groupUserAttributeAssignmentRepository = groupUserAttributeAssignmentRepository;
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
            const definition = definitionsByKey.get(normalizeUserAttributeKey(key));
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
    normalizeCustomAttributes(customAttributes) {
        return normalizeCustomAttributeMap(customAttributes, { omitEmptyValues: true });
    }
    invalidateAdminUserListCache() {
        this.adminUserListCache = undefined;
        this.adminUserListCacheLoadedAt = 0;
    }
    async loadAdminUserListCache() {
        const now = Date.now();
        if (this.adminUserListCache && now - this.adminUserListCacheLoadedAt < UserService.ADMIN_USER_LIST_CACHE_TTL_MS) {
            return this.adminUserListCache;
        }
        const groups = await this.groupRepository.list();
        const groupIds = groups.map((group) => group.id);
        const [roles, userRoleAssignments, userGroupAssignments, userAppAssignments, groupRoleAssignments, groupAppAssignments, groupUserAttributeAssignments, attributeDefinitions] = await Promise.all([
            this.roleRepository.list(),
            this.userRoleAssignmentRepository.list(),
            this.userGroupAssignmentRepository.list(),
            this.userAppAssignmentRepository.list(),
            groupIds.length > 0 ? this.groupRoleAssignmentRepository.listByGroups(groupIds) : Promise.resolve([]),
            groupIds.length > 0 ? this.groupAppAssignmentRepository.listByGroups(groupIds) : Promise.resolve([]),
            this.groupUserAttributeAssignmentRepository.list(),
            this.userAttributeRepository.list()
        ]);
        this.adminUserListCache = buildAdminUserListCache({
            groups,
            roles,
            userRoleAssignments,
            userGroupAssignments,
            userAppAssignments,
            groupRoleAssignments,
            groupAppAssignments,
            groupUserAttributeAssignments,
            attributeDefinitions
        });
        this.adminUserListCacheLoadedAt = now;
        return this.adminUserListCache;
    }
    async createUser(input) {
        const appIds = this.normalizeAppIds(input);
        const customAttributes = this.normalizeCustomAttributes(input.customAttributes);
        if (await this.userRepository.findByEmail(input.email)) {
            throw new ValidationError("A user with this email already exists");
        }
        if (await this.userRepository.findByUsername(input.username)) {
            throw new ValidationError("A user with this username already exists");
        }
        await this.validateAppIds(appIds);
        await this.validateCustomAttributes(customAttributes);
        if (!input.password && !input.passwordHash) {
            throw new ValidationError("Either password or passwordHash is required");
        }
        if (input.password && input.passwordHash) {
            throw new ValidationError("Provide either password or passwordHash, not both");
        }
        const passwordHash = input.passwordHash ?? hashPassword(input.password);
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
            passwordHash,
            givenName: input.givenName,
            familyName: input.familyName,
            customAttributes: {
                ...customAttributes,
                password_changed_at: customAttributes.password_changed_at ?? passwordChangedAtTodayIso()
            },
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
        this.invalidateAdminUserListCache();
        return user;
    }
    async serializeAdminUser(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            return null;
        }
        const cache = await this.loadAdminUserListCache();
        return serializeAdminUserFromCache(user, cache);
    }
    async serializeAdminUsers(userIds) {
        if (userIds.length === 0) {
            return [];
        }
        const uniqueIds = Array.from(new Set(userIds));
        const [cache, users] = await Promise.all([
            this.loadAdminUserListCache(),
            Promise.all(uniqueIds.map((userId) => this.userRepository.findById(userId)))
        ]);
        return users
            .filter((user) => user !== null && user !== undefined)
            .map((user) => serializeAdminUserFromCache(user, cache));
    }
    async listUsers(filters) {
        const [users, cache] = await Promise.all([
            this.userRepository.list(),
            this.loadAdminUserListCache()
        ]);
        const allowedUserIds = filters?.userIds ? new Set(filters.userIds) : undefined;
        let candidates = users.filter((user) => !allowedUserIds || allowedUserIds.has(user.id));
        if (filters?.includeServiceUsers !== true) {
            candidates = candidates.filter((user) => !user.isServiceUser);
        }
        if (filters?.active !== undefined) {
            candidates = candidates.filter((user) => user.active === filters.active);
        }
        if (filters?.search) {
            candidates = applyListSearch(candidates, filters.search, [
                (user) => user.username,
                (user) => user.email,
                (user) => user.givenName,
                (user) => user.familyName,
                (user) => user.id
            ]);
        }
        const normalizedAttributeFilters = filters?.customAttributes
            ? normalizeCustomAttributeMap(filters.customAttributes)
            : undefined;
        const groupNeedle = filters?.group?.trim().toLowerCase();
        const matched = [];
        for (const user of candidates) {
            const serialized = serializeAdminUserFromCache(user, cache);
            if (groupNeedle) {
                const hasGroup = (serialized.groups ?? []).some((groupName) => groupName.toLowerCase() === groupNeedle || groupName.toLowerCase().includes(groupNeedle));
                if (!hasGroup) {
                    continue;
                }
            }
            if (normalizedAttributeFilters) {
                const attributes = serialized.customAttributes ?? {};
                const matchesAttributes = Object.entries(normalizedAttributeFilters).every(([key, value]) => attributes[key] === value);
                if (!matchesAttributes) {
                    continue;
                }
            }
            matched.push(serialized);
        }
        return applyListPagination(matched, {
            page: filters?.page,
            pageSize: filters?.pageSize
        });
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
        if (input.username !== undefined && input.username === existing.id) {
            input = { ...input, username: undefined };
        }
        if (input.email !== undefined && input.email === existing.id) {
            input = { ...input, email: undefined };
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
            await this.validateCustomAttributes(this.normalizeCustomAttributes(input.customAttributes));
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
            this.invalidateAdminUserListCache();
            return {
                ...updated,
                appId: appIds[0],
                appIds,
                directAppIds: appIds
            };
        }
        this.invalidateAdminUserListCache();
        return updated;
    }
    async ensurePasswordChangedAt(user) {
        const existing = user.customAttributes.password_changed_at?.trim();
        if (existing) {
            return user;
        }
        const passwordChangedAt = passwordChangedAtTodayIso();
        const nextCustomAttributes = {
            ...(user.customAttributes ?? {}),
            password_changed_at: passwordChangedAt
        };
        await this.userRepository.setCustomAttributes(user.id, nextCustomAttributes);
        this.invalidateAdminUserListCache();
        return {
            ...user,
            customAttributes: nextCustomAttributes
        };
    }
    async resetPassword(id, password) {
        const existing = await this.userRepository.findById(id);
        if (!existing) {
            throw new ValidationError("User not found");
        }
        await this.userRepository.setPasswordHash(id, hashPassword(password));
        await this.userRepository.setCustomAttributes(id, {
            ...(existing.customAttributes ?? {}),
            password_changed_at: new Date().toISOString()
        });
        this.invalidateAdminUserListCache();
    }
    async setUserActive(id, active) {
        await this.userRepository.setActive(id, active);
        this.invalidateAdminUserListCache();
    }
    async setCustomAttributes(id, customAttributes) {
        const normalizedCustomAttributes = this.normalizeCustomAttributes(customAttributes);
        await this.validateCustomAttributes(normalizedCustomAttributes);
        await this.userRepository.setCustomAttributes(id, normalizedCustomAttributes);
        this.invalidateAdminUserListCache();
    }
    async setPortalCustomAttributes(id, customAttributes, options) {
        const pictureKey = options?.pictureKey ?? "picture";
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new ValidationError("User not found");
        }
        const definitions = await this.userAttributeRepository.list();
        const editableByKey = new Map(definitions
            .filter((definition) => definition.enabled && definition.userEditable && definition.key !== pictureKey)
            .map((definition) => [definition.key, definition]));
        const nextAttributes = { ...(user.customAttributes ?? {}) };
        const normalizedIncoming = normalizeCustomAttributeMap(customAttributes, { omitEmptyValues: false });
        for (const [key, value] of Object.entries(normalizedIncoming)) {
            const definition = editableByKey.get(key);
            if (!definition) {
                throw new ValidationError(`Custom attribute is not editable on the portal: ${key}`);
            }
            if (!value.trim()) {
                delete nextAttributes[key];
                continue;
            }
            nextAttributes[key] = value.trim();
        }
        await this.setCustomAttributes(id, nextAttributes);
    }
    async listPortalCustomAttributeFields(userId, options) {
        const pictureKey = options?.pictureKey ?? "picture";
        const definitions = await this.userAttributeRepository.list();
        const resolved = await this.resolveCustomAttributesForUser(userId);
        return definitions
            .filter((definition) => definition.enabled && definition.showOnPortal && definition.key !== pictureKey)
            .map((definition) => ({
            key: definition.key,
            name: definition.name,
            description: definition.description,
            type: definition.type,
            userEditable: definition.userEditable,
            value: resolved.customAttributes[definition.key] ?? ""
        }));
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
        this.invalidateAdminUserListCache();
    }
    async resolveAppAccessForUser(userId) {
        const user = await this.userRepository.findById(userId);
        const assignedDirectAppIds = (await this.userAppAssignmentRepository.listByUser(userId)).map((assignment) => assignment.appId);
        const directAppIds = assignedDirectAppIds.length > 0 ? assignedDirectAppIds : (user?.appId ? [user.appId] : []);
        const groupIds = await this.groupService.listGroupIdsForUser(userId);
        const inheritedAppSources = groupIds.length === 0
            ? []
            : await this.groupService.resolveAppSourcesForGroups(groupIds);
        const inheritedAppIds = Array.from(new Set(inheritedAppSources.map((source) => source.appId)));
        const appIds = Array.from(new Set([...directAppIds, ...inheritedAppIds]));
        return {
            appId: appIds[0],
            appIds,
            directAppIds,
            inheritedAppIds,
            inheritedAppSources
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
