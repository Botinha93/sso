import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
import type { UserRepository } from "../repositories/contracts.js";
import { RoleService } from "./role-service.js";
import { GroupService } from "./group-service.js";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleService: RoleService,
    private readonly groupService: GroupService
  ) {}

  async createUser(input: {
    appId?: string;
    externalSource?: string;
    externalId?: string;
    isServiceUser?: boolean;
    email: string;
    username: string;
    password: string;
    givenName: string;
    familyName: string;
    customAttributes?: Record<string, string>;
    roleIds: string[];
    groupIds?: string[];
    active?: boolean;
  }) {
    if (await this.userRepository.findByEmail(input.email)) {
      throw new ValidationError("A user with this email already exists");
    }

    const user = await this.userRepository.create({
      appId: input.appId,
      externalSource: input.externalSource,
      externalId: input.externalId,
      isServiceUser: input.isServiceUser ?? false,
      email: input.email,
      username: input.username,
      passwordHash: hashPassword(input.password),
      givenName: input.givenName,
      familyName: input.familyName,
      customAttributes: input.customAttributes ?? {},
      active: input.active ?? true
    });

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
      roles: await this.roleService.resolveNamesForUser(user.id),
      groups: await this.groupService.resolveGroupNamesForUser(user.id)
    })));
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
    externalSource?: string;
    externalId?: string;
    isServiceUser?: boolean;
    email?: string;
    username?: string;
    givenName?: string;
    familyName?: string;
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

    return this.userRepository.updateProfile(id, input);
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
    await this.userRepository.setCustomAttributes(id, customAttributes);
  }

  async deleteUser(id: string) {
    const groupIds = await this.groupService.listGroupIdsForUser(id);
    for (const groupId of groupIds) {
      await this.groupService.removeUserFromGroup({ userId: id, groupId });
    }

    await this.userRepository.delete(id);
  }
}
