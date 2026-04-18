import { ValidationError } from "../core/errors.js";
import { hashPassword } from "../security/password.js";
export class UserService {
    userRepository;
    roleService;
    constructor(userRepository, roleService) {
        this.userRepository = userRepository;
        this.roleService = roleService;
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
    findUserByEmail(email) {
        return this.userRepository.findByEmail(email);
    }
    findUserById(id) {
        return this.userRepository.findById(id);
    }
}
