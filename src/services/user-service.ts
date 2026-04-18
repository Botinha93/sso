import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
import type { UserRepository } from "../repositories/contracts.js";
import { RoleService } from "./role-service.js";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleService: RoleService
  ) {}

  createUser(input: {
    email: string;
    username: string;
    password: string;
    givenName: string;
    familyName: string;
    roleIds: string[];
    active?: boolean;
  }) {
    if (this.userRepository.findByEmail(input.email)) {
      throw new ValidationError("A user with this email already exists");
    }

    const user = this.userRepository.create({
      email: input.email,
      username: input.username,
      passwordHash: hashPassword(input.password),
      givenName: input.givenName,
      familyName: input.familyName,
      active: input.active ?? true
    });

    for (const roleId of input.roleIds) {
      this.roleService.assignRole({
        userId: user.id,
        roleId
      });
    }

    return user;
  }

  listUsers() {
    return this.userRepository.list().map(({ passwordHash, ...user }) => ({
      ...user,
      roles: this.roleService.resolveNamesForUser(user.id)
    }));
  }

  findUserByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  findUserById(id: string) {
    return this.userRepository.findById(id);
  }
}
