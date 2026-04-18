import { nanoid } from "nanoid";
export class InMemoryRoleRepository {
    roles = new Map();
    create(input) {
        const role = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.roles.set(role.id, role);
        return role;
    }
    list() {
        return [...this.roles.values()];
    }
    findByIds(ids) {
        return ids.map((id) => this.roles.get(id)).filter((role) => Boolean(role));
    }
}
export class InMemoryUserRepository {
    users = new Map();
    create(input) {
        const now = new Date();
        const user = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.users.set(user.id, user);
        return user;
    }
    list() {
        return [...this.users.values()];
    }
    findByEmail(email) {
        return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase());
    }
    findById(id) {
        return this.users.get(id);
    }
}
export class InMemoryClientRepository {
    clients = new Map();
    create(input) {
        const client = {
            ...input,
            createdAt: new Date()
        };
        this.clients.set(client.id, client);
        return client;
    }
    findById(id) {
        return this.clients.get(id);
    }
}
export class InMemorySessionRepository {
    sessions = new Map();
    create(input) {
        const session = {
            ...input,
            id: nanoid()
        };
        this.sessions.set(session.id, session);
        return session;
    }
}
export class InMemoryAuthorizationCodeRepository {
    codes = new Map();
    create(input) {
        const authorizationCode = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.codes.set(authorizationCode.code, authorizationCode);
        return authorizationCode;
    }
    consume(code) {
        const authorizationCode = this.codes.get(code);
        if (!authorizationCode) {
            return undefined;
        }
        this.codes.delete(code);
        return authorizationCode;
    }
}
