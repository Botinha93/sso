import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
const parseStringArray = (value) => {
    if (typeof value !== "string" || value.length === 0) {
        return [];
    }
    return JSON.parse(value);
};
const asDate = (value) => new Date(String(value));
const maybeDate = (value) => (value ? asDate(value) : undefined);
export class SqliteDatabase {
    connection;
    constructor(path) {
        const absolutePath = resolve(path);
        mkdirSync(dirname(absolutePath), { recursive: true });
        this.connection = new DatabaseSync(absolutePath);
        this.connection.exec("PRAGMA journal_mode = WAL;");
        this.connection.exec("PRAGMA busy_timeout = 5000;");
        this.connection.exec("PRAGMA foreign_keys = ON;");
        this.connection.exec("PRAGMA synchronous = NORMAL;");
    }
    migrate() {
        this.connection.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        scope TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        given_name TEXT NOT NULL,
        family_name TEXT NOT NULL,
        active INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        secret TEXT NOT NULL,
        redirect_uris_json TEXT NOT NULL,
        allowed_scopes_json TEXT NOT NULL,
        grants_json TEXT NOT NULL,
        require_pkce INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES oauth_clients(id)
      );

      CREATE TABLE IF NOT EXISTS authorization_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        code_challenge TEXT,
        code_challenge_method TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES oauth_clients(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        active INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_role_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        tenant_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, role_id, tenant_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, client_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES oauth_clients(id)
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        token_id TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        consumed_at TEXT,
        revoked_at TEXT,
        rotated_from_token_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES oauth_clients(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS access_tokens (
        id TEXT PRIMARY KEY,
        token_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES oauth_clients(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);
    }
}
const mapRole = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    permissions: parseStringArray(row.permissions_json),
    scope: row.scope,
    createdAt: asDate(row.created_at)
});
const mapUser = (row) => ({
    id: String(row.id),
    email: String(row.email),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    givenName: String(row.given_name),
    familyName: String(row.family_name),
    active: Boolean(row.active),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapClient = (row) => ({
    id: String(row.id),
    name: String(row.name),
    secret: String(row.secret),
    redirectUris: parseStringArray(row.redirect_uris_json),
    allowedScopes: parseStringArray(row.allowed_scopes_json),
    grants: parseStringArray(row.grants_json),
    requirePkce: Boolean(row.require_pkce),
    createdAt: asDate(row.created_at)
});
const mapSession = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    clientId: String(row.client_id),
    createdAt: asDate(row.created_at),
    expiresAt: asDate(row.expires_at),
    revokedAt: maybeDate(row.revoked_at)
});
const mapAuthorizationCode = (row) => ({
    id: String(row.id),
    code: String(row.code),
    clientId: String(row.client_id),
    userId: String(row.user_id),
    redirectUri: String(row.redirect_uri),
    scope: parseStringArray(row.scope_json),
    codeChallenge: row.code_challenge ? String(row.code_challenge) : undefined,
    codeChallengeMethod: row.code_challenge_method ? "S256" : undefined,
    expiresAt: asDate(row.expires_at),
    createdAt: asDate(row.created_at)
});
const mapTenant = (row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    active: Boolean(row.active),
    createdAt: asDate(row.created_at)
});
const mapAssignment = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    roleId: String(row.role_id),
    tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
    createdAt: asDate(row.created_at)
});
const mapConsent = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    clientId: String(row.client_id),
    scope: parseStringArray(row.scope_json),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapRefreshToken = (row) => ({
    id: String(row.id),
    tokenId: String(row.token_id),
    tokenHash: String(row.token_hash),
    userId: String(row.user_id),
    clientId: String(row.client_id),
    sessionId: String(row.session_id),
    scope: parseStringArray(row.scope_json),
    expiresAt: asDate(row.expires_at),
    createdAt: asDate(row.created_at),
    consumedAt: maybeDate(row.consumed_at),
    revokedAt: maybeDate(row.revoked_at),
    rotatedFromTokenId: row.rotated_from_token_id ? String(row.rotated_from_token_id) : undefined
});
const mapAccessToken = (row) => ({
    id: String(row.id),
    tokenId: String(row.token_id),
    userId: String(row.user_id),
    clientId: String(row.client_id),
    sessionId: String(row.session_id),
    expiresAt: asDate(row.expires_at),
    createdAt: asDate(row.created_at),
    revokedAt: maybeDate(row.revoked_at)
});
export class SqliteRoleRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const role = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO roles (id, name, description, permissions_json, scope, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(role.id, role.name, role.description, JSON.stringify(role.permissions), role.scope, role.createdAt.toISOString());
        return role;
    }
    list() {
        return this.db.prepare("SELECT * FROM roles ORDER BY created_at ASC").all().map((row) => mapRole(row));
    }
    findByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const placeholders = ids.map(() => "?").join(", ");
        return this.db.prepare(`SELECT * FROM roles WHERE id IN (${placeholders})`).all(...ids).map((row) => mapRole(row));
    }
    findByName(name) {
        const row = this.db.prepare("SELECT * FROM roles WHERE name = ?").get(name);
        return row ? mapRole(row) : undefined;
    }
}
export class SqliteUserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const now = new Date();
        const user = { ...input, id: nanoid(), createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO users (id, email, username, password_hash, given_name, family_name, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.email, user.username, user.passwordHash, user.givenName, user.familyName, user.active ? 1 : 0, user.createdAt.toISOString(), user.updatedAt.toISOString());
        return user;
    }
    list() {
        return this.db.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map((row) => mapUser(row));
    }
    findByEmail(email) {
        const row = this.db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
        return row ? mapUser(row) : undefined;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        return row ? mapUser(row) : undefined;
    }
}
export class SqliteClientRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const client = { ...input, createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO oauth_clients (id, name, secret, redirect_uris_json, allowed_scopes_json, grants_json, require_pkce, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client.id, client.name, client.secret, JSON.stringify(client.redirectUris), JSON.stringify(client.allowedScopes), JSON.stringify(client.grants), client.requirePkce ? 1 : 0, client.createdAt.toISOString());
        return client;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM oauth_clients WHERE id = ?").get(id);
        return row ? mapClient(row) : undefined;
    }
}
export class SqliteSessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const session = { ...input, id: nanoid() };
        this.db.prepare(`
      INSERT INTO sessions (id, user_id, client_id, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session.id, session.userId, session.clientId, session.createdAt.toISOString(), session.expiresAt.toISOString(), session.revokedAt?.toISOString() ?? null);
        return session;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
        return row ? mapSession(row) : undefined;
    }
}
export class SqliteAuthorizationCodeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const code = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO authorization_codes
      (id, code, client_id, user_id, redirect_uri, scope_json, code_challenge, code_challenge_method, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code.id, code.code, code.clientId, code.userId, code.redirectUri, JSON.stringify(code.scope), code.codeChallenge ?? null, code.codeChallengeMethod ?? null, code.expiresAt.toISOString(), code.createdAt.toISOString());
        return code;
    }
    consume(rawCode) {
        const row = this.db.prepare("SELECT * FROM authorization_codes WHERE code = ?").get(rawCode);
        if (!row) {
            return undefined;
        }
        this.db.prepare("DELETE FROM authorization_codes WHERE code = ?").run(rawCode);
        return mapAuthorizationCode(row);
    }
}
export class SqliteTenantRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const tenant = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO tenants (id, slug, name, active, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tenant.id, tenant.slug, tenant.name, tenant.active ? 1 : 0, tenant.createdAt.toISOString());
        return tenant;
    }
    list() {
        return this.db.prepare("SELECT * FROM tenants ORDER BY created_at ASC").all().map((row) => mapTenant(row));
    }
    findBySlug(slug) {
        const row = this.db.prepare("SELECT * FROM tenants WHERE slug = ?").get(slug);
        return row ? mapTenant(row) : undefined;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
        return row ? mapTenant(row) : undefined;
    }
}
export class SqliteUserRoleAssignmentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    assign(input) {
        const existing = this.db.prepare(`
      SELECT * FROM user_role_assignments
      WHERE user_id = ? AND role_id = ? AND ifnull(tenant_id, '') = ifnull(?, '')
    `).get(input.userId, input.roleId, input.tenantId ?? null);
        if (existing) {
            return mapAssignment(existing);
        }
        const assignment = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO user_role_assignments (id, user_id, role_id, tenant_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignment.id, assignment.userId, assignment.roleId, assignment.tenantId ?? null, assignment.createdAt.toISOString());
        return assignment;
    }
    listByUser(userId) {
        return this.db.prepare("SELECT * FROM user_role_assignments WHERE user_id = ?").all(userId).map((row) => mapAssignment(row));
    }
}
export class SqliteConsentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    upsert(input) {
        const existing = this.findByUserAndClient(input.userId, input.clientId);
        const now = new Date();
        if (existing) {
            this.db.prepare(`
        UPDATE consents
        SET scope_json = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(input.scope), now.toISOString(), existing.id);
            return {
                ...existing,
                scope: input.scope,
                updatedAt: now
            };
        }
        const consent = {
            id: nanoid(),
            userId: input.userId,
            clientId: input.clientId,
            scope: input.scope,
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO consents (id, user_id, client_id, scope_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(consent.id, consent.userId, consent.clientId, JSON.stringify(consent.scope), consent.createdAt.toISOString(), consent.updatedAt.toISOString());
        return consent;
    }
    findByUserAndClient(userId, clientId) {
        const row = this.db.prepare("SELECT * FROM consents WHERE user_id = ? AND client_id = ?").get(userId, clientId);
        return row ? mapConsent(row) : undefined;
    }
}
export class SqliteRefreshTokenRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const token = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO refresh_tokens
      (id, token_id, token_hash, user_id, client_id, session_id, scope_json, expires_at, created_at, consumed_at, revoked_at, rotated_from_token_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(token.id, token.tokenId, token.tokenHash, token.userId, token.clientId, token.sessionId, JSON.stringify(token.scope), token.expiresAt.toISOString(), token.createdAt.toISOString(), token.consumedAt?.toISOString() ?? null, token.revokedAt?.toISOString() ?? null, token.rotatedFromTokenId ?? null);
        return token;
    }
    findActiveByHash(tokenHash) {
        const row = this.db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ?
        AND consumed_at IS NULL
        AND revoked_at IS NULL
    `).get(tokenHash);
        return row ? mapRefreshToken(row) : undefined;
    }
    markConsumed(tokenId, consumedAt) {
        this.db.prepare("UPDATE refresh_tokens SET consumed_at = ? WHERE token_id = ?").run(consumedAt.toISOString(), tokenId);
    }
    revokeTokenFamily(tokenId, revokedAt) {
        this.db.prepare(`
      WITH RECURSIVE family(token_id) AS (
        SELECT token_id FROM refresh_tokens WHERE token_id = ?
        UNION ALL
        SELECT rt.token_id
        FROM refresh_tokens rt
        JOIN family f ON rt.rotated_from_token_id = f.token_id
      )
      UPDATE refresh_tokens
      SET revoked_at = ?
      WHERE token_id IN (SELECT token_id FROM family)
    `).run(tokenId, revokedAt.toISOString());
    }
    revokeByTokenId(tokenId, revokedAt) {
        this.db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_id = ?").run(revokedAt.toISOString(), tokenId);
    }
}
export class SqliteAccessTokenRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const token = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO access_tokens (id, token_id, user_id, client_id, session_id, expires_at, created_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(token.id, token.tokenId, token.userId, token.clientId, token.sessionId, token.expiresAt.toISOString(), token.createdAt.toISOString(), token.revokedAt?.toISOString() ?? null);
        return token;
    }
    isRevoked(tokenId) {
        const row = this.db.prepare("SELECT revoked_at FROM access_tokens WHERE token_id = ?").get(tokenId);
        return Boolean(row?.revoked_at);
    }
    revokeByTokenId(tokenId, revokedAt) {
        this.db.prepare("UPDATE access_tokens SET revoked_at = ? WHERE token_id = ?").run(revokedAt.toISOString(), tokenId);
    }
}
