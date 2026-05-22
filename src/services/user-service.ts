import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
import type { AppRepository, UserAppAssignmentRepository, UserAttributeRepository, UserRepository } from "../repositories/contracts.js";
import { RoleService } from "./role-service.js";
import { GroupService } from "./group-service.js";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly appRepository: AppRepository,
    private readonly userAppAssignmentRepository: UserAppAssignmentRepository,
    private readonly userAttributeRepository: UserAttributeRepository,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService
  ) {}

  private normalizeAppIds(input: { appId?: string; appIds?: string[] }) {
    return Array.from(new Set(input.appIds ?? (input.appId ? [input.appId] : [])));
  }

  private async validateAppIds(appIds: string[]) {
    const apps = await this.appRepository.list();
    const known = new Set(apps.map((app) => app.id));
    if (appIds.some((appId) => !known.has(appId))) {
      throw new ValidationError("One or more appIds are invalid");
    }
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
        } catch {
          throw new ValidationError(`Custom attribute ${key} must be valid JSON`);
        }
      }
    }
  }

  private normalizeCustomAttributes(customAttributes: Record<string, string> | undefined) {
    if (!customAttributes) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(customAttributes).filter(([, value]) => value.trim().length > 0)
    );
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
      email: input.email,
      username: input.username,
      passwordHash,
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
    return Promise.all(users.map(async ({ passwordHash, ...user }) => {
      const directRoleIds = Array.from(new Set((await this.roleService.listAssignmentsForUser(user.id)).map((assignment) => assignment.roleId)));
      return {
        ...user,
        ...(await this.resolveCustomAttributesForUser(user.id)),
        ...(await this.resolveAppAccessForUser(user.id)),
        roles: await this.roleService.resolveNamesForUser(user.id),
        directRoleIds,
        groups: await this.groupService.resolveGroupNamesForUser(user.id)
      };
    }));
  }

  async findUserByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findUserByUsername(username: string) {
    return this.userRepository.findByUsername(username);
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
      return {
        ...updated,
        appId: appIds[0],
        appIds,
        directAppIds: appIds
      };
    }

    return updated;
  }

  async resetPassword(id: string, password: string) {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    await this.userRepository.setPasswordHash(id, hashPassword(password));
  }

  async setUserActive(id: string, active: boolean) {
    await this.userRepository.setActive(id, active);
  }

  async setCustomAttributes(id: string, customAttributes: Record<string, string>) {
    const normalizedCustomAttributes = this.normalizeCustomAttributes(customAttributes);
    await this.validateCustomAttributes(normalizedCustomAttributes);
    await this.userRepository.setCustomAttributes(id, normalizedCustomAttributes);
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
