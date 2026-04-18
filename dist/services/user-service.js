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
    createUser(input) {
        if (this.userRepository.findByEmail(input.email)) {
            throw new ValidationError("A user with this email already exists");
        }
        const user = this.userRepository.create({
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
    findUserByEmail(email) {
        return this.userRepository.findByEmail(email);
    }
    findUserByUsername(username) {
        return this.userRepository.findByUsername(username);
    }
    findUserById(id) {
        return this.userRepository.findById(id);
    }
    setUserActive(id, active) {
        this.userRepository.setActive(id, active);
    }
    setCustomAttributes(id, customAttributes) {
        this.userRepository.setCustomAttributes(id, customAttributes);
    }
    deleteUser(id) {
        this.userRepository.delete(id);
    }
}
