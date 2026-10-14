import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
import type { User } from "../domain/models.js";
import { pickUserForLoginIdentifier, uniqueUsers } from "../domain/login-identifier.js";
import type {
  AppRepository,
  GroupAppAssignmentRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  GroupUserAttributeAssignmentRepository,
  RoleRepository,
  UserAppAssignmentRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository
} from "../repositories/contracts.js";
import { RoleService } from "./role-service.js";
import { GroupService } from "./group-service.js";
import {
  isSystemManagedUserAttributeKey,
  normalizeCustomAttributeMap,
  normalizeUserAttributeKey,
  omitSystemManagedCustomAttributes,
  PASSWORD_CHANGED_AT_ATTRIBUTE_KEY
} from "../domain/user-attribute-keys.js";
import {
  PASSWORD_CHANGED_AT_BACKFILL_DATE,
  needsPasswordChangedAtBackfill,
  passwordChangedAtDateValue,
  serverPasswordChangedAtDateValue,
  toDateAttributeValue
} from "./password-expiration.js";
import {
  buildAdminUserListCache,
  serializeAdminUserFromCache,
  type AdminUserListCache,
  type SerializedAdminUser
} from "./admin-user-list-cache.js";
import { applyListPagination, applyListSearch } from "../http/list-search.js";

export class UserService {
  private adminUserListCache?: AdminUserListCache;
  private adminUserListCacheLoadedAt = 0;
  private static readonly ADMIN_USER_LIST_CACHE_TTL_MS = 5_000;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly appRepository: AppRepository,
    private readonly userAppAssignmentRepository: UserAppAssignmentRepository,
    private readonly userAttributeRepository: UserAttributeRepository,
    private readonly userGroupAssignmentRepository: UserGroupAssignmentRepository,
    private readonly userRoleAssignmentRepository: UserRoleAssignmentRepository,
    private readonly groupRepository: GroupRepository,
    private readonly roleRepository: RoleRepository,
    private readonly groupAppAssignmentRepository: GroupAppAssignmentRepository,
    private readonly groupRoleAssignmentRepository: GroupRoleAssignmentRepository,
    private readonly groupUserAttributeAssignmentRepository: GroupUserAttributeAssignmentRepository,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService
  ) {}

  private normalizeAppIds(input: { appId?: string; appIds?: string[] }) {
    return Array.from(new Set(input.appIds ?? (input.appId ? [input.appId] : [])));
  }

  private async sanitizeAppIds(appIds: string[]) {
    if (appIds.length === 0) {
      return [];
    }
    const apps = await this.appRepository.list();
    const known = new Set(apps.map((app) => app.id));
    return appIds.filter((appId) => known.has(appId));
  }

  private async setUserAppAssignments(userId: string, appIds: string[]) {
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

  private async validateCustomAttributes(customAttributes: Record<string, string>) {
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
        } catch {
          throw new ValidationError(`Custom attribute ${key} must be valid JSON`);
        }
      }
    }
  }

  private normalizeCustomAttributes(customAttributes: Record<string, string> | undefined) {
    return normalizeCustomAttributeMap(customAttributes, { omitEmptyValues: true });
  }

  private normalizePasswordChangedAt(customAttributes: Record<string, string>) {
    const passwordChangedAt = toDateAttributeValue(customAttributes.password_changed_at);
    if (!passwordChangedAt) {
      return customAttributes;
    }

    return {
      ...customAttributes,
      password_changed_at: passwordChangedAt
    };
  }

  private invalidateAdminUserListCache() {
    this.adminUserListCache = undefined;
    this.adminUserListCacheLoadedAt = 0;
  }

  private async loadAdminUserListCache(): Promise<AdminUserListCache> {
    const now = Date.now();
    if (this.adminUserListCache && now - this.adminUserListCacheLoadedAt < UserService.ADMIN_USER_LIST_CACHE_TTL_MS) {
      return this.adminUserListCache;
    }

    const groups = await this.groupRepository.list();
    const groupIds = groups.map((group) => group.id);
    const [
      roles,
      userRoleAssignments,
      userGroupAssignments,
      userAppAssignments,
      groupRoleAssignments,
      groupAppAssignments,
      groupUserAttributeAssignments,
      attributeDefinitions
    ] = await Promise.all([
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

  async createUser(input: {
    appId?: string;
    appIds?: string[];
    externalSource?: string;
    externalId?: string;
    isServiceUser?: boolean;
    avatarUrl?: string;
    email: string;
    username: string;
    password?: string;
    passwordHash?: string;
    givenName: string;
    familyName: string;
    customAttributes?: Record<string, string>;
    roleIds: string[];
    groupIds?: string[];
    active?: boolean;
  }) {
    const appIds = await this.sanitizeAppIds(this.normalizeAppIds(input));
    const customAttributes = this.normalizeCustomAttributes(input.customAttributes);
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();

    await this.assertIdentifiersAvailable({ email, username });

    await this.validateCustomAttributes(customAttributes);

    if (!input.password && !input.passwordHash) {
      throw new ValidationError("Either password or passwordHash is required");
    }

    if (input.password && input.passwordHash) {
      throw new ValidationError("Provide either password or passwordHash, not both");
    }

    const passwordHash = input.passwordHash ?? hashPassword(input.password!);

    const user = await this.userRepository.create({
      appId: appIds[0],
      appIds,
      directAppIds: appIds,
      inheritedAppIds: [],
      externalSource: input.externalSource,
      externalId: input.externalId,
      isServiceUser: input.isServiceUser ?? false,
      avatarUrl: input.avatarUrl,
      email,
      username,
      passwordHash,
      givenName: input.givenName,
      familyName: input.familyName,
      customAttributes: {
        ...omitSystemManagedCustomAttributes(customAttributes),
        [PASSWORD_CHANGED_AT_ATTRIBUTE_KEY]: toDateAttributeValue(customAttributes[PASSWORD_CHANGED_AT_ATTRIBUTE_KEY])
          ?? serverPasswordChangedAtDateValue()
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

  async serializeAdminUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    const cache = await this.loadAdminUserListCache();
    return serializeAdminUserFromCache(user, cache);
  }

  async serializeAdminUsers(userIds: string[]): Promise<SerializedAdminUser[]> {
    if (userIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(userIds));
    const [cache, users] = await Promise.all([
      this.loadAdminUserListCache(),
      Promise.all(uniqueIds.map((userId) => this.userRepository.findById(userId)))
    ]);

    return users
      .filter((user): user is NonNullable<typeof user> => user !== null && user !== undefined)
      .map((user) => serializeAdminUserFromCache(user, cache));
  }

  async listUsers(filters?: {
    group?: string;
    customAttributes?: Record<string, string>;
    active?: boolean;
    includeServiceUsers?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
    userIds?: string[];
  }) {
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

    const matched: SerializedAdminUser[] = [];
    for (const user of candidates) {
      const serialized = serializeAdminUserFromCache(user, cache);

      if (groupNeedle) {
        const hasGroup = (serialized.groups ?? []).some(
          (groupName) => groupName.toLowerCase() === groupNeedle || groupName.toLowerCase().includes(groupNeedle)
        );
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

  async findUserByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findUserByUsername(username: string) {
    return this.userRepository.findByUsername(username);
  }

  async findLoginCandidates(identifier: string) {
    const candidates = await this.userRepository.findByLoginIdentifier(identifier);
    if (candidates.length > 0) {
      return uniqueUsers(candidates);
    }

    return uniqueUsers([
      await this.userRepository.findByEmail(identifier),
      await this.userRepository.findByUsername(identifier)
    ]);
  }

  async findUserByLoginIdentifier(identifier: string) {
    return pickUserForLoginIdentifier(identifier, await this.findLoginCandidates(identifier));
  }

  private async assertIdentifiersAvailable(input: {
    email?: string;
    username?: string;
    ignoreUserId?: string;
  }) {
    const email = input.email?.trim().toLowerCase();
    const username = input.username?.trim();

    if (email) {
      const byEmail = await this.userRepository.findByEmail(email);
      if (byEmail && byEmail.id !== input.ignoreUserId) {
        throw new ValidationError("A user with this email already exists");
      }
      const usernameTakenByEmail = await this.userRepository.findByUsername(email);
      if (usernameTakenByEmail && usernameTakenByEmail.id !== input.ignoreUserId) {
        throw new ValidationError("This email is already used as a username");
      }
    }

    if (username) {
      const byUsername = await this.userRepository.findByUsername(username);
      if (byUsername && byUsername.id !== input.ignoreUserId) {
        throw new ValidationError("A user with this username already exists");
      }
      const emailTakenByUsername = await this.userRepository.findByEmail(username);
      if (emailTakenByUsername && emailTakenByUsername.id !== input.ignoreUserId) {
        throw new ValidationError("This username is already used as an email");
      }
    }
  }

  async findUserById(id: string) {
    return this.userRepository.findById(id);
  }

  async updateUserProfile(id: string, input: {
    appId?: string;
    appIds?: string[];
    externalSource?: string;
    externalId?: string;
    isServiceUser?: boolean;
    avatarUrl?: string | null;
    email?: string;
    username?: string;
    givenName?: string;
    familyName?: string;
    customAttributes?: Record<string, string>;
  }) {
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

    const nextEmail = input.email !== undefined ? input.email.trim().toLowerCase() : undefined;
    const nextUsername = input.username !== undefined ? input.username.trim() : undefined;
    await this.assertIdentifiersAvailable({
      email: nextEmail !== undefined && nextEmail !== existing.email.toLowerCase() ? nextEmail : undefined,
      username: nextUsername !== undefined && nextUsername.toLowerCase() !== existing.username.toLowerCase() ? nextUsername : undefined,
      ignoreUserId: id
    });

    const appIds = input.appId !== undefined || input.appIds !== undefined
      ? await this.sanitizeAppIds(this.normalizeAppIds(input))
      : undefined;
    if (input.customAttributes) {
      await this.validateCustomAttributes(this.normalizeCustomAttributes(input.customAttributes));
    }

    const updated = await this.userRepository.updateProfile(id, {
      ...input,
      email: nextEmail,
      username: nextUsername,
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

  async ensurePasswordChangedAt(user: User) {
    const existing = toDateAttributeValue(user.customAttributes.password_changed_at);
    if (existing) {
      if (existing === user.customAttributes.password_changed_at?.trim()) {
        return user;
      }

      const normalizedCustomAttributes = {
        ...(user.customAttributes ?? {}),
        password_changed_at: existing
      };
      await this.userRepository.setCustomAttributes(user.id, normalizedCustomAttributes);
      this.invalidateAdminUserListCache();
      return {
        ...user,
        customAttributes: normalizedCustomAttributes
      };
    }

    const passwordChangedAt = passwordChangedAtDateValue(user.createdAt);
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

  async resetPassword(id: string, password: string) {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    await this.userRepository.setPasswordHash(id, hashPassword(password));
    await this.userRepository.setCustomAttributes(id, {
      ...(existing.customAttributes ?? {}),
      [PASSWORD_CHANGED_AT_ATTRIBUTE_KEY]: serverPasswordChangedAtDateValue()
    });
    this.invalidateAdminUserListCache();
  }

  async setUserActive(id: string, active: boolean) {
    await this.userRepository.setActive(id, active);
    this.invalidateAdminUserListCache();
  }

  async backfillActiveUsersPasswordChangedAt(dateValue = PASSWORD_CHANGED_AT_BACKFILL_DATE) {
    const users = await this.userRepository.list();
    let updated = 0;

    for (const user of users) {
      if (!needsPasswordChangedAtBackfill(user, dateValue)) {
        continue;
      }

      await this.userRepository.setCustomAttributes(user.id, {
        ...(user.customAttributes ?? {}),
        password_changed_at: dateValue
      });
      updated += 1;
    }

    if (updated > 0) {
      this.invalidateAdminUserListCache();
    }

    return updated;
  }

  async setCustomAttributes(id: string, customAttributes: Record<string, string>) {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    const normalizedCustomAttributes = this.normalizePasswordChangedAt(
      this.normalizeCustomAttributes(customAttributes)
    );
    const sentPasswordChangedAt = Object.keys(customAttributes).some((key) => isSystemManagedUserAttributeKey(key));
    const incomingPasswordChangedAt = sentPasswordChangedAt
      ? toDateAttributeValue(customAttributes[PASSWORD_CHANGED_AT_ATTRIBUTE_KEY])
      : undefined;
    const preservedPasswordChangedAt = toDateAttributeValue(existing.customAttributes[PASSWORD_CHANGED_AT_ATTRIBUTE_KEY])
      ?? existing.customAttributes[PASSWORD_CHANGED_AT_ATTRIBUTE_KEY]?.trim();
    const nextCustomAttributes = omitSystemManagedCustomAttributes(normalizedCustomAttributes);
    const nextPasswordChangedAt = incomingPasswordChangedAt ?? preservedPasswordChangedAt;
    if (nextPasswordChangedAt) {
      nextCustomAttributes[PASSWORD_CHANGED_AT_ATTRIBUTE_KEY] = nextPasswordChangedAt;
    }

    await this.validateCustomAttributes(nextCustomAttributes);
    await this.userRepository.setCustomAttributes(id, nextCustomAttributes);
    this.invalidateAdminUserListCache();
  }

  async setPortalCustomAttributes(id: string, customAttributes: Record<string, string>, options?: { pictureKey?: string }) {
    const pictureKey = options?.pictureKey ?? "picture";
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new ValidationError("User not found");
    }

    const definitions = await this.userAttributeRepository.list();
    const editableByKey = new Map(
      definitions
        .filter((definition) => definition.enabled && definition.userEditable && definition.key !== pictureKey)
        .map((definition) => [definition.key, definition])
    );

    const nextAttributes = { ...(user.customAttributes ?? {}) };
    const normalizedIncoming = normalizeCustomAttributeMap(customAttributes, { omitEmptyValues: false });

    for (const [key, value] of Object.entries(normalizedIncoming)) {
      if (isSystemManagedUserAttributeKey(key) || key === pictureKey) {
        continue;
      }

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

  async listPortalCustomAttributeFields(userId: string, options?: { pictureKey?: string }) {
    const pictureKey = options?.pictureKey ?? "picture";
    const definitions = await this.userAttributeRepository.list();
    const resolved = await this.resolveCustomAttributesForUser(userId);

    return definitions
      .filter((definition) => definition.enabled && definition.showOnPortal && definition.key !== pictureKey && !isSystemManagedUserAttributeKey(definition.key))
      .map((definition) => ({
        key: definition.key,
        name: definition.name,
        description: definition.description,
        type: definition.type,
        userEditable: definition.userEditable,
        value: resolved.customAttributes[definition.key] ?? ""
      }));
  }

  async deleteUser(id: string) {
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

  async resolveAppAccessForUser(userId: string) {
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

  async resolveCustomAttributesForUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    const directCustomAttributes = user?.customAttributes ?? {};
    const groupIds = await this.groupService.listGroupIdsForUser(userId);
    const inheritedCustomAttributes: Record<string, string> = {};

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
