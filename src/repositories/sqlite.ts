import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type {
  AccessTokenRecord,
  AuthenticationFlow,
  AuditEvent,
  AuthorizationCode,
  Consent,
  FederationProvider,
  FederatedIdentity,
  FederationTransaction,
  GroupUserAttributeAssignment,
  Group,
  GroupRoleAssignment,
  OAuthClient,
  OAuthScope,
  EventHook,
  EventNotification,
  PolicyAssignment,
  PolicyDefinition,
  PolicyScopeType,
  RefreshTokenRecord,
  Role,
  Session,
  Tenant,
  User,
  UserAttributeDefinition,
  UserGroupAssignment,
  UserRoleAssignment
} from "../domain/models.js";
import type {
  AccessTokenRepository,
  AuthenticationFlowRepository,
  AuditRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ScopeRepository,
  ConsentRepository,
  FederationProviderRepository,
  FederatedIdentityRepository,
  FederationTransactionRepository,
  GroupUserAttributeAssignmentRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  PolicyDefinitionRepository,
  PolicyAssignmentRepository,
  EventHookRepository,
  EventNotificationRepository,
  RefreshTokenRepository,
  RoleRepository,
  SessionRepository,
  TenantRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository
} from "./contracts.js";

type DbRow = Record<string, unknown>;

const parseStringArray = (value: unknown): string[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  return JSON.parse(value) as string[];
};

const parseStringRecord = (value: unknown): Record<string, string> => {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw === "string") {
      output[key] = raw;
    }
  }

  return output;
};

const asDate = (value: unknown): Date => new Date(String(value));

const maybeDate = (value: unknown): Date | undefined => (value ? asDate(value) : undefined);

export class SqliteDatabase {
  readonly connection: Database.Database;

  constructor(path: string) {
    const absolutePath = resolve(path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.connection = new Database(absolutePath);
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
        custom_attributes_json TEXT NOT NULL DEFAULT '{}',
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
        resources_json TEXT NOT NULL DEFAULT '[]',
        flow_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_scopes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_group_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, group_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (group_id) REFERENCES groups(id)
      );

      CREATE TABLE IF NOT EXISTS group_role_assignments (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (group_id, role_id),
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (role_id) REFERENCES roles(id)
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

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        actor_id TEXT,
        actor_type TEXT NOT NULL,
        client_id TEXT,
        ip TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS federated_identities (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        provider_subject TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL,
        UNIQUE (provider_id, provider_subject),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS federation_transactions (
        state TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        redirect_after_login TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS federation_providers (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        authorization_endpoint TEXT NOT NULL,
        token_endpoint TEXT NOT NULL,
        userinfo_endpoint TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS authentication_flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        designation TEXT NOT NULL DEFAULT 'authentication',
        enabled INTEGER NOT NULL,
        grants_json TEXT NOT NULL DEFAULT '["authorization_code"]',
        stages_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_attribute_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS group_user_attribute_assignments (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        attribute_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (group_id, attribute_id),
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (attribute_id) REFERENCES user_attribute_definitions(id)
      );

      CREATE TABLE IF NOT EXISTS policy_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS policy_assignments (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (policy_id, scope_type, scope_id),
        FOREIGN KEY (policy_id) REFERENCES policy_definitions(id)
      );

      CREATE TABLE IF NOT EXISTS event_hooks (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        target_url TEXT NOT NULL,
        method TEXT NOT NULL,
        headers_json TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_notifications (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        hook_id TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (hook_id) REFERENCES event_hooks(id)
      );
    `);

    const userColumns = this.connection.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasCustomAttributesColumn = userColumns.some((column) => column.name === "custom_attributes_json");
    if (!hasCustomAttributesColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN custom_attributes_json TEXT NOT NULL DEFAULT '{}';");
    }

    const clientColumns = this.connection.prepare("PRAGMA table_info(oauth_clients)").all() as Array<{ name: string }>;
    const hasResourcesColumn = clientColumns.some((column) => column.name === "resources_json");
    if (!hasResourcesColumn) {
      this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN resources_json TEXT NOT NULL DEFAULT '[]';");
    }
    const hasFlowIdsColumn = clientColumns.some((column) => column.name === "flow_ids_json");
    if (!hasFlowIdsColumn) {
      this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN flow_ids_json TEXT NOT NULL DEFAULT '[]';");
    }

    const authFlowColumns = this.connection.prepare("PRAGMA table_info(authentication_flows)").all() as Array<{ name: string }>;
    const hasDesignationColumn = authFlowColumns.some((column) => column.name === "designation");
    if (!hasDesignationColumn) {
      this.connection.exec("ALTER TABLE authentication_flows ADD COLUMN designation TEXT NOT NULL DEFAULT 'authentication';");
    }
    const hasGrantsColumn = authFlowColumns.some((column) => column.name === "grants_json");
    if (!hasGrantsColumn) {
      this.connection.exec("ALTER TABLE authentication_flows ADD COLUMN grants_json TEXT NOT NULL DEFAULT '[\"authorization_code\"]';");
    }
  }
}

const mapRole = (row: DbRow): Role => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  permissions: parseStringArray(row.permissions_json),
  scope: row.scope as Role["scope"],
  createdAt: asDate(row.created_at)
});

const mapUser = (row: DbRow): User => ({
  id: String(row.id),
  email: String(row.email),
  username: String(row.username),
  passwordHash: String(row.password_hash),
  givenName: String(row.given_name),
  familyName: String(row.family_name),
  customAttributes: parseStringRecord(row.custom_attributes_json),
  active: Boolean(row.active),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapClient = (row: DbRow): OAuthClient => ({
  id: String(row.id),
  name: String(row.name),
  secret: String(row.secret),
  redirectUris: parseStringArray(row.redirect_uris_json),
  allowedScopes: parseStringArray(row.allowed_scopes_json),
  grants: parseStringArray(row.grants_json) as OAuthClient["grants"],
  requirePkce: Boolean(row.require_pkce),
  resources: parseStringArray(row.resources_json),
  flowIds: parseStringArray(row.flow_ids_json),
  createdAt: asDate(row.created_at)
});

const mapScope = (row: DbRow): OAuthScope => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  createdAt: asDate(row.created_at)
});

const mapSession = (row: DbRow): Session => ({
  id: String(row.id),
  userId: String(row.user_id),
  clientId: String(row.client_id),
  createdAt: asDate(row.created_at),
  expiresAt: asDate(row.expires_at),
  revokedAt: maybeDate(row.revoked_at)
});

const mapAuthorizationCode = (row: DbRow): AuthorizationCode => ({
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

const mapTenant = (row: DbRow): Tenant => ({
  id: String(row.id),
  slug: String(row.slug),
  name: String(row.name),
  active: Boolean(row.active),
  createdAt: asDate(row.created_at)
});

const mapGroup = (row: DbRow): Group => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  createdAt: asDate(row.created_at)
});

const mapUserGroupAssignment = (row: DbRow): UserGroupAssignment => ({
  id: String(row.id),
  userId: String(row.user_id),
  groupId: String(row.group_id),
  createdAt: asDate(row.created_at)
});

const mapGroupRoleAssignment = (row: DbRow): GroupRoleAssignment => ({
  id: String(row.id),
  groupId: String(row.group_id),
  roleId: String(row.role_id),
  createdAt: asDate(row.created_at)
});

const mapFederatedIdentity = (row: DbRow): FederatedIdentity => ({
  id: String(row.id),
  providerId: String(row.provider_id),
  providerSubject: String(row.provider_subject),
  userId: String(row.user_id),
  email: row.email ? String(row.email) : undefined,
  createdAt: asDate(row.created_at),
  lastLoginAt: asDate(row.last_login_at)
});

const mapFederationTransaction = (row: DbRow): FederationTransaction => ({
  state: String(row.state),
  providerId: String(row.provider_id),
  codeVerifier: String(row.code_verifier),
  redirectAfterLogin: String(row.redirect_after_login),
  createdAt: asDate(row.created_at),
  expiresAt: asDate(row.expires_at)
});

const mapFederationProvider = (row: DbRow): FederationProvider => ({
  id: String(row.id),
  label: String(row.label),
  authorizationEndpoint: String(row.authorization_endpoint),
  tokenEndpoint: String(row.token_endpoint),
  userInfoEndpoint: String(row.userinfo_endpoint),
  clientId: String(row.client_id),
  clientSecret: String(row.client_secret),
  scopes: parseStringArray(row.scopes_json),
  enabled: Boolean(row.enabled),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapAuthenticationFlow = (row: DbRow): AuthenticationFlow => ({
  id: String(row.id),
  name: String(row.name),
  description: String(row.description),
  designation: (typeof row.designation === "string" && row.designation.length > 0 ? row.designation : "authentication") as AuthenticationFlow["designation"],
  enabled: Boolean(row.enabled),
  grantTypes: (parseStringArray(row.grants_json).length ? parseStringArray(row.grants_json) : ["authorization_code"]) as AuthenticationFlow["grantTypes"],
  stages: JSON.parse(String(row.stages_json)) as AuthenticationFlow["stages"],
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapUserAttributeDefinition = (row: DbRow): UserAttributeDefinition => ({
  id: String(row.id),
  key: String(row.key),
  name: String(row.name),
  description: String(row.description),
  type: String(row.type) as UserAttributeDefinition["type"],
  enabled: Boolean(row.enabled),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapGroupUserAttributeAssignment = (row: DbRow): GroupUserAttributeAssignment => ({
  id: String(row.id),
  groupId: String(row.group_id),
  attributeId: String(row.attribute_id),
  enabled: Boolean(row.enabled),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapPolicyDefinition = (row: DbRow): PolicyDefinition => ({
  id: String(row.id),
  key: String(row.key),
  name: String(row.name),
  description: String(row.description),
  enabled: Boolean(row.enabled),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapPolicyAssignment = (row: DbRow): PolicyAssignment => ({
  id: String(row.id),
  policyId: String(row.policy_id),
  scopeType: String(row.scope_type) as PolicyScopeType,
  scopeId: String(row.scope_id),
  enabled: Boolean(row.enabled),
  config: JSON.parse(String(row.config_json)) as Record<string, unknown>,
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapEventHook = (row: DbRow): EventHook => ({
  id: String(row.id),
  eventType: String(row.event_type),
  targetUrl: String(row.target_url),
  method: String(row.method) as EventHook["method"],
  headers: JSON.parse(String(row.headers_json)) as Record<string, string>,
  enabled: Boolean(row.enabled),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapEventNotification = (row: DbRow): EventNotification => ({
  id: String(row.id),
  eventType: String(row.event_type),
  hookId: row.hook_id ? String(row.hook_id) : undefined,
  payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
  status: String(row.status) as EventNotification["status"],
  responseStatus: typeof row.response_status === "number" ? row.response_status : undefined,
  responseBody: row.response_body ? String(row.response_body) : undefined,
  error: row.error ? String(row.error) : undefined,
  createdAt: asDate(row.created_at)
});

const mapAssignment = (row: DbRow): UserRoleAssignment => ({
  id: String(row.id),
  userId: String(row.user_id),
  roleId: String(row.role_id),
  tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
  createdAt: asDate(row.created_at)
});

const mapConsent = (row: DbRow): Consent => ({
  id: String(row.id),
  userId: String(row.user_id),
  clientId: String(row.client_id),
  scope: parseStringArray(row.scope_json),
  createdAt: asDate(row.created_at),
  updatedAt: asDate(row.updated_at)
});

const mapRefreshToken = (row: DbRow): RefreshTokenRecord => ({
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

const mapAccessToken = (row: DbRow): AccessTokenRecord => ({
  id: String(row.id),
  tokenId: String(row.token_id),
  userId: String(row.user_id),
  clientId: String(row.client_id),
  sessionId: String(row.session_id),
  expiresAt: asDate(row.expires_at),
  createdAt: asDate(row.created_at),
  revokedAt: maybeDate(row.revoked_at)
});

export class SqliteRoleRepository implements RoleRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<Role, "id" | "createdAt">): Role {
    const role = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO roles (id, name, description, permissions_json, scope, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(role.id, role.name, role.description, JSON.stringify(role.permissions), role.scope, role.createdAt.toISOString());
    return role;
  }

  list(): Role[] {
    const rows = this.db.prepare("SELECT * FROM roles ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapRole);
  }

  findByIds(ids: string[]): Role[] {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db.prepare(`SELECT * FROM roles WHERE id IN (${placeholders})`).all(...ids) as DbRow[];
    return rows.map(mapRole);
  }

  update(id: string, input: Partial<Omit<Role, "id" | "createdAt">>): Role | undefined {
    const existing = this.db.prepare("SELECT * FROM roles WHERE id = ?").get(id) as DbRow | undefined;
    if (!existing) return undefined;
    const current = mapRole(existing);
    const updated = { ...current, ...input };
    this.db.prepare(`
      UPDATE roles SET name = ?, description = ?, permissions_json = ?, scope = ? WHERE id = ?
    `).run(updated.name, updated.description, JSON.stringify(updated.permissions), updated.scope, id);
    return updated;
  }

  findByName(name: string): Role | undefined {
    const row = this.db.prepare("SELECT * FROM roles WHERE name = ?").get(name);
    return row ? mapRole(row as DbRow) : undefined;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM roles WHERE id = ?").run(id);
  }
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): User {
    const now = new Date();
    const user: User = { ...input, id: nanoid(), createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO users (id, email, username, password_hash, given_name, family_name, custom_attributes_json, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email,
      user.username,
      user.passwordHash,
      user.givenName,
      user.familyName,
      JSON.stringify(user.customAttributes),
      user.active ? 1 : 0,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
    return user;
  }

  list(): User[] {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapUser);
  }

  findByEmail(email: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
    return row ? mapUser(row as DbRow) : undefined;
  }

  findByUsername(username: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").get(username);
    return row ? mapUser(row as DbRow) : undefined;
  }

  findById(id: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? mapUser(row as DbRow) : undefined;
  }

  updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName">>): User | undefined {
    const current = this.findById(id);
    if (!current) return undefined;

    const updated = {
      ...current,
      email: input.email ?? current.email,
      username: input.username ?? current.username,
      givenName: input.givenName ?? current.givenName,
      familyName: input.familyName ?? current.familyName,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE users
      SET email = ?, username = ?, given_name = ?, family_name = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.email,
      updated.username,
      updated.givenName,
      updated.familyName,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  setActive(id: string, active: boolean): void {
    this.db.prepare("UPDATE users SET active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
  }

  setCustomAttributes(id: string, customAttributes: Record<string, string>): void {
    this.db.prepare("UPDATE users SET custom_attributes_json = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(customAttributes),
      new Date().toISOString(),
      id
    );
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
}

export class SqliteClientRepository implements ClientRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<OAuthClient, "createdAt">): OAuthClient {
    const client: OAuthClient = {
      ...input,
      resources: input.resources ?? [],
      flowIds: input.flowIds ?? [],
      createdAt: new Date()
    };
    this.db.prepare(`
      INSERT INTO oauth_clients (id, name, secret, redirect_uris_json, allowed_scopes_json, grants_json, require_pkce, resources_json, flow_ids_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client.id,
      client.name,
      client.secret,
      JSON.stringify(client.redirectUris),
      JSON.stringify(client.allowedScopes),
      JSON.stringify(client.grants),
      client.requirePkce ? 1 : 0,
      JSON.stringify(client.resources),
      JSON.stringify(client.flowIds),
      client.createdAt.toISOString()
    );
    return client;
  }

  findById(id: string): OAuthClient | undefined {
    const row = this.db.prepare("SELECT * FROM oauth_clients WHERE id = ?").get(id);
    return row ? mapClient(row as DbRow) : undefined;
  }

  list(): OAuthClient[] {
    const rows = this.db.prepare("SELECT * FROM oauth_clients ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapClient);
  }

  update(id: string, input: Partial<Omit<OAuthClient, "id" | "createdAt">>): OAuthClient | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...input };
    this.db.prepare(`
      UPDATE oauth_clients
      SET name = ?, secret = ?, redirect_uris_json = ?, allowed_scopes_json = ?, grants_json = ?, require_pkce = ?, resources_json = ?, flow_ids_json = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.secret,
      JSON.stringify(updated.redirectUris),
      JSON.stringify(updated.allowedScopes),
      JSON.stringify(updated.grants),
      updated.requirePkce ? 1 : 0,
      JSON.stringify(updated.resources),
      JSON.stringify(updated.flowIds),
      id
    );
    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM oauth_clients WHERE id = ?").run(id);
  }
}

export class SqliteScopeRepository implements ScopeRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<OAuthScope, "id" | "createdAt">): OAuthScope {
    const scope: OAuthScope = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO oauth_scopes (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(scope.id, scope.name, scope.description, scope.createdAt.toISOString());
    return scope;
  }

  list(): OAuthScope[] {
    const rows = this.db.prepare("SELECT * FROM oauth_scopes ORDER BY name ASC").all() as DbRow[];
    return rows.map(mapScope);
  }

  findByName(name: string): OAuthScope | undefined {
    const row = this.db.prepare("SELECT * FROM oauth_scopes WHERE name = ?").get(name) as DbRow | undefined;
    return row ? mapScope(row) : undefined;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM oauth_scopes WHERE id = ?").run(id);
  }
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<Session, "id">): Session {
    const session: Session = { ...input, id: nanoid() };
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, client_id, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.userId,
      session.clientId,
      session.createdAt.toISOString(),
      session.expiresAt.toISOString(),
      session.revokedAt?.toISOString() ?? null
    );
    return session;
  }

  findById(id: string): Session | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    return row ? mapSession(row as DbRow) : undefined;
  }

  list(): Session[] {
    const rows = this.db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all() as DbRow[];
    return rows.map(mapSession);
  }

  revoke(id: string, revokedAt: Date): void {
    this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(revokedAt.toISOString(), id);
  }
}

export class SqliteAuthorizationCodeRepository implements AuthorizationCodeRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<AuthorizationCode, "id" | "createdAt">): AuthorizationCode {
    const code: AuthorizationCode = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO authorization_codes
      (id, code, client_id, user_id, redirect_uri, scope_json, code_challenge, code_challenge_method, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.id,
      code.code,
      code.clientId,
      code.userId,
      code.redirectUri,
      JSON.stringify(code.scope),
      code.codeChallenge ?? null,
      code.codeChallengeMethod ?? null,
      code.expiresAt.toISOString(),
      code.createdAt.toISOString()
    );
    return code;
  }

  consume(rawCode: string): AuthorizationCode | undefined {
    const row = this.db.prepare("SELECT * FROM authorization_codes WHERE code = ?").get(rawCode);

    if (!row) {
      return undefined;
    }

    this.db.prepare("DELETE FROM authorization_codes WHERE code = ?").run(rawCode);
    return mapAuthorizationCode(row as DbRow);
  }
}

export class SqliteTenantRepository implements TenantRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<Tenant, "id" | "createdAt">): Tenant {
    const tenant: Tenant = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO tenants (id, slug, name, active, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tenant.id, tenant.slug, tenant.name, tenant.active ? 1 : 0, tenant.createdAt.toISOString());
    return tenant;
  }

  list(): Tenant[] {
    const rows = this.db.prepare("SELECT * FROM tenants ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapTenant);
  }

  findBySlug(slug: string): Tenant | undefined {
    const row = this.db.prepare("SELECT * FROM tenants WHERE slug = ?").get(slug);
    return row ? mapTenant(row as DbRow) : undefined;
  }

  findById(id: string): Tenant | undefined {
    const row = this.db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
    return row ? mapTenant(row as DbRow) : undefined;
  }

  update(id: string, input: Partial<Omit<Tenant, "id" | "createdAt">>): Tenant | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updated: Tenant = {
      ...existing,
      slug: input.slug ?? existing.slug,
      name: input.name ?? existing.name,
      active: input.active ?? existing.active
    };

    this.db.prepare(`
      UPDATE tenants SET slug = ?, name = ?, active = ? WHERE id = ?
    `).run(updated.slug, updated.name, updated.active ? 1 : 0, id);

    return updated;
  }
}

export class SqliteGroupRepository implements GroupRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<Group, "id" | "createdAt">): Group {
    const group: Group = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO groups (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(group.id, group.name, group.description, group.createdAt.toISOString());
    return group;
  }

  list(): Group[] {
    const rows = this.db.prepare("SELECT * FROM groups ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapGroup);
  }

  findById(id: string): Group | undefined {
    const row = this.db.prepare("SELECT * FROM groups WHERE id = ?").get(id);
    return row ? mapGroup(row as DbRow) : undefined;
  }

  update(id: string, input: Partial<Omit<Group, "id" | "createdAt">>): Group | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updated: Group = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description
    };

    this.db.prepare(`
      UPDATE groups SET name = ?, description = ? WHERE id = ?
    `).run(updated.name, updated.description, id);

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM groups WHERE id = ?").run(id);
  }
}

export class SqliteUserGroupAssignmentRepository implements UserGroupAssignmentRepository {
  constructor(private readonly db: Database.Database) {}

  assign(input: Omit<UserGroupAssignment, "id" | "createdAt">): UserGroupAssignment {
    const existing = this.db.prepare(`
      SELECT * FROM user_group_assignments
      WHERE user_id = ? AND group_id = ?
    `).get(input.userId, input.groupId);

    if (existing) {
      return mapUserGroupAssignment(existing as DbRow);
    }

    const assignment: UserGroupAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO user_group_assignments (id, user_id, group_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(assignment.id, assignment.userId, assignment.groupId, assignment.createdAt.toISOString());

    return assignment;
  }

  listByUser(userId: string): UserGroupAssignment[] {
    const rows = this.db.prepare("SELECT * FROM user_group_assignments WHERE user_id = ?").all(userId) as DbRow[];
    return rows.map(mapUserGroupAssignment);
  }

  remove(userId: string, groupId: string): void {
    this.db.prepare("DELETE FROM user_group_assignments WHERE user_id = ? AND group_id = ?").run(userId, groupId);
  }
}

export class SqliteGroupRoleAssignmentRepository implements GroupRoleAssignmentRepository {
  constructor(private readonly db: Database.Database) {}

  assign(input: Omit<GroupRoleAssignment, "id" | "createdAt">): GroupRoleAssignment {
    const existing = this.db.prepare(`
      SELECT * FROM group_role_assignments
      WHERE group_id = ? AND role_id = ?
    `).get(input.groupId, input.roleId);

    if (existing) {
      return mapGroupRoleAssignment(existing as DbRow);
    }

    const assignment: GroupRoleAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO group_role_assignments (id, group_id, role_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(assignment.id, assignment.groupId, assignment.roleId, assignment.createdAt.toISOString());

    return assignment;
  }

  listByGroup(groupId: string): GroupRoleAssignment[] {
    const rows = this.db.prepare("SELECT * FROM group_role_assignments WHERE group_id = ?").all(groupId) as DbRow[];
    return rows.map(mapGroupRoleAssignment);
  }

  listByGroups(groupIds: string[]): GroupRoleAssignment[] {
    if (groupIds.length === 0) {
      return [];
    }

    const placeholders = groupIds.map(() => "?").join(", ");
    const rows = this.db.prepare(`SELECT * FROM group_role_assignments WHERE group_id IN (${placeholders})`).all(...groupIds) as DbRow[];
    return rows.map(mapGroupRoleAssignment);
  }

  remove(groupId: string, roleId: string): void {
    this.db.prepare("DELETE FROM group_role_assignments WHERE group_id = ? AND role_id = ?").run(groupId, roleId);
  }
}

export class SqliteUserRoleAssignmentRepository implements UserRoleAssignmentRepository {
  constructor(private readonly db: Database.Database) {}

  assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): UserRoleAssignment {
    const existing = this.db.prepare(`
      SELECT * FROM user_role_assignments
      WHERE user_id = ? AND role_id = ? AND ifnull(tenant_id, '') = ifnull(?, '')
    `).get(input.userId, input.roleId, input.tenantId ?? null);

    if (existing) {
      return mapAssignment(existing as DbRow);
    }

    const assignment: UserRoleAssignment = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO user_role_assignments (id, user_id, role_id, tenant_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      assignment.id,
      assignment.userId,
      assignment.roleId,
      assignment.tenantId ?? null,
      assignment.createdAt.toISOString()
    );
    return assignment;
  }

  listByUser(userId: string): UserRoleAssignment[] {
    const rows = this.db.prepare("SELECT * FROM user_role_assignments WHERE user_id = ?").all(userId) as DbRow[];
    return rows.map(mapAssignment);
  }
}

export class SqliteConsentRepository implements ConsentRepository {
  constructor(private readonly db: Database.Database) {}

  upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Consent {
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

    const consent: Consent = {
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
    `).run(
      consent.id,
      consent.userId,
      consent.clientId,
      JSON.stringify(consent.scope),
      consent.createdAt.toISOString(),
      consent.updatedAt.toISOString()
    );
    return consent;
  }

  findByUserAndClient(userId: string, clientId: string): Consent | undefined {
    const row = this.db.prepare("SELECT * FROM consents WHERE user_id = ? AND client_id = ?").get(userId, clientId);
    return row ? mapConsent(row as DbRow) : undefined;
  }

  list(): Consent[] {
    const rows = this.db.prepare("SELECT * FROM consents ORDER BY updated_at DESC").all() as DbRow[];
    return rows.map(mapConsent);
  }

  revoke(id: string): void {
    this.db.prepare("DELETE FROM consents WHERE id = ?").run(id);
  }
}

export class SqliteRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): RefreshTokenRecord {
    const token: RefreshTokenRecord = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO refresh_tokens
      (id, token_id, token_hash, user_id, client_id, session_id, scope_json, expires_at, created_at, consumed_at, revoked_at, rotated_from_token_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token.id,
      token.tokenId,
      token.tokenHash,
      token.userId,
      token.clientId,
      token.sessionId,
      JSON.stringify(token.scope),
      token.expiresAt.toISOString(),
      token.createdAt.toISOString(),
      token.consumedAt?.toISOString() ?? null,
      token.revokedAt?.toISOString() ?? null,
      token.rotatedFromTokenId ?? null
    );
    return token;
  }

  findActiveByHash(tokenHash: string): RefreshTokenRecord | undefined {
    const row = this.db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ?
        AND consumed_at IS NULL
        AND revoked_at IS NULL
    `).get(tokenHash);

    return row ? mapRefreshToken(row as DbRow) : undefined;
  }

  markConsumed(tokenId: string, consumedAt: Date): void {
    this.db.prepare("UPDATE refresh_tokens SET consumed_at = ? WHERE token_id = ?").run(consumedAt.toISOString(), tokenId);
  }

  revokeTokenFamily(tokenId: string, revokedAt: Date): void {
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

  revokeByTokenId(tokenId: string, revokedAt: Date): void {
    this.db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_id = ?").run(revokedAt.toISOString(), tokenId);
  }
}

export class SqliteAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<AccessTokenRecord, "id" | "createdAt">): AccessTokenRecord {
    const token: AccessTokenRecord = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO access_tokens (id, token_id, user_id, client_id, session_id, expires_at, created_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token.id,
      token.tokenId,
      token.userId,
      token.clientId,
      token.sessionId,
      token.expiresAt.toISOString(),
      token.createdAt.toISOString(),
      token.revokedAt?.toISOString() ?? null
    );
    return token;
  }

  isRevoked(tokenId: string): boolean {
    const row = this.db.prepare("SELECT revoked_at FROM access_tokens WHERE token_id = ?").get(tokenId);
    return Boolean((row as DbRow | undefined)?.revoked_at);
  }

  revokeByTokenId(tokenId: string, revokedAt: Date): void {
    this.db.prepare("UPDATE access_tokens SET revoked_at = ? WHERE token_id = ?").run(revokedAt.toISOString(), tokenId);
  }
}

export class SqliteAuditRepository implements AuditRepository {
  constructor(private readonly db: Database.Database) {}

  log(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
    const event: AuditEvent = { ...input, id: nanoid(), createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO audit_events (id, type, actor_id, actor_type, client_id, ip, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.type,
      event.actorId ?? null,
      event.actorType,
      event.clientId ?? null,
      event.ip ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.createdAt.toISOString()
    );
    return event;
  }

  list(limit = 200): AuditEvent[] {
    const rows = this.db.prepare(
      "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?"
    ).all(limit) as DbRow[];
    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type) as AuditEvent["type"],
      actorId: row.actor_id ? String(row.actor_id) : undefined,
      actorType: String(row.actor_type) as AuditEvent["actorType"],
      clientId: row.client_id ? String(row.client_id) : undefined,
      ip: row.ip ? String(row.ip) : undefined,
      metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
      createdAt: new Date(String(row.created_at))
    }));
  }
}

export class SqliteFederatedIdentityRepository implements FederatedIdentityRepository {
  constructor(private readonly db: Database.Database) {}

  findByProviderSubject(providerId: string, providerSubject: string): FederatedIdentity | undefined {
    const row = this.db.prepare(
      "SELECT * FROM federated_identities WHERE provider_id = ? AND provider_subject = ?"
    ).get(providerId, providerSubject);
    return row ? mapFederatedIdentity(row as DbRow) : undefined;
  }

  create(input: Omit<FederatedIdentity, "id" | "createdAt" | "lastLoginAt">): FederatedIdentity {
    const entity: FederatedIdentity = {
      ...input,
      id: nanoid(),
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    this.db.prepare(`
      INSERT INTO federated_identities (id, provider_id, provider_subject, user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entity.id,
      entity.providerId,
      entity.providerSubject,
      entity.userId,
      entity.email ?? null,
      entity.createdAt.toISOString(),
      entity.lastLoginAt.toISOString()
    );

    return entity;
  }

  touchLogin(id: string, loggedAt: Date): void {
    this.db.prepare("UPDATE federated_identities SET last_login_at = ? WHERE id = ?").run(loggedAt.toISOString(), id);
  }
}

export class SqliteFederationTransactionRepository implements FederationTransactionRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<FederationTransaction, "createdAt">): FederationTransaction {
    const transaction: FederationTransaction = {
      ...input,
      createdAt: new Date()
    };

    this.db.prepare(`
      INSERT INTO federation_transactions (state, provider_id, code_verifier, redirect_after_login, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      transaction.state,
      transaction.providerId,
      transaction.codeVerifier,
      transaction.redirectAfterLogin,
      transaction.createdAt.toISOString(),
      transaction.expiresAt.toISOString()
    );

    return transaction;
  }

  consume(state: string): FederationTransaction | undefined {
    const row = this.db.prepare("SELECT * FROM federation_transactions WHERE state = ?").get(state);
    if (!row) {
      return undefined;
    }

    this.db.prepare("DELETE FROM federation_transactions WHERE state = ?").run(state);
    return mapFederationTransaction(row as DbRow);
  }

  purgeExpired(now: Date): void {
    this.db.prepare("DELETE FROM federation_transactions WHERE expires_at < ?").run(now.toISOString());
  }
}

export class SqliteFederationProviderRepository implements FederationProviderRepository {
  constructor(private readonly db: Database.Database) {}

  list(): FederationProvider[] {
    const rows = this.db.prepare("SELECT * FROM federation_providers ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapFederationProvider);
  }

  findById(id: string): FederationProvider | undefined {
    const row = this.db.prepare("SELECT * FROM federation_providers WHERE id = ?").get(id);
    return row ? mapFederationProvider(row as DbRow) : undefined;
  }

  create(input: Omit<FederationProvider, "createdAt" | "updatedAt">): FederationProvider {
    const now = new Date();
    const provider: FederationProvider = { ...input, createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO federation_providers
      (id, label, authorization_endpoint, token_endpoint, userinfo_endpoint, client_id, client_secret, scopes_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider.id,
      provider.label,
      provider.authorizationEndpoint,
      provider.tokenEndpoint,
      provider.userInfoEndpoint,
      provider.clientId,
      provider.clientSecret,
      JSON.stringify(provider.scopes),
      provider.enabled ? 1 : 0,
      provider.createdAt.toISOString(),
      provider.updatedAt.toISOString()
    );

    return provider;
  }

  update(id: string, input: Partial<Omit<FederationProvider, "id" | "createdAt" | "updatedAt">>): FederationProvider | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: FederationProvider = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE federation_providers
      SET label = ?, authorization_endpoint = ?, token_endpoint = ?, userinfo_endpoint = ?, client_id = ?, client_secret = ?, scopes_json = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.label,
      updated.authorizationEndpoint,
      updated.tokenEndpoint,
      updated.userInfoEndpoint,
      updated.clientId,
      updated.clientSecret,
      JSON.stringify(updated.scopes),
      updated.enabled ? 1 : 0,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM federation_providers WHERE id = ?").run(id);
  }
}

export class SqliteAuthenticationFlowRepository implements AuthenticationFlowRepository {
  constructor(private readonly db: Database.Database) {}

  list(): AuthenticationFlow[] {
    const rows = this.db.prepare("SELECT * FROM authentication_flows ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapAuthenticationFlow);
  }

  findById(id: string): AuthenticationFlow | undefined {
    const row = this.db.prepare("SELECT * FROM authentication_flows WHERE id = ?").get(id);
    return row ? mapAuthenticationFlow(row as DbRow) : undefined;
  }

  create(input: Omit<AuthenticationFlow, "createdAt" | "updatedAt">): AuthenticationFlow {
    const now = new Date();
    const flow: AuthenticationFlow = { ...input, createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO authentication_flows (id, name, description, designation, enabled, grants_json, stages_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      flow.id,
      flow.name,
      flow.description,
      flow.designation,
      flow.enabled ? 1 : 0,
      JSON.stringify(flow.grantTypes),
      JSON.stringify(flow.stages),
      flow.createdAt.toISOString(),
      flow.updatedAt.toISOString()
    );

    return flow;
  }

  update(id: string, input: Partial<Omit<AuthenticationFlow, "id" | "createdAt" | "updatedAt">>): AuthenticationFlow | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: AuthenticationFlow = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE authentication_flows
      SET name = ?, description = ?, designation = ?, enabled = ?, grants_json = ?, stages_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.description,
      updated.designation,
      updated.enabled ? 1 : 0,
      JSON.stringify(updated.grantTypes),
      JSON.stringify(updated.stages),
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM authentication_flows WHERE id = ?").run(id);
  }
}

export class SqliteUserAttributeRepository implements UserAttributeRepository {
  constructor(private readonly db: Database.Database) {}

  list(): UserAttributeDefinition[] {
    const rows = this.db.prepare("SELECT * FROM user_attribute_definitions ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapUserAttributeDefinition);
  }

  findById(id: string): UserAttributeDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM user_attribute_definitions WHERE id = ?").get(id);
    return row ? mapUserAttributeDefinition(row as DbRow) : undefined;
  }

  findByKey(key: string): UserAttributeDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM user_attribute_definitions WHERE key = ?").get(key);
    return row ? mapUserAttributeDefinition(row as DbRow) : undefined;
  }

  create(input: Omit<UserAttributeDefinition, "createdAt" | "updatedAt">): UserAttributeDefinition {
    const now = new Date();
    const attribute: UserAttributeDefinition = { ...input, createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO user_attribute_definitions (id, key, name, description, type, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attribute.id,
      attribute.key,
      attribute.name,
      attribute.description,
      attribute.type,
      attribute.enabled ? 1 : 0,
      attribute.createdAt.toISOString(),
      attribute.updatedAt.toISOString()
    );

    return attribute;
  }

  update(id: string, input: Partial<Omit<UserAttributeDefinition, "id" | "createdAt" | "updatedAt">>): UserAttributeDefinition | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: UserAttributeDefinition = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE user_attribute_definitions
      SET key = ?, name = ?, description = ?, type = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.key,
      updated.name,
      updated.description,
      updated.type,
      updated.enabled ? 1 : 0,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM user_attribute_definitions WHERE id = ?").run(id);
  }
}

export class SqliteGroupUserAttributeAssignmentRepository implements GroupUserAttributeAssignmentRepository {
  constructor(private readonly db: Database.Database) {}

  list(): GroupUserAttributeAssignment[] {
    const rows = this.db.prepare("SELECT * FROM group_user_attribute_assignments ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapGroupUserAttributeAssignment);
  }

  listByAttribute(attributeId: string): GroupUserAttributeAssignment[] {
    const rows = this.db.prepare("SELECT * FROM group_user_attribute_assignments WHERE attribute_id = ? ORDER BY created_at ASC").all(attributeId) as DbRow[];
    return rows.map(mapGroupUserAttributeAssignment);
  }

  upsert(input: Omit<GroupUserAttributeAssignment, "id" | "createdAt" | "updatedAt">): GroupUserAttributeAssignment {
    const existing = this.db.prepare(
      "SELECT * FROM group_user_attribute_assignments WHERE group_id = ? AND attribute_id = ?"
    ).get(input.groupId, input.attributeId);

    if (existing) {
      const current = mapGroupUserAttributeAssignment(existing as DbRow);
      const updated: GroupUserAttributeAssignment = {
        ...current,
        enabled: input.enabled,
        updatedAt: new Date()
      };

      this.db.prepare(`
        UPDATE group_user_attribute_assignments
        SET enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), updated.id);

      return updated;
    }

    const now = new Date();
    const assignment: GroupUserAttributeAssignment = {
      id: nanoid(),
      groupId: input.groupId,
      attributeId: input.attributeId,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now
    };

    this.db.prepare(`
      INSERT INTO group_user_attribute_assignments (id, group_id, attribute_id, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      assignment.id,
      assignment.groupId,
      assignment.attributeId,
      assignment.enabled ? 1 : 0,
      assignment.createdAt.toISOString(),
      assignment.updatedAt.toISOString()
    );

    return assignment;
  }

  delete(attributeId: string, groupId: string): void {
    this.db.prepare("DELETE FROM group_user_attribute_assignments WHERE attribute_id = ? AND group_id = ?").run(attributeId, groupId);
  }
}

export class SqlitePolicyDefinitionRepository implements PolicyDefinitionRepository {
  constructor(private readonly db: Database.Database) {}

  list(): PolicyDefinition[] {
    const rows = this.db.prepare("SELECT * FROM policy_definitions ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapPolicyDefinition);
  }

  findById(id: string): PolicyDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM policy_definitions WHERE id = ?").get(id);
    return row ? mapPolicyDefinition(row as DbRow) : undefined;
  }

  findByKey(key: string): PolicyDefinition | undefined {
    const row = this.db.prepare("SELECT * FROM policy_definitions WHERE key = ?").get(key);
    return row ? mapPolicyDefinition(row as DbRow) : undefined;
  }

  create(input: Omit<PolicyDefinition, "createdAt" | "updatedAt">): PolicyDefinition {
    const now = new Date();
    const policy: PolicyDefinition = { ...input, createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO policy_definitions (id, key, name, description, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      policy.id,
      policy.key,
      policy.name,
      policy.description,
      policy.enabled ? 1 : 0,
      policy.createdAt.toISOString(),
      policy.updatedAt.toISOString()
    );

    return policy;
  }

  update(id: string, input: Partial<Omit<PolicyDefinition, "id" | "createdAt" | "updatedAt">>): PolicyDefinition | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: PolicyDefinition = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE policy_definitions
      SET key = ?, name = ?, description = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.key,
      updated.name,
      updated.description,
      updated.enabled ? 1 : 0,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM policy_definitions WHERE id = ?").run(id);
  }
}

export class SqlitePolicyAssignmentRepository implements PolicyAssignmentRepository {
  constructor(private readonly db: Database.Database) {}

  list(): PolicyAssignment[] {
    const rows = this.db.prepare("SELECT * FROM policy_assignments ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapPolicyAssignment);
  }

  listByPolicy(policyId: string): PolicyAssignment[] {
    const rows = this.db.prepare("SELECT * FROM policy_assignments WHERE policy_id = ? ORDER BY created_at ASC").all(policyId) as DbRow[];
    return rows.map(mapPolicyAssignment);
  }

  upsert(input: Omit<PolicyAssignment, "id" | "createdAt" | "updatedAt">): PolicyAssignment {
    const existing = this.db.prepare(
      "SELECT * FROM policy_assignments WHERE policy_id = ? AND scope_type = ? AND scope_id = ?"
    ).get(input.policyId, input.scopeType, input.scopeId);

    if (existing) {
      const current = mapPolicyAssignment(existing as DbRow);
      const updated: PolicyAssignment = {
        ...current,
        enabled: input.enabled,
        config: input.config,
        updatedAt: new Date()
      };

      this.db.prepare(`
        UPDATE policy_assignments
        SET enabled = ?, config_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.enabled ? 1 : 0,
        JSON.stringify(updated.config),
        updated.updatedAt.toISOString(),
        updated.id
      );

      return updated;
    }

    const now = new Date();
    const assignment: PolicyAssignment = {
      id: nanoid(),
      policyId: input.policyId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      enabled: input.enabled,
      config: input.config,
      createdAt: now,
      updatedAt: now
    };

    this.db.prepare(`
      INSERT INTO policy_assignments (id, policy_id, scope_type, scope_id, enabled, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignment.id,
      assignment.policyId,
      assignment.scopeType,
      assignment.scopeId,
      assignment.enabled ? 1 : 0,
      JSON.stringify(assignment.config),
      assignment.createdAt.toISOString(),
      assignment.updatedAt.toISOString()
    );

    return assignment;
  }

  delete(policyId: string, scopeType: PolicyScopeType, scopeId: string): void {
    this.db.prepare("DELETE FROM policy_assignments WHERE policy_id = ? AND scope_type = ? AND scope_id = ?").run(policyId, scopeType, scopeId);
  }
}

export class SqliteEventHookRepository implements EventHookRepository {
  constructor(private readonly db: Database.Database) {}

  list(): EventHook[] {
    const rows = this.db.prepare("SELECT * FROM event_hooks ORDER BY created_at ASC").all() as DbRow[];
    return rows.map(mapEventHook);
  }

  listByEventType(eventType: string): EventHook[] {
    const rows = this.db.prepare("SELECT * FROM event_hooks WHERE event_type = ? ORDER BY created_at ASC").all(eventType) as DbRow[];
    return rows.map(mapEventHook);
  }

  findById(id: string): EventHook | undefined {
    const row = this.db.prepare("SELECT * FROM event_hooks WHERE id = ?").get(id);
    return row ? mapEventHook(row as DbRow) : undefined;
  }

  create(input: Omit<EventHook, "createdAt" | "updatedAt">): EventHook {
    const now = new Date();
    const hook: EventHook = { ...input, createdAt: now, updatedAt: now };
    this.db.prepare(`
      INSERT INTO event_hooks (id, event_type, target_url, method, headers_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hook.id,
      hook.eventType,
      hook.targetUrl,
      hook.method,
      JSON.stringify(hook.headers),
      hook.enabled ? 1 : 0,
      hook.createdAt.toISOString(),
      hook.updatedAt.toISOString()
    );

    return hook;
  }

  update(id: string, input: Partial<Omit<EventHook, "id" | "createdAt" | "updatedAt">>): EventHook | undefined {
    const existing = this.findById(id);
    if (!existing) {
      return undefined;
    }

    const updated: EventHook = {
      ...existing,
      ...input,
      updatedAt: new Date()
    };

    this.db.prepare(`
      UPDATE event_hooks
      SET event_type = ?, target_url = ?, method = ?, headers_json = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.eventType,
      updated.targetUrl,
      updated.method,
      JSON.stringify(updated.headers),
      updated.enabled ? 1 : 0,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM event_hooks WHERE id = ?").run(id);
  }
}

export class SqliteEventNotificationRepository implements EventNotificationRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 100): EventNotification[] {
    const rows = this.db.prepare("SELECT * FROM event_notifications ORDER BY created_at DESC LIMIT ?").all(limit) as DbRow[];
    return rows.map(mapEventNotification);
  }

  create(input: Omit<EventNotification, "id" | "createdAt">): EventNotification {
    const notification: EventNotification = { id: nanoid(), ...input, createdAt: new Date() };
    this.db.prepare(`
      INSERT INTO event_notifications (id, event_type, hook_id, payload_json, status, response_status, response_body, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      notification.id,
      notification.eventType,
      notification.hookId ?? null,
      JSON.stringify(notification.payload),
      notification.status,
      notification.responseStatus ?? null,
      notification.responseBody ?? null,
      notification.error ?? null,
      notification.createdAt.toISOString()
    );

    return notification;
  }
}
