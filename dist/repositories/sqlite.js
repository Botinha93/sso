import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
const parseStringArray = (value) => {
    if (typeof value !== "string" || value.length === 0) {
        return [];
    }
    return JSON.parse(value);
};
const parseStringRecord = (value) => {
    if (typeof value !== "string" || value.length === 0) {
        return {};
    }
    const parsed = JSON.parse(value);
    const output = {};
    for (const [key, raw] of Object.entries(parsed)) {
        if (typeof raw === "string") {
            output[key] = raw;
        }
    }
    return output;
};
const asDate = (value) => new Date(String(value));
const maybeDate = (value) => (value ? asDate(value) : undefined);
export class SqliteDatabase {
    connection;
    constructor(path) {
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
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS instance_settings (
        id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        app_id TEXT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        scope TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        app_id TEXT,
        is_service_user INTEGER NOT NULL DEFAULT 0,
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
        app_id TEXT,
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

      CREATE TABLE IF NOT EXISTS totp_credentials (
        user_id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
        app_id TEXT,
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
        stage_bindings_json TEXT NOT NULL DEFAULT '[]',
        javascript_code TEXT,
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
        const userColumns = this.connection.prepare("PRAGMA table_info(users)").all();
        const hasCustomAttributesColumn = userColumns.some((column) => column.name === "custom_attributes_json");
        if (!hasCustomAttributesColumn) {
            this.connection.exec("ALTER TABLE users ADD COLUMN custom_attributes_json TEXT NOT NULL DEFAULT '{}';");
        }
        const hasUserAppIdColumn = userColumns.some((column) => column.name === "app_id");
        if (!hasUserAppIdColumn) {
            this.connection.exec("ALTER TABLE users ADD COLUMN app_id TEXT;");
        }
        const hasIsServiceUserColumn = userColumns.some((column) => column.name === "is_service_user");
        if (!hasIsServiceUserColumn) {
            this.connection.exec("ALTER TABLE users ADD COLUMN is_service_user INTEGER NOT NULL DEFAULT 0;");
        }
        const clientColumns = this.connection.prepare("PRAGMA table_info(oauth_clients)").all();
        const hasResourcesColumn = clientColumns.some((column) => column.name === "resources_json");
        if (!hasResourcesColumn) {
            this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN resources_json TEXT NOT NULL DEFAULT '[]';");
        }
        const hasFlowIdsColumn = clientColumns.some((column) => column.name === "flow_ids_json");
        if (!hasFlowIdsColumn) {
            this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN flow_ids_json TEXT NOT NULL DEFAULT '[]';");
        }
        const hasClientAppIdColumn = clientColumns.some((column) => column.name === "app_id");
        if (!hasClientAppIdColumn) {
            this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN app_id TEXT;");
        }
        const roleColumns = this.connection.prepare("PRAGMA table_info(roles)").all();
        const hasRoleAppIdColumn = roleColumns.some((column) => column.name === "app_id");
        if (!hasRoleAppIdColumn) {
            this.connection.exec("ALTER TABLE roles ADD COLUMN app_id TEXT;");
        }
        const groupColumns = this.connection.prepare("PRAGMA table_info(groups)").all();
        const hasGroupAppIdColumn = groupColumns.some((column) => column.name === "app_id");
        if (!hasGroupAppIdColumn) {
            this.connection.exec("ALTER TABLE groups ADD COLUMN app_id TEXT;");
        }
        const appColumns = this.connection.prepare("PRAGMA table_info(apps)").all();
        const hasAppIconColumn = appColumns.some((column) => column.name === "icon");
        if (!hasAppIconColumn) {
            this.connection.exec("ALTER TABLE apps ADD COLUMN icon TEXT;");
        }
        const hasAppUrlColumn = appColumns.some((column) => column.name === "url");
        if (!hasAppUrlColumn) {
            this.connection.exec("ALTER TABLE apps ADD COLUMN url TEXT;");
        }
        const authFlowColumns = this.connection.prepare("PRAGMA table_info(authentication_flows)").all();
        const hasDesignationColumn = authFlowColumns.some((column) => column.name === "designation");
        if (!hasDesignationColumn) {
            this.connection.exec("ALTER TABLE authentication_flows ADD COLUMN designation TEXT NOT NULL DEFAULT 'authentication';");
        }
        const hasGrantsColumn = authFlowColumns.some((column) => column.name === "grants_json");
        if (!hasGrantsColumn) {
            this.connection.exec("ALTER TABLE authentication_flows ADD COLUMN grants_json TEXT NOT NULL DEFAULT '[\"authorization_code\"]';");
        }
        const policyDefinitionColumns = this.connection.prepare("PRAGMA table_info(policy_definitions)").all();
        const hasStageBindingsColumn = policyDefinitionColumns.some((column) => column.name === "stage_bindings_json");
        if (!hasStageBindingsColumn) {
            this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN stage_bindings_json TEXT NOT NULL DEFAULT '[]';");
        }
        const hasJavascriptCodeColumn = policyDefinitionColumns.some((column) => column.name === "javascript_code");
        if (!hasJavascriptCodeColumn) {
            this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN javascript_code TEXT;");
        }
    }
}
const mapRole = (row) => ({
    id: String(row.id),
    appId: row.app_id ? String(row.app_id) : undefined,
    name: String(row.name),
    description: String(row.description),
    permissions: parseStringArray(row.permissions_json),
    scope: row.scope,
    createdAt: asDate(row.created_at)
});
const mapUser = (row) => ({
    id: String(row.id),
    appId: row.app_id ? String(row.app_id) : undefined,
    isServiceUser: Boolean(row.is_service_user),
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
const mapClient = (row) => ({
    id: String(row.id),
    appId: row.app_id ? String(row.app_id) : undefined,
    name: String(row.name),
    secret: String(row.secret),
    redirectUris: parseStringArray(row.redirect_uris_json),
    allowedScopes: parseStringArray(row.allowed_scopes_json),
    grants: parseStringArray(row.grants_json),
    requirePkce: Boolean(row.require_pkce),
    resources: parseStringArray(row.resources_json),
    flowIds: parseStringArray(row.flow_ids_json),
    createdAt: asDate(row.created_at)
});
const mapScope = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
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
const mapTotpCredential = (row) => ({
    userId: String(row.user_id),
    secret: String(row.secret),
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
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
const mapGroup = (row) => ({
    id: String(row.id),
    appId: row.app_id ? String(row.app_id) : undefined,
    name: String(row.name),
    description: String(row.description),
    createdAt: asDate(row.created_at)
});
const mapApp = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    icon: row.icon ? String(row.icon) : undefined,
    url: row.url ? String(row.url) : undefined,
    createdAt: asDate(row.created_at)
});
const mapInstanceSettings = (row) => {
    const parsed = JSON.parse(String(row.settings_json));
    return {
        id: String(row.id),
        requireHttps: Boolean(parsed.requireHttps),
        secureCookies: Boolean(parsed.secureCookies),
        allowAnyCorsOrigin: Boolean(parsed.allowAnyCorsOrigin),
        corsAllowedOrigins: Array.isArray(parsed.corsAllowedOrigins) ? parsed.corsAllowedOrigins.map(String) : [],
        requireHttpsRedirectUris: Boolean(parsed.requireHttpsRedirectUris),
        requireS256Pkce: Boolean(parsed.requireS256Pkce),
        allowImplicitFlow: Boolean(parsed.allowImplicitFlow),
        loginFailureWindowMs: typeof parsed.loginFailureWindowMs === "number" ? parsed.loginFailureWindowMs : 15 * 60 * 1000,
        loginLockoutThreshold: typeof parsed.loginLockoutThreshold === "number" ? parsed.loginLockoutThreshold : 5,
        loginLockoutDurationMs: typeof parsed.loginLockoutDurationMs === "number" ? parsed.loginLockoutDurationMs : 15 * 60 * 1000,
        sessionAnomalyConcurrencyThreshold: typeof parsed.sessionAnomalyConcurrencyThreshold === "number" ? parsed.sessionAnomalyConcurrencyThreshold : 5,
        emailTransport: parsed.emailTransport === "smtp" || parsed.emailTransport === "disabled" ? parsed.emailTransport : "log",
        emailFrom: typeof parsed.emailFrom === "string" && parsed.emailFrom.length > 0 ? parsed.emailFrom : "no-reply@example.local",
        smtpHost: typeof parsed.smtpHost === "string" && parsed.smtpHost.length > 0 ? parsed.smtpHost : undefined,
        smtpPort: typeof parsed.smtpPort === "number" ? parsed.smtpPort : undefined,
        smtpSecure: typeof parsed.smtpSecure === "boolean" ? parsed.smtpSecure : false,
        smtpUser: typeof parsed.smtpUser === "string" && parsed.smtpUser.length > 0 ? parsed.smtpUser : undefined,
        smtpPass: typeof parsed.smtpPass === "string" && parsed.smtpPass.length > 0 ? parsed.smtpPass : undefined,
        tokenSigningAlgorithm: "RS256",
        updatedAt: asDate(row.updated_at)
    };
};
const mapUserGroupAssignment = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    groupId: String(row.group_id),
    createdAt: asDate(row.created_at)
});
const mapGroupRoleAssignment = (row) => ({
    id: String(row.id),
    groupId: String(row.group_id),
    roleId: String(row.role_id),
    createdAt: asDate(row.created_at)
});
const mapFederatedIdentity = (row) => ({
    id: String(row.id),
    providerId: String(row.provider_id),
    providerSubject: String(row.provider_subject),
    userId: String(row.user_id),
    email: row.email ? String(row.email) : undefined,
    createdAt: asDate(row.created_at),
    lastLoginAt: asDate(row.last_login_at)
});
const mapFederationTransaction = (row) => ({
    state: String(row.state),
    providerId: String(row.provider_id),
    codeVerifier: String(row.code_verifier),
    redirectAfterLogin: String(row.redirect_after_login),
    createdAt: asDate(row.created_at),
    expiresAt: asDate(row.expires_at)
});
const mapFederationProvider = (row) => ({
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
const mapAuthenticationFlow = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    designation: (typeof row.designation === "string" && row.designation.length > 0 ? row.designation : "authentication"),
    enabled: Boolean(row.enabled),
    grantTypes: (parseStringArray(row.grants_json).length ? parseStringArray(row.grants_json) : ["authorization_code"]),
    stages: JSON.parse(String(row.stages_json)),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapUserAttributeDefinition = (row) => ({
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description),
    type: String(row.type),
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapGroupUserAttributeAssignment = (row) => ({
    id: String(row.id),
    groupId: String(row.group_id),
    attributeId: String(row.attribute_id),
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapPolicyDefinition = (row) => ({
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description),
    stageBindings: parseStringArray(row.stage_bindings_json),
    javascriptCode: row.javascript_code ? String(row.javascript_code) : undefined,
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapPolicyAssignment = (row) => ({
    id: String(row.id),
    policyId: String(row.policy_id),
    scopeType: String(row.scope_type),
    scopeId: String(row.scope_id),
    enabled: Boolean(row.enabled),
    config: JSON.parse(String(row.config_json)),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapEventHook = (row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    targetUrl: String(row.target_url),
    method: String(row.method),
    headers: JSON.parse(String(row.headers_json)),
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapEventNotification = (row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    hookId: row.hook_id ? String(row.hook_id) : undefined,
    payload: JSON.parse(String(row.payload_json)),
    status: String(row.status),
    responseStatus: typeof row.response_status === "number" ? row.response_status : undefined,
    responseBody: row.response_body ? String(row.response_body) : undefined,
    error: row.error ? String(row.error) : undefined,
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
      INSERT INTO roles (id, app_id, name, description, permissions_json, scope, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(role.id, role.appId ?? null, role.name, role.description, JSON.stringify(role.permissions), role.scope, role.createdAt.toISOString());
        return role;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM roles ORDER BY created_at ASC").all();
        return rows.map(mapRole);
    }
    findByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const placeholders = ids.map(() => "?").join(", ");
        const rows = this.db.prepare(`SELECT * FROM roles WHERE id IN (${placeholders})`).all(...ids);
        return rows.map(mapRole);
    }
    update(id, input) {
        const existing = this.db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
        if (!existing)
            return undefined;
        const current = mapRole(existing);
        const updated = { ...current, ...input };
        this.db.prepare(`
      UPDATE roles SET app_id = ?, name = ?, description = ?, permissions_json = ?, scope = ? WHERE id = ?
    `).run(updated.appId ?? null, updated.name, updated.description, JSON.stringify(updated.permissions), updated.scope, id);
        return updated;
    }
    findByName(name) {
        const row = this.db.prepare("SELECT * FROM roles WHERE name = ?").get(name);
        return row ? mapRole(row) : undefined;
    }
    delete(id) {
        this.db.prepare("DELETE FROM roles WHERE id = ?").run(id);
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
      INSERT INTO users (id, app_id, is_service_user, email, username, password_hash, given_name, family_name, custom_attributes_json, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.appId ?? null, user.isServiceUser ? 1 : 0, user.email, user.username, user.passwordHash, user.givenName, user.familyName, JSON.stringify(user.customAttributes), user.active ? 1 : 0, user.createdAt.toISOString(), user.updatedAt.toISOString());
        return user;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
        return rows.map(mapUser);
    }
    findByEmail(email) {
        const row = this.db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
        return row ? mapUser(row) : undefined;
    }
    findByUsername(username) {
        const row = this.db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").get(username);
        return row ? mapUser(row) : undefined;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        return row ? mapUser(row) : undefined;
    }
    updateProfile(id, input) {
        const current = this.findById(id);
        if (!current)
            return undefined;
        const updated = {
            ...current,
            appId: input.appId !== undefined ? input.appId : current.appId,
            isServiceUser: input.isServiceUser ?? current.isServiceUser,
            email: input.email ?? current.email,
            username: input.username ?? current.username,
            givenName: input.givenName ?? current.givenName,
            familyName: input.familyName ?? current.familyName,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE users
      SET app_id = ?, is_service_user = ?, email = ?, username = ?, given_name = ?, family_name = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.appId ?? null, updated.isServiceUser ? 1 : 0, updated.email, updated.username, updated.givenName, updated.familyName, updated.updatedAt.toISOString(), id);
        return updated;
    }
    setPasswordHash(id, passwordHash) {
        this.db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, new Date().toISOString(), id);
    }
    setActive(id, active) {
        this.db.prepare("UPDATE users SET active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    }
    setCustomAttributes(id, customAttributes) {
        this.db.prepare("UPDATE users SET custom_attributes_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(customAttributes), new Date().toISOString(), id);
    }
    delete(id) {
        this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    }
}
export class SqliteClientRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const client = {
            ...input,
            resources: input.resources ?? [],
            flowIds: input.flowIds ?? [],
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO oauth_clients (id, app_id, name, secret, redirect_uris_json, allowed_scopes_json, grants_json, require_pkce, resources_json, flow_ids_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client.id, client.appId ?? null, client.name, client.secret, JSON.stringify(client.redirectUris), JSON.stringify(client.allowedScopes), JSON.stringify(client.grants), client.requirePkce ? 1 : 0, JSON.stringify(client.resources), JSON.stringify(client.flowIds), client.createdAt.toISOString());
        return client;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM oauth_clients WHERE id = ?").get(id);
        return row ? mapClient(row) : undefined;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM oauth_clients ORDER BY created_at ASC").all();
        return rows.map(mapClient);
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...input };
        this.db.prepare(`
      UPDATE oauth_clients
      SET app_id = ?, name = ?, secret = ?, redirect_uris_json = ?, allowed_scopes_json = ?, grants_json = ?, require_pkce = ?, resources_json = ?, flow_ids_json = ?
      WHERE id = ?
    `).run(updated.appId ?? null, updated.name, updated.secret, JSON.stringify(updated.redirectUris), JSON.stringify(updated.allowedScopes), JSON.stringify(updated.grants), updated.requirePkce ? 1 : 0, JSON.stringify(updated.resources), JSON.stringify(updated.flowIds), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM oauth_clients WHERE id = ?").run(id);
    }
}
export class SqliteScopeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const scope = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO oauth_scopes (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(scope.id, scope.name, scope.description, scope.createdAt.toISOString());
        return scope;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM oauth_scopes ORDER BY name ASC").all();
        return rows.map(mapScope);
    }
    findByName(name) {
        const row = this.db.prepare("SELECT * FROM oauth_scopes WHERE name = ?").get(name);
        return row ? mapScope(row) : undefined;
    }
    delete(id) {
        this.db.prepare("DELETE FROM oauth_scopes WHERE id = ?").run(id);
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
    list() {
        const rows = this.db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all();
        return rows.map(mapSession);
    }
    revoke(id, revokedAt) {
        this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(revokedAt.toISOString(), id);
    }
}
export class SqliteTotpCredentialRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findByUserId(userId) {
        const row = this.db.prepare("SELECT * FROM totp_credentials WHERE user_id = ?").get(userId);
        return row ? mapTotpCredential(row) : undefined;
    }
    upsert(input) {
        const existing = this.findByUserId(input.userId);
        const createdAt = existing?.createdAt ?? new Date();
        const updatedAt = new Date();
        this.db.prepare(`
      INSERT INTO totp_credentials (user_id, secret, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        secret = excluded.secret,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(input.userId, input.secret, input.enabled ? 1 : 0, createdAt.toISOString(), updatedAt.toISOString());
        return {
            userId: input.userId,
            secret: input.secret,
            enabled: input.enabled,
            createdAt,
            updatedAt
        };
    }
    delete(userId) {
        this.db.prepare("DELETE FROM totp_credentials WHERE user_id = ?").run(userId);
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
        const rows = this.db.prepare("SELECT * FROM tenants ORDER BY created_at ASC").all();
        return rows.map(mapTenant);
    }
    findBySlug(slug) {
        const row = this.db.prepare("SELECT * FROM tenants WHERE slug = ?").get(slug);
        return row ? mapTenant(row) : undefined;
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
        return row ? mapTenant(row) : undefined;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = {
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
export class SqliteAppRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const app = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO apps (id, name, description, icon, url, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(app.id, app.name, app.description, app.icon ?? null, app.url ?? null, app.createdAt.toISOString());
        return app;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM apps ORDER BY created_at ASC").all();
        return rows.map(mapApp);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM apps WHERE id = ?").get(id);
        return row ? mapApp(row) : undefined;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            name: input.name ?? existing.name,
            description: input.description ?? existing.description,
            icon: input.icon !== undefined ? input.icon : existing.icon,
            url: input.url !== undefined ? input.url : existing.url
        };
        this.db.prepare("UPDATE apps SET name = ?, description = ?, icon = ?, url = ? WHERE id = ?").run(updated.name, updated.description, updated.icon ?? null, updated.url ?? null, id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM apps WHERE id = ?").run(id);
    }
}
export class SqliteInstanceSettingsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get() {
        const row = this.db.prepare("SELECT * FROM instance_settings WHERE id = ?").get("instance");
        return row ? mapInstanceSettings(row) : undefined;
    }
    upsert(input) {
        const updatedAt = new Date();
        this.db.prepare(`
      INSERT INTO instance_settings (id, settings_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
    `).run(input.id, JSON.stringify({
            requireHttps: input.requireHttps,
            secureCookies: input.secureCookies,
            allowAnyCorsOrigin: input.allowAnyCorsOrigin,
            corsAllowedOrigins: input.corsAllowedOrigins,
            requireHttpsRedirectUris: input.requireHttpsRedirectUris,
            requireS256Pkce: input.requireS256Pkce,
            allowImplicitFlow: input.allowImplicitFlow,
            tokenSigningAlgorithm: input.tokenSigningAlgorithm
        }), updatedAt.toISOString());
        return {
            ...input,
            tokenSigningAlgorithm: "RS256",
            updatedAt
        };
    }
}
export class SqliteGroupRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const group = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO groups (id, app_id, name, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(group.id, group.appId ?? null, group.name, group.description, group.createdAt.toISOString());
        return group;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM groups ORDER BY created_at ASC").all();
        return rows.map(mapGroup);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM groups WHERE id = ?").get(id);
        return row ? mapGroup(row) : undefined;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            appId: input.appId ?? existing.appId,
            name: input.name ?? existing.name,
            description: input.description ?? existing.description
        };
        this.db.prepare(`
      UPDATE groups SET app_id = ?, name = ?, description = ? WHERE id = ?
    `).run(updated.appId ?? null, updated.name, updated.description, id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM groups WHERE id = ?").run(id);
    }
}
export class SqliteUserGroupAssignmentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    assign(input) {
        const existing = this.db.prepare(`
      SELECT * FROM user_group_assignments
      WHERE user_id = ? AND group_id = ?
    `).get(input.userId, input.groupId);
        if (existing) {
            return mapUserGroupAssignment(existing);
        }
        const assignment = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO user_group_assignments (id, user_id, group_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(assignment.id, assignment.userId, assignment.groupId, assignment.createdAt.toISOString());
        return assignment;
    }
    listByUser(userId) {
        const rows = this.db.prepare("SELECT * FROM user_group_assignments WHERE user_id = ?").all(userId);
        return rows.map(mapUserGroupAssignment);
    }
    remove(userId, groupId) {
        this.db.prepare("DELETE FROM user_group_assignments WHERE user_id = ? AND group_id = ?").run(userId, groupId);
    }
}
export class SqliteGroupRoleAssignmentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    assign(input) {
        const existing = this.db.prepare(`
      SELECT * FROM group_role_assignments
      WHERE group_id = ? AND role_id = ?
    `).get(input.groupId, input.roleId);
        if (existing) {
            return mapGroupRoleAssignment(existing);
        }
        const assignment = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO group_role_assignments (id, group_id, role_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(assignment.id, assignment.groupId, assignment.roleId, assignment.createdAt.toISOString());
        return assignment;
    }
    listByGroup(groupId) {
        const rows = this.db.prepare("SELECT * FROM group_role_assignments WHERE group_id = ?").all(groupId);
        return rows.map(mapGroupRoleAssignment);
    }
    listByGroups(groupIds) {
        if (groupIds.length === 0) {
            return [];
        }
        const placeholders = groupIds.map(() => "?").join(", ");
        const rows = this.db.prepare(`SELECT * FROM group_role_assignments WHERE group_id IN (${placeholders})`).all(...groupIds);
        return rows.map(mapGroupRoleAssignment);
    }
    remove(groupId, roleId) {
        this.db.prepare("DELETE FROM group_role_assignments WHERE group_id = ? AND role_id = ?").run(groupId, roleId);
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
        const rows = this.db.prepare("SELECT * FROM user_role_assignments WHERE user_id = ?").all(userId);
        return rows.map(mapAssignment);
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
    list() {
        const rows = this.db.prepare("SELECT * FROM consents ORDER BY updated_at DESC").all();
        return rows.map(mapConsent);
    }
    revoke(id) {
        this.db.prepare("DELETE FROM consents WHERE id = ?").run(id);
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
export class SqliteAuditRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    log(input) {
        const event = { ...input, id: nanoid(), createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO audit_events (id, type, actor_id, actor_type, client_id, ip, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.type, event.actorId ?? null, event.actorType, event.clientId ?? null, event.ip ?? null, event.metadata ? JSON.stringify(event.metadata) : null, event.createdAt.toISOString());
        return event;
    }
    list(limit = 200) {
        const rows = this.db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map((row) => ({
            id: String(row.id),
            type: String(row.type),
            actorId: row.actor_id ? String(row.actor_id) : undefined,
            actorType: String(row.actor_type),
            clientId: row.client_id ? String(row.client_id) : undefined,
            ip: row.ip ? String(row.ip) : undefined,
            metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
            createdAt: new Date(String(row.created_at))
        }));
    }
}
export class SqliteFederatedIdentityRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findByProviderSubject(providerId, providerSubject) {
        const row = this.db.prepare("SELECT * FROM federated_identities WHERE provider_id = ? AND provider_subject = ?").get(providerId, providerSubject);
        return row ? mapFederatedIdentity(row) : undefined;
    }
    create(input) {
        const entity = {
            ...input,
            id: nanoid(),
            createdAt: new Date(),
            lastLoginAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO federated_identities (id, provider_id, provider_subject, user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entity.id, entity.providerId, entity.providerSubject, entity.userId, entity.email ?? null, entity.createdAt.toISOString(), entity.lastLoginAt.toISOString());
        return entity;
    }
    touchLogin(id, loggedAt) {
        this.db.prepare("UPDATE federated_identities SET last_login_at = ? WHERE id = ?").run(loggedAt.toISOString(), id);
    }
}
export class SqliteFederationTransactionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const transaction = {
            ...input,
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO federation_transactions (state, provider_id, code_verifier, redirect_after_login, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(transaction.state, transaction.providerId, transaction.codeVerifier, transaction.redirectAfterLogin, transaction.createdAt.toISOString(), transaction.expiresAt.toISOString());
        return transaction;
    }
    consume(state) {
        const row = this.db.prepare("SELECT * FROM federation_transactions WHERE state = ?").get(state);
        if (!row) {
            return undefined;
        }
        this.db.prepare("DELETE FROM federation_transactions WHERE state = ?").run(state);
        return mapFederationTransaction(row);
    }
    purgeExpired(now) {
        this.db.prepare("DELETE FROM federation_transactions WHERE expires_at < ?").run(now.toISOString());
    }
}
export class SqliteFederationProviderRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM federation_providers ORDER BY created_at ASC").all();
        return rows.map(mapFederationProvider);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM federation_providers WHERE id = ?").get(id);
        return row ? mapFederationProvider(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const provider = { ...input, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO federation_providers
      (id, label, authorization_endpoint, token_endpoint, userinfo_endpoint, client_id, client_secret, scopes_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(provider.id, provider.label, provider.authorizationEndpoint, provider.tokenEndpoint, provider.userInfoEndpoint, provider.clientId, provider.clientSecret, JSON.stringify(provider.scopes), provider.enabled ? 1 : 0, provider.createdAt.toISOString(), provider.updatedAt.toISOString());
        return provider;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE federation_providers
      SET label = ?, authorization_endpoint = ?, token_endpoint = ?, userinfo_endpoint = ?, client_id = ?, client_secret = ?, scopes_json = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.label, updated.authorizationEndpoint, updated.tokenEndpoint, updated.userInfoEndpoint, updated.clientId, updated.clientSecret, JSON.stringify(updated.scopes), updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM federation_providers WHERE id = ?").run(id);
    }
}
export class SqliteAuthenticationFlowRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM authentication_flows ORDER BY created_at ASC").all();
        return rows.map(mapAuthenticationFlow);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM authentication_flows WHERE id = ?").get(id);
        return row ? mapAuthenticationFlow(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const flow = { ...input, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO authentication_flows (id, name, description, designation, enabled, grants_json, stages_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(flow.id, flow.name, flow.description, flow.designation, flow.enabled ? 1 : 0, JSON.stringify(flow.grantTypes), JSON.stringify(flow.stages), flow.createdAt.toISOString(), flow.updatedAt.toISOString());
        return flow;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE authentication_flows
      SET name = ?, description = ?, designation = ?, enabled = ?, grants_json = ?, stages_json = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.name, updated.description, updated.designation, updated.enabled ? 1 : 0, JSON.stringify(updated.grantTypes), JSON.stringify(updated.stages), updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM authentication_flows WHERE id = ?").run(id);
    }
}
export class SqliteUserAttributeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM user_attribute_definitions ORDER BY created_at ASC").all();
        return rows.map(mapUserAttributeDefinition);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM user_attribute_definitions WHERE id = ?").get(id);
        return row ? mapUserAttributeDefinition(row) : undefined;
    }
    findByKey(key) {
        const row = this.db.prepare("SELECT * FROM user_attribute_definitions WHERE key = ?").get(key);
        return row ? mapUserAttributeDefinition(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const attribute = { ...input, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO user_attribute_definitions (id, key, name, description, type, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(attribute.id, attribute.key, attribute.name, attribute.description, attribute.type, attribute.enabled ? 1 : 0, attribute.createdAt.toISOString(), attribute.updatedAt.toISOString());
        return attribute;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE user_attribute_definitions
      SET key = ?, name = ?, description = ?, type = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.key, updated.name, updated.description, updated.type, updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM user_attribute_definitions WHERE id = ?").run(id);
    }
}
export class SqliteGroupUserAttributeAssignmentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM group_user_attribute_assignments ORDER BY created_at ASC").all();
        return rows.map(mapGroupUserAttributeAssignment);
    }
    listByAttribute(attributeId) {
        const rows = this.db.prepare("SELECT * FROM group_user_attribute_assignments WHERE attribute_id = ? ORDER BY created_at ASC").all(attributeId);
        return rows.map(mapGroupUserAttributeAssignment);
    }
    upsert(input) {
        const existing = this.db.prepare("SELECT * FROM group_user_attribute_assignments WHERE group_id = ? AND attribute_id = ?").get(input.groupId, input.attributeId);
        if (existing) {
            const current = mapGroupUserAttributeAssignment(existing);
            const updated = {
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
        const assignment = {
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
    `).run(assignment.id, assignment.groupId, assignment.attributeId, assignment.enabled ? 1 : 0, assignment.createdAt.toISOString(), assignment.updatedAt.toISOString());
        return assignment;
    }
    delete(attributeId, groupId) {
        this.db.prepare("DELETE FROM group_user_attribute_assignments WHERE attribute_id = ? AND group_id = ?").run(attributeId, groupId);
    }
}
export class SqlitePolicyDefinitionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM policy_definitions ORDER BY created_at ASC").all();
        return rows.map(mapPolicyDefinition);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM policy_definitions WHERE id = ?").get(id);
        return row ? mapPolicyDefinition(row) : undefined;
    }
    findByKey(key) {
        const row = this.db.prepare("SELECT * FROM policy_definitions WHERE key = ?").get(key);
        return row ? mapPolicyDefinition(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const policy = { ...input, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO policy_definitions (id, key, name, description, stage_bindings_json, javascript_code, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(policy.id, policy.key, policy.name, policy.description, JSON.stringify(policy.stageBindings), policy.javascriptCode ?? null, policy.enabled ? 1 : 0, policy.createdAt.toISOString(), policy.updatedAt.toISOString());
        return policy;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE policy_definitions
      SET key = ?, name = ?, description = ?, stage_bindings_json = ?, javascript_code = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.key, updated.name, updated.description, JSON.stringify(updated.stageBindings), updated.javascriptCode ?? null, updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM policy_definitions WHERE id = ?").run(id);
    }
}
export class SqlitePolicyAssignmentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM policy_assignments ORDER BY created_at ASC").all();
        return rows.map(mapPolicyAssignment);
    }
    listByPolicy(policyId) {
        const rows = this.db.prepare("SELECT * FROM policy_assignments WHERE policy_id = ? ORDER BY created_at ASC").all(policyId);
        return rows.map(mapPolicyAssignment);
    }
    upsert(input) {
        const existing = this.db.prepare("SELECT * FROM policy_assignments WHERE policy_id = ? AND scope_type = ? AND scope_id = ?").get(input.policyId, input.scopeType, input.scopeId);
        if (existing) {
            const current = mapPolicyAssignment(existing);
            const updated = {
                ...current,
                enabled: input.enabled,
                config: input.config,
                updatedAt: new Date()
            };
            this.db.prepare(`
        UPDATE policy_assignments
        SET enabled = ?, config_json = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.enabled ? 1 : 0, JSON.stringify(updated.config), updated.updatedAt.toISOString(), updated.id);
            return updated;
        }
        const now = new Date();
        const assignment = {
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
    `).run(assignment.id, assignment.policyId, assignment.scopeType, assignment.scopeId, assignment.enabled ? 1 : 0, JSON.stringify(assignment.config), assignment.createdAt.toISOString(), assignment.updatedAt.toISOString());
        return assignment;
    }
    delete(policyId, scopeType, scopeId) {
        this.db.prepare("DELETE FROM policy_assignments WHERE policy_id = ? AND scope_type = ? AND scope_id = ?").run(policyId, scopeType, scopeId);
    }
}
export class SqliteEventHookRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM event_hooks ORDER BY created_at ASC").all();
        return rows.map(mapEventHook);
    }
    listByEventType(eventType) {
        const rows = this.db.prepare("SELECT * FROM event_hooks WHERE event_type = ? ORDER BY created_at ASC").all(eventType);
        return rows.map(mapEventHook);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM event_hooks WHERE id = ?").get(id);
        return row ? mapEventHook(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const hook = { ...input, createdAt: now, updatedAt: now };
        this.db.prepare(`
      INSERT INTO event_hooks (id, event_type, target_url, method, headers_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(hook.id, hook.eventType, hook.targetUrl, hook.method, JSON.stringify(hook.headers), hook.enabled ? 1 : 0, hook.createdAt.toISOString(), hook.updatedAt.toISOString());
        return hook;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing) {
            return undefined;
        }
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE event_hooks
      SET event_type = ?, target_url = ?, method = ?, headers_json = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.eventType, updated.targetUrl, updated.method, JSON.stringify(updated.headers), updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM event_hooks WHERE id = ?").run(id);
    }
}
export class SqliteEventNotificationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list(limit = 100) {
        const rows = this.db.prepare("SELECT * FROM event_notifications ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapEventNotification);
    }
    create(input) {
        const notification = { id: nanoid(), ...input, createdAt: new Date() };
        this.db.prepare(`
      INSERT INTO event_notifications (id, event_type, hook_id, payload_json, status, response_status, response_body, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(notification.id, notification.eventType, notification.hookId ?? null, JSON.stringify(notification.payload), notification.status, notification.responseStatus ?? null, notification.responseBody ?? null, notification.error ?? null, notification.createdAt.toISOString());
        return notification;
    }
}
