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
        image_url TEXT,
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
        FOREIGN KEY (service_identity_id) REFERENCES service_identities(id)
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
        const hasGroupExternalSourceColumn = groupColumns.some((column) => column.name === "external_source");
        if (!hasGroupExternalSourceColumn) {
            this.connection.exec("ALTER TABLE groups ADD COLUMN external_source TEXT;");
        }
        const hasGroupExternalIdColumn = groupColumns.some((column) => column.name === "external_id");
        if (!hasGroupExternalIdColumn) {
            this.connection.exec("ALTER TABLE groups ADD COLUMN external_id TEXT;");
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
        const hasAppImageUrlColumn = appColumns.some((column) => column.name === "image_url");
        if (!hasAppImageUrlColumn) {
            this.connection.exec("ALTER TABLE apps ADD COLUMN image_url TEXT;");
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
        const policyAssignmentColumns = this.connection.prepare("PRAGMA table_info(policy_assignments)").all();
        const hasPriorityColumn = policyAssignmentColumns.some((column) => column.name === "priority");
        if (!hasPriorityColumn) {
            this.connection.exec("ALTER TABLE policy_assignments ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;");
        }
        const hasDecisionStrategyColumn = policyAssignmentColumns.some((column) => column.name === "decision_strategy");
        if (!hasDecisionStrategyColumn) {
            this.connection.exec("ALTER TABLE policy_assignments ADD COLUMN decision_strategy TEXT;");
        }
        const deprovisioningColumns = this.connection.prepare("PRAGMA table_info(deprovisioning_queue)").all();
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
        const accessRequestColumns = this.connection.prepare("PRAGMA table_info(access_requests)").all();
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
        const accessRequestApprovalColumns = this.connection.prepare("PRAGMA table_info(access_request_approvals)").all();
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
        const accessReviewCampaignColumns = this.connection.prepare("PRAGMA table_info(access_review_campaigns)").all();
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
        const accessReviewItemColumns = this.connection.prepare("PRAGMA table_info(access_review_items)").all();
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
        const elevationColumns = this.connection.prepare("PRAGMA table_info(elevation_requests)").all();
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
        const elevationSessionColumns = this.connection.prepare("PRAGMA table_info(elevation_sessions)").all();
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
    externalSource: row.external_source ? String(row.external_source) : undefined,
    externalId: row.external_id ? String(row.external_id) : undefined,
    isServiceUser: Boolean(row.is_service_user),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
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
const mapWebauthnCredential = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    credentialId: String(row.credential_id),
    publicKey: String(row.public_key),
    signCount: Number(row.sign_count),
    transports: parseStringArray(row.transports_json),
    aaguid: row.aaguid ? String(row.aaguid) : undefined,
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
    externalSource: row.external_source ? String(row.external_source) : undefined,
    externalId: row.external_id ? String(row.external_id) : undefined,
    name: String(row.name),
    description: String(row.description),
    createdAt: asDate(row.created_at)
});
const mapApp = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    icon: row.icon ? String(row.icon) : undefined,
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    url: row.url ? String(row.url) : undefined,
    createdAt: asDate(row.created_at)
});
const mapInstanceSettings = (row) => {
    const parsed = JSON.parse(String(row.settings_json));
    return {
        id: String(row.id),
        databaseProvider: parsed.databaseProvider === "postgresql" || parsed.databaseProvider === "mysql" ? parsed.databaseProvider : "sqlite",
        databasePath: typeof parsed.databasePath === "string" && parsed.databasePath.length > 0 ? parsed.databasePath : "./data/sso.sqlite",
        externalDatabaseUrl: typeof parsed.externalDatabaseUrl === "string" && parsed.externalDatabaseUrl.length > 0 ? parsed.externalDatabaseUrl : undefined,
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
        uiCustomizations: typeof parsed.uiCustomizations === "object" && parsed.uiCustomizations
            ? parsed.uiCustomizations
            : { defaultBySurface: {}, byClientId: {}, byAppId: {} },
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
    category: row.category === "authorization" ? "authorization" : "authentication",
    effect: row.effect === "allow" ? "allow" : "deny",
    resourcePattern: row.resource_pattern ? String(row.resource_pattern) : undefined,
    actionPattern: row.action_pattern ? String(row.action_pattern) : undefined,
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
    priority: typeof row.priority === "number" ? row.priority : 0,
    decisionStrategy: row.decision_strategy ? String(row.decision_strategy) : undefined,
    config: JSON.parse(String(row.config_json)),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapPolicyDecisionLog = (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    clientId: row.client_id ? String(row.client_id) : undefined,
    tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
    ip: row.ip ? String(row.ip) : undefined,
    resource: String(row.resource),
    action: String(row.action),
    allow: Boolean(row.allow),
    deniedBy: parseStringArray(row.denied_by_json),
    context: JSON.parse(String(row.context_json)),
    source: String(row.source),
    createdAt: asDate(row.created_at)
});
const mapScimToken = (row) => ({
    id: String(row.id),
    label: String(row.label),
    tokenHash: String(row.token_hash),
    lastUsedAt: maybeDate(row.last_used_at),
    expiresAt: maybeDate(row.expires_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapProvisioningMapping = (row) => ({
    id: String(row.id),
    name: String(row.name),
    sourceAttribute: String(row.source_attribute),
    targetAttribute: String(row.target_attribute),
    transformExpression: row.transform_expression ? String(row.transform_expression) : undefined,
    enabled: Boolean(row.enabled),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapProvisioningJob = (row) => ({
    id: String(row.id),
    jobType: String(row.job_type),
    status: String(row.status),
    summary: JSON.parse(String(row.summary_json)),
    initiatedByUserId: row.initiated_by_user_id ? String(row.initiated_by_user_id) : undefined,
    createdAt: asDate(row.created_at),
    completedAt: maybeDate(row.completed_at)
});
const mapDeprovisioningQueueItem = (row) => ({
    id: String(row.id),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    actionType: String(row.action_type),
    status: String(row.status),
    payload: JSON.parse(String(row.payload_json)),
    error: row.error ? String(row.error) : undefined,
    createdAt: asDate(row.created_at),
    processedAt: maybeDate(row.processed_at)
});
const mapAccessRequest = (row) => ({
    id: String(row.id),
    requesterId: String(row.requester_id),
    subjectUserId: String(row.subject_user_id),
    entitlementType: String(row.entitlement_type),
    entitlementValue: String(row.entitlement_value),
    status: String(row.status),
    justification: String(row.justification),
    expiresAt: maybeDate(row.expires_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapAccessRequestApproval = (row) => ({
    id: String(row.id),
    accessRequestId: String(row.access_request_id),
    approverId: String(row.approver_id),
    decision: String(row.decision),
    rationale: row.rationale ? String(row.rationale) : undefined,
    createdAt: asDate(row.created_at)
});
const mapAccessReviewCampaign = (row) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    status: String(row.status),
    createdByUserId: String(row.created_by_user_id),
    dueAt: maybeDate(row.due_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapAccessReviewItem = (row) => ({
    id: String(row.id),
    campaignId: String(row.campaign_id),
    subjectUserId: String(row.subject_user_id),
    entitlementType: String(row.entitlement_type),
    entitlementValue: String(row.entitlement_value),
    currentState: String(row.current_state),
    decision: row.decision ? String(row.decision) : undefined,
    decidedByUserId: row.decided_by_user_id ? String(row.decided_by_user_id) : undefined,
    decisionRationale: row.decision_rationale ? String(row.decision_rationale) : undefined,
    decidedAt: maybeDate(row.decided_at),
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
      INSERT INTO users (id, app_id, external_source, external_id, is_service_user, avatar_url, email, username, password_hash, given_name, family_name, custom_attributes_json, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.appId ?? null, user.externalSource ?? null, user.externalId ?? null, user.isServiceUser ? 1 : 0, user.avatarUrl ?? null, user.email, user.username, user.passwordHash, user.givenName, user.familyName, JSON.stringify(user.customAttributes), user.active ? 1 : 0, user.createdAt.toISOString(), user.updatedAt.toISOString());
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
            externalSource: input.externalSource !== undefined ? input.externalSource : current.externalSource,
            externalId: input.externalId !== undefined ? input.externalId : current.externalId,
            isServiceUser: input.isServiceUser ?? current.isServiceUser,
            avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : current.avatarUrl,
            email: input.email ?? current.email,
            username: input.username ?? current.username,
            givenName: input.givenName ?? current.givenName,
            familyName: input.familyName ?? current.familyName,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE users
      SET app_id = ?, external_source = ?, external_id = ?, is_service_user = ?, avatar_url = ?, email = ?, username = ?, given_name = ?, family_name = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.appId ?? null, updated.externalSource ?? null, updated.externalId ?? null, updated.isServiceUser ? 1 : 0, updated.avatarUrl ?? null, updated.email, updated.username, updated.givenName, updated.familyName, updated.updatedAt.toISOString(), id);
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
export class SqliteWebauthnCredentialRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    listByUserId(userId) {
        const rows = this.db.prepare("SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC").all(userId);
        return rows.map(mapWebauthnCredential);
    }
    findByCredentialId(credentialId) {
        const row = this.db.prepare("SELECT * FROM webauthn_credentials WHERE credential_id = ?").get(credentialId);
        return row ? mapWebauthnCredential(row) : undefined;
    }
    upsert(input) {
        const existing = this.findByCredentialId(input.credentialId);
        const now = new Date();
        const nextId = existing?.id ?? nanoid();
        const createdAt = existing?.createdAt ?? now;
        this.db.prepare(`
      INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, sign_count, transports_json, aaguid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(credential_id) DO UPDATE SET
        user_id = excluded.user_id,
        public_key = excluded.public_key,
        sign_count = excluded.sign_count,
        transports_json = excluded.transports_json,
        aaguid = excluded.aaguid,
        updated_at = excluded.updated_at
    `).run(nextId, input.userId, input.credentialId, input.publicKey, input.signCount, JSON.stringify(input.transports), input.aaguid ?? null, createdAt.toISOString(), now.toISOString());
        return {
            id: nextId,
            userId: input.userId,
            credentialId: input.credentialId,
            publicKey: input.publicKey,
            signCount: input.signCount,
            transports: input.transports,
            aaguid: input.aaguid,
            createdAt,
            updatedAt: now
        };
    }
    deleteByCredentialId(credentialId) {
        this.db.prepare("DELETE FROM webauthn_credentials WHERE credential_id = ?").run(credentialId);
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
      INSERT INTO apps (id, name, description, icon, image_url, url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(app.id, app.name, app.description, app.icon ?? null, app.imageUrl ?? null, app.url ?? null, app.createdAt.toISOString());
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
            imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.imageUrl,
            url: input.url !== undefined ? input.url : existing.url
        };
        this.db.prepare("UPDATE apps SET name = ?, description = ?, icon = ?, image_url = ?, url = ? WHERE id = ?").run(updated.name, updated.description, updated.icon ?? null, updated.imageUrl ?? null, updated.url ?? null, id);
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
            databaseProvider: input.databaseProvider,
            databasePath: input.databasePath,
            externalDatabaseUrl: input.externalDatabaseUrl,
            requireHttps: input.requireHttps,
            secureCookies: input.secureCookies,
            allowAnyCorsOrigin: input.allowAnyCorsOrigin,
            corsAllowedOrigins: input.corsAllowedOrigins,
            requireHttpsRedirectUris: input.requireHttpsRedirectUris,
            requireS256Pkce: input.requireS256Pkce,
            allowImplicitFlow: input.allowImplicitFlow,
            loginFailureWindowMs: input.loginFailureWindowMs,
            loginLockoutThreshold: input.loginLockoutThreshold,
            loginLockoutDurationMs: input.loginLockoutDurationMs,
            sessionAnomalyConcurrencyThreshold: input.sessionAnomalyConcurrencyThreshold,
            emailTransport: input.emailTransport,
            emailFrom: input.emailFrom,
            smtpHost: input.smtpHost,
            smtpPort: input.smtpPort,
            smtpSecure: input.smtpSecure,
            smtpUser: input.smtpUser,
            smtpPass: input.smtpPass,
            uiCustomizations: input.uiCustomizations,
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
      INSERT INTO groups (id, app_id, external_source, external_id, name, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(group.id, group.appId ?? null, group.externalSource ?? null, group.externalId ?? null, group.name, group.description, group.createdAt.toISOString());
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
            externalSource: input.externalSource !== undefined ? input.externalSource : existing.externalSource,
            externalId: input.externalId !== undefined ? input.externalId : existing.externalId,
            name: input.name ?? existing.name,
            description: input.description ?? existing.description
        };
        this.db.prepare(`
      UPDATE groups SET app_id = ?, external_source = ?, external_id = ?, name = ?, description = ? WHERE id = ?
    `).run(updated.appId ?? null, updated.externalSource ?? null, updated.externalId ?? null, updated.name, updated.description, id);
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
    remove(input) {
        this.db.prepare(`
      DELETE FROM user_role_assignments
      WHERE user_id = ? AND role_id = ? AND ifnull(tenant_id, '') = ifnull(?, '')
    `).run(input.userId, input.roleId, input.tenantId ?? null);
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
      INSERT INTO policy_definitions (id, key, name, description, category, effect, resource_pattern, action_pattern, stage_bindings_json, javascript_code, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(policy.id, policy.key, policy.name, policy.description, policy.category, policy.effect ?? "deny", policy.resourcePattern ?? null, policy.actionPattern ?? null, JSON.stringify(policy.stageBindings), policy.javascriptCode ?? null, policy.enabled ? 1 : 0, policy.createdAt.toISOString(), policy.updatedAt.toISOString());
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
      SET key = ?, name = ?, description = ?, category = ?, effect = ?, resource_pattern = ?, action_pattern = ?, stage_bindings_json = ?, javascript_code = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.key, updated.name, updated.description, updated.category, updated.effect ?? "deny", updated.resourcePattern ?? null, updated.actionPattern ?? null, JSON.stringify(updated.stageBindings), updated.javascriptCode ?? null, updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
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
                priority: input.priority,
                decisionStrategy: input.decisionStrategy,
                config: input.config,
                updatedAt: new Date()
            };
            this.db.prepare(`
        UPDATE policy_assignments
        SET enabled = ?, priority = ?, decision_strategy = ?, config_json = ?, updated_at = ?
        WHERE id = ?
      `).run(updated.enabled ? 1 : 0, updated.priority ?? 0, updated.decisionStrategy ?? null, JSON.stringify(updated.config), updated.updatedAt.toISOString(), updated.id);
            return updated;
        }
        const now = new Date();
        const assignment = {
            id: nanoid(),
            policyId: input.policyId,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            enabled: input.enabled,
            priority: input.priority,
            decisionStrategy: input.decisionStrategy,
            config: input.config,
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO policy_assignments (id, policy_id, scope_type, scope_id, enabled, priority, decision_strategy, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(assignment.id, assignment.policyId, assignment.scopeType, assignment.scopeId, assignment.enabled ? 1 : 0, assignment.priority ?? 0, assignment.decisionStrategy ?? null, JSON.stringify(assignment.config), assignment.createdAt.toISOString(), assignment.updatedAt.toISOString());
        return assignment;
    }
    delete(policyId, scopeType, scopeId) {
        this.db.prepare("DELETE FROM policy_assignments WHERE policy_id = ? AND scope_type = ? AND scope_id = ?").run(policyId, scopeType, scopeId);
    }
}
export class SqlitePolicyDecisionLogRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(limit = 100) {
        const rows = this.db.prepare("SELECT * FROM policy_decision_logs ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapPolicyDecisionLog);
    }
    async create(input) {
        const log = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO policy_decision_logs (id, user_id, client_id, tenant_id, ip, resource, action, allow, denied_by_json, context_json, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(log.id, log.userId, log.clientId ?? null, log.tenantId ?? null, log.ip ?? null, log.resource, log.action, log.allow ? 1 : 0, JSON.stringify(log.deniedBy), JSON.stringify(log.context), log.source, log.createdAt.toISOString());
        return log;
    }
}
export class SqliteScimTokenRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list() {
        const rows = this.db.prepare("SELECT * FROM scim_tokens ORDER BY created_at ASC").all();
        return rows.map(mapScimToken);
    }
    async findByTokenHash(tokenHash) {
        const row = this.db.prepare("SELECT * FROM scim_tokens WHERE token_hash = ?").get(tokenHash);
        return row ? mapScimToken(row) : undefined;
    }
    async create(input) {
        const now = new Date();
        const token = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO scim_tokens (id, label, token_hash, last_used_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(token.id, token.label, token.tokenHash, null, token.expiresAt ? token.expiresAt.toISOString() : null, token.createdAt.toISOString(), token.updatedAt.toISOString());
        return token;
    }
    async touchLastUsed(id, usedAt) {
        this.db.prepare("UPDATE scim_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?")
            .run(usedAt.toISOString(), usedAt.toISOString(), id);
    }
    async delete(id) {
        this.db.prepare("DELETE FROM scim_tokens WHERE id = ?").run(id);
    }
}
export class SqliteProvisioningMappingRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list() {
        const rows = this.db.prepare("SELECT * FROM provisioning_mappings ORDER BY created_at ASC").all();
        return rows.map(mapProvisioningMapping);
    }
    async create(input) {
        const now = new Date();
        const mapping = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO provisioning_mappings (id, name, source_attribute, target_attribute, transform_expression, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mapping.id, mapping.name, mapping.sourceAttribute, mapping.targetAttribute, mapping.transformExpression ?? null, mapping.enabled ? 1 : 0, mapping.createdAt.toISOString(), mapping.updatedAt.toISOString());
        return mapping;
    }
    async update(id, input) {
        const currentRow = this.db.prepare("SELECT * FROM provisioning_mappings WHERE id = ?").get(id);
        if (!currentRow) {
            return undefined;
        }
        const current = mapProvisioningMapping(currentRow);
        const updated = {
            ...current,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE provisioning_mappings
      SET name = ?, source_attribute = ?, target_attribute = ?, transform_expression = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.name, updated.sourceAttribute, updated.targetAttribute, updated.transformExpression ?? null, updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    async delete(id) {
        this.db.prepare("DELETE FROM provisioning_mappings WHERE id = ?").run(id);
    }
}
export class SqliteProvisioningJobRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(limit = 50) {
        const rows = this.db.prepare("SELECT * FROM provisioning_jobs ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapProvisioningJob);
    }
    async create(input) {
        const job = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO provisioning_jobs (id, job_type, status, summary_json, initiated_by_user_id, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(job.id, job.jobType, job.status, JSON.stringify(job.summary), job.initiatedByUserId ?? null, job.createdAt.toISOString(), job.completedAt ? job.completedAt.toISOString() : null);
        return job;
    }
    async update(id, input) {
        const row = this.db.prepare("SELECT * FROM provisioning_jobs WHERE id = ?").get(id);
        if (!row) {
            return undefined;
        }
        const current = mapProvisioningJob(row);
        const updated = {
            ...current,
            ...input
        };
        this.db.prepare(`
      UPDATE provisioning_jobs
      SET job_type = ?, status = ?, summary_json = ?, initiated_by_user_id = ?, completed_at = ?
      WHERE id = ?
    `).run(updated.jobType, updated.status, JSON.stringify(updated.summary), updated.initiatedByUserId ?? null, updated.completedAt ? updated.completedAt.toISOString() : null, id);
        return updated;
    }
}
export class SqliteDeprovisioningQueueRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(limit = 100) {
        const rows = this.db.prepare("SELECT * FROM deprovisioning_queue ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapDeprovisioningQueueItem);
    }
    async enqueue(input) {
        const item = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO deprovisioning_queue (id, subject_type, subject_id, action_type, status, payload_json, error, created_at, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.subjectType, item.subjectId, item.actionType, item.status, JSON.stringify(item.payload), item.error ?? null, item.createdAt.toISOString(), item.processedAt ? item.processedAt.toISOString() : null);
        return item;
    }
    async updateStatus(id, input) {
        const existing = this.db.prepare("SELECT * FROM deprovisioning_queue WHERE id = ?").get(id);
        if (!existing) {
            return undefined;
        }
        const current = mapDeprovisioningQueueItem(existing);
        const updated = {
            ...current,
            status: input.status,
            error: input.error,
            processedAt: input.processedAt
        };
        this.db.prepare(`
      UPDATE deprovisioning_queue
      SET status = ?, error = ?, processed_at = ?
      WHERE id = ?
    `).run(updated.status, updated.error ?? null, updated.processedAt ? updated.processedAt.toISOString() : null, id);
        return updated;
    }
}
export class SqliteAccessRequestRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(input) {
        const limit = Math.max(1, Math.min(200, input?.limit ?? 100));
        if (input?.status) {
            const rows = this.db.prepare("SELECT * FROM access_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?").all(input.status, limit);
            return rows.map(mapAccessRequest);
        }
        const rows = this.db.prepare("SELECT * FROM access_requests ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapAccessRequest);
    }
    async findById(id) {
        const row = this.db.prepare("SELECT * FROM access_requests WHERE id = ?").get(id);
        return row ? mapAccessRequest(row) : undefined;
    }
    async create(input) {
        const now = new Date();
        const request = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO access_requests (id, requester_id, subject_user_id, entitlement_type, entitlement_value, status, justification, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(request.id, request.requesterId, request.subjectUserId, request.entitlementType, request.entitlementValue, request.status, request.justification, request.expiresAt ? request.expiresAt.toISOString() : null, request.createdAt.toISOString(), request.updatedAt.toISOString());
        return request;
    }
    async update(id, input) {
        const existing = this.db.prepare("SELECT * FROM access_requests WHERE id = ?").get(id);
        if (!existing) {
            return undefined;
        }
        const current = mapAccessRequest(existing);
        const updated = {
            ...current,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE access_requests
      SET requester_id = ?, subject_user_id = ?, entitlement_type = ?, entitlement_value = ?, status = ?, justification = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.requesterId, updated.subjectUserId, updated.entitlementType, updated.entitlementValue, updated.status, updated.justification, updated.expiresAt ? updated.expiresAt.toISOString() : null, updated.updatedAt.toISOString(), id);
        return updated;
    }
}
export class SqliteAccessRequestApprovalRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async listByAccessRequestId(accessRequestId) {
        const rows = this.db.prepare("SELECT * FROM access_request_approvals WHERE access_request_id = ? ORDER BY created_at ASC").all(accessRequestId);
        return rows.map(mapAccessRequestApproval);
    }
    async create(input) {
        const approval = {
            ...input,
            id: nanoid(),
            createdAt: new Date()
        };
        this.db.prepare(`
      INSERT INTO access_request_approvals (id, access_request_id, approver_id, decision, rationale, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(approval.id, approval.accessRequestId, approval.approverId, approval.decision, approval.rationale ?? null, approval.createdAt.toISOString());
        return approval;
    }
}
export class SqliteAccessReviewCampaignRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(input) {
        const limit = Math.max(1, Math.min(200, input?.limit ?? 100));
        if (input?.status) {
            const rows = this.db.prepare("SELECT * FROM access_review_campaigns WHERE status = ? ORDER BY created_at DESC LIMIT ?").all(input.status, limit);
            return rows.map(mapAccessReviewCampaign);
        }
        const rows = this.db.prepare("SELECT * FROM access_review_campaigns ORDER BY created_at DESC LIMIT ?").all(limit);
        return rows.map(mapAccessReviewCampaign);
    }
    async findById(id) {
        const row = this.db.prepare("SELECT * FROM access_review_campaigns WHERE id = ?").get(id);
        return row ? mapAccessReviewCampaign(row) : undefined;
    }
    async create(input) {
        const now = new Date();
        const campaign = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO access_review_campaigns (id, name, description, status, created_by_user_id, due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaign.id, campaign.name, campaign.description ?? null, campaign.status, campaign.createdByUserId, campaign.dueAt ? campaign.dueAt.toISOString() : null, campaign.createdAt.toISOString(), campaign.updatedAt.toISOString());
        return campaign;
    }
    async update(id, input) {
        const existing = this.db.prepare("SELECT * FROM access_review_campaigns WHERE id = ?").get(id);
        if (!existing) {
            return undefined;
        }
        const current = mapAccessReviewCampaign(existing);
        const updated = {
            ...current,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE access_review_campaigns
      SET name = ?, description = ?, status = ?, created_by_user_id = ?, due_at = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.name, updated.description ?? null, updated.status, updated.createdByUserId, updated.dueAt ? updated.dueAt.toISOString() : null, updated.updatedAt.toISOString(), id);
        return updated;
    }
}
export class SqliteAccessReviewItemRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async listByCampaignId(campaignId) {
        const rows = this.db.prepare("SELECT * FROM access_review_items WHERE campaign_id = ? ORDER BY created_at ASC").all(campaignId);
        return rows.map(mapAccessReviewItem);
    }
    async findById(id) {
        const row = this.db.prepare("SELECT * FROM access_review_items WHERE id = ?").get(id);
        return row ? mapAccessReviewItem(row) : undefined;
    }
    async create(input) {
        const now = new Date();
        const item = {
            ...input,
            id: nanoid(),
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO access_review_items (
        id,
        campaign_id,
        subject_user_id,
        entitlement_type,
        entitlement_value,
        current_state,
        decision,
        decided_by_user_id,
        decision_rationale,
        decided_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.campaignId, item.subjectUserId, item.entitlementType, item.entitlementValue, item.currentState, item.decision ?? null, item.decidedByUserId ?? null, item.decisionRationale ?? null, item.decidedAt ? item.decidedAt.toISOString() : null, item.createdAt.toISOString(), item.updatedAt.toISOString());
        return item;
    }
    async update(id, input) {
        const existing = this.db.prepare("SELECT * FROM access_review_items WHERE id = ?").get(id);
        if (!existing) {
            return undefined;
        }
        const current = mapAccessReviewItem(existing);
        const updated = {
            ...current,
            ...input,
            updatedAt: new Date()
        };
        this.db.prepare(`
      UPDATE access_review_items
      SET campaign_id = ?, subject_user_id = ?, entitlement_type = ?, entitlement_value = ?, current_state = ?, decision = ?, decided_by_user_id = ?, decision_rationale = ?, decided_at = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.campaignId, updated.subjectUserId, updated.entitlementType, updated.entitlementValue, updated.currentState, updated.decision ?? null, updated.decidedByUserId ?? null, updated.decisionRationale ?? null, updated.decidedAt ? updated.decidedAt.toISOString() : null, updated.updatedAt.toISOString(), id);
        return updated;
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
const mapElevationRequest = (row) => ({
    id: String(row.id),
    correlationId: String(row.correlation_id ?? row.id),
    requesterId: String(row.requester_id),
    justification: String(row.justification),
    resource: String(row.resource),
    action: String(row.action),
    status: row.status,
    approvedByUserId: row.approved_by_user_id ? String(row.approved_by_user_id) : undefined,
    approvedAt: maybeDate(row.approved_at),
    activatedAt: maybeDate(row.activated_at),
    expiresAt: maybeDate(row.expires_at),
    revokedAt: maybeDate(row.revoked_at),
    revokedByUserId: row.revoked_by_user_id ? String(row.revoked_by_user_id) : undefined,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
const mapElevationSession = (row) => ({
    id: String(row.id),
    correlationId: String(row.correlation_id ?? row.elevation_request_id),
    elevationRequestId: String(row.elevation_request_id),
    requesterId: String(row.requester_id),
    resource: String(row.resource),
    action: String(row.action),
    status: row.status,
    startedAt: asDate(row.started_at),
    expiresAt: asDate(row.expires_at),
    endedAt: maybeDate(row.ended_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
});
export class SqliteElevationRequestRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list(input) {
        const limit = input?.limit ?? 100;
        const conditions = [];
        const params = [];
        if (input?.status) {
            conditions.push("status = ?");
            params.push(input.status);
        }
        if (input?.requesterId) {
            conditions.push("requester_id = ?");
            params.push(input.requesterId);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit);
        const rows = this.db.prepare(`SELECT * FROM elevation_requests ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
        return rows.map(mapElevationRequest);
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM elevation_requests WHERE id = ?").get(id);
        return row ? mapElevationRequest(row) : undefined;
    }
    create(input) {
        const now = new Date();
        const request = {
            id: nanoid(),
            ...input,
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO elevation_requests
        (id, correlation_id, requester_id, justification, resource, action, status, approved_by_user_id, approved_at, activated_at, expires_at, revoked_at, revoked_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(request.id, request.correlationId, request.requesterId, request.justification, request.resource, request.action, request.status, request.approvedByUserId ?? null, request.approvedAt?.toISOString() ?? null, request.activatedAt?.toISOString() ?? null, request.expiresAt?.toISOString() ?? null, request.revokedAt?.toISOString() ?? null, request.revokedByUserId ?? null, request.createdAt.toISOString(), request.updatedAt.toISOString());
        return request;
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...input, updatedAt: new Date() };
        this.db.prepare(`
      UPDATE elevation_requests
      SET correlation_id = ?, requester_id = ?, justification = ?, resource = ?, action = ?, status = ?,
          approved_by_user_id = ?, approved_at = ?, activated_at = ?, expires_at = ?,
          revoked_at = ?, revoked_by_user_id = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.correlationId, updated.requesterId, updated.justification, updated.resource, updated.action, updated.status, updated.approvedByUserId ?? null, updated.approvedAt?.toISOString() ?? null, updated.activatedAt?.toISOString() ?? null, updated.expiresAt?.toISOString() ?? null, updated.revokedAt?.toISOString() ?? null, updated.revokedByUserId ?? null, updated.updatedAt.toISOString(), id);
        return updated;
    }
}
export class SqliteElevationSessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list(input) {
        const limit = input?.limit ?? 100;
        const conditions = [];
        const params = [];
        if (input?.status) {
            conditions.push("status = ?");
            params.push(input.status);
        }
        if (input?.requesterId) {
            conditions.push("requester_id = ?");
            params.push(input.requesterId);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit);
        const rows = this.db.prepare(`SELECT * FROM elevation_sessions ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
        return rows.map(mapElevationSession);
    }
    create(input) {
        const now = new Date();
        const session = {
            id: nanoid(),
            ...input,
            createdAt: now,
            updatedAt: now
        };
        this.db.prepare(`
      INSERT INTO elevation_sessions
        (id, correlation_id, elevation_request_id, requester_id, resource, action, status, started_at, expires_at, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session.id, session.correlationId, session.elevationRequestId, session.requesterId, session.resource, session.action, session.status, session.startedAt.toISOString(), session.expiresAt.toISOString(), session.endedAt?.toISOString() ?? null, session.createdAt.toISOString(), session.updatedAt.toISOString());
        return session;
    }
    findActive(input) {
        const now = (input.now ?? new Date()).toISOString();
        const row = this.db.prepare(`
      SELECT * FROM elevation_sessions
      WHERE requester_id = ? AND resource = ? AND action = ? AND status = 'active' AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(input.requesterId, input.resource, input.action, now);
        return row ? mapElevationSession(row) : undefined;
    }
    closeByElevationRequestId(input) {
        const result = this.db.prepare(`
      UPDATE elevation_sessions
      SET status = ?, ended_at = ?, updated_at = ?
      WHERE elevation_request_id = ? AND status = 'active'
    `).run(input.status, input.closedAt.toISOString(), input.closedAt.toISOString(), input.elevationRequestId);
        return result.changes;
    }
    closeExpired(now) {
        const result = this.db.prepare(`
      UPDATE elevation_sessions
      SET status = 'expired', ended_at = ?, updated_at = ?
      WHERE status = 'active' AND expires_at <= ?
    `).run(now.toISOString(), now.toISOString(), now.toISOString());
        return result.changes;
    }
    // SAML Service Provider Repository Implementation
    samlServiceProviderList() {
        const rows = this.db.prepare("SELECT * FROM saml_service_providers").all();
        return rows.map((row) => ({
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        }));
    }
    samlServiceProviderFindById(id) {
        const row = this.db.prepare("SELECT * FROM saml_service_providers WHERE id = ?").get(id);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        };
    }
    samlServiceProviderFindByEntityId(entityId) {
        const row = this.db.prepare("SELECT * FROM saml_service_providers WHERE entity_id = ?").get(entityId);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        };
    }
    samlServiceProviderCreate(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_service_providers (id, app_id, entity_id, metadata, acs_url, slo_url, signing_certificate, encryption_certificate, name_id_format, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.appId || null, input.entityId, input.metadata || null, input.acsUrl, input.sloUrl || null, input.signingCertificate || null, input.encryptionCertificate || null, input.nameIdFormat, input.enabled ? 1 : 0, now, now);
        return {
            id,
            ...input,
            createdAt: new Date(now),
            updatedAt: new Date(now)
        };
    }
    samlServiceProviderUpdate(id, input) {
        const now = new Date().toISOString();
        const existing = this.samlServiceProviderFindById(id);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            ...input,
            updatedAt: new Date(now)
        };
        this.db.prepare(`
      UPDATE saml_service_providers
      SET app_id = ?, entity_id = ?, metadata = ?, acs_url = ?, slo_url = ?, signing_certificate = ?, encryption_certificate = ?, name_id_format = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.appId || null, updated.entityId, updated.metadata || null, updated.acsUrl, updated.sloUrl || null, updated.signingCertificate || null, updated.encryptionCertificate || null, updated.nameIdFormat, updated.enabled ? 1 : 0, now, id);
        return updated;
    }
    samlServiceProviderDelete(id) {
        this.db.prepare("DELETE FROM saml_service_providers WHERE id = ?").run(id);
    }
    // SAML Name ID Mapping Repository Implementation
    samlNameIdMappingFindBySpId(spId) {
        const rows = this.db.prepare("SELECT * FROM saml_name_id_mappings WHERE sp_id = ?").all(spId);
        return rows.map((row) => ({
            id: String(row.id),
            spId: String(row.sp_id),
            format: String(row.format),
            sourceAttribute: String(row.source_attribute),
            createdAt: new Date(String(row.created_at))
        }));
    }
    samlNameIdMappingCreate(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_name_id_mappings (id, sp_id, format, source_attribute, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.spId, input.format, input.sourceAttribute, now);
        return {
            id,
            ...input,
            createdAt: new Date(now)
        };
    }
    samlNameIdMappingDeleteBySpId(spId) {
        const result = this.db.prepare("DELETE FROM saml_name_id_mappings WHERE sp_id = ?").run(spId);
        return result.changes;
    }
    // SAML Assertion Audit Repository Implementation
    samlAssertionAuditList(input) {
        let query = "SELECT * FROM saml_assertion_audits";
        const params = [];
        if (input?.spId) {
            query += " WHERE sp_id = ?";
            params.push(input.spId);
        }
        query += " ORDER BY created_at DESC";
        if (input?.limit) {
            query += ` LIMIT ${input.limit}`;
        }
        const rows = this.db.prepare(query).all(...params);
        return rows.map((row) => ({
            id: String(row.id),
            spId: String(row.sp_id),
            requestId: String(row.request_id),
            responseId: String(row.response_id),
            subject: String(row.subject),
            audience: String(row.audience),
            assertionId: String(row.assertion_id),
            issueInstant: new Date(String(row.issue_instant)),
            notOnOrAfter: new Date(String(row.not_on_or_after)),
            destinationUrl: String(row.destination_url),
            statusCode: String(row.status_code),
            createdAt: new Date(String(row.created_at))
        }));
    }
    samlAssertionAuditFindById(id) {
        const row = this.db.prepare("SELECT * FROM saml_assertion_audits WHERE id = ?").get(id);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            spId: String(row.sp_id),
            requestId: String(row.request_id),
            responseId: String(row.response_id),
            subject: String(row.subject),
            audience: String(row.audience),
            assertionId: String(row.assertion_id),
            issueInstant: new Date(String(row.issue_instant)),
            notOnOrAfter: new Date(String(row.not_on_or_after)),
            destinationUrl: String(row.destination_url),
            statusCode: String(row.status_code),
            createdAt: new Date(String(row.created_at))
        };
    }
    samlAssertionAuditCreate(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_assertion_audits (id, sp_id, request_id, response_id, subject, audience, assertion_id, issue_instant, not_on_or_after, destination_url, status_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.spId, input.requestId, input.responseId, input.subject, input.audience, input.assertionId, input.issueInstant.toISOString(), input.notOnOrAfter.toISOString(), input.destinationUrl, input.statusCode, now);
        return {
            id,
            ...input,
            createdAt: new Date(now)
        };
    }
}
export class SqliteSamlServiceProviderRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list() {
        const rows = this.db.prepare("SELECT * FROM saml_service_providers ORDER BY created_at ASC").all();
        return rows.map((row) => ({
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        }));
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM saml_service_providers WHERE id = ?").get(id);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        };
    }
    findByEntityId(entityId) {
        const row = this.db.prepare("SELECT * FROM saml_service_providers WHERE entity_id = ?").get(entityId);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            appId: row.app_id ? String(row.app_id) : undefined,
            entityId: String(row.entity_id),
            metadata: row.metadata ? String(row.metadata) : undefined,
            acsUrl: String(row.acs_url),
            sloUrl: row.slo_url ? String(row.slo_url) : undefined,
            signingCertificate: row.signing_certificate ? String(row.signing_certificate) : undefined,
            encryptionCertificate: row.encryption_certificate ? String(row.encryption_certificate) : undefined,
            nameIdFormat: String(row.name_id_format),
            enabled: Boolean(row.enabled),
            createdAt: new Date(String(row.created_at)),
            updatedAt: new Date(String(row.updated_at))
        };
    }
    create(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_service_providers (id, app_id, entity_id, metadata, acs_url, slo_url, signing_certificate, encryption_certificate, name_id_format, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.appId ?? null, input.entityId, input.metadata ?? null, input.acsUrl, input.sloUrl ?? null, input.signingCertificate ?? null, input.encryptionCertificate ?? null, input.nameIdFormat, input.enabled ? 1 : 0, now, now);
        return {
            id,
            ...input,
            createdAt: new Date(now),
            updatedAt: new Date(now)
        };
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...input, updatedAt: new Date() };
        this.db.prepare(`
      UPDATE saml_service_providers
      SET app_id = ?, entity_id = ?, metadata = ?, acs_url = ?, slo_url = ?, signing_certificate = ?, encryption_certificate = ?, name_id_format = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updated.appId ?? null, updated.entityId, updated.metadata ?? null, updated.acsUrl, updated.sloUrl ?? null, updated.signingCertificate ?? null, updated.encryptionCertificate ?? null, updated.nameIdFormat, updated.enabled ? 1 : 0, updated.updatedAt.toISOString(), id);
        return updated;
    }
    delete(id) {
        this.db.prepare("DELETE FROM saml_service_providers WHERE id = ?").run(id);
    }
}
export class SqliteSamlNameIdMappingRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findBySpId(spId) {
        const rows = this.db.prepare("SELECT * FROM saml_name_id_mappings WHERE sp_id = ? ORDER BY created_at ASC").all(spId);
        return rows.map((row) => ({
            id: String(row.id),
            spId: String(row.sp_id),
            format: String(row.format),
            sourceAttribute: String(row.source_attribute),
            createdAt: new Date(String(row.created_at))
        }));
    }
    create(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_name_id_mappings (id, sp_id, format, source_attribute, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.spId, input.format, input.sourceAttribute, now);
        return {
            id,
            ...input,
            createdAt: new Date(now)
        };
    }
    deleteBySpId(spId) {
        const result = this.db.prepare("DELETE FROM saml_name_id_mappings WHERE sp_id = ?").run(spId);
        return result.changes;
    }
}
export class SqliteSamlAssertionAuditRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    list(input) {
        let query = "SELECT * FROM saml_assertion_audits";
        const params = [];
        if (input?.spId) {
            query += " WHERE sp_id = ?";
            params.push(input.spId);
        }
        query += " ORDER BY created_at DESC";
        if (input?.limit) {
            query += ` LIMIT ${input.limit}`;
        }
        const rows = this.db.prepare(query).all(...params);
        return rows.map((row) => ({
            id: String(row.id),
            spId: String(row.sp_id),
            requestId: String(row.request_id),
            responseId: String(row.response_id),
            subject: String(row.subject),
            audience: String(row.audience),
            assertionId: String(row.assertion_id),
            issueInstant: new Date(String(row.issue_instant)),
            notOnOrAfter: new Date(String(row.not_on_or_after)),
            destinationUrl: String(row.destination_url),
            statusCode: String(row.status_code),
            createdAt: new Date(String(row.created_at))
        }));
    }
    findById(id) {
        const row = this.db.prepare("SELECT * FROM saml_assertion_audits WHERE id = ?").get(id);
        if (!row)
            return undefined;
        return {
            id: String(row.id),
            spId: String(row.sp_id),
            requestId: String(row.request_id),
            responseId: String(row.response_id),
            subject: String(row.subject),
            audience: String(row.audience),
            assertionId: String(row.assertion_id),
            issueInstant: new Date(String(row.issue_instant)),
            notOnOrAfter: new Date(String(row.not_on_or_after)),
            destinationUrl: String(row.destination_url),
            statusCode: String(row.status_code),
            createdAt: new Date(String(row.created_at))
        };
    }
    create(input) {
        const id = nanoid();
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO saml_assertion_audits (id, sp_id, request_id, response_id, subject, audience, assertion_id, issue_instant, not_on_or_after, destination_url, status_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.spId, input.requestId, input.responseId, input.subject, input.audience, input.assertionId, input.issueInstant.toISOString(), input.notOnOrAfter.toISOString(), input.destinationUrl, input.statusCode, now);
        return {
            id,
            ...input,
            createdAt: new Date(now)
        };
    }
}
