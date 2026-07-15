import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type {
  AccessTokenRecord,
  AccessReviewCampaign,
  AccessReviewItem,
  AccessRequest,
  AccessRequestApproval,
  App,
  InstanceSettings,
  AuthenticationFlow,
  AuditEvent,
  AuthorizationCode,
  Consent,
  DeprovisioningQueueItem,
  ElevationSession,
  ElevationRequest,
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
  PolicyDecisionLog,
  PolicyDefinition,
  PolicyScopeType,
  ProvisioningJob,
  ProvisioningMapping,
  ScimToken,
  RefreshTokenRecord,
  Role,
  Session,
  Tenant,
  TotpCredential,
  WebauthnCredential,
  User,
  UserAttributeDefinition,
  UserGroupAssignment,
  UserRoleAssignment,
  SamlServiceProvider,
  SamlNameIdMapping,
  SamlAssertionAudit
} from "../domain/models.js";
import type {
  AccessTokenRepository,
  AccessReviewCampaignRepository,
  AccessReviewItemRepository,
  AccessRequestApprovalRepository,
  AccessRequestRepository,
  AppRepository,
  InstanceSettingsRepository,
  AuthenticationFlowRepository,
  AuditRepository,
  AuthorizationCodeRepository,
  ClientRepository,
  ScopeRepository,
  ConsentRepository,
  DeprovisioningQueueRepository,
  ElevationSessionRepository,
  ElevationRequestRepository,
  FederationProviderRepository,
  FederatedIdentityRepository,
  FederationTransactionRepository,
  GroupUserAttributeAssignmentRepository,
  GroupRepository,
  GroupRoleAssignmentRepository,
  PolicyDefinitionRepository,
  ProvisioningJobRepository,
  ProvisioningMappingRepository,
  ScimTokenRepository,
  PolicyAssignmentRepository,
  PolicyDecisionLogRepository,
  EventHookRepository,
  EventNotificationRepository,
  RefreshTokenRepository,
  RoleRepository,
  SessionRepository,
  TenantRepository,
  TotpCredentialRepository,
  WebauthnCredentialRepository,
  UserAttributeRepository,
  UserGroupAssignmentRepository,
  UserRepository,
  UserRoleAssignmentRepository,
  SamlServiceProviderRepository,
  SamlNameIdMappingRepository,
  SamlAssertionAuditRepository
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

  assertHealthy() {
    const quickCheck = this.connection.pragma("quick_check", { simple: true });
    if (quickCheck !== "ok") {
      throw new Error(`SQLite integrity check failed: ${String(quickCheck)}`);
    }
  }

  private migrateLegacyServiceIdentitiesToUsers() {
    const legacyRows = this.connection.prepare("SELECT * FROM service_identities").all() as Array<{
      id: string;
      name: string;
      description?: string | null;
      owner_id?: string | null;
      app_id?: string | null;
      status: string;
      allowed_scopes_json: string;
      allowed_audiences_json: string;
      metadata_json?: string | null;
      created_at: string;
      updated_at: string;
    }>;

    if (legacyRows.length === 0) {
      return;
    }

    const insert = this.connection.prepare(`
      INSERT OR IGNORE INTO users (
        id, app_id, external_source, external_id, is_service_user, avatar_url,
        email, username, password_hash, given_name, family_name,
        custom_attributes_json, active, created_at, updated_at
      ) VALUES (
        @id, @appId, NULL, NULL, 1, NULL,
        @email, @username, @passwordHash, @givenName, @familyName,
        @customAttributesJson, @active, @createdAt, @updatedAt
      )
    `);

    const migrate = this.connection.transaction(() => {
      for (const row of legacyRows) {
        const customAttributes = {
          "si.allowedScopes": row.allowed_scopes_json,
          "si.allowedAudiences": row.allowed_audiences_json,
          ...(row.owner_id ? { "si.ownerId": row.owner_id } : {}),
          ...(row.metadata_json ? { "si.metadata": row.metadata_json } : {}),
          "si.status": row.status
        };

        insert.run({
          id: row.id,
          appId: row.app_id ?? null,
          email: `svc-${row.id}@service.local`,
          username: `svc-${row.id}`,
          passwordHash: `disabled-${nanoid()}`,
          givenName: row.name,
          familyName: row.description ?? "",
          customAttributesJson: JSON.stringify(customAttributes),
          active: row.status === "active" ? 1 : 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }
    });

    migrate();
  }

  private ensureServiceIdentityCredentialForeignKey() {
    const foreignKeys = this.connection.prepare("PRAGMA foreign_key_list(service_identity_credentials)").all() as Array<{ table: string }>;
    const referencesLegacyTable = foreignKeys.some((foreignKey) => foreignKey.table === "service_identities");
    if (!referencesLegacyTable) {
      return;
    }

    this.connection.exec("PRAGMA foreign_keys = OFF;");
    try {
      this.connection.exec(`
        BEGIN;

        CREATE TABLE service_identity_credentials_new (
          id TEXT PRIMARY KEY,
          service_identity_id TEXT NOT NULL,
          client_id TEXT NOT NULL UNIQUE,
          client_secret_hash TEXT NOT NULL,
          expires_at TEXT,
          revoked_at TEXT,
          rotated_from_id TEXT,
          last_used_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (service_identity_id) REFERENCES users(id)
        );

        INSERT INTO service_identity_credentials_new (
          id, service_identity_id, client_id, client_secret_hash,
          expires_at, revoked_at, rotated_from_id, last_used_at, created_at
        )
        SELECT
          id, service_identity_id, client_id, client_secret_hash,
          expires_at, revoked_at, rotated_from_id, last_used_at, created_at
        FROM service_identity_credentials
        WHERE service_identity_id IN (SELECT id FROM users);

        DROP TABLE service_identity_credentials;
        ALTER TABLE service_identity_credentials_new RENAME TO service_identity_credentials;

        COMMIT;
      `);
    } catch (error) {
      this.connection.exec("ROLLBACK;");
      throw error;
    } finally {
      this.connection.exec("PRAGMA foreign_keys = ON;");
    }
  }

  migrate() {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        icon TEXT,
        image_url TEXT,
        url TEXT,
        resources_json TEXT NOT NULL DEFAULT '[]',
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
        external_source TEXT,
        external_id TEXT,
        is_service_user INTEGER NOT NULL DEFAULT 0,
        avatar_url TEXT,
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
        access_token_ttl_seconds INTEGER,
        refresh_token_ttl_seconds INTEGER,
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

      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        sign_count INTEGER NOT NULL DEFAULT 0,
        transports_json TEXT NOT NULL DEFAULT '[]',
        aaguid TEXT,
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
        external_source TEXT,
        external_id TEXT,
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

      CREATE TABLE IF NOT EXISTS user_app_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, app_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (app_id) REFERENCES apps(id)
      );

      CREATE TABLE IF NOT EXISTS group_app_assignments (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (group_id, app_id),
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (app_id) REFERENCES apps(id)
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
        show_on_portal INTEGER NOT NULL DEFAULT 0,
        user_editable INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS group_user_attribute_assignments (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        attribute_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        value TEXT,
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
        category TEXT NOT NULL DEFAULT 'authentication',
        effect TEXT NOT NULL DEFAULT 'deny',
        resource_pattern TEXT,
        action_pattern TEXT,
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
        priority INTEGER NOT NULL DEFAULT 0,
        decision_strategy TEXT,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (policy_id, scope_type, scope_id),
        FOREIGN KEY (policy_id) REFERENCES policy_definitions(id)
      );

      CREATE TABLE IF NOT EXISTS policy_decision_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id TEXT,
        tenant_id TEXT,
        ip TEXT,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        allow INTEGER NOT NULL,
        denied_by_json TEXT NOT NULL,
        context_json TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scim_tokens (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provisioning_mappings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_attribute TEXT NOT NULL,
        target_attribute TEXT NOT NULL,
        transform_expression TEXT,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provisioning_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        initiated_by_user_id TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS deprovisioning_queue (
        id TEXT PRIMARY KEY,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        subject_user_id TEXT NOT NULL,
        entitlement_type TEXT NOT NULL,
        entitlement_value TEXT NOT NULL,
        status TEXT NOT NULL,
        justification TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (requester_id) REFERENCES users(id),
        FOREIGN KEY (subject_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS access_request_approvals (
        id TEXT PRIMARY KEY,
        access_request_id TEXT NOT NULL,
        approver_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (access_request_id) REFERENCES access_requests(id),
        FOREIGN KEY (approver_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS access_review_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS access_review_items (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        subject_user_id TEXT NOT NULL,
        entitlement_type TEXT NOT NULL,
        entitlement_value TEXT NOT NULL,
        current_state TEXT NOT NULL,
        decision TEXT,
        decided_by_user_id TEXT,
        decision_rationale TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES access_review_campaigns(id),
        FOREIGN KEY (subject_user_id) REFERENCES users(id),
        FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS elevation_requests (
        id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        justification TEXT NOT NULL,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        approved_by_user_id TEXT,
        approved_at TEXT,
        activated_at TEXT,
        expires_at TEXT,
        revoked_at TEXT,
        revoked_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (requester_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS elevation_sessions (
        id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        elevation_request_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ended_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (elevation_request_id) REFERENCES elevation_requests(id),
        FOREIGN KEY (requester_id) REFERENCES users(id)
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

      CREATE TABLE IF NOT EXISTS saml_service_providers (
        id TEXT PRIMARY KEY,
        app_id TEXT,
        entity_id TEXT UNIQUE NOT NULL,
        metadata TEXT,
        acs_url TEXT NOT NULL,
        slo_url TEXT,
        signing_certificate TEXT,
        encryption_certificate TEXT,
        name_id_format TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saml_name_id_mappings (
        id TEXT PRIMARY KEY,
        sp_id TEXT NOT NULL,
        format TEXT NOT NULL,
        source_attribute TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (sp_id) REFERENCES saml_service_providers(id)
      );

      CREATE TABLE IF NOT EXISTS saml_assertion_audits (
        id TEXT PRIMARY KEY,
        sp_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        response_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        audience TEXT NOT NULL,
        assertion_id TEXT NOT NULL,
        issue_instant TEXT NOT NULL,
        not_on_or_after TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        status_code TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (sp_id) REFERENCES saml_service_providers(id)
      );

      CREATE TABLE IF NOT EXISTS risk_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        ip TEXT,
        device_fingerprint_hash TEXT,
        geo TEXT,
        confidence INTEGER NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        decision TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_identities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT,
        app_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        allowed_scopes_json TEXT NOT NULL DEFAULT '[]',
        allowed_audiences_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_identity_credentials (
        id TEXT PRIMARY KEY,
        service_identity_id TEXT NOT NULL,
        client_id TEXT NOT NULL UNIQUE,
        client_secret_hash TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        rotated_from_id TEXT,
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (service_identity_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config_json TEXT NOT NULL DEFAULT '{}',
        schedule TEXT,
        last_sync_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connector_runs (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT,
        finished_at TEXT,
        records_imported INTEGER NOT NULL DEFAULT 0,
        records_failed INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (connector_id) REFERENCES connectors(id)
      );

      CREATE TABLE IF NOT EXISTS connector_mappings (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        source_field TEXT NOT NULL,
        target_field TEXT NOT NULL,
        transform TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (connector_id) REFERENCES connectors(id)
      );

      CREATE TABLE IF NOT EXISTS auth_metric_rollups (
        id TEXT NOT NULL,
        bucket TEXT NOT NULL,
        event TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        PRIMARY KEY (bucket, event)
      );
    `);

    this.migrateLegacyServiceIdentitiesToUsers();
    this.ensureServiceIdentityCredentialForeignKey();

    const userColumns = this.connection.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasCustomAttributesColumn = userColumns.some((column) => column.name === "custom_attributes_json");
    if (!hasCustomAttributesColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN custom_attributes_json TEXT NOT NULL DEFAULT '{}';");
    }

    const groupUserAttributeColumns = this.connection.prepare("PRAGMA table_info(group_user_attribute_assignments)").all() as Array<{ name: string }>;
    const hasGroupUserAttributeValueColumn = groupUserAttributeColumns.some((column) => column.name === "value");
    if (!hasGroupUserAttributeValueColumn) {
      this.connection.exec("ALTER TABLE group_user_attribute_assignments ADD COLUMN value TEXT;");
    }

    const userAttributeDefinitionColumns = this.connection.prepare("PRAGMA table_info(user_attribute_definitions)").all() as Array<{ name: string }>;
    if (!userAttributeDefinitionColumns.some((column) => column.name === "show_on_portal")) {
      this.connection.exec("ALTER TABLE user_attribute_definitions ADD COLUMN show_on_portal INTEGER NOT NULL DEFAULT 0;");
    }
    if (!userAttributeDefinitionColumns.some((column) => column.name === "user_editable")) {
      this.connection.exec("ALTER TABLE user_attribute_definitions ADD COLUMN user_editable INTEGER NOT NULL DEFAULT 0;");
    }
    const hasUserAppIdColumn = userColumns.some((column) => column.name === "app_id");
    if (!hasUserAppIdColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN app_id TEXT;");
    }
    const hasIsServiceUserColumn = userColumns.some((column) => column.name === "is_service_user");
    if (!hasIsServiceUserColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN is_service_user INTEGER NOT NULL DEFAULT 0;");
    }
    const hasUserExternalSourceColumn = userColumns.some((column) => column.name === "external_source");
    if (!hasUserExternalSourceColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN external_source TEXT;");
    }
    const hasUserExternalIdColumn = userColumns.some((column) => column.name === "external_id");
    if (!hasUserExternalIdColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN external_id TEXT;");
    }
    const hasUserAvatarUrlColumn = userColumns.some((column) => column.name === "avatar_url");
    if (!hasUserAvatarUrlColumn) {
      this.connection.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
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
    const hasClientAppIdColumn = clientColumns.some((column) => column.name === "app_id");
    if (!hasClientAppIdColumn) {
      this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN app_id TEXT;");
    }
    const hasAccessTokenTtlColumn = clientColumns.some((column) => column.name === "access_token_ttl_seconds");
    if (!hasAccessTokenTtlColumn) {
      this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN access_token_ttl_seconds INTEGER;");
    }
    const hasRefreshTokenTtlColumn = clientColumns.some((column) => column.name === "refresh_token_ttl_seconds");
    if (!hasRefreshTokenTtlColumn) {
      this.connection.exec("ALTER TABLE oauth_clients ADD COLUMN refresh_token_ttl_seconds INTEGER;");
    }

    const roleColumns = this.connection.prepare("PRAGMA table_info(roles)").all() as Array<{ name: string }>;
    const hasRoleAppIdColumn = roleColumns.some((column) => column.name === "app_id");
    if (!hasRoleAppIdColumn) {
      this.connection.exec("ALTER TABLE roles ADD COLUMN app_id TEXT;");
    }

    const groupColumns = this.connection.prepare("PRAGMA table_info(groups)").all() as Array<{ name: string }>;
    const hasGroupAppIdColumn = groupColumns.some((column) => column.name === "app_id");
    if (!hasGroupAppIdColumn) {
      this.connection.exec("ALTER TABLE groups ADD COLUMN app_id TEXT;");
    }
    const hasGroupExternalSourceColumn = groupColumns.some((column) => column.name === "external_source");
    if (!hasGroupExternalSourceColumn) {
      this.connection.exec("ALTER TABLE groups ADD COLUMN external_source TEXT;");
    }
    const hasGroupExternalIdColumn = groupColumns.some((column) => column.name === "external_id");
    if (!hasGroupExternalIdColumn) {
      this.connection.exec("ALTER TABLE groups ADD COLUMN external_id TEXT;");
    }

    const appColumns = this.connection.prepare("PRAGMA table_info(apps)").all() as Array<{ name: string }>;
    const hasAppIconColumn = appColumns.some((column) => column.name === "icon");
    if (!hasAppIconColumn) {
      this.connection.exec("ALTER TABLE apps ADD COLUMN icon TEXT;");
    }
    const hasAppUrlColumn = appColumns.some((column) => column.name === "url");
    if (!hasAppUrlColumn) {
      this.connection.exec("ALTER TABLE apps ADD COLUMN url TEXT;");
    }
    const hasAppImageUrlColumn = appColumns.some((column) => column.name === "image_url");
    if (!hasAppImageUrlColumn) {
      this.connection.exec("ALTER TABLE apps ADD COLUMN image_url TEXT;");
    }
    const hasAppResourcesColumn = appColumns.some((column) => column.name === "resources_json");
    if (!hasAppResourcesColumn) {
      this.connection.exec("ALTER TABLE apps ADD COLUMN resources_json TEXT NOT NULL DEFAULT '[]';");
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

    const policyDefinitionColumns = this.connection.prepare("PRAGMA table_info(policy_definitions)").all() as Array<{ name: string }>;
    const hasStageBindingsColumn = policyDefinitionColumns.some((column) => column.name === "stage_bindings_json");
    if (!hasStageBindingsColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN stage_bindings_json TEXT NOT NULL DEFAULT '[]';");
    }
    const hasJavascriptCodeColumn = policyDefinitionColumns.some((column) => column.name === "javascript_code");
    if (!hasJavascriptCodeColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN javascript_code TEXT;");
    }
    const hasCategoryColumn = policyDefinitionColumns.some((column) => column.name === "category");
    if (!hasCategoryColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN category TEXT NOT NULL DEFAULT 'authentication';");
      this.connection.exec("UPDATE policy_definitions SET category = 'authorization' WHERE stage_bindings_json = '[]';");
    }
    const hasEffectColumn = policyDefinitionColumns.some((column) => column.name === "effect");
    if (!hasEffectColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN effect TEXT NOT NULL DEFAULT 'deny';");
    }
    const hasResourcePatternColumn = policyDefinitionColumns.some((column) => column.name === "resource_pattern");
    if (!hasResourcePatternColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN resource_pattern TEXT;");
    }
    const hasActionPatternColumn = policyDefinitionColumns.some((column) => column.name === "action_pattern");
    if (!hasActionPatternColumn) {
      this.connection.exec("ALTER TABLE policy_definitions ADD COLUMN action_pattern TEXT;");
    }

    const policyAssignmentColumns = this.connection.prepare("PRAGMA table_info(policy_assignments)").all() as Array<{ name: string }>;
    const hasPriorityColumn = policyAssignmentColumns.some((column) => column.name === "priority");
    if (!hasPriorityColumn) {
      this.connection.exec("ALTER TABLE policy_assignments ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;");
    }
    const hasDecisionStrategyColumn = policyAssignmentColumns.some((column) => column.name === "decision_strategy");
    if (!hasDecisionStrategyColumn) {
      this.connection.exec("ALTER TABLE policy_assignments ADD COLUMN decision_strategy TEXT;");
    }

    const deprovisioningColumns = this.connection.prepare("PRAGMA table_info(deprovisioning_queue)").all() as Array<{ name: string }>;
    if (deprovisioningColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS deprovisioning_queue (
          id TEXT PRIMARY KEY,
          subject_type TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          action_type TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL,
          processed_at TEXT
        );
      `);
    }

    const accessRequestColumns = this.connection.prepare("PRAGMA table_info(access_requests)").all() as Array<{ name: string }>;
    if (accessRequestColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS access_requests (
          id TEXT PRIMARY KEY,
          requester_id TEXT NOT NULL,
          subject_user_id TEXT NOT NULL,
          entitlement_type TEXT NOT NULL,
          entitlement_value TEXT NOT NULL,
          status TEXT NOT NULL,
          justification TEXT NOT NULL,
          expires_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (requester_id) REFERENCES users(id),
          FOREIGN KEY (subject_user_id) REFERENCES users(id)
        );
      `);
    }

    const accessRequestApprovalColumns = this.connection.prepare("PRAGMA table_info(access_request_approvals)").all() as Array<{ name: string }>;
    if (accessRequestApprovalColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS access_request_approvals (
          id TEXT PRIMARY KEY,
          access_request_id TEXT NOT NULL,
          approver_id TEXT NOT NULL,
          decision TEXT NOT NULL,
          rationale TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (access_request_id) REFERENCES access_requests(id),
          FOREIGN KEY (approver_id) REFERENCES users(id)
        );
      `);
    }

    const accessReviewCampaignColumns = this.connection.prepare("PRAGMA table_info(access_review_campaigns)").all() as Array<{ name: string }>;
    if (accessReviewCampaignColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS access_review_campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          due_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        );
      `);
    }

    const accessReviewItemColumns = this.connection.prepare("PRAGMA table_info(access_review_items)").all() as Array<{ name: string }>;
    if (accessReviewItemColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS access_review_items (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          subject_user_id TEXT NOT NULL,
          entitlement_type TEXT NOT NULL,
          entitlement_value TEXT NOT NULL,
          current_state TEXT NOT NULL,
          decision TEXT,
          decided_by_user_id TEXT,
          decision_rationale TEXT,
          decided_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (campaign_id) REFERENCES access_review_campaigns(id),
          FOREIGN KEY (subject_user_id) REFERENCES users(id),
          FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
        );
      `);
    }

    const elevationColumns = this.connection.prepare("PRAGMA table_info(elevation_requests)").all() as Array<{ name: string }>;
    if (elevationColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS elevation_requests (
          id TEXT PRIMARY KEY,
          correlation_id TEXT NOT NULL,
          requester_id TEXT NOT NULL,
          justification TEXT NOT NULL,
          resource TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          approved_by_user_id TEXT,
          approved_at TEXT,
          activated_at TEXT,
          expires_at TEXT,
          revoked_at TEXT,
          revoked_by_user_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (requester_id) REFERENCES users(id)
        );
      `);
    }
    const hasElevationCorrelationId = elevationColumns.some((column) => column.name === "correlation_id");
    if (!hasElevationCorrelationId) {
      this.connection.exec("ALTER TABLE elevation_requests ADD COLUMN correlation_id TEXT NOT NULL DEFAULT '';\nUPDATE elevation_requests SET correlation_id = id WHERE correlation_id = '';\n");
    }

    const elevationSessionColumns = this.connection.prepare("PRAGMA table_info(elevation_sessions)").all() as Array<{ name: string }>;
    if (elevationSessionColumns.length === 0) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS elevation_sessions (
          id TEXT PRIMARY KEY,
          correlation_id TEXT NOT NULL,
          elevation_request_id TEXT NOT NULL,
          requester_id TEXT NOT NULL,
          resource TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          ended_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (elevation_request_id) REFERENCES elevation_requests(id),
          FOREIGN KEY (requester_id) REFERENCES users(id)
        );
      `);
    }
    const hasElevationSessionCorrelationId = elevationSessionColumns.some((column) => column.name === "correlation_id");
    if (!hasElevationSessionCorrelationId) {
      this.connection.exec("ALTER TABLE elevation_sessions ADD COLUMN correlation_id TEXT NOT NULL DEFAULT '';\nUPDATE elevation_sessions SET correlation_id = elevation_request_id WHERE correlation_id = '';\n");
    }
  }

  close() {
    this.connection.close();
  }
}
