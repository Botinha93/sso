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

  createUser(input: {
    appId?: string;
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
    if (this.userRepository.findByEmail(input.email)) {
      throw new ValidationError("A user with this email already exists");
    }

    const user = this.userRepository.create({
      appId: input.appId,
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
      this.roleService.assignRole({
        userId: user.id,
        roleId
      });
    }

    for (const groupId of input.groupIds ?? []) {
      this.groupService.assignUserToGroup({ userId: user.id, groupId });
    }

    return user;
  }

  listUsers() {
    return this.userRepository.list().map(({ passwordHash, ...user }) => ({
      ...user,
      roles: this.roleService.resolveNamesForUser(user.id),
      groups: this.groupService.resolveGroupNamesForUser(user.id)
    }));
  }

  findUserByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  findUserByUsername(username: string) {
    return this.userRepository.findByUsername(username);
  }

  findUserById(id: string) {
    return this.userRepository.findById(id);
  }

  updateUserProfile(id: string, input: { appId?: string; isServiceUser?: boolean; email?: string; username?: string; givenName?: string; familyName?: string }) {
    const existing = this.userRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
      const byEmail = this.userRepository.findByEmail(input.email);
      if (byEmail && byEmail.id !== id) {
        throw new ValidationError("A user with this email already exists");
      }
    }

    if (input.username && input.username.toLowerCase() !== existing.username.toLowerCase()) {
      const byUsername = this.userRepository.findByUsername(input.username);
      if (byUsername && byUsername.id !== id) {
        throw new ValidationError("A user with this username already exists");
      }
    }

    return this.userRepository.updateProfile(id, input);
  }

  resetPassword(id: string, password: string) {
    const existing = this.userRepository.findById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    this.userRepository.setPasswordHash(id, hashPassword(password));
  }

  setUserActive(id: string, active: boolean) {
    this.userRepository.setActive(id, active);
  }

  setCustomAttributes(id: string, customAttributes: Record<string, string>) {
    this.userRepository.setCustomAttributes(id, customAttributes);
  }

  deleteUser(id: string) {
    this.userRepository.delete(id);
  }
}
