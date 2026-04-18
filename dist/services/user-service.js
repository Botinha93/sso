import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
export class UserService {
    userRepository;
    roleService;
    groupService;
    constructor(userRepository, roleService, groupService) {
        this.userRepository = userRepository;
        this.roleService = roleService;
        this.groupService = groupService;
    }
    async createUser(input) {
        if (await this.userRepository.findByEmail(input.email)) {
            throw new ValidationError("A user with this email already exists");
        }
        const user = await this.userRepository.create({
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
        return this.userRepository.updateProfile(id, input);
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
        await this.userRepository.setCustomAttributes(id, customAttributes);
    }
    async deleteUser(id) {
        await this.userRepository.delete(id);
    }
}
