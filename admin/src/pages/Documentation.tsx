import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { BookText, Code2, Search, Server } from 'lucide-react'

type DocArea = 'api' | 'admin' | 'dev'

interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  auth: 'public' | 'session' | 'bearer' | 'client' | 'session+csrf' | 'token'
  description: string
}

interface ApiEndpointDocs {
  parameters: string[]
  requestJson?: string
  expectedResponse: string
  notes?: string[]
}

interface TutorialSection {
  title: string
  goal: string
  steps: string[]
  expectedResult: string
}

interface ConceptGuide {
  id: string
  title: string
  plainExplanation: string
  whyItMatters: string
  whoDefinesIt: string
  whereInAdmin: string[]
  details: string[]
}

interface EntityFieldGuide {
  entity: string
  view: string
  purpose: string
  whenToUse: string
  learnMore: string[]
  fields: Array<{
    field: string
    meaning: string
    recommendation: string
  }>
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const matchesSearch = (needle: string, values: Array<string | undefined>) => {
  if (!needle) return true

  return values.some((value) => value?.toLowerCase().includes(needle))
}

const API_ROUTES: ApiRoute[] = [
  { method: 'GET', path: '/health', auth: 'public', description: 'Health probe for service status and timestamp.' },
  { method: 'GET', path: '/api/ui/customization', auth: 'public', description: 'Resolves merged UI customization for a target surface, with optional clientId/appId override context.' },
  { method: 'GET', path: '/api/setup/status', auth: 'public', description: 'Reports initialization status and whether setup is required.' },
  { method: 'POST', path: '/api/setup/initialize', auth: 'public', description: 'Bootstraps first admin account and platform defaults.' },
  { method: 'GET', path: '/api/csrf-token', auth: 'session', description: 'Issues CSRF token cookie and response payload for admin mutations.' },

  { method: 'GET', path: '/.well-known/openid-configuration', auth: 'public', description: 'OIDC discovery metadata document.' },
  { method: 'GET', path: '/.well-known/jwks.json', auth: 'public', description: 'JWKS document for token signature verification.' },
  { method: 'POST', path: '/connect/register', auth: 'public', description: 'Dynamic client registration endpoint.' },
  { method: 'GET', path: '/oauth/authorize', auth: 'session', description: 'Authorization endpoint for code and implicit flows.' },
  { method: 'POST', path: '/oauth/token', auth: 'client', description: 'Token endpoint for authorization_code, refresh_token, client_credentials, password, and device_code grants.' },
  { method: 'POST', path: '/oauth/device/authorize', auth: 'client', description: 'Starts device authorization flow and returns user_code/device_code.' },
  { method: 'POST', path: '/oauth/device/verify', auth: 'public', description: 'User approval/denial endpoint for device flow verification.' },
  { method: 'POST', path: '/oauth/introspect', auth: 'client', description: 'Token introspection endpoint.' },
  { method: 'POST', path: '/oauth/token/revoke', auth: 'client', description: 'RFC7009 token revocation endpoint.' },
  { method: 'GET', path: '/oauth/userinfo', auth: 'bearer', description: 'Returns user claims for the presented access token.' },
  { method: 'GET', path: '/oauth/logout', auth: 'session', description: 'OIDC RP-initiated logout endpoint.' },
  { method: 'GET', path: '/oauth/frontchannel-logout', auth: 'session', description: 'Front-channel logout endpoint for sid/sub scoped revocation.' },
  { method: 'POST', path: '/oauth/backchannel-logout', auth: 'client', description: 'Back-channel logout endpoint for sid/sub scoped revocation.' },
  { method: 'POST', path: '/oauth/revoke', auth: 'session+csrf', description: 'Legacy local token revocation helper endpoint.' },

  { method: 'GET', path: '/scim/v2/ServiceProviderConfig', auth: 'bearer', description: 'SCIM service provider capabilities document.' },
  { method: 'GET', path: '/scim/v2/Schemas', auth: 'bearer', description: 'Lists supported SCIM schemas for User and Group resources.' },
  { method: 'GET', path: '/scim/v2/ResourceTypes', auth: 'bearer', description: 'Lists supported SCIM resource types and endpoint bindings.' },
  { method: 'GET', path: '/scim/v2/Users', auth: 'bearer', description: 'Lists SCIM users with optional filter and pagination.' },
  { method: 'POST', path: '/scim/v2/Users', auth: 'bearer', description: 'Creates SCIM user (supports externalId linkage) and emits scim.user.created plus audit event.' },
  { method: 'GET', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Gets SCIM user by id.' },
  { method: 'PUT', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Replaces SCIM user profile/external linkage and emits scim.user.updated plus audit event.' },
  { method: 'PATCH', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Applies SCIM patch operations (including externalId) and emits scim.user.updated plus audit event.' },
  { method: 'DELETE', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Deletes SCIM user and emits scim.user.deleted plus audit event.' },
  { method: 'GET', path: '/scim/v2/Groups', auth: 'bearer', description: 'Lists SCIM groups with optional filter and pagination.' },
  { method: 'POST', path: '/scim/v2/Groups', auth: 'bearer', description: 'Creates SCIM group (supports externalId linkage) and emits scim.group.created plus audit event.' },
  { method: 'GET', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Gets SCIM group by id.' },
  { method: 'PUT', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Replaces SCIM group display name/members/external linkage, emitting scim.group.updated plus audit event.' },
  { method: 'PATCH', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Applies SCIM patch operations to group display name/members/externalId, emitting scim.group.updated plus audit event.' },
  { method: 'DELETE', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Deletes SCIM group and emits scim.group.deleted plus audit event.' },

  { method: 'GET', path: '/saml/metadata', auth: 'public', description: 'Returns generated SAML metadata XML for a configured service provider (`spId` query parameter).' },
  { method: 'POST', path: '/saml/sso', auth: 'session', description: 'Builds and signs a SAML Response for a configured service provider and returns form-post handoff or JSON payload.' },
  { method: 'POST', path: '/saml/acs/:spId', auth: 'public', description: 'Accepts base64 signed SAML responses for signature verification, signature-wrapping defense checks, validation/audit correlation, audience/destination checks, clock-skew handling, and replay protection (replayed responses are rejected).' },
  { method: 'POST', path: '/saml/slo', auth: 'session', description: 'Processes SAML logout handoff by revoking the active session and clearing cookie state.' },

  { method: 'POST', path: '/auth/login', auth: 'public', description: 'Login endpoint creating session cookie and issuing initial tokens.' },
  { method: 'POST', path: '/auth/login/webauthn/begin', auth: 'public', description: 'Starts passkey-based login by issuing a WebAuthn challenge for the identified account.' },
  { method: 'POST', path: '/auth/login/webauthn/finish', auth: 'public', description: 'Completes passkey-based login using credential assertion payload and issues browser session/tokens.' },
  { method: 'POST', path: '/auth/logout', auth: 'session+csrf', description: 'Clears active session cookie and emits logout event.' },
  { method: 'GET', path: '/auth/federation/providers', auth: 'public', description: 'Lists enabled federation providers for sign-in screen.' },
  { method: 'GET', path: '/auth/federation/:providerId/start', auth: 'public', description: 'Starts external IdP authorization redirect.' },
  { method: 'GET', path: '/auth/federation/:providerId/callback', auth: 'public', description: 'Processes external IdP callback and creates local session.' },

  { method: 'GET', path: '/api/admin/me', auth: 'session', description: 'Returns authenticated admin profile, roles, groups, and permissions.' },
  { method: 'GET', path: '/api/admin/security/risk-events', auth: 'session', description: 'Lists normalized security risk events derived from audit telemetry (login failures, lockouts, anomaly detections, and protocol/security blocks).' },
  { method: 'GET', path: '/api/admin/settings', auth: 'session', description: 'Returns persisted instance-wide administration and security settings.' },
  { method: 'PUT', path: '/api/admin/settings', auth: 'session+csrf', description: 'Updates instance-wide transport, CORS, OAuth, email, and runtime security controls.' },
  { method: 'POST', path: '/api/admin/settings/database/test', auth: 'session+csrf', description: 'Tests connectivity to a PostgreSQL/MySQL target database URL.' },
  { method: 'POST', path: '/api/admin/settings/database/migrate', auth: 'session+csrf', description: 'Copies data from SQLite into the configured external PostgreSQL/MySQL database.' },
  { method: 'GET', path: '/api/admin/provisioning/tokens', auth: 'session', description: 'Lists SCIM provisioning tokens with audit-friendly metadata.' },
  { method: 'POST', path: '/api/admin/provisioning/tokens', auth: 'session+csrf', description: 'Creates a SCIM provisioning token. Raw token is returned only once.' },
  { method: 'DELETE', path: '/api/admin/provisioning/tokens/:id', auth: 'session+csrf', description: 'Revokes a SCIM provisioning token by id.' },
  { method: 'POST', path: '/api/admin/saml/service-providers/:id/metadata', auth: 'session+csrf', description: 'Uploads SP metadata XML, stores raw metadata, and optionally applies parsed entityId/ACS/SLO/certificate fields.' },
  { method: 'POST', path: '/api/admin/saml/service-providers/:id/certificates/rotate', auth: 'session+csrf', description: 'Rotates signing or encryption certificate for a configured service provider without a full object update.' },
  { method: 'GET', path: '/api/admin/provisioning/mappings', auth: 'session', description: 'Lists configured provisioning attribute mappings.' },
  { method: 'POST', path: '/api/admin/provisioning/mappings', auth: 'session+csrf', description: 'Creates a provisioning attribute mapping rule (supports lowercase/uppercase/trim transform expressions).' },
  { method: 'DELETE', path: '/api/admin/provisioning/mappings/:id', auth: 'session+csrf', description: 'Deletes a provisioning attribute mapping rule.' },
  { method: 'GET', path: '/api/admin/provisioning/jobs', auth: 'session', description: 'Lists recent provisioning reconciliation jobs.' },
  { method: 'GET', path: '/api/admin/provisioning/deprovisioning-queue', auth: 'session', description: 'Lists queued downstream deprovisioning/offboarding tasks.' },
  { method: 'POST', path: '/api/admin/provisioning/jobs/reconcile', auth: 'session+csrf', description: 'Starts a provisioning reconciliation run and reports drift/updated counters (dry-run supported).' },
  { method: 'GET', path: '/api/admin/access-requests', auth: 'session', description: 'Lists access governance requests with optional status filtering.' },
  { method: 'POST', path: '/api/admin/access-requests', auth: 'session+csrf', description: 'Creates an access governance request for a target entitlement.' },
  { method: 'POST', path: '/api/admin/access-requests/:id/approve', auth: 'session+csrf', description: 'Approves a pending access governance request and records approval evidence.' },
  { method: 'POST', path: '/api/admin/access-requests/:id/reject', auth: 'session+csrf', description: 'Rejects a pending access governance request and records rejection rationale.' },
  { method: 'POST', path: '/api/admin/access-requests/process-expirations', auth: 'session+csrf', description: 'Expires approved requests past expiresAt and revokes previously granted entitlements (supports dryRun).' },
  { method: 'POST', path: '/api/admin/access-reviews/campaigns', auth: 'session+csrf', description: 'Creates a recertification campaign and generates review items from current role/group assignments.' },
  { method: 'GET', path: '/api/admin/access-reviews/campaigns/:id', auth: 'session', description: 'Returns campaign metadata and generated review items.' },
  { method: 'POST', path: '/api/admin/access-reviews/items/:id/decision', auth: 'session+csrf', description: 'Records reviewer decision (certified/revoked), applies revocation for revoked outcomes, and emits attestation evidence metadata into audit/event streams.' },
  { method: 'GET', path: '/api/admin/access-requests/stalled', auth: 'session', description: 'Lists pending access requests that have exceeded the SLA threshold (default 60 min).' },

  { method: 'GET', path: '/api/admin/elevations', auth: 'session', description: 'Lists PAM-lite elevation requests with optional status filtering.' },
  { method: 'POST', path: '/api/admin/elevations', auth: 'session+csrf', description: 'Creates a PAM-lite elevation request for temporary privileged access to a resource.' },
  { method: 'GET', path: '/api/admin/elevations/:id', auth: 'session', description: 'Returns details of a specific elevation request.' },
  { method: 'GET', path: '/api/admin/elevations/sessions', auth: 'session', description: 'Lists elevation sessions with hard-expiry lifecycle states (active/revoked/expired).' },
  { method: 'POST', path: '/api/admin/elevations/:id/approve', auth: 'session+csrf', description: 'Approves a pending elevation request.' },
  { method: 'POST', path: '/api/admin/elevations/:id/activate', auth: 'session+csrf', description: 'Activates an approved elevation request and starts the expiry timer.' },
  { method: 'POST', path: '/api/admin/elevations/:id/revoke', auth: 'session+csrf', description: 'Revokes an active or approved elevation request.' },
  { method: 'POST', path: '/api/admin/elevations/process-expirations', auth: 'session+csrf', description: 'Expires active elevation requests that have passed their scheduled expiry time.' },
  { method: 'POST', path: '/api/admin/elevations/check', auth: 'session+csrf', description: 'Checks whether the current user currently has an active elevation session for a resource/action pair.' },
  { method: 'POST', path: '/api/admin/elevations/break-glass', auth: 'session+csrf', description: 'Activates emergency break-glass elevation for immediate privileged access (bypasses normal approval). Requires detailed emergency justification.' },

  { method: 'GET', path: '/api/admin/users', auth: 'session', description: 'Lists users.' },
  { method: 'POST', path: '/api/admin/users', auth: 'session+csrf', description: 'Creates user and emits user.created event.' },
  { method: 'PATCH', path: '/api/admin/users/:id', auth: 'session+csrf', description: 'Updates user profile, groups, attributes, and emits user.updated event.' },
  { method: 'POST', path: '/api/admin/users/:id/reset-password', auth: 'session+csrf', description: 'Resets password, revokes sessions, and emits user.password_reset event.' },
  { method: 'DELETE', path: '/api/admin/users/:id', auth: 'session+csrf', description: 'Deletes user and emits user.deleted event.' },

  { method: 'GET', path: '/api/admin/groups', auth: 'session', description: 'Lists groups.' },
  { method: 'POST', path: '/api/admin/groups', auth: 'session+csrf', description: 'Creates group.' },
  { method: 'PUT', path: '/api/admin/groups/:id', auth: 'session+csrf', description: 'Updates group.' },
  { method: 'DELETE', path: '/api/admin/groups/:id', auth: 'session+csrf', description: 'Deletes group.' },
  { method: 'POST', path: '/api/admin/user-groups', auth: 'session+csrf', description: 'Assigns user to group.' },
  { method: 'DELETE', path: '/api/admin/user-groups', auth: 'session+csrf', description: 'Removes user from group.' },
  { method: 'POST', path: '/api/admin/group-role-assignments', auth: 'session+csrf', description: 'Assigns role to group.' },
  { method: 'DELETE', path: '/api/admin/group-role-assignments', auth: 'session+csrf', description: 'Removes role from group.' },

  { method: 'GET', path: '/api/admin/roles', auth: 'session', description: 'Lists roles.' },
  { method: 'POST', path: '/api/admin/roles', auth: 'session+csrf', description: 'Creates role.' },
  { method: 'PUT', path: '/api/admin/roles/:id', auth: 'session+csrf', description: 'Updates role.' },
  { method: 'DELETE', path: '/api/admin/roles/:id', auth: 'session+csrf', description: 'Deletes role.' },
  { method: 'POST', path: '/api/admin/role-assignments', auth: 'session+csrf', description: 'Assigns direct role to user.' },

  { method: 'GET', path: '/api/admin/clients', auth: 'session', description: 'Lists OAuth clients.' },
  { method: 'POST', path: '/api/admin/clients', auth: 'session+csrf', description: 'Creates OAuth client and emits client.created event.' },
  { method: 'PUT', path: '/api/admin/clients/:id', auth: 'session+csrf', description: 'Updates OAuth client and emits client.updated event.' },
  { method: 'DELETE', path: '/api/admin/clients/:id', auth: 'session+csrf', description: 'Deletes OAuth client and emits client.deleted event.' },

  { method: 'GET', path: '/api/admin/scopes', auth: 'session', description: 'Lists OAuth scopes.' },
  { method: 'POST', path: '/api/admin/scopes', auth: 'session+csrf', description: 'Creates OAuth scope.' },
  { method: 'DELETE', path: '/api/admin/scopes/:id', auth: 'session+csrf', description: 'Deletes OAuth scope.' },

  { method: 'GET', path: '/api/admin/consents', auth: 'session', description: 'Lists consent grants.' },
  { method: 'DELETE', path: '/api/admin/consents/:id', auth: 'session+csrf', description: 'Revokes consent and emits consent.revoked event.' },

  { method: 'GET', path: '/api/admin/sessions', auth: 'session', description: 'Lists user sessions.' },
  { method: 'DELETE', path: '/api/admin/sessions/:id', auth: 'session+csrf', description: 'Revokes session and emits session.revoked event.' },

  { method: 'GET', path: '/api/admin/devices', auth: 'session', description: 'Lists pending device requests and device sessions.' },
  { method: 'DELETE', path: '/api/admin/devices/requests/:deviceCode', auth: 'session+csrf', description: 'Revokes device request and emits device.request.revoked event.' },
  { method: 'DELETE', path: '/api/admin/devices/sessions/:id', auth: 'session+csrf', description: 'Revokes device session and emits device.session.revoked event.' },

  { method: 'GET', path: '/api/admin/tenants', auth: 'session', description: 'Lists tenants.' },
  { method: 'POST', path: '/api/admin/tenants', auth: 'session+csrf', description: 'Creates tenant.' },
  { method: 'PUT', path: '/api/admin/tenants/:id', auth: 'session+csrf', description: 'Updates tenant.' },

  { method: 'GET', path: '/api/admin/apps', auth: 'session', description: 'Lists apps.' },
  { method: 'POST', path: '/api/admin/apps', auth: 'session+csrf', description: 'Creates app.' },
  { method: 'PUT', path: '/api/admin/apps/:id', auth: 'session+csrf', description: 'Updates app.' },
  { method: 'DELETE', path: '/api/admin/apps/:id', auth: 'session+csrf', description: 'Deletes app.' },

  { method: 'GET', path: '/api/admin/audit', auth: 'session', description: 'Lists audit events.' },

  { method: 'GET', path: '/api/admin/federation/providers', auth: 'session', description: 'Lists configured federation providers.' },
  { method: 'POST', path: '/api/admin/federation/providers', auth: 'session+csrf', description: 'Creates federation provider.' },
  { method: 'PUT', path: '/api/admin/federation/providers/:id', auth: 'session+csrf', description: 'Updates federation provider.' },
  { method: 'DELETE', path: '/api/admin/federation/providers/:id', auth: 'session+csrf', description: 'Deletes federation provider.' },

  { method: 'GET', path: '/api/admin/authentication/flows', auth: 'session', description: 'Lists authentication flows.' },
  { method: 'POST', path: '/api/admin/authentication/flows', auth: 'session+csrf', description: 'Creates authentication flow.' },
  { method: 'PUT', path: '/api/admin/authentication/flows/:id', auth: 'session+csrf', description: 'Updates authentication flow.' },
  { method: 'DELETE', path: '/api/admin/authentication/flows/:id', auth: 'session+csrf', description: 'Deletes authentication flow.' },

  { method: 'GET', path: '/api/admin/user-attributes', auth: 'session', description: 'Lists user attribute definitions.' },
  { method: 'POST', path: '/api/admin/user-attributes', auth: 'session+csrf', description: 'Creates user attribute definition.' },
  { method: 'PUT', path: '/api/admin/user-attributes/:id', auth: 'session+csrf', description: 'Updates user attribute definition.' },
  { method: 'DELETE', path: '/api/admin/user-attributes/:id', auth: 'session+csrf', description: 'Deletes user attribute definition.' },
  { method: 'PUT', path: '/api/admin/user-attributes/:id/groups', auth: 'session+csrf', description: 'Sets group assignment state for user attribute.' },
  { method: 'DELETE', path: '/api/admin/user-attributes/:id/groups/:groupId', auth: 'session+csrf', description: 'Removes user attribute group assignment.' },

  { method: 'GET', path: '/api/admin/policies', auth: 'session', description: 'Lists policy definitions and assignments.' },
  { method: 'POST', path: '/api/admin/policies', auth: 'session+csrf', description: 'Creates policy definition.' },
  { method: 'PUT', path: '/api/admin/policies/:id', auth: 'session+csrf', description: 'Updates policy definition.' },
  { method: 'DELETE', path: '/api/admin/policies/:id', auth: 'session+csrf', description: 'Deletes policy definition.' },
  { method: 'PUT', path: '/api/admin/policies/:id/assignments', auth: 'session+csrf', description: 'Creates or updates policy assignment.' },
  { method: 'DELETE', path: '/api/admin/policies/:id/assignments', auth: 'session+csrf', description: 'Deletes policy assignment.' },

  { method: 'GET', path: '/api/admin/events/hooks', auth: 'session', description: 'Lists event hooks.' },
  { method: 'GET', path: '/api/admin/events/types', auth: 'session', description: 'Lists supported event types.' },
  { method: 'POST', path: '/api/admin/events/hooks', auth: 'session+csrf', description: 'Creates event hook.' },
  { method: 'PUT', path: '/api/admin/events/hooks/:id', auth: 'session+csrf', description: 'Updates event hook.' },
  { method: 'POST', path: '/api/admin/events/hooks/:id/test', auth: 'session+csrf', description: 'Sends test event to one hook target.' },
  { method: 'DELETE', path: '/api/admin/events/hooks/:id', auth: 'session+csrf', description: 'Deletes event hook.' },
  { method: 'GET', path: '/api/admin/events/notifications', auth: 'session', description: 'Lists event delivery notifications.' },

  { method: 'GET', path: '/api/portal/me', auth: 'session', description: 'Returns current portal identity context: profile, groups, roles, permissions, rolePermission matrix, and assigned apps.' },
  { method: 'PATCH', path: '/api/portal/profile', auth: 'session+csrf', description: 'Updates editable fields for current portal user (name and custom attributes).' },
  { method: 'POST', path: '/api/portal/change-password', auth: 'session+csrf', description: 'Changes current portal user password after verifying currentPassword.' },
  { method: 'DELETE', path: '/api/portal/account', auth: 'session+csrf', description: 'Deletes current portal account and revokes active sessions/tokens.' },
  { method: 'POST', path: '/api/portal/avatar', auth: 'session+csrf', description: 'Uploads current user avatar (multipart image file) and returns the resolved avatar URL.' },
  { method: 'GET', path: '/api/account/mfa/webauthn/credentials', auth: 'session', description: 'Lists passkey credentials enrolled by the current account.' },
  { method: 'POST', path: '/api/account/mfa/webauthn/register/begin', auth: 'session+csrf', description: 'Starts passkey enrollment and returns challenge + relying party metadata.' },
  { method: 'POST', path: '/api/account/mfa/webauthn/register/finish', auth: 'session+csrf', description: 'Completes passkey enrollment and stores credential material/signature counter.' },
  { method: 'DELETE', path: '/api/account/mfa/webauthn/credentials/:credentialId', auth: 'session+csrf', description: 'Deletes one enrolled passkey credential for the current account.' },

  // Service Identities (Workload Identity)
  { method: 'GET', path: '/api/admin/service-identities', auth: 'session', description: 'Lists all service identities (non-human machine accounts).' },
  { method: 'POST', path: '/api/admin/service-identities', auth: 'session+csrf', description: 'Creates a new service identity with allowed scopes and audiences.' },
  { method: 'GET', path: '/api/admin/service-identities/:id', auth: 'session', description: 'Returns a service identity with its credential history.' },
  { method: 'PATCH', path: '/api/admin/service-identities/:id', auth: 'session+csrf', description: 'Updates service identity status, scopes, or description.' },
  { method: 'DELETE', path: '/api/admin/service-identities/:id', auth: 'session+csrf', description: 'Deletes a service identity and all its credentials.' },
  { method: 'POST', path: '/api/admin/service-identities/:id/credentials', auth: 'session+csrf', description: 'Issues a new credential (client_id + secret) for the service identity. Secret is shown only once.' },
  { method: 'POST', path: '/api/admin/service-identities/:id/credentials/rotate', auth: 'session+csrf', description: 'Rotates a credential: issues a replacement and revokes the current one atomically.' },
  { method: 'DELETE', path: '/api/admin/service-identities/:id/credentials/:credentialId', auth: 'session+csrf', description: 'Revokes a specific credential immediately.' },
  { method: 'GET', path: '/api/admin/service-identities/:id/usage', auth: 'session', description: 'Returns credential usage telemetry including last-used timestamps and status.' },

  // Connector Framework (EPIC 8)
  { method: 'GET', path: '/api/admin/connectors', auth: 'session', description: 'Lists all configured identity connectors (LDAP, SCIM, CSV, SQL, custom).' },
  { method: 'POST', path: '/api/admin/connectors', auth: 'session+csrf', description: 'Creates a new connector with a type, config JSON, and optional cron schedule.' },
  { method: 'GET', path: '/api/admin/connectors/:id', auth: 'session', description: 'Returns a connector and its current status.' },
  { method: 'PATCH', path: '/api/admin/connectors/:id', auth: 'session+csrf', description: 'Updates connector name, config, schedule, or status.' },
  { method: 'DELETE', path: '/api/admin/connectors/:id', auth: 'session+csrf', description: 'Deletes a connector and all associated runs and mappings.' },
  { method: 'POST', path: '/api/admin/connectors/:id/sync', auth: 'session+csrf', description: 'Triggers an immediate sync run for the connector. Returns a ConnectorRun record.' },
  { method: 'GET', path: '/api/admin/connectors/:id/runs', auth: 'session', description: 'Lists the most recent sync runs for a connector with status, counts, and error messages.' },
  { method: 'GET', path: '/api/admin/connectors/:id/mappings', auth: 'session', description: 'Lists field mappings for a connector (source → target with optional transform).' },
  { method: 'POST', path: '/api/admin/connectors/:id/mappings', auth: 'session+csrf', description: 'Creates a new field mapping for a connector.' },
  { method: 'DELETE', path: '/api/admin/connectors/:connectorId/mappings/:mappingId', auth: 'session+csrf', description: 'Removes a specific field mapping.' },

  // Auth Metrics (EPIC 8)
  { method: 'GET', path: '/api/admin/metrics/auth', auth: 'session', description: 'Returns bucketed auth event metric rollups. Accepts startHour, endHour, and event filter query params.' },

  // Plugin Management
  { method: 'GET', path: '/api/admin/plugins', auth: 'session', description: 'Lists uploaded plugin bundles and validated manifest metadata.' },
  { method: 'POST', path: '/api/admin/plugins/validate', auth: 'session+csrf', description: 'Validates plugin manifest contract and optional bundle payload without persisting.' },
  { method: 'POST', path: '/api/admin/plugins', auth: 'session+csrf', description: 'Uploads a plugin bundle ZIP (base64 payload), stores manifest metadata, and records checksum.' },
  { method: 'DELETE', path: '/api/admin/plugins/:id', auth: 'session+csrf', description: 'Removes an uploaded plugin bundle and metadata record.' },

  // Token Exchange
  { method: 'POST', path: '/oauth/token/exchange', auth: 'token', description: 'RFC 8693 Token Exchange: validates a subject_token and issues a new scoped access token. Supports access_token and JWT subject token types.' },

  { method: 'GET', path: '/users', auth: 'public', description: 'Legacy helper endpoint listing users.' },
  { method: 'GET', path: '/clients', auth: 'public', description: 'Legacy helper endpoint listing clients.' },
  { method: 'GET', path: '/roles', auth: 'public', description: 'Legacy helper endpoint listing roles.' },
  { method: 'GET', path: '/groups', auth: 'public', description: 'Legacy helper endpoint listing groups.' },
  { method: 'GET', path: '/tenants', auth: 'public', description: 'Legacy helper endpoint listing tenants.' },
  { method: 'POST', path: '/users', auth: 'public', description: 'Legacy helper endpoint creating users.' },
  { method: 'POST', path: '/roles', auth: 'public', description: 'Legacy helper endpoint creating roles.' },
  { method: 'POST', path: '/role-assignments', auth: 'public', description: 'Legacy helper endpoint assigning user roles.' },
  { method: 'POST', path: '/groups', auth: 'public', description: 'Legacy helper endpoint creating groups.' },
  { method: 'POST', path: '/tenants', auth: 'public', description: 'Legacy helper endpoint creating tenants.' }
]

const OIDC_OAUTH_CONCEPTS = [
  {
    title: 'Client, Resource Owner, Authorization Server',
    detail: 'OAuth2 authorizes a client to access resources on behalf of a user (resource owner). This platform acts as authorization server and identity provider for OIDC.'
  },
  {
    title: 'Authorization Code, PKCE, And Token Exchange',
    detail: 'Interactive clients start at /oauth/authorize and exchange code for tokens at /oauth/token. PKCE protects public clients by binding code usage to the initiating app.'
  },
  {
    title: 'Access, ID, And Refresh Tokens',
    detail: 'Access tokens authorize API calls, ID tokens carry identity context for OIDC clients, and refresh tokens renew sessions while enforcing rotation and replay protections.'
  },
  {
    title: 'Scopes, Claims, And Consent',
    detail: 'Scopes define requested permissions and identity attributes. Claims exposed by UserInfo and ID tokens depend on granted scopes and client configuration.'
  },
  {
    title: 'Sessions And Logout Semantics',
    detail: 'Browser sessions use secure cookies while OAuth sessions map to issued tokens. Logout includes RP-initiated logout and optional front/back-channel revocation behavior.'
  },
  {
    title: 'OIDC Discovery And JWKS',
    detail: 'Clients bootstrap integration using discovery metadata and verify JWT signatures using the published JWKS endpoint.'
  }
]

const ADMIN_CONCEPT_GUIDES: ConceptGuide[] = [
  {
    id: 'app',
    title: 'What Is An App?',
    plainExplanation: 'An app is a named logical container that groups together related users, roles, groups, and OAuth clients under a common product or service boundary. Think of it as the organizational unit that says "these identities and this access configuration belong to Product X." Apps are not an OAuth protocol concept — they are an administrative structure this platform introduces so that multiple products can share the same identity infrastructure without interfering with each other.',
    whyItMatters: 'Without app boundaries, a role named "admin" for your billing product and a role named "admin" for your support product are indistinguishable — they can bleed across products, confuse governance reviews, and create unintended access escalation. Apps give administrators a clean namespace per product, make delegated administration practical (you can give a team admin rights scoped to only their app), and produce audit trails that are meaningful at the product level.',
    whoDefinesIt: 'Platform super-administrators define apps and assign objects into them. Product-level admins may have rights scoped to their app only.',
    whereInAdmin: ['Apps view', 'Users view', 'Groups view', 'Roles view', 'Clients view'],
    details: [
      'Users, groups, roles, and clients can all be app-scoped, giving each product its own identity namespace.',
      'App assignment is purely organizational — it does not change OAuth token fields or claim content by itself.',
      'Use separate apps when products have different security owners, different administration teams, or meaningfully different access models.',
      'A single user can belong to multiple apps simultaneously — app scoping is on the objects attached to them, not the user record itself.',
      'Start with one app per product surface and divide further only when governance requirements actually differ.'
    ]
  },
  {
    id: 'user-registration',
    title: 'How Users Register Or Appear In The System',
    plainExplanation: 'User records can enter this platform through three different paths, each with different lifecycle expectations. The first path is direct admin creation: an administrator creates the account, sets credentials, and the user logs in with those. The second path is federation: when a user authenticates via an external identity provider (OIDC, SAML), the platform either finds an existing linked record or auto-provisions a new one based on federation mapping rules. The third path is programmatic provisioning via SCIM: an upstream directory (for example Azure AD or Okta) pushes user records into the platform as part of joiner/mover/leaver automation. Each path produces the same user record type but with different trust assumptions, lifecycle responsibilities, and troubleshooting approaches.',
    whyItMatters: 'The origin of a user record determines who is responsible for its lifecycle. Admin-created users need manual deprovisioning. Federated users may be deprovisioned when the federation session ends or when the upstream IdP removes them. SCIM-provisioned users should be managed entirely by the upstream source of truth. Mixing these patterns without clarity leads to orphaned accounts, stale access, and compliance gaps.',
    whoDefinesIt: 'Admins create local users directly. Federation configuration (in Federation Providers view) controls which external IdPs can provision or link users. SCIM provisioning tokens and mappings control which upstream directories can push records.',
    whereInAdmin: ['Users view', 'Federation Providers view', 'Administration view (SCIM)', 'Audit Log'],
    details: [
      'Admin-created users have local credentials and password policies enforced by this platform.',
      'Federated users authenticate via an external IdP and may or may not have a local credential — this depends on link-or-provision mapping behavior.',
      'SCIM-provisioned users are created and updated by an upstream directory; local edits may be overwritten on next sync.',
      'A user can be both federated and have a local credential if linking is configured to allow it.',
      'Check the audit log for user creation events to understand the origin and who or what triggered the record.',
      'Password policies, active/inactive flags, and role assignments apply regardless of how the user was created.'
    ]
  },
  {
    id: 'users',
    title: 'Users: The Human Or Service Identity Record',
    plainExplanation: 'A user record is the persistent identity object that represents a person (or machine account) in this platform. It stores core attributes like email, display name, and active status, and acts as the anchor for everything else: role assignments, group memberships, active sessions, granted consents, MFA credentials, and audit history. When a login succeeds, the platform resolves a user record. When a policy evaluates access, it reads attributes from the user record. When you audit an action, the actor is a user record.',
    whyItMatters: 'The user record is the source of truth for identity state. A deactivated user cannot log in. A user with no roles receives no role-gated access. A user with stale group membership may carry access they should no longer have. Keeping user records accurate and lifecycle-managed is foundational to correct authorization behavior across all downstream systems.',
    whoDefinesIt: 'Admins create and maintain local users. Federation and SCIM provisioning can also create or update records automatically based on configuration.',
    whereInAdmin: ['Users view', 'Sessions view', 'Consents view', 'Audit Log', 'Groups view', 'Roles view'],
    details: [
      'Active/inactive status gates login eligibility independently of role assignments.',
      'A user record persists indefinitely — sessions and tokens expire, but the record remains until explicitly deleted or deactivated.',
      'Group membership, role assignments, and attribute values are all referenced from the user record during policy evaluation.',
      'MFA credentials (TOTP, WebAuthn passkeys) are stored on the user record and govern strong authentication paths.',
      'Use the Users view to inspect current state, resolve login issues, manage credentials, and review what sessions or consents are active.',
      'Deactivation is safer than deletion when you need to preserve audit history while removing login access.'
    ]
  },
  {
    id: 'groups',
    title: 'Groups: Membership Bundles For Operational Management',
    plainExplanation: 'A group is a named collection of users managed as a single unit. Once users are grouped, you can assign roles to the group instead of to individual users, apply policy treatments to everyone in the group at once, and use group membership as an attribute in ABAC conditions. Groups are a purely administrative convenience — they are not an OAuth standard object and they do not appear in tokens unless you configure claims mappings to include group membership.',
    whyItMatters: 'Managing access user-by-user breaks down quickly as teams grow. A 50-person engineering team should not need 50 individual role assignments. Groups let you assign roles once to the group and add/remove individuals from it as the team changes. This makes access reviews faster (review the group, not 50 records), onboarding simpler (add to one group, everything follows), and offboarding complete (remove from the group, all related access is removed).',
    whoDefinesIt: 'Admins create groups and manage membership. SCIM provisioning can also push group structure and membership from upstream directories.',
    whereInAdmin: ['Groups view', 'Users view', 'Roles view', 'Policies view', 'User Attributes'],
    details: [
      'Groups reduce repetitive per-user administration by letting access follow membership.',
      'A group can represent a team, department, application audience, region, or any logical classification your organization uses.',
      'Role assignments on a group propagate to all members — when a member leaves the group, they lose the group-derived role.',
      'ABAC policies can reference group membership as a subject attribute for fine-grained conditions.',
      'Groups do not appear in tokens automatically — configure token claims mapping if applications need to see group membership.',
      'SCIM-sourced groups should be treated as read-only local mirrors; edit them in the upstream directory to prevent drift.'
    ]
  },
  {
    id: 'roles',
    title: 'Roles: Named Access Intent',
    plainExplanation: 'A role is a named label that expresses what kind of access a user should have inside a product or system. Roles are assigned to users (directly or via groups) and can be surfaced in tokens as claims for consuming applications to act on. They are part of RBAC (Role-Based Access Control) — the coarse-grained first layer of access decisions. For more precise conditions beyond role membership, ABAC policies build on top.',
    whyItMatters: 'Roles are the shared language between who-administers-identity (this platform) and who-enforces-access (your applications). When an application checks a token for a role claim like "billing.admin", it trusts that identity administration has correctly verified, assigned, and governed that role. Poorly named, over-assigned, or never-reviewed roles quietly erode access control — users accumulate entitlements they no longer need, and the role catalog loses meaning.',
    whoDefinesIt: 'Admins define the role catalog and decide what each role name represents. Applications interpret role names and act on them in their own authorization logic.',
    whereInAdmin: ['Roles view', 'Users view', 'Groups view', 'Clients view', 'Token claims via scope configuration'],
    details: [
      'Role names should reflect business responsibility (e.g. "billing.admin", "support.read"), not implementation details.',
      'Roles are included in tokens only when the client requests the appropriate scope and the flow is configured to emit them.',
      'Users can hold multiple roles simultaneously; applications should check for specific roles, not rely on a single role existing.',
      'Use group-based role assignment to keep the role catalog manageable as teams grow.',
      'Periodic access reviews should validate that users still need the roles assigned to them.',
      'ABAC policies can consume role information as a subject attribute for additional condition checks beyond simple membership.'
    ]
  },
  {
    id: 'role-assignments',
    title: 'Role Assignments: How Roles Reach Users',
    plainExplanation: 'A role assignment is the record that connects a role to a user or group. Defining a role creates it in the catalog but does not give anyone access — the assignment is the step that actually grants it. Assignments can be direct (role attached to a specific user) or indirect (role attached to a group, which the user belongs to). They can also be scoped to a specific tenant, app, or context, so the same role can mean different things in different organizational containers.',
    whyItMatters: 'Role assignment is the operational step that turns policy intent into real access. Admins sometimes define a thorough role catalog and then accidentally leave critical roles unassigned, or assign them too broadly. Both failure modes cause problems: users who cannot do their job, or users with access they should not have. Assignment records are also what access reviews inspect — "Who holds the billing.admin role, and should they still have it?" is answered by the assignment table.',
    whoDefinesIt: 'Admins create direct user-role assignments. Group membership transitively grants group-level role assignments. Policy structures can also drive conditional assignments.',
    whereInAdmin: ['Users view (roles tab)', 'Groups view (roles tab)', 'Roles view (assignments tab)', 'Policies view'],
    details: [
      'Direct assignments are precise but do not scale — prefer group-based assignment for teams.',
      'Group-based assignment is the recommended pattern: assign roles to groups, put users in groups.',
      'When a user is removed from a group, they immediately lose the roles that group carried.',
      'Periodic access reviews should verify that live assignments still match employment status and business need.',
      'Tenant-scoped assignments restrict the role to a specific organizational context.',
      'Do not assign high-privilege roles globally when tenant-scoped assignment is sufficient.'
    ]
  },
  {
    id: 'apps-governance',
    title: 'Apps As Governance Boundaries',
    plainExplanation: 'Apps act as the principal governance boundary within the platform. When a role called "admin" exists in your billing product and another role also called "admin" exists in your support product, the app boundary is what keeps them separate. Without it, those roles share a namespace, access reviews mix unrelated entitlements, and delegating administration becomes difficult because you cannot grant someone rights over "just their product." The app label attaches to users, groups, roles, and clients so that each governance question — who can access this, who should review it, who owns it — can be answered within the correct product context.',
    whyItMatters: 'Governance reviews are only tractable when the scope of each review is clearly bounded. An org-wide review of all roles in all products is operationally unmanageable. An app-scoped review is actionable: it lists the roles, the assigned users, and the clients for one product surface. App boundaries also enable delegated administration — giving a team lead admin rights scoped to their app without touching anything else. The clearer the app model, the faster and more reliable access reviews, offboarding, and compliance audits become.',
    whoDefinesIt: 'Platform administrators define apps and decide which identity objects belong to each. Product teams typically advocate for their own app scope and naming conventions.',
    whereInAdmin: ['Apps view', 'Users view', 'Groups view', 'Roles view', 'Clients view'],
    details: [
      'App boundaries apply to roles, groups, clients, and user membership — the user record itself is global, but everything attached to it can be app-scoped.',
      'Use separate apps when products have different administrators, different security expectations, or different compliance scope.',
      'App names should reflect stable product or service names that reviewers and auditors will recognize.',
      'App boundaries help documentation, onboarding, and audit review remain clear and product-aligned.',
      'Do not create an app per team or per microservice — use app granularity that matches your governance and access review cadence.'
    ]
  },
  {
    id: 'client',
    title: 'What Is An OAuth Client?',
    plainExplanation: 'An OAuth client is the registration record for one application that uses this authorization server to get tokens. It is not the same as the application code — it is the configuration record that defines what the application is allowed to do in the OAuth/OIDC protocol. Every application that participates in login, token issuance, or API authorization needs a client record. The client record answers: What redirects are allowed? What grant types can it use? What scopes can it request? Does it need PKCE? Is it a public (browser/mobile) or confidential (server-side) application?',
    whyItMatters: 'Client configuration is the enforcement boundary for every application integration. A misconfigured client is one of the most common causes of login failures, token errors, and security vulnerabilities. An overly permissive client — one with wildcard redirects, unnecessary grants, or too many allowed scopes — can be exploited to exhaust tokens or redirect authorization codes to attacker-controlled locations. Every client configuration decision is a security decision.',
    whoDefinesIt: 'Admins create and manage clients in the Clients view. Dynamic registration can also create clients programmatically via /connect/register if enabled.',
    whereInAdmin: ['Clients view', 'Authentication Flows view', 'Consents view', 'Sessions view'],
    details: [
      'Each application (web app, mobile app, backend API client) needs its own client registration.',
      'Public clients (SPAs, mobile apps) cannot keep secrets — they must use PKCE instead of client secrets.',
      'Confidential clients (server-side apps) should have a client secret, HTTPS-only redirects, and minimal allowed scopes.',
      'Client metadata is checked on every authorize and token request — changes take effect immediately.',
      'Misconfigured redirect URIs and incorrect grant types are the most common first-line login errors to investigate.',
      'Review client configurations as part of release readiness: new redirect URIs, scope additions, and grant changes all carry security implications.'
    ]
  },
  {
    id: 'client-id-secret',
    title: 'Client ID And Client Secret',
    plainExplanation: 'The client ID is a non-secret public identifier for a client application — it appears in authorize request URLs and is intended to be visible. The client secret is a confidential credential that only the authorization server and a trusted (server-side) client share. When a server-side application calls the token endpoint to exchange a code for tokens, it proves it is the correct client by presenting its secret. Without this check, an authorization code stolen in transit could be exchanged by anyone.',
    whyItMatters: 'The distinction between public and confidential clients exists because only server-side applications can safely store secrets. SPAs and mobile apps run on untrusted devices — their code can be inspected and secrets extracted. That is why public clients must use PKCE instead of a secret. Distributing a client secret in frontend JavaScript or a mobile binary is a high-severity security finding: it allows anyone to impersonate that client at the token endpoint.',
    whoDefinesIt: 'Admins set both values when creating clients. Secrets should be generated with sufficient entropy and stored in secrets management systems, not in application configuration files under source control.',
    whereInAdmin: ['Clients view'],
    details: [
      'Client ID is public and present in every authorize request URL — never treat it as a secret.',
      'Client secret is a server-side only credential — never embed it in browser JavaScript, mobile apps, or public repositories.',
      'Rotate secrets when a team member leaves, when a secret appears in logs, or when compromise is suspected.',
      'Public clients (SPAs, mobile apps) should not have a client secret — use PKCE S256 instead.',
      'Secret rotation should be coordinated: generate the new secret, update deployments, then revoke the old one.'
    ]
  },
  {
    id: 'redirect-uris',
    title: 'Redirect URIs',
    plainExplanation: 'A redirect URI is the exact URL the authorization server will send the user back to after a successful (or failed) authorization. After the user logs in and consents, the platform hands the authorization code or token back to the client by redirecting the browser to the registered redirect URI. The platform only sends responses to URIs that are explicitly pre-registered for that client — any mismatch causes the request to be rejected with an error.',
    whyItMatters: 'Redirect URI validation is one of the most important OAuth security controls. An open redirect — one where the server accepts any URI the client requests — allows an attacker to send the user through a login flow but redirect the authorization code to an attacker-controlled page. That gives the attacker the code, which they can exchange for real tokens. Exact URI matching prevents this entirely. Wildcard or partially-matched redirects are a well-documented attack vector.',
    whoDefinesIt: 'Admins configure the allowed redirect URI list per client. The list must include every environment the client legitimately uses.',
    whereInAdmin: ['Clients view (redirectUris field)'],
    details: [
      'Only exact URI matches should be accepted — never allow wildcard or partial matches in production.',
      'Register separate URIs for each environment (local development, staging, production) rather than using one permissive pattern.',
      'Scheme matters: https://app.example.com and http://app.example.com are different URIs with different security properties.',
      'PKCE does not replace strict redirect URI matching — both controls are needed together.',
      'If login returns a redirect_uri_mismatch error, the URI the client is sending does not exactly match any registered value.'
    ]
  },
  {
    id: 'scopes',
    title: 'Scopes: What They Are And Where They Come From',
    plainExplanation: 'Scopes are named strings that a client requests during the authorization flow to declare what access or identity information it needs. Standard OIDC scopes like "openid", "profile", and "email" unlock specific claims in the ID token or UserInfo response. Custom scopes can represent API access bundles. When a client requests a scope, the platform checks three things: Is this scope in the platform catalog? Does this client allow it? Does the user consent to granting it? All three must be satisfied for the scope to be included in the token.',
    whyItMatters: 'Scopes implement least-privilege access for clients. They prevent an application from receiving more identity claims or API access than it actually needs. Over-requesting scopes (asking for everything) and then ignoring them is a common anti-pattern that both exposes unnecessary data and produces friction in consent screens. Well-designed scopes also make consent meaningful — a user who sees "This app will access your profile" understands more than one who sees "This app requests: everything."',
    whoDefinesIt: 'The platform scope catalog is configured by admins. Each client registration specifies the subset of scopes it is allowed to request. End users grant scopes at consent time.',
    whereInAdmin: ['Clients view (allowedScopes configuration)', 'Consents view', 'Scopes API and Documentation view'],
    details: [
      '"openid" scope is required for OIDC flows — without it the platform will not issue an ID token.',
      'Standard scopes: openid (required for OIDC), profile (name/picture/locale), email (email address and verification), roles (role claims).',
      'A scope must be in the client allowedScopes list to be granted, even if the user consents to it.',
      'Consent records persist scope approvals for a user-client pair so the consent screen does not re-appear on every login.',
      'Custom API scopes should be named to reflect the access they grant (e.g. "billing.read", "reports.write").',
      'Use the Clients view to audit what scopes each application can actually obtain.'
    ]
  },
  {
    id: 'grants',
    title: 'Grants: What They Mean And Who Defines Them',
    plainExplanation: 'A grant type is the OAuth mechanism that a client uses to obtain tokens. Each grant type describes a different interaction model: authorization_code is for interactive browser-based logins where a user is present; client_credentials is for machine-to-machine API access with no human user; refresh_token lets applications silently renew access without re-prompting the user; device_code handles TVs and CLIs that cannot open a browser directly; password is a legacy direct credential grant that bypasses the browser entirely (generally discouraged). Each grant type comes with different security properties and recommendations.',
    whyItMatters: 'Enabling the wrong grant type on a client is a direct security risk. A server-side API client that also has authorization_code enabled could be misused to initiate interactive logins. A public mobile app with client_credentials enabled could exfiltrate long-lived tokens. The grant list on each client should contain exactly the types that application legitimately needs and nothing else.',
    whoDefinesIt: 'Admins configure allowed grant types per client. Authentication flows also have grantType allowlists — a grant must be enabled in both places to function.',
    whereInAdmin: ['Clients view (grantTypes field)', 'Authentication Flows view'],
    details: [
      'authorization_code + PKCE is the correct grant for browser SPAs and mobile apps.',
      'authorization_code + client_secret is the correct grant for server-side web applications.',
      'client_credentials is the correct grant for background services and machine identities — no user involved.',
      'refresh_token enables silent token renewal; pair it with refresh token rotation for better security.',
      'device_code is for input-constrained devices (TVs, CLIs) that cannot open a browser.',
      'The password grant submits user credentials directly to the token endpoint — avoid it unless legacy system constraints make it unavoidable.',
      'A grant must be in both the client allowedGrants list and the authentication flow grantTypes list to work.'
    ]
  },
  {
    id: 'flows',
    title: 'What Are Authentication Flows?',
    plainExplanation: 'An authentication flow is an ordered pipeline of stages that defines what must happen before a login is considered complete. A simple flow might have only a password stage. A more complete flow adds MFA, risk checking, federation handling, consent, and policy evaluation in sequence. Each stage represents a specific authentication or enforcement step, and stages execute in order. The flow assigned to a client (or the default active flow) determines the full set of requirements a user must pass to receive tokens.',
    whyItMatters: 'Authentication flows are the enforcement layer that makes policy real. You could configure every security rule correctly in policies and ABAC — but without a flow that actually executes those stages, none of it runs at login time. The flow is what turns configuration into runtime behavior. Teams that bypass flows or leave the default flow under-configured often discover the gap only during an incident.',
    whoDefinesIt: 'Admins define flow stages and select which flow is active. Clients can be associated with specific flows if different applications need different authentication requirements.',
    whereInAdmin: ['Authentication Flows view', 'Policies view', 'Clients view'],
    details: [
      'Stages execute in the order they are defined — put required checks (like password) before optional enhancements (like risk scoring).',
      'Each stage can be required or optional; a required stage that fails blocks token issuance.',
      'Supported stage types include: password, federation, MFA (TOTP, WebAuthn), consent, risk_check, policy, and device_code.',
      'Policy assignments at the flow level can influence whether conditional stages are triggered.',
      'Multiple flows can exist but only one is active at a time as the platform default.',
      'Changing an active flow takes effect immediately — test changes in a staging environment before promoting to production.'
    ]
  },
  {
    id: 'pkce',
    title: 'PKCE And Cryptographic Proof',
    plainExplanation: 'PKCE (Proof Key for Code Exchange, pronounced "pixie") is a security extension for the authorization_code grant that protects public clients — browser apps and mobile apps — from authorization code interception. Here is how it works: before the login starts, the client generates a random secret called the code_verifier. It hashes it (using SHA-256) to produce a code_challenge, then sends the challenge to the authorization server at the start of the flow. Later, when the client exchanges the authorization code for tokens, it sends the original code_verifier. The server hashes it again and checks that it matches. If an attacker intercepts the authorization code, they cannot use it because they do not have the original verifier.',
    whyItMatters: 'Public clients (SPAs, mobile apps) cannot keep a client secret — their code is visible. Without PKCE, an intercepted authorization code can be exchanged for tokens by anyone. With PKCE, the code is useless without the verifier that only the legitimate client holds. The S256 challenge method (SHA-256 hashing) is the required form — plain method (no hashing) offers no real protection and should never be used.',
    whoDefinesIt: 'Admins enforce PKCE for public clients by setting requirePkce on the client record. The S256 method should be enforced at the platform level.',
    whereInAdmin: ['Clients view (requirePkce setting)'],
    details: [
      'Enable requirePkce for all public clients: browser SPAs, mobile apps, and desktop clients.',
      'Always use S256 (SHA-256) as the challenge method — plain method provides no real protection.',
      'Confidential server-side clients already use their client secret, but adding PKCE on top is still a security best practice.',
      'PKCE replaces the need for a client secret for public clients — do not add a secret AND disable PKCE; pick one based on client type.',
      'If login fails with an "invalid code_verifier" error, the client library is likely misimplementing the challenge calculation.'
    ]
  },
  {
    id: 'crypto-enforcement',
    title: 'How To Enforce Strong Cryptography In Practice',
    plainExplanation: 'Strong cryptography in OAuth/OIDC is not one switch — it is a checklist of layered controls that must all be in place together. The most important layers are: (1) transport security (HTTPS with valid certificates so tokens are never sent over cleartext), (2) token signing (JWTs signed with RS256 or ES256 so recipients can verify the token was genuinely issued by this server), (3) code interception protection (PKCE S256 for public clients so a stolen authorization code cannot be exchanged), (4) redirect binding (exact URI matching so authorization responses cannot be sent to attacker-controlled domains), and (5) secret hygiene (client secrets stored in vaults and never embedded in frontend code). Each layer closes a different attack category — removing any one of them opens a gap that the others cannot compensate for.',
    whyItMatters: 'OAuth security incidents most commonly trace back to one of a small set of configuration mistakes: plaintext transport exposing tokens in transit, weak or missing PKCE on public clients, wildcard redirects letting codes leak to third-party domains, or client secrets checked into source repositories. These are not theoretical — they are recurrent real-world findings. The good news is that all of them are preventable through enforced client configuration and deployment hygiene. An admin review of every client against this checklist before go-live catches the vast majority of OAuth security gaps.',
    whoDefinesIt: 'Admins enforce cryptographic controls through client settings (PKCE requirement, redirect URI lists, scope allowlists) and through deployment posture (HTTPS, certificate management, secrets management). Some controls are not in the UI — they require infrastructure configuration outside this admin panel.',
    whereInAdmin: ['Clients view (requirePkce, redirectUris, grantTypes, allowedScopes)', 'Instance Settings (HTTPS enforcement, CORS)', 'Documentation API tutorials'],
    details: [
      'HTTPS is mandatory in production — do not run authorization or token endpoints over HTTP even on internal networks.',
      'JWTs should be signed with RS256 or ES256 so the signature is verifiable with a published public key (JWKS endpoint).',
      'Enable requirePkce with S256 for all public clients (SPAs, mobile apps) — plain PKCE method provides no real protection.',
      'Redirect URIs must be exact matches — never use wildcard patterns, path prefixes, or case-insensitive comparison in production.',
      'Client secrets must be stored in a secrets manager (HashiCorp Vault, cloud KMS, etc.) — never in application config files committed to source control.',
      'Rotate client secrets proactively and revoke the old secret only after all deployments have been updated to the new value.',
      'Revoke unused sessions and consents to reduce standing access surface — active sessions and consents for departed users are compliance gaps.'
    ]
  },
  {
    id: 'tenants',
    title: 'Tenants: Isolation For Organizations Or Customers',
    plainExplanation: 'A tenant is a top-level organizational container that represents a customer, company, or isolated business domain within the same platform instance. Tenants carry their own user populations, role assignments, policies, and configuration scopes. This means the same platform installation can serve multiple organizationally distinct customers without those customers’ identities or policies interfering with each other. Tenants are stronger isolation than groups or apps — they reflect a distinct administrative domain, not just a categorization.',
    whyItMatters: 'Multi-tenancy is what enables a platform to serve enterprise customers without duplicating infrastructure for each. Without tenant isolation, a role assigned at platform level could apply across all customers, a policy meant for one organization could fire for another, and branding or configuration differences become impossible. Tenants also make delegation clean: a tenant admin has full control within their boundary and no visibility into other tenants.',
    whoDefinesIt: 'Super-admins define tenants and assign users, roles, policies, and clients into them. Tenant admins may have delegated control within their own tenant.',
    whereInAdmin: ['Tenants view', 'Users view (tenant membership)', 'Roles view (tenant-scoped assignments)', 'Policies view', 'Clients view'],
    details: [
      'Tenants represent administrative isolation — use them when different organizations need independent administration.',
      'Groups and apps are organizational classification within a tenant; tenants are the boundary between organizations.',
      'Tenant-scoped role assignments only apply within that tenant — the same user can have different roles in different tenants.',
      'Policies can be scoped to a tenant so enforcement logic is specific to that organization.',
      'Be explicit about which configuration is tenant-scoped versus platform-global to avoid unintended cross-tenant bleed.',
      'Audit events are tenant-tagged, enabling per-customer compliance reporting.'
    ]
  },
  {
    id: 'consents',
    title: 'Consents: User Approval Memory',
    plainExplanation: 'A consent record is how the platform remembers that a specific user approved a specific client to access a specific set of scopes. When a user logs in through an application and sees the consent screen saying "This app wants to access your profile and email," their approval creates a consent record. On future logins, if the same user authorizes the same client for the same scopes, the consent screen may be skipped because approval was already given. Consents are tied to the three-way relationship: user + client + scope set.',
    whyItMatters: 'Consent protects users from applications silently expanding their access over time. If an application later requests new scopes it did not originally ask for, a new consent prompt must appear. Admins may also need to revoke consents during offboarding (to ensure an ex-employee’s approvals are not carried forward) or after a client configuration change. Understanding consent records helps explain why some users see a consent screen on a login and others do not.',
    whoDefinesIt: 'Users grant consent interactively during login. Admins can review and revoke consent records. Clients configured as trusted/first-party may skip the consent screen entirely.',
    whereInAdmin: ['Consents view', 'Users view (consents tab)', 'Clients view (consent settings)'],
    details: [
      'Consent is scoped to a user-client-scopeset triple — changing any part of that triple may trigger a new consent prompt.',
      'First-party clients (your own applications) can be configured to skip consent for a smoother UX.',
      'Third-party or externally developed clients should always show a consent screen.',
      'Revoking a consent record forces consent re-collection on the user’s next login with that client.',
      'Offline_access scope grants a refresh token — pay attention to which clients have this consented.',
      'During user offboarding, revoke consents alongside sessions to fully remove active application authorizations.'
    ]
  },
  {
    id: 'sessions',
    title: 'Sessions: Live Browser Or Login State',
    plainExplanation: 'A session is the server-side record of an authenticated user’s active login state. After a successful login, the platform creates a session that tracks who is logged in, from where, when it started, and when it expires. Browsers carry a session reference (typically in a secure, HttpOnly cookie). As long as the session is valid and unexpired, the user can obtain new tokens without re-authenticating. Sessions are separate from tokens — a session lives on the server; tokens are issued to the client application and have their own shorter lifetime.',
    whyItMatters: 'Sessions are the first object to inspect when diagnosing login issues or responding to security incidents. An unexpectedly long session lifetime means users stay logged in past intended boundaries. An active session for a deactivated user means they can still get tokens until the session expires. During incident response, revoking a session is the fastest way to terminate a user’s active access before all their tokens expire naturally.',
    whoDefinesIt: 'The platform creates sessions on successful login. Admins set session lifetime policy through instance settings and flow configuration. Admins can revoke individual sessions manually.',
    whereInAdmin: ['Sessions view', 'Users view (sessions tab)', 'Instance Settings (session lifetime)', 'Audit Log'],
    details: [
      'Session records show current browser login state — use them to verify whether a user is actually logged in right now.',
      'Revoking a session forces the next request from that browser to re-authenticate — it is a rapid response control.',
      'Access tokens derived from a session can still be valid after the session is revoked — wait for them to expire or revoke them separately.',
      'Session fixation protection should be enabled — this rotates the session identifier after login.',
      'Session lifetime should be shorter for high-risk applications and longer for low-risk internal tools.',
      'Back-channel logout (where supported) propagates logout across federated sessions and downstream applications.'
    ]
  },
  {
    id: 'devices',
    title: 'Devices And Device Code Login',
    plainExplanation: 'The device authorization grant (also called device code flow) solves a specific problem: how do you authenticate a user on a device that has no practical way to open a browser or receive a redirect — a smart TV, a CLI tool, a printer, a headless server, or an IoT device? The flow works in two halves. First, the constrained device contacts the authorization server and receives two codes: a device_code (used internally to poll for completion) and a user_code (a short human-readable code like GFTM-XHQK). The device displays the user_code and a verification URL to the user. The user takes out their phone or computer, visits that URL, enters the code, and approves the login. Back on the device, the client has been polling the token endpoint — when the user approves, the poll returns a token and the device is authenticated.',
    whyItMatters: 'Without the device code flow, applications running on input-constrained devices would have to collect usernames and passwords directly (the password grant) or require users to somehow copy long authorization URLs manually — both are bad security or bad UX. The device code flow preserves the security model of OAuth (the user authenticates on a trusted browser, the device never sees the password) while making it practical for constrained clients. It must still respect all the same client, scope, and policy gates as a normal browser-based flow.',
    whoDefinesIt: 'Admins enable device_code as an allowed grant on specific clients and ensure the authentication flow supports it. End users complete the approval step on a separate trusted device.',
    whereInAdmin: ['Devices view (pending and completed device authorizations)', 'Clients view (device_code in grantTypes)', 'Authentication Flows view', 'Device Verification Interaction Screen'],
    details: [
      'The device polls the token endpoint using the device_code until the user approves or the code expires — configure appropriate polling intervals to avoid rate limiting.',
      'user_code display should be prominent and include the verification URL so users know exactly where to go.',
      'Device code requests must still pass client, scope, and flow policy checks — this grant is not a bypass of authentication policy.',
      'Monitor active device authorizations for abnormal patterns: codes that are never approved but are repeatedly requested may indicate abuse.',
      'Set reasonable device_code expiry times (typically 5–15 minutes) to limit the window during which a code can be used.',
      'Approved device authorizations appear in the Devices view and can be revoked if a shared device is reported lost or compromised.'
    ]
  },
  {
    id: 'federation',
    title: 'Federation Providers: External Identity Sources',
    plainExplanation: 'Federation lets users log into this platform using an identity they already have at another provider — their corporate Google Workspace account, an Azure AD identity, an Okta organization, or any other OIDC-compatible IdP. When a user chooses to sign in via a federation provider, this platform redirects them to the external IdP for authentication. The external IdP verifies the user and sends back claims (name, email, groups, custom attributes) in a token. This platform receives those claims, maps them according to configuration, and either links the incoming identity to an existing local user record or auto-provisions a new one. The result is a local user session with the same roles and policies as any other user, but backed by an externally managed identity.',
    whyItMatters: 'Most enterprise organizations already have a centralized identity provider that manages employee accounts, enforces MFA, and handles lifecycle events like offboarding. Making users maintain a separate password in every system is a security risk (password sprawl, no central revocation) and an operational burden. Federation centralizes authentication trust: when an employee leaves the organization, deactivating their account in the upstream IdP automatically blocks their ability to federate into this platform on the next login. Claim mapping quality is critical — if the external claims do not map cleanly to the expected local fields, federated users may get wrong roles, missing attributes, or failed provisioning.',
    whoDefinesIt: 'Admins configure federation providers in the Federation Providers view: the provider discovery URL (for OIDC), client ID and secret issued by the external IdP, claim mappings, and link-or-provision behavior.',
    whereInAdmin: ['Federation Providers view', 'Login view (provider selection)', 'Users view (linked identities)', 'Authentication Flows view'],
    details: [
      'Each federation provider requires an OIDC client registration at the external IdP that points back to this platform callback URL.',
      'Claim mapping converts external claims (e.g. "preferred_username", "groups") into local user fields and attributes.',
      'Link behavior determines whether an incoming federated identity links to an existing user (by email match) or always creates a new one.',
      'Auto-provisioned users inherit platform defaults for roles and groups — configure sensible defaults before enabling auto-provisioning.',
      'Provider credentials (client ID and secret) are security-sensitive — treat them with the same care as any confidential OAuth credential.',
      'When a federation provider is removed or disabled, users who authenticated only via that provider will lose login access until a recovery path is established.'
    ]
  },
  {
    id: 'saml-federation',
    title: 'SAML Federation: Legacy/Enterprise SSO Bridge',
    plainExplanation: 'SAML 2.0 (Security Assertion Markup Language) is an older but still widely deployed standard for single sign-on. Where OIDC uses JSON tokens and REST-friendly flows, SAML uses XML documents called assertions that are signed with X.509 certificates and transported via browser redirects. This platform acts as a SAML Identity Provider (IdP): when a user tries to access a SAML-enabled service provider (SP) like a legacy SaaS application, the SP redirects the user here, the user authenticates, and this platform sends back a cryptographically signed XML assertion that the SP validates and trusts. The SP never sees the users credentials — only the assertion.',
    whyItMatters: 'Despite OIDC being the modern standard, many enterprise applications — especially older SaaS platforms, HR systems, and on-premise tools — only support SAML. Without SAML support, integrating those systems requires separate credentials and separate authentication management. Supporting SAML lets the platform act as the central IdP for the entire enterprise estate regardless of protocol. Certificate management is operationally critical: an expired signing certificate breaks all SAML SSO for that service provider until the certificate is rotated and the SP metadata is updated.',
    whoDefinesIt: 'Admins configure service provider records in the Federation Providers view: the SP entity ID, ACS (Assertion Consumer Service) URL, SLO (Single Logout) URL, NameID format, and signing/encryption certificate behavior.',
    whereInAdmin: ['Federation Providers view (SAML SP table)', 'Administration view', 'Documentation view', 'Audit Log'],
    details: [
      'This platform publishes its own SAML metadata at GET /saml/metadata — service providers use this to configure trust.',
      'The ACS endpoint (POST /saml/acs/:spId) is where the SP sends assertion responses back after SSO; it validates signature, audience, destination, and replay protection.',
      'Admin metadata upload parses an SP-provided XML file and populates entityId, ACS URL, SLO URL, and certificate fields automatically.',
      'Certificate rotation lets you roll signing and encryption keys without recreating the SP record — coordinate the new certificate with the SP before activating it.',
      'NameID format (persistent, transient, email) should match what the SP expects — mismatches cause login failures even when the assertion is otherwise valid.',
      'Signature wrapping attacks are defended against by rejecting ambiguous assertion structures at ACS processing time.',
      'Every ACS assertion handling event is audited with assertion ID, audience, destination, and session correlation for incident traceability.'
    ]
  },
  {
    id: 'attributes',
    title: 'User Attributes: Extensible Identity Data',
    plainExplanation: 'Standard identity fields — email, name, roles — cover common cases. But organizations often need to attach business-specific metadata to identities: a user’s cost center, their clearance level, their geographic region, their employment type (contractor vs. full-time), or a custom onboarding status flag. User attributes are the mechanism for this. Admins define a schema (attribute name, type, and whether it is enabled) and then values can be set per user or, with group-level inheritance, applied to all users in a group. Those attribute values can then be referenced in ABAC policy conditions, token claims, and application APIs.',
    whyItMatters: 'Attributes transform the identity platform from a simple login system into a rich data source for access decisions. An ABAC policy that says "allow access only if the user’s clearance_level is >= 3 AND their region is EU" needs those values on the user record. Without attributes, that condition cannot be evaluated and every access decision reduces to coarse role checks. Attributes also reduce the number of roles needed: instead of creating a separate role for every combination of region, team, and seniority, you model those as attributes and write one policy that references them. Schema governance matters — undefined or inconsistently used attributes produce wrong policy decisions.',
    whoDefinesIt: 'Admins define the attribute schema (name, type, enabled status) in the User Attributes view. Individual attribute values are set on user records or inherited from groups. Applications and policies consume them.',
    whereInAdmin: ['User Attributes view (schema definition)', 'Users view (per-user attribute values)', 'Groups view (group-level attribute inheritance)', 'Policies view (attribute conditions in ABAC rules)'],
    details: [
      'Attribute names should be stable identifiers using consistent casing — changing names breaks any policies or application logic that references them.',
      'Use typed attributes (string, number, boolean) so policies can perform correct comparisons without type coercion surprises.',
      'Group-level attribute inheritance sets a default value for all group members, which users can override on a per-user basis if enabled.',
      'Only create attributes that have a concrete consumer — a policy condition, a token claim mapping, or an application-side check.',
      'Treat the attribute schema like database schema: additions are low-risk, but renames or type changes are breaking and need coordination.',
      'Review attribute values during access reviews — stale or incorrect attribute values can silently produce wrong authorization decisions.'
    ]
  },
  {
    id: 'policies',
    title: 'Policies: Decision Rules Applied Across Scope',
    plainExplanation: 'Policies are named, reusable rule definitions that encode a decision or enforcement behavior and can be assigned at different scopes — global, tenant, group, or user. A policy might specify "require MFA for all admin-role users," or "allow access to resource X only if the requester’s department attribute is finance," or "deny any request from countries outside the allowlist." Defining a policy separates the rule from the assignment: the same policy definition can be assigned to multiple groups or tenants, and the rule behavior follows the assignment scope. Policy categories include authentication (affecting flow stage behavior) and authorization (affecting ABAC access decisions).',
    whyItMatters: 'Without policies, enforcing consistent behavior across a large user base requires per-client or per-user configuration, which is unmanageable at scale and inconsistent by nature. A single policy definition assigned to a group of 500 users enforces the same rule for all of them with one change. Policies also create a clear audit trail: instead of investigating why a particular user was or was not allowed access, you can trace the specific policy that was evaluated, what decision it made, and what inputs it received. Global policies are powerful but dangerous — a misconfigured global policy can lock out all users from every flow simultaneously.',
    whoDefinesIt: 'Admins define policy rules in the Policies view and create assignments at the appropriate scope. Policy scripts (for ABAC conditions) run in a sandboxed environment with restricted globals.',
    whereInAdmin: ['Policies view (definition and simulation)', 'Authentication Flows view (flow-level policy stages)', 'Users view (user-scoped policy assignments)', 'Groups view (group-scoped assignments)', 'Tenants view (tenant-scoped assignments)'],
    details: [
      'Policy categories: "authentication" policies affect stage behavior during login; "authorization" policies affect ABAC access decisions.',
      'Policy effect (allow/deny) and priority determine outcomes when multiple policies match the same request.',
      'Decision strategy per assignment (deny_overrides, allow_overrides, first_applicable) governs conflict resolution.',
      'Global policies should be used sparingly and tested thoroughly — they evaluate for every applicable subject at every decision point.',
      'Use the policy simulation endpoint (/api/admin/policies/evaluate) to test decision outcomes before assigning policies to production scope.',
      'Decision logs record who triggered an evaluation, what inputs were used, and what the outcome was — use them during access investigations.',
      'Policy conditions execute in a sandboxed VM with a timeout — keep conditions simple and deterministic.'
    ]
  },
  {
    id: 'abac-fundamentals',
    title: 'ABAC Fundamentals: Context-Aware Authorization',
    plainExplanation: 'RBAC (Role-Based Access Control) answers one question: does this user have the right role? It is fast and simple but quickly grows unwieldy when access requirements are more nuanced than role membership. ABAC (Attribute-Based Access Control) goes further by evaluating four dimensions: the subject (who is requesting, including their attributes like department, clearance, region), the resource (what they are requesting, including its attributes like classification, owner, sensitivity tier), the action (what they want to do — read, write, delete, approve), and the context (environmental factors like time of day, IP address, risk score, environment tier). A policy rule combines conditions across these dimensions: "allow write if subject.department = finance AND resource.classification != top_secret AND context.environment = production."',
    whyItMatters: 'Without ABAC, every distinct access scenario needs its own role. A system with 5 departments, 3 resource sensitivity tiers, and 4 action types would need 60 roles under pure RBAC — and that is a small example. ABAC lets you express all 60 scenarios with one policy that references attributes. This is called avoiding "role explosion." ABAC also enables truly contextual decisions that RBAC cannot: "allow only during business hours," "require elevated clearance if the user’s risk score is above threshold," or "only permit access to resources the subject owns." These conditions make authorization logic match real-world policy intent rather than forcing that intent into a role taxonomy.',
    whoDefinesIt: 'Admins write ABAC policy rules in the Policies view and assign them at the appropriate scope. Services calling the authorization check endpoint provide current request context (resource, action, environment attributes) at evaluation time.',
    whereInAdmin: ['Policies view (ABAC rule authoring and simulation)', 'Authorization check endpoint (/api/admin/authorization/check)', 'Decision logs (Audit Log)', 'Documentation view'],
    details: [
      'RBAC remains useful as a fast prefilter — check coarse role membership first, then run ABAC for fine-grained decisioning.',
      'Policy conditions evaluate subject attributes (from the user record), resource attributes (from the caller’s request context), and environment attributes (IP, time, risk score).',
      'Effect (allow/deny) and priority resolve conflicts when multiple policies match the same request.',
      'Decision strategies: deny_overrides means any deny wins regardless of allow policies; allow_overrides means any allow wins; first_applicable stops at the first matching rule.',
      'Use the simulation endpoint to dry-run policy decisions with specific subject/resource/action inputs before assigning to production scope.',
      'Keep policy condition scripts short and side-effect-free — they run in a sandboxed VM with a timeout, and complex logic slows authorization decisions.',
      'Decision logs (GET /api/admin/policies/decisions) record every evaluation for auditability and investigation.'
    ]
  },
  {
    id: 'interaction-views',
    title: 'Interaction Views: What The User Actually Sees During Auth',
    plainExplanation: 'Interaction views are the browser screens that appear at each step of the authentication journey. The login screen asks for credentials. The consent screen presents the list of requested scopes and asks the user to approve them. The device verification screen shows the user code entry UI for device code flows. The MFA screen prompts for a TOTP code or WebAuthn gesture. Each of these views is driven by backend state — what the flow requires, what scopes the client is requesting, what MFA factors the user has enrolled — but the user only sees the rendered HTML page. The gap between backend configuration and what actually appears on screen is where many support issues originate.',
    whyItMatters: 'Authentication configuration is easy to verify in isolation but surprisingly easy to misconfigure in ways that only become visible during a live login. An admin might enable a new flow stage or change consent settings without realizing how it changes the user-facing page. A user who sees a consent screen listing more permissions than they expect, or a step-up prompt that does not explain why it appeared, will often abandon the flow or contact support. Checking interaction views after configuration changes is the fastest way to validate that backend rules translate into a sensible, accurate user experience.',
    whoDefinesIt: 'The platform renders interaction view templates based on current flow, client, and policy state. Admins influence behavior through authentication flow configuration, client consent settings, and MFA policy, but the screen rendering itself is handled by the platform.',
    whereInAdmin: ['Login view (credential and federation screens)', 'Consent Interaction Screen', 'Device Verification Interaction Screen', 'MFA prompt screens', 'Authentication Flows view (stage configuration)'],
    details: [
      'The consent screen lists requested scopes — if the scope list looks wrong, check the client’s allowedScopes and the authorize request’s scope parameter.',
      'MFA prompts appear when a flow stage requires them — if they are appearing unexpectedly, trace back to which stage is triggering the requirement.',
      'The device verification screen appears only when the device_code grant is active for the client and flow.',
      'Step-up prompts from adaptive auth (risk_check stage) should ideally explain to the user why additional verification is needed.',
      'Changes to flow stages, consent settings, or policy assignments often surface as differences in these screens — test in a staging environment after every significant flow change.',
      'If a user reports seeing a screen they did not expect, check the audit log for the login event to trace which stage triggered it.'
    ]
  },
  {
    id: 'events-hooks',
    title: 'Events And Hooks: Outbound Notifications Of Change',
    plainExplanation: 'Events are structured records of things that happened in the platform: a user was created, a login succeeded or failed, a role was assigned, a SCIM provisioning run completed, a risk event was triggered. By themselves, events are just telemetry stored in the audit log. Hooks are the mechanism that turns those events into outbound notifications: when a configured event type fires, the platform makes an HTTP POST to a registered webhook endpoint carrying the event payload. This lets external systems react to identity changes in real time — a SIEM ingests login failures for threat detection, a ticketing system opens a review ticket when a privileged role is assigned, or a Slack bot alerts the security team when a break-glass elevation occurs.',
    whyItMatters: 'Most security and operational workflows that involve identity data need to span multiple systems. A deprovisioning flow might require: SCIM deletes the user here, an HR system marks the offboarding complete, an ITSM ticket is created for confirmation, and a SIEM alert checks for any last-minute access. Without event hooks, each of these steps requires polling or manual coordination. With hooks, the platform proactively pushes notifications and the downstream systems react. The quality of that integration depends entirely on which events are hooked, what the payload contains, and whether delivery failures are monitored and retried.',
    whoDefinesIt: 'Admins configure webhook targets (URLs, auth headers) and select which event types each target should receive. Downstream system owners implement the receivers.',
    whereInAdmin: ['Events view (hook configuration and delivery history)', 'Audit Log (underlying event stream)', 'Administration view'],
    details: [
      'Webhook targets should use HTTPS and require an authentication header — never send events to unauthenticated or HTTP endpoints.',
      'Configure per-target event type filtering — a SIEM should receive security events; an HR system likely only needs provisioning lifecycle events.',
      'Delivery history is essential for debugging: a hook that consistently fails silently means downstream automation is not running.',
      'Implement retry logic and idempotency on webhook receivers — the same event may be delivered more than once during retries.',
      'Security-critical events (break-glass elevation, admin role assignment, failed login spike) should have dedicated hook targets with monitored receivers.',
      'Test webhook delivery in staging before pointing hooks at production receivers — malformed payloads or authentication failures are easier to debug before go-live.'
    ]
  },
  {
    id: 'audit-log',
    title: 'Audit Log: Forensics And Accountability Record',
    plainExplanation: 'The audit log is the authoritative, append-only record of every meaningful security and administrative action taken in this platform. Each entry captures: who (the actor — admin user, system process, or API caller), what (the action type — user.created, session.revoked, role.assigned, policy.evaluated, break-glass.invoked), which (the target object and its identifier), when (timestamp with timezone), and context (IP address, request ID, outcome). The audit log is not just an operational monitoring tool — it is evidence. During a security investigation, a compliance audit, or an access review, the audit log is the primary source of truth for reconstructing what happened and whether it was authorized.',
    whyItMatters: 'Without a complete audit log, security incidents become unresolvable: you cannot answer when a credential was first used from an unusual location, who approved a sensitive role assignment, or whether a terminated employee attempted access after offboarding. Many compliance frameworks (SOC 2, ISO 27001, HIPAA, PCI DSS) require demonstrable audit trails for privileged operations and access changes. The audit log satisfies those requirements, but only if every write path in the platform emits audit events and those events are retained long enough to cover the review window. Gaps in audit coverage are not just operational blind spots — they are compliance findings.',
    whoDefinesIt: 'The platform emits audit entries automatically on write operations — there is no admin configuration required to enable basic auditing. Admins consume it for investigation, review, and compliance reporting.',
    whereInAdmin: ['Audit Log view (primary consumer)', 'Users view (per-user audit history)', 'Clients view (per-client audit history)', 'Sessions view (session lifecycle events)', 'Events view (hook delivery audit trail)'],
    details: [
      'Every audit entry links actor, action type, target object, timestamp, and outcome — use all five dimensions when investigating an incident.',
      'The audit log is append-only — entries are never edited or deleted, making it tamper-evident for compliance purposes.',
      'Start audit investigations by filtering on the affected user or resource and the relevant time window, then expand outward.',
      'Look for sequences, not just individual events: a successful login followed by an unusual role assignment followed by a bulk export query is more meaningful than any single event.',
      'Security-critical events to monitor regularly: break-glass invocations, admin role assignments, policy changes, client secret rotations, high-volume failed logins.',
      'Retain audit logs for at least the period required by your compliance framework — common minimums are 1 year for SOC 2 and 6 years for HIPAA audit controls.',
      'Event hook consumers that mirror audit events to a SIEM extend retention and enable correlation with non-identity events.'
    ]
  },
  {
    id: 'instance-settings',
    title: 'Instance Settings: Global Security Posture Controls',
    plainExplanation: 'Instance settings are server-wide configuration values that set the security and behavioral baseline for the entire platform installation. Unlike client or flow settings that apply to one integration, instance settings apply universally: HTTPS enforcement means every endpoint requires TLS, not just selected ones. CORS allowlists define which origins the server will respond to for browser-initiated requests. Token algorithm preferences set the default signing algorithm for all issued JWTs. PKCE enforcement can be required platform-wide regardless of individual client settings. These settings represent the minimum security posture the operators have committed to for this deployment.',
    whyItMatters: 'Per-client configuration provides flexibility but creates risk through inconsistency — a client configured permissively can undermine a security baseline that every other client meets. Instance settings close that gap by establishing non-negotiable platform-level controls. If HTTPS is required at the instance level, no client can accidentally or intentionally downgrade to plaintext. If a PKCE enforcement is set platform-wide, clients cannot opt out. This layered model — instance baseline + client refinement — is the correct way to operate a multi-tenant authorization server where not every client administrator has full security context.',
    whoDefinesIt: 'Super-administrators with administration access define and update instance settings. Changes should be reviewed, documented, and communicated to affected integration teams before being applied in production.',
    whereInAdmin: ['Administration view (instance settings panel)', 'Clients view (per-client overrides within instance baseline)', 'Login view (settings that affect login page behavior)'],
    details: [
      'Instance settings sit above client settings in precedence — a client cannot configure a behavior that instance settings prohibit.',
      'HTTPS enforcement at the instance level prevents token and session material from ever being transmitted over plaintext transport.',
      'CORS allowlists should be as narrow as possible — allowing all origins (*) on an authorization server is a high-severity misconfiguration.',
      'Changes to instance settings take effect on the next request — test in staging first and communicate with integration teams before changing in production.',
      'Review instance settings as part of security posture assessments; they define what the platform actually enforces rather than what individual client configs assume.',
      'Token signing algorithm preferences should favor RS256 or ES256 — symmetric algorithms (HS256) require sharing the signing key with token consumers, which is operationally risky at scale.'
    ]
  },
  {
    id: 'workload-identity',
    title: 'Workload Identity: Non-Human Credentials Governance',
    plainExplanation: 'Every automated process, background job, microservice, and integration script that needs to call a protected API is a workload identity — a non-human actor that needs credentials but has no human to log in interactively. Service identities model these actors explicitly: each has a name (describing the workload), an owner (the team accountable for it), a set of allowed scopes and audiences (constraining what it can request), and one or more credentials (client secrets or tokens) with expiry and rotation history. Rather than sharing a human user credential for automation (a common anti-pattern), each workload gets its own tightly scoped identity that can be independently rotated, revoked, and audited.',
    whyItMatters: 'Shared or unmanaged service credentials are one of the most common sources of credential sprawl and post-breach lateral movement. When a developer leaves and their personal token was being used by three CI pipelines, deactivating that account breaks three systems. When a service credential is never rotated, it becomes a long-lived attack surface — a credential leaked in a Git commit from two years ago may still be valid. Service identities solve this by making non-human credentials first-class objects with lifecycle management, rotation scheduling, last-used tracking, and explicit revocation. Blast radius is also constrained: a compromised service identity that is narrowly scoped can only reach the APIs it was authorized for, not everything a human admin can access.',
    whoDefinesIt: 'Platform admins create service identities, issue credentials, and define allowed scope and audience constraints. Service owners are responsible for credential rotation and reporting suspected compromise.',
    whereInAdmin: ['Service Identities view', 'Audit Log (credential issuance and rotation events)', 'Documentation view'],
    details: [
      'Each service identity should represent one logical workload — separate identities per environment (staging, production) is safer than one shared identity.',
      'Allowed scopes and audiences should be exactly what the workload needs — never grant broader access to make configuration easier.',
      'Credentials should have defined expiry and a rotation schedule — treat indefinite credentials as a security finding.',
      'Last-used timestamps help identify stale credentials: a service identity not used in 90+ days is a candidate for decommissioning.',
      'Token exchange (RFC 8693) allows a service to request a narrowed downstream token from a broad subject token — use it to reduce scope at service-to-service boundaries.',
      'Credential rotation should be zero-downtime: issue the new credential, update the workload, verify it works, then revoke the old one.',
      'Audit any service identity with credentials that have never been rotated since issuance — those are likely forgotten and unmonitored.'
    ]
  },
  {
    id: 'scim-fundamentals',
    title: 'SCIM Fundamentals: Provisioning Contract And Lifecycle',
    plainExplanation: 'SCIM (System for Cross-domain Identity Management) is an open standard protocol (RFC 7642-7644) that defines a REST API and JSON schema for synchronizing user and group records between systems. The canonical use case is an enterprise directory (Active Directory, Azure AD, Okta, Google Workspace) that acts as the authoritative source of truth for employee identities, pushing those identities into downstream SaaS and platform systems. SCIM provides standard verbs for the full lifecycle: create a new user when they are onboarded, update their attributes when they change departments, partially patch their record when their manager changes, and delete or deactivate the record when they leave. Both sides speak the same schema, so no custom transformation code is needed between the directory and the application.',
    whyItMatters: 'Manual user provisioning does not scale and does not deprovision reliably. When an employee is onboarded, IT creates accounts in every system they need. When they leave, IT must remember to deactivate every account in every system — and frequently they do not. Stale accounts from departed employees are one of the most common findings in security audits. SCIM automates the entire lifecycle from a single source of truth: the moment HR processes an offboarding, the directory sends a SCIM DELETE or PATCH (deactivate), and the user loses access across all connected systems within minutes, not days. The provisioning token model ensures only authorized upstream directories can make SCIM calls.',
    whoDefinesIt: 'Platform admins create provisioning tokens and configure attribute mappings. The upstream identity platform (Azure AD, Okta, etc.) is configured to call this platform SCIM endpoints using the issued bearer token.',
    whereInAdmin: ['Administration view (provisioning tokens, mappings, reconciliation)', 'Users view (SCIM-sourced user records)', 'Groups view (SCIM-sourced groups)', 'Audit Log (SCIM lifecycle events)'],
    details: [
      'SCIM endpoints are at /scim/v2/Users and /scim/v2/Groups and require bearer token authentication.',
      'Provisioning tokens are bearer credentials — rotate them on schedule and revoke them immediately if an upstream directory configuration is decommissioned.',
      'Attribute mappings define how external SCIM attributes map to local user fields, including enterprise user extensions for department or cost center.',
      'SCIM PATCH operations use JSON Patch syntax — partial updates are more common than full PUT replaces during attribute changes.',
      'Reconciliation jobs compare the current local user state against what the upstream has sent and report or remediate drift.',
      'SCIM-sourced user records should generally not be edited directly in the admin panel — changes will be overwritten on the next sync from the upstream directory.',
      'Deprovisioning via SCIM can either delete the user or deactivate them — deactivation is usually preferred to preserve audit history.'
    ]
  },
  {
    id: 'access-governance',
    title: 'Access Governance: Request, Approval, And Evidence',
    plainExplanation: 'Access governance is the practice of making access grants deliberate, evidenced, and time-limited rather than persistent and assumed. Instead of an admin silently assigning a sensitive role whenever requested, access governance introduces an explicit workflow: a user or manager submits an access request with a business justification and optional expiry, one or more designated approvers receive the request and decide to approve or reject it with written rationale, and the platform creates the entitlement assignment only if approved. Every step is recorded with timestamps, actors, and reasons. When the expiry arrives, the platform automatically revokes the assignment and the access ends without requiring a manual deprovisioning step.',
    whyItMatters: 'Unmanaged access grants accumulate over time. Employees change roles, projects end, and contractors finish their engagement — but roles and group memberships often persist indefinitely because there is no systematic cleanup process. The result is privilege creep: users and service accounts accumulating access far beyond what their current role requires. Access governance prevents this at the source by requiring justification for every sensitive grant, building in expiry by default, and creating an evidence trail that satisfies compliance requirements. During a SOC 2 audit, reviewers want to see that access to production systems requires approval, has a business justification, and expires. The access request log provides exactly that evidence.',
    whoDefinesIt: 'Admins configure governance workflow settings and designate approvers. Users and managers initiate requests. Approvers make and record decisions. The platform enforces expiry and automates revocation.',
    whereInAdmin: ['Administration view (access requests and approval queue)', 'Audit Log (decision evidence)', 'Documentation view'],
    details: [
      'Every access request should include a specific business justification — vague requests should be rejected by approvers.',
      'Request expiry should default to the shortest period that still allows the work to be done — avoid indefinite grants for temporary needs.',
      'Approval rationale is compliance evidence; reviewers should write decisions that an auditor reading them 12 months later can understand without additional context.',
      'Stalled requests (no decision within a configured SLA window) should trigger escalation to a secondary approver or manager.',
      'Approved grants are automatically revoked at expiry — verify this is working by checking that no expired-access assignments exist in the active state.',
      'Pair access governance with recertification campaigns: governance controls what gets granted, recertification controls whether existing grants should remain.'
    ]
  },
  {
    id: 'recertification',
    title: 'Recertification Campaigns: Periodic Access Validation',
    plainExplanation: 'A recertification campaign is a structured review process where designated reviewers are presented with a list of existing access assignments and asked to make an explicit decision on each one: certify (the access is still appropriate and should remain) or revoke (the access is no longer needed). The platform generates the review item list from current assignment state, assigns items to appropriate reviewers (often the manager or resource owner), and collects decisions with rationale over a defined review window. Revoked items trigger automatic assignment removal. The campaign record itself — with each item, its reviewer, the decision, and the written rationale — becomes the audit attestation document.',
    whyItMatters: 'Access governance controls what gets granted. Recertification controls what persists. Even with excellent request and approval workflows in place, people change roles, projects end, and org structure evolves — historical grants accumulate that were correct when made but are no longer appropriate. Without periodic recertification, the only cleanup mechanism is manual spot checks that rarely happen. Many compliance frameworks (SOC 2 CC6.3, HIPAA, ISO 27001 A.9.2.5) require evidence of periodic access reviews. A completed recertification campaign with documented reviewer decisions is the artifact that satisfies that requirement.',
    whoDefinesIt: 'Admins configure campaign scope, period, and reviewer assignments. Resource owners and managers execute the review decisions. The platform automates item generation, reminder sending, and revocation on revoked decisions.',
    whereInAdmin: ['Administration view (campaigns, review items, decisions)', 'Audit Log (campaign completion records and revocation events)', 'Documentation view'],
    details: [
      'Start campaigns with high-risk entitlements first: admin roles, privilege escalation access, production system credentials.',
      'Every reviewer decision must include written rationale — approved with no explanation is insufficient evidence for an auditor.',
      'Configure campaign deadlines with escalation: if a reviewer does not act within the window, escalate or apply a default revocation rule.',
      'Default-deny on timeout (revoke if no decision is made by deadline) is safer than default-certify.',
      'Revoked outcomes should trigger immediate assignment deletion — verify post-campaign that revoked access is actually gone from active assignments.',
      'Completed campaign records with all decisions and rationale are compliance attestation evidence; do not purge them on a short retention schedule.'
    ]
  },
  {
    id: 'pam-lite',
    title: 'PAM-lite Elevation: Time-Bound Privileged Access',
    plainExplanation: 'PAM-lite implements just-in-time privilege elevation: instead of giving administrators standing access to high-risk operations all the time, the platform requires an explicit elevation request each time privileged access is needed. The requester specifies what they need access to, why, and for how long. An approver reviews and approves or rejects. Once approved, the requester activates the elevation to start a time-bounded privileged session. When the session expires, the elevated access ends automatically — no cleanup step is required, and the time-bound design enforces cleanup by construction. Every elevation request, approval decision, session activation, and expiry is recorded in the audit log.',
    whyItMatters: 'Standing privileged access — where administrators have elevated permissions all the time regardless of whether they are doing privileged work — is one of the highest-risk patterns in access management. An admin account with permanent broad access is a high-value target: compromising it gives an attacker unlimited time to extract data or make changes. By requiring elevation only when needed and expiring it when done, the window during which elevated access is active is dramatically reduced. This is the zero standing privilege principle. Even if an admin account is compromised, the attacker cannot perform privileged operations until they also complete an elevation request — which creates a detection and intervention opportunity.',
    whoDefinesIt: 'Admins configure elevation policies and designate approvers for each resource and action pair. Users submit elevation requests. Approvers review and decide. The platform enforces time limits and blocks privileged calls without active elevation.',
    whereInAdmin: ['Administration view (elevation policies, active sessions, request queue)', 'Audit Log (elevation lifecycle events)', 'Documentation view'],
    details: [
      'Every elevation request must include a specific justification — generic reasons should be rejected by approvers as insufficient.',
      'Elevation duration should match the expected task — a 15-minute task does not need a 4-hour window.',
      'Active elevation sessions should be monitored; unusually long sessions or sessions on unexpected resources are investigation indicators.',
      'The platform checks active elevation status before executing privileged operations — calls fail if no active elevation covers the resource and action.',
      'Elevation sessions expire automatically — verify that post-expiry access is actually revoked and not cached by downstream systems.',
      'Pair elevation with break-glass for emergency paths: elevation covers planned privileged tasks, break-glass covers unexpected incidents requiring immediate access.'
    ]
  },
  {
    id: 'break-glass',
    title: 'Break-Glass: Emergency Privilege Override',
    plainExplanation: 'Break-glass is the emergency privilege mechanism for situations where normal approval workflows are too slow and the cost of waiting for approval exceeds the risk of acting without it. The name comes from the physical metaphor: a fire alarm behind a glass panel that you break in a genuine emergency, accepting that breaking it is visible, logged, and will be reviewed afterward. In the platform, a break-glass invocation immediately activates elevated access without waiting for an approver, but it collects a mandatory written justification at activation time, sets a hard configurable time limit, and emits elevated-priority audit events flagging the invocation as exceptional. Every break-glass use is expected to be reviewed after the emergency is resolved.',
    whyItMatters: 'Without a controlled emergency path, operators who need immediate access during an outage will find informal bypasses — sharing credentials, disabling security controls, or using built-in superuser accounts that are never properly audited. These informal bypasses are invisible to governance processes and often never cleaned up. Break-glass provides a sanctioned emergency path that is faster than normal approval (immediate activation) but more heavily audited than normal privileged tasks. The goal is not to eliminate emergency access — emergencies are real — but to ensure that when break-glass is used, it is visible, documented, time-limited, and reviewed.',
    whoDefinesIt: 'Admins configure break-glass access policies and restrict authorization to the minimum set of operators needed. Authorized operators invoke at their discretion during incidents. The security team reviews all invocations post-incident.',
    whereInAdmin: ['Administration view (break-glass policies and authorized operators)', 'Audit Log (enriched invocation events flagged as exceptional)', 'Documentation view'],
    details: [
      'Break-glass access requires an explicit written justification at invocation time — the justification should reference the incident ticket number.',
      'Duration should be as short as the emergency requires — automatic expiry means cleanup is not dependent on the operator remembering to revoke.',
      'Every break-glass invocation should be reviewed post-incident: what happened, was the use justified, and was access revoked promptly?',
      'Restrict break-glass authorization to the minimum set of operators necessary — not all admins should be break-glass authorized.',
      'Break-glass events should trigger real-time alerts to the security team — an unexpected invocation may itself be an incident indicator.',
      'Retrospective review of break-glass usage should be a standing item in incident post-mortems.'
    ]
  },
  {
    id: 'webauthn-passkeys',
    title: 'WebAuthn And Passkeys: Phishing-Resistant Authentication',
    plainExplanation: 'WebAuthn is a browser and device standard that replaces passwords with public-key cryptography. Instead of a shared secret (a password that both you and the server know and that can be stolen from either side), WebAuthn generates a unique key pair during registration: the private key stays locked inside your device or authenticator hardware and never leaves it, while the public key is stored on the server. At login, the server issues a one-time random challenge. The device signs it with the private key, and the server verifies the signature with the public key. Nothing reusable or guessable is ever transmitted. A passkey is a user-friendly implementation of WebAuthn that syncs across devices via the operating system (Apple, Google, Microsoft), making phishing-resistant login as simple as a fingerprint or face scan.',
    whyItMatters: 'Phishing works by tricking a user into entering their credentials on a fake lookalike site. With passwords, once you type them in, the attacker has them. WebAuthn is structurally immune to this attack because the private key never leaves the device, and the cryptographic response is bound to the exact origin (domain) the browser is connected to. A fake site cannot harvest a usable credential even if the user is fully deceived. This also eliminates credential stuffing (reusing leaked passwords from other breaches), password spraying, and man-in-the-middle attacks that intercept cleartext credentials. For high-value admin accounts and enterprise users, passkeys represent the most meaningful security upgrade available today.',
    whoDefinesIt: 'Platform authentication flows and MFA configuration determine whether WebAuthn is offered as an option or required as a mandatory factor. Users enroll their own passkeys via the account security portal. Admins can view enrolled credentials and revoke them during offboarding or suspected compromise.',
    whereInAdmin: ['Authentication Flows view (mfa_webauthn stage)', 'Portal account security page (user enrollment)', 'Users view (credential management)', 'Administration view'],
    details: [
      'WebAuthn credentials are origin-bound: a credential enrolled for app.example.com cannot be used by fake-app.example.com, even if the user is tricked.',
      'Registration ceremony: device generates key pair, sends public key and attestation to server, private key never leaves the device.',
      'Login ceremony: server sends a random challenge, device signs it with the private key, server verifies with the stored public key.',
      'Passkeys synced via OS (iCloud Keychain, Google Password Manager, Windows Hello) survive device loss and make cross-device login practical.',
      'Hardware security keys (YubiKey, etc.) use the same WebAuthn protocol but store keys on the hardware token instead of device OS.',
      'Enable mfa_webauthn as a flow stage to require WebAuthn as a second factor after password, or as a sole credential for passwordless flows.',
      'Credential lifecycle events (register, login, removal) are audited and should be reviewed for anomalies like registrations from unexpected locations.'
    ]
  },
  {
    id: 'adaptive-auth',
    title: 'Adaptive Authentication: Risk-Aware Step-Up',
    plainExplanation: 'Adaptive authentication is a login strategy that adjusts the authentication requirements in real time based on the assessed risk of a particular login attempt. Instead of every user always going through the same fixed set of steps, the platform evaluates signals about the current login context and decides whether the situation is normal or suspicious. Low-risk logins (recognized device, known IP, typical working hours) may proceed with just a password. High-risk logins (new device, unusual country, IP flagged in threat feeds, many recent failures) are stepped up to a stronger factor like MFA or an explicit user challenge. Truly anomalous logins can be blocked entirely.',
    whyItMatters: 'Requiring MFA on every single login creates friction that users work around — they stay logged in longer, use weaker devices, or find other bypasses. Requiring it never leaves the system unprotected. Adaptive auth solves this tradeoff: friction is proportional to actual risk, so legitimate users with normal patterns have a smooth experience while attackers, who by definition have unusual patterns (wrong IP, unknown device, impossible travel), face higher barriers. This means 95% of logins are low-friction and 5% of risky logins get additional scrutiny. The security outcome improves for the high-risk population without degrading UX for everyone else.',
    whoDefinesIt: 'The platform collects and scores risk signals automatically. Admins configure the risk_check stage in authentication flows and define threshold policies for challenge, allow, and block outcomes. Risk event records are stored and visible in the Administration view.',
    whereInAdmin: ['Authentication Flows view (risk_check stage)', 'Administration view (risk events)', 'Audit Log', 'Policies view'],
    details: [
      'Risk signals evaluated at login time include: IP address reputation, geolocation and impossible travel detection, device fingerprint novelty, time-of-day patterns, and recent failed attempt history.',
      'Risk events are scored with a confidence level and reason code — these are visible in the Administration view for operator review.',
      'Three possible risk outcomes: allow (risk acceptable, proceed normally), challenge (risk elevated, require step-up MFA), block (risk too high, deny and log).',
      'The risk_check flow stage should be positioned before credential finalization so a block decision prevents token issuance even if credentials were valid.',
      'A challenged login that passes MFA results in a normal session — the risk concern was resolved by the additional factor.',
      'A blocked login must be explicitly investigated and cleared by an admin before the user can proceed.',
      'Risk scoring quality depends on signal completeness — for best results, ensure IP and device context is passed through to the authentication flow.',
      'Review risk event records periodically to calibrate thresholds: too many false positives frustrate legitimate users; too few flagged events means the system is not catching real anomalies.'
    ]
  },
  {
    id: 'connectors-ops',
    title: 'Connectors: External Identity Sync Operations',
    plainExplanation: 'Connectors model the ongoing synchronization relationship between this platform and an external system that holds identity-relevant data — an HR system, a SaaS directory, a legacy LDAP store, or a custom data source. A connector defines the source, the sync schedule, the field mappings from source format to platform format, and the run behavior (full sync vs. incremental). When a connector run fires, it fetches records from the external source, applies the field mappings, and creates or updates the corresponding local identity records. Run logs record how many records were processed, how many failed, what errors occurred, and when the run completed.',
    whyItMatters: 'Connectors extend the platform reach into enterprise data systems without requiring those systems to implement SCIM or OIDC. Not every data source the identity platform needs to consume is a modern directory. Connector failures are operationally invisible unless monitored — a connector that has been silently failing for two weeks means user records are stale, role assignments may be wrong, and downstream authorization decisions are based on outdated data. Run failure rates and record error counts are the first signal that something is wrong upstream.',
    whoDefinesIt: 'Platform admins configure connector type, source credentials, field mappings, and schedule from the Connectors view. Connector run telemetry is available to any admin reviewing data freshness.',
    whereInAdmin: ['Connectors view (run history, field mappings, run trigger)', 'Audit Log (run lifecycle events)', 'Documentation view'],
    details: [
      'Each connector run produces a record with imported record count, failed record count, and structured error messages — review failed counts regularly.',
      'Field mappings define how source attributes translate to platform user fields — mapping errors often produce empty or incorrectly typed attribute values.',
      'A silent connector failure (runs completing with zero records when thousands are expected) is harder to detect than an error — set alerts on both error rates and unexpected zero-record runs.',
      'Compare run telemetry before and after connector configuration changes to verify the expected effect on record imports.',
      'Connector runs should be idempotent: re-running the same sync should not create duplicate records.',
      'Source credentials used by connectors are secrets — rotate them on schedule and revoke immediately if the source system credential is compromised.'
    ]
  },
  {
    id: 'token-exchange',
    title: 'Token Exchange: Delegation And Scope Down',
    plainExplanation: 'Token exchange (RFC 8693) is a protocol extension that allows one trusted service to present an existing token and request a new token with a different audience, different scope, or representing a different principal. The canonical use case is a service-to-service call chain: a user logs in and gets a broad access token. Service A receives that token and needs to call Service B on behalf of the user — but Service B should only see a narrowly scoped token for its own audience, not the original broad token. Service A calls the token exchange endpoint, presents its own client credentials and the subject token, and receives a new token scoped specifically for Service B.',
    whyItMatters: 'Without token exchange, service-to-service delegation is typically handled in one of two bad ways: passing the original user token all the way through the call chain (every downstream service gets the full user scope, violating least privilege) or having each service use a shared service account token (no user context, no audit trail). Token exchange solves both: downstream services receive tokens scoped to exactly what they need, the token carries the original user subject for audit purposes, and each exchange is individually auditable.',
    whoDefinesIt: 'Platform admins configure which clients can perform token exchange and what scope constraints apply. Service owners decide where exchanged tokens are accepted and verify audience validation is enforced.',
    whereInAdmin: ['Clients view (exchange-enabled client configuration)', 'Policies view (token exchange policy)', 'Audit Log (exchange events)', 'Documentation view'],
    details: [
      'Token exchange uses grant type urn:ietf:params:oauth:grant-type:token-exchange with subject_token, subject_token_type, audience, and scope parameters.',
      'The exchanged token should have a shorter lifetime than the subject token.',
      'Audience restriction on the exchanged token means it can only be used by the intended service — validate audience on the receiving end.',
      'Scope must be equal to or a subset of the subject token scopes — token exchange cannot elevate scope.',
      'Log every exchange event with the subject token issuer, requester client, requested audience, and resulting scope.',
      'Impersonation (act_as) and delegation (on_behalf_of) are distinct modes — impersonation makes the new token appear to come from the subject; delegation identifies both subject and acting party.'
    ]
  },
  {
    id: 'risk-events',
    title: 'Risk Events: Normalized Security Signals',
    plainExplanation: 'A risk event is a structured record created when the platform detects a pattern in authentication or API activity that is anomalous, suspicious, or policy-violating. Instead of leaving operators to manually scan raw audit logs, the platform normalizes observations into classified risk events with severity labels, reason codes, and confidence scores. Examples: a user with 12 failed login attempts in 60 seconds produces a credential_stuffing risk event; a successful login from a country the user has never accessed from produces a suspicious_location event; a request carrying a malformed JWT produces a protocol_violation event.',
    whyItMatters: 'Raw audit logs are comprehensive but operationally overwhelming — in a platform handling thousands of logins per day, manually triaging individual log entries for security signals is not practical. Risk events surface the signal from the noise. They are also the input to adaptive authentication — when the risk_check flow stage is configured, it reads the current risk context for the incoming login and makes a challenge or block decision based on the presence and severity of recent risk events. This makes the security response real-time and automated rather than reactive.',
    whoDefinesIt: 'The platform derives and classifies risk records automatically. Admins consume and respond to them and can tune thresholds to reduce false positives.',
    whereInAdmin: ['Administration view (risk event feed with severity and reason codes)', 'Audit Log (correlated raw events)', 'Authentication Flows view (adaptive auth configuration)'],
    details: [
      'Risk event severity levels: informational (pattern noted), medium (elevated suspicion, consider review), high (strong signal, investigate promptly).',
      'Reason codes classify the signal type: failed_login_spike, suspicious_location, credential_stuffing, impossible_travel, threat_intel_match, protocol_violation, anomaly_pattern.',
      'Confidence score reflects how certain the classification is — low-confidence events need more context before acting on them.',
      'Recurring medium-severity events from the same user or IP may indicate probing or a persistent misconfiguration.',
      'Use risk events with the audit log — the risk event gives the classification, the audit log gives the full request context.',
      'Suppress or tune risk event thresholds if they are generating persistent false positives that obscure real signals.'
    ]
  },
  {
    id: 'saml-sp-ops',
    title: 'SAML Service Provider Operations',
    plainExplanation: 'Once a SAML service provider is registered, the work is not finished — SAML integrations require ongoing operational maintenance. The two most operationally critical tasks are metadata management and certificate lifecycle. Metadata management: the XML metadata document that describes a service provider can change over time when the SP makes infrastructure changes. Manually editing each field individually is error-prone; the admin metadata upload endpoint accepts a fresh XML file and updates all relevant fields automatically. Certificate lifecycle: SAML assertions are signed with an X.509 certificate. Those certificates expire. When a signing or encryption certificate is approaching expiry, it must be rotated before it expires — if it expires in production, all SAML SSO for that SP fails immediately.',
    whyItMatters: 'SAML integration failures during business hours are high-impact events: users cannot log into the affected SaaS application at all. Most SAML outages are caused by predictable, preventable events: certificate expiry that was not tracked, a metadata endpoint change at the SP not reflected in the platform, or a NameID format mismatch after the SP was upgraded. Proactive certificate monitoring, coordinated rotation procedures, and regular metadata refreshes prevent these outages entirely.',
    whoDefinesIt: 'Platform admins maintain SP records, perform metadata uploads, and rotate certificates. SP owners at the partner organization must coordinate when metadata or certificates change on their side.',
    whereInAdmin: ['Federation Providers view (SP record management, metadata upload, certificate management)', 'Audit Log (SP record change events)', 'Documentation view'],
    details: [
      'Track certificate expiry dates for all registered SPs and schedule rotation at least 30 days before expiry.',
      'Certificate rotation is a two-phase operation: generate new certificate, update the SP record, confirm the SP accepts it, then revoke the old certificate.',
      'Metadata upload parses an SP-provided XML file and populates entityId, ACS URL, SLO URL, and NameID format — confirm each field looks correct after upload.',
      'NameID format must match exactly what the SP expects: persistent, transient, or email format.',
      'Test SSO after every metadata upload or certificate rotation before confirming to the SP that the change is complete.',
      'Audit log SP record changes so that if SAML SSO breaks unexpectedly, you can correlate the failure timestamp with any recent record modifications.'
    ]
  },
  {
    id: 'auth-metrics',
    title: 'Auth Metrics: Operational Trend Buckets',
    plainExplanation: 'Auth metrics are pre-aggregated counts of authentication and authorization events grouped into time windows (hourly, daily). Where the audit log shows individual events, auth metrics show rates and trends: how many logins succeeded in the last hour, how many token requests failed, how many policy decisions were deny vs. allow, how the error rate changed after a deployment. The platform continuously rolls up event telemetry into these buckets so operators can answer operational questions without querying millions of raw audit records.',
    whyItMatters: 'Individual events are necessary for investigation but insufficient for operational awareness. A sudden doubling of login failures might be 2 events in a low-traffic system or 200,000 in a high-traffic one — the rate change is immediately meaningful in both. Trend visibility is how operators catch regressions before users report them. A deployment that pushed a bad flow configuration change will show up as a spike in authentication failures in the next metric bucket, often within minutes, long before the support tickets come in.',
    whoDefinesIt: 'The platform emits and aggregates metric buckets automatically. Admins use them for monitoring, troubleshooting, and reporting on login health trends.',
    whereInAdmin: ['Connectors view (auth metric trend view)', 'Administration view (operational dashboard)', 'Documentation view'],
    details: [
      'Key metric dimensions: login_success, login_failure, token_issued, token_denied, policy_allow, policy_deny, mfa_enrolled, mfa_challenged, mfa_failed.',
      'Compare metric buckets before and after deployments or configuration changes to detect regressions immediately.',
      'A sustained elevated failure rate not explained by a known event is a signal to investigate — check risk events and audit logs for the same time window.',
      'Session and token issuance drops can indicate a broken flow configuration silently preventing logins from completing.',
      'Policy deny rate spikes after an ABAC policy change may mean the new policy is over-restrictive — cross-reference with the decision log.',
      'Use auth metrics alongside connector run health to understand whether user lifecycle changes are affecting login rates as expected.'
    ]
  }
]

const VIEW_LEARN_MORE: Record<string, string[]> = {
  Setup: ['user-registration', 'users', 'crypto-enforcement'],
  Login: ['flows', 'scopes', 'sessions', 'interaction-views'],
  Dashboard: ['app', 'apps-governance', 'client', 'audit-log', 'abac-fundamentals'],
  Users: ['user-registration', 'users', 'groups', 'roles', 'role-assignments', 'attributes', 'sessions', 'scim-fundamentals'],
  Groups: ['groups', 'roles', 'role-assignments', 'attributes', 'apps-governance', 'scim-fundamentals'],
  Roles: ['roles', 'role-assignments', 'scopes', 'tenants', 'apps-governance'],
  Clients: ['client', 'client-id-secret', 'redirect-uris', 'scopes', 'grants', 'flows', 'pkce', 'crypto-enforcement'],
  Consents: ['consents', 'scopes', 'client', 'interaction-views'],
  Sessions: ['sessions', 'users', 'crypto-enforcement', 'audit-log'],
  Devices: ['devices', 'grants', 'flows', 'interaction-views'],
  Apps: ['app', 'apps-governance', 'roles', 'groups', 'client'],
  Tenants: ['tenants', 'roles', 'policies', 'flows', 'scopes'],
  'Federation Providers': ['federation', 'saml-federation', 'saml-sp-ops', 'user-registration', 'users', 'flows', 'crypto-enforcement'],
  Administration: ['instance-settings', 'crypto-enforcement', 'redirect-uris', 'pkce', 'saml-federation', 'risk-events', 'scim-fundamentals', 'access-governance', 'recertification', 'pam-lite', 'break-glass', 'adaptive-auth', 'webauthn-passkeys'],
  'Service Identities': ['workload-identity', 'token-exchange', 'client-id-secret', 'scopes', 'audit-log'],
  Connectors: ['connectors-ops', 'auth-metrics', 'flows', 'policies', 'audit-log'],
  'Authentication Flows': ['flows', 'grants', 'policies', 'interaction-views', 'adaptive-auth', 'webauthn-passkeys'],
  'Interaction Views': ['interaction-views', 'flows', 'scopes', 'consents', 'devices'],
  'User Attributes': ['attributes', 'users', 'groups', 'policies'],
  Policies: ['policies', 'abac-fundamentals', 'flows', 'tenants', 'groups', 'crypto-enforcement'],
  Events: ['events-hooks', 'audit-log', 'client'],
  'Audit Log': ['audit-log', 'sessions', 'events-hooks', 'crypto-enforcement'],
  'Consent Interaction Screen': ['consents', 'scopes', 'interaction-views'],
  'Device Verification Interaction Screen': ['devices', 'grants', 'interaction-views'],
  Documentation: ['client', 'roles', 'groups', 'policies', 'abac-fundamentals', 'scopes', 'pkce', 'saml-federation', 'saml-sp-ops', 'token-exchange', 'scim-fundamentals', 'risk-events', 'auth-metrics', 'access-governance', 'recertification', 'pam-lite', 'break-glass', 'adaptive-auth', 'webauthn-passkeys']
}

const ENTITY_FIELD_TUTORIALS: EntityFieldGuide[] = [
  {
    entity: 'Client',
    view: 'Clients',
    purpose: 'Defines how an application integrates with the authorization server and what it is allowed to request.',
    whenToUse: 'Create a client whenever a browser app, mobile app, backend, CLI, TV app, or partner integration needs tokens from this platform.',
    learnMore: ['client', 'client-id-secret', 'redirect-uris', 'scopes', 'grants', 'flows', 'pkce', 'crypto-enforcement'],
    fields: [
      {
        field: 'App',
        meaning: 'Optional business boundary grouping for this client.',
        recommendation: 'Use app assignment for governance clarity in multi-product environments.'
      },
      {
        field: 'Client ID',
        meaning: 'Public identifier used by the application in protocol requests.',
        recommendation: 'Make it stable and environment-aware; avoid collisions across integrations.'
      },
      {
        field: 'Client Secret',
        meaning: 'Confidential credential for secure server-side token exchange.',
        recommendation: 'Never expose in browser/mobile code; rotate when in doubt.'
      },
      {
        field: 'Client Name',
        meaning: 'Human-friendly label shown to admins and sometimes end users during consent.',
        recommendation: 'Use the product or integration name users will actually recognize.'
      },
      {
        field: 'Redirect URIs',
        meaning: 'Exact callback destinations allowed for authorization responses.',
        recommendation: 'Register only trusted exact URIs; keep staging and production separated.'
      },
      {
        field: 'Allowed Scopes',
        meaning: 'Maximum scope set this client can request.',
        recommendation: 'Use least privilege; include only what the client truly needs.'
      },
      {
        field: 'Grants',
        meaning: 'Token acquisition methods this client can use.',
        recommendation: 'Choose grants based on client type; keep password grant constrained and intentional.'
      },
      {
        field: 'Allowed Authentication Flows',
        meaning: 'Flow allowlist controlling which active stage pipeline can service this client.',
        recommendation: 'Ensure the selected flow supports the same grants and required user journey.'
      },
      {
        field: 'Create Scope',
        meaning: 'Inline shortcut for defining a new scope before assigning it to the client.',
        recommendation: 'Only add scopes with a clear consumer and documented meaning.'
      },
      {
        field: 'Require PKCE',
        meaning: 'Enforces PKCE challenge verification for authorization code flow usage.',
        recommendation: 'Enable for every public client and prefer S256.'
      }
    ]
  },
  {
    entity: 'User',
    view: 'Users',
    purpose: 'Represents a person or managed identity that can authenticate, receive roles, and hold sessions or consents.',
    whenToUse: 'Create a user when onboarding a local identity or preparing an account before federation or role assignment.',
    learnMore: ['users', 'user-registration', 'groups', 'roles', 'role-assignments', 'attributes', 'sessions'],
    fields: [
      {
        field: 'App',
        meaning: 'Optional app ownership boundary for the user record.',
        recommendation: 'Use app assignment when identities should be managed within one product domain.'
      },
      {
        field: 'Given Name',
        meaning: 'User first name used in profile and claims contexts.',
        recommendation: 'Store the person’s real preferred given name for recognizable admin and user experiences.'
      },
      {
        field: 'Family Name',
        meaning: 'User surname or last name.',
        recommendation: 'Keep it accurate for audit, directory, and profile display consistency.'
      },
      {
        field: 'Email',
        meaning: 'Primary email identity used for login, recovery, and contact in many deployments.',
        recommendation: 'Use a unique reachable address unless the account is intentionally service-only.'
      },
      {
        field: 'Username',
        meaning: 'Stable short identifier for login and operator reference.',
        recommendation: 'Choose a predictable convention and avoid reusing usernames after offboarding.'
      },
      {
        field: 'Service User',
        meaning: 'Marks the account as a machine/system identity for non-human service communication.',
        recommendation: 'Enable for integration users and automation identities so operators can distinguish them from human accounts.'
      },
      {
        field: 'Password',
        meaning: 'Initial local credential for direct authentication.',
        recommendation: 'Use a strong temporary password and rotate/reset during first secure handoff.'
      },
      {
        field: 'Custom Attributes (JSON)',
        meaning: 'Structured business metadata attached to the user record.',
        recommendation: 'Only populate attributes that have a defined policy or application consumer.'
      },
      {
        field: 'Groups',
        meaning: 'Initial group memberships that can indirectly grant roles or policy treatment.',
        recommendation: 'Prefer group assignment over many direct per-user role changes.'
      }
    ]
  },
  {
    entity: 'Group',
    view: 'Groups',
    purpose: 'Provides a reusable membership container for assigning roles and policy treatment to many users at once.',
    whenToUse: 'Create a group when several users should share the same access model, department label, or policy targeting.',
    learnMore: ['groups', 'roles', 'role-assignments', 'apps-governance'],
    fields: [
      {
        field: 'App',
        meaning: 'Optional app boundary that keeps the group aligned to one product space.',
        recommendation: 'Use app scoping when group meaning should not span unrelated products.'
      },
      {
        field: 'Group Name',
        meaning: 'Human-readable label describing the membership cohort.',
        recommendation: 'Name groups by function or audience, such as Support Team or Finance Admins.'
      },
      {
        field: 'Description',
        meaning: 'Operator-facing explanation of why the group exists.',
        recommendation: 'State what membership means and what access or responsibility it implies.'
      },
      {
        field: 'Initial Roles',
        meaning: 'Roles attached to the group so new members inherit access through membership.',
        recommendation: 'Keep group roles focused and avoid creating giant catch-all groups.'
      }
    ]
  },
  {
    entity: 'Role',
    view: 'Roles',
    purpose: 'Defines a named access intent backed by permissions that applications and admins can reason about consistently.',
    whenToUse: 'Create a role when you need a stable access label that can be assigned directly or through groups.',
    learnMore: ['roles', 'role-assignments', 'scopes', 'tenants', 'apps-governance'],
    fields: [
      {
        field: 'App',
        meaning: 'Optional product boundary for the role definition.',
        recommendation: 'Use app scoping when a role only makes sense in one product or portal.'
      },
      {
        field: 'Name',
        meaning: 'Stable role identifier used by admins and often surfaced in claims.',
        recommendation: 'Name roles by business responsibility, such as application_admin or billing_viewer.'
      },
      {
        field: 'Scope',
        meaning: 'Whether the role applies at platform level or tenant level.',
        recommendation: 'Use tenant scope when the same role name may vary by organization.'
      },
      {
        field: 'Description',
        meaning: 'Plain-language explanation of what the role is intended to authorize.',
        recommendation: 'Describe the access intent, not just the UI surface it appears in.'
      },
      {
        field: 'Permissions',
        meaning: 'Selected capability strings that make the role actionable inside the platform or clients.',
        recommendation: 'Choose the smallest set of permissions needed for the role’s responsibility.'
      }
    ]
  },
  {
    entity: 'Tenant',
    view: 'Tenants',
    purpose: 'Creates an organizational boundary for isolation, branding, and tenant-aware access decisions.',
    whenToUse: 'Create a tenant when identities, policies, or roles must be isolated by customer or organization.',
    learnMore: ['tenants', 'roles', 'policies', 'flows'],
    fields: [
      {
        field: 'Organization Name',
        meaning: 'Display name for the tenant shown to admins and potentially in tenant-aware UX.',
        recommendation: 'Use the official customer or organization name.'
      },
      {
        field: 'Identifier Slug',
        meaning: 'Short stable machine-friendly identifier used in routing, lookup, or API references.',
        recommendation: 'Keep it lowercase, predictable, and resistant to future naming drift.'
      },
      {
        field: 'Tenant Is Active',
        meaning: 'Operational status flag controlling whether the tenant should continue to participate normally.',
        recommendation: 'Disable instead of deleting when you need a reversible suspension.'
      }
    ]
  },
  {
    entity: 'App',
    view: 'Apps',
    purpose: 'Defines a governance and presentation boundary used to group clients, users, groups, and roles around one product.',
    whenToUse: 'Create an app when a product, portal, or service should have its own identity grouping and admin vocabulary.',
    learnMore: ['app', 'apps-governance', 'client', 'roles', 'groups'],
    fields: [
      {
        field: 'Icon',
        meaning: 'Visual marker used to make the app recognizable in the admin UI.',
        recommendation: 'Choose something visually distinct and durable for operators.'
      },
      {
        field: 'App Name',
        meaning: 'Primary human-readable label for the product or service.',
        recommendation: 'Use the business-facing name admins already know.'
      },
      {
        field: 'Description',
        meaning: 'Short explanation of what this app grouping is for.',
        recommendation: 'Explain the product purpose and what identities belong here.'
      },
      {
        field: 'App URL',
        meaning: 'Optional link to the application or portal home.',
        recommendation: 'Populate for operator convenience when there is a canonical destination.'
      },
      {
        field: 'Components',
        meaning: 'Assignments connecting users, groups, roles, and clients to the app.',
        recommendation: 'Review component membership regularly so governance boundaries remain meaningful.'
      }
    ]
  },
  {
    entity: 'Scope',
    view: 'Clients',
    purpose: 'Defines a named permission or claim bundle that clients can request and users may approve.',
    whenToUse: 'Create a scope when an application needs a distinct permission label or claim set not already represented.',
    learnMore: ['scopes', 'consents', 'client'],
    fields: [
      {
        field: 'Name',
        meaning: 'Protocol-facing scope value used in authorize and token requests.',
        recommendation: 'Keep it concise, stable, and semantically clear.'
      },
      {
        field: 'Description',
        meaning: 'Operator explanation of what the scope grants or exposes.',
        recommendation: 'Write this as a consent-friendly sentence users and admins can both understand.'
      }
    ]
  },
  {
    entity: 'Federation Provider',
    view: 'Federation Providers',
    purpose: 'Connects the platform to an upstream identity provider so users can sign in with external credentials.',
    whenToUse: 'Create a provider when another IdP should supply authentication or user identity into this platform.',
    learnMore: ['federation', 'user-registration', 'flows', 'crypto-enforcement'],
    fields: [
      {
        field: 'ID',
        meaning: 'Stable provider key used in callback and routing paths.',
        recommendation: 'Keep it short, URL-safe, and consistent with the upstream provider identity.'
      },
      {
        field: 'Label',
        meaning: 'Display name shown to admins and on the login screen.',
        recommendation: 'Use the provider brand users expect to click, such as Google Workspace or Okta.'
      },
      {
        field: 'Authorization Endpoint',
        meaning: 'Upstream URL where the browser is redirected for login.',
        recommendation: 'Copy directly from the provider’s official OIDC/OAuth documentation.'
      },
      {
        field: 'Token Endpoint',
        meaning: 'Upstream URL used to exchange authorization codes for tokens.',
        recommendation: 'Verify it matches the same issuer and environment as the authorization endpoint.'
      },
      {
        field: 'UserInfo Endpoint',
        meaning: 'Upstream endpoint used to fetch user claims after authentication.',
        recommendation: 'Ensure the selected scopes support the claims you expect here.'
      },
      {
        field: 'Client ID',
        meaning: 'Identifier issued by the upstream provider for this platform as a relying party/client.',
        recommendation: 'Do not confuse this with local OAuth clients managed in the Clients view.'
      },
      {
        field: 'Client Secret',
        meaning: 'Credential used when this platform authenticates to the upstream provider.',
        recommendation: 'Treat it like any other confidential secret and rotate carefully.'
      },
      {
        field: 'Scopes',
        meaning: 'Requested upstream permissions/claims for the external login process.',
        recommendation: 'Start with the minimum identity scopes needed for linking and provisioning.'
      },
      {
        field: 'Enabled',
        meaning: 'Controls whether the provider is available to users.',
        recommendation: 'Disable during maintenance or rollout validation instead of deleting immediately.'
      }
    ]
  },
  {
    entity: 'Authentication Flow',
    view: 'Authentication Flows',
    purpose: 'Defines the ordered stage pipeline used to authenticate or authorize users for supported grants.',
    whenToUse: 'Create a flow when you need a specific staged experience such as password plus consent, federation-first login, or device verification handling.',
    learnMore: ['flows', 'grants', 'policies', 'interaction-views'],
    fields: [
      {
        field: 'Name',
        meaning: 'Operator label identifying the flow intent.',
        recommendation: 'Name flows by journey purpose, such as Browser Login with Consent or Device Approval Flow.'
      },
      {
        field: 'Description',
        meaning: 'Short explanation of what this flow is designed to do.',
        recommendation: 'Document the journey and the kinds of clients or users it should serve.'
      },
      {
        field: 'Designation',
        meaning: 'Category describing where in the lifecycle this flow belongs, such as authentication or recovery.',
        recommendation: 'Use the closest lifecycle designation so operators understand intent immediately.'
      },
      {
        field: 'Enabled',
        meaning: 'Whether the flow is active and can be selected operationally.',
        recommendation: 'Only enable flows that have been fully validated end to end.'
      },
      {
        field: 'Grant Types',
        meaning: 'Allowlist of OAuth grant types this flow can service.',
        recommendation: 'Match these to the client population and keep unsupported grants disabled.'
      },
      {
        field: 'Stages',
        meaning: 'Ordered stage list defining what the user must pass through.',
        recommendation: 'Keep stage order intentional because it directly shapes the user journey and enforcement path.'
      }
    ]
  },
  {
    entity: 'User Attribute',
    view: 'User Attributes',
    purpose: 'Extends the identity schema with business-specific fields that can be displayed, stored, or used in policy logic.',
    whenToUse: 'Create an attribute when standard identity fields are insufficient for downstream business or security decisions.',
    learnMore: ['attributes', 'users', 'groups', 'policies'],
    fields: [
      {
        field: 'Key',
        meaning: 'Stable machine-facing attribute identifier.',
        recommendation: 'Use a predictable snake_case style because applications and policies may depend on it.'
      },
      {
        field: 'Name',
        meaning: 'Human-friendly label for the attribute.',
        recommendation: 'Write the name the way an operator or end user would understand it.'
      },
      {
        field: 'Description',
        meaning: 'Definition of what the attribute stores and how it should be interpreted.',
        recommendation: 'Document valid meaning, expected values, and the business owner of the field.'
      },
      {
        field: 'Type',
        meaning: 'Data type used to validate and represent the attribute.',
        recommendation: 'Choose the narrowest correct type so policies and clients can reason about it safely.'
      },
      {
        field: 'Enabled',
        meaning: 'Global toggle controlling whether the attribute is active.',
        recommendation: 'Disable unused attributes rather than deleting them if rollback may be needed.'
      },
      {
        field: 'Group Assignments',
        meaning: 'Optional per-group enablement rules for targeted attribute applicability.',
        recommendation: 'Use group-level targeting when an attribute only matters for part of the user base.'
      }
    ]
  },
  {
    entity: 'Policy Definition',
    view: 'Policies',
    purpose: 'Defines reusable enforcement logic that can be bound to authentication stages and assigned at different scope levels.',
    whenToUse: 'Create a policy when behavior must be enforced consistently across many users, groups, tenants, or flows.',
    learnMore: ['policies', 'flows', 'attributes', 'crypto-enforcement'],
    fields: [
      {
        field: 'Key',
        meaning: 'Stable machine identifier used to reference the policy and often tied to example config.',
        recommendation: 'Pick a durable key because it will appear in assignments, scripts, and operator discussions.'
      },
      {
        field: 'Name',
        meaning: 'Human-friendly label describing the enforcement rule.',
        recommendation: 'Name it by outcome, such as two_factor_required or unique_email.'
      },
      {
        field: 'Description',
        meaning: 'Operator-facing explanation of what the policy does.',
        recommendation: 'State the business rule and what happens when the policy blocks or modifies behavior.'
      },
      {
        field: 'Stage Bindings',
        meaning: 'Authentication stages where this policy can run or influence behavior.',
        recommendation: 'Bind only to stages where the policy has the data it needs and makes semantic sense.'
      },
      {
        field: 'JavaScript Validator',
        meaning: 'Optional server-side script for advanced conditional evaluation.',
        recommendation: 'Keep scripts short, deterministic, and well-documented because they become security logic.'
      },
      {
        field: 'Enabled',
        meaning: 'Master switch controlling whether the policy is operational.',
        recommendation: 'Disable for rollout or incident response instead of deleting immediately.'
      }
    ]
  },
  {
    entity: 'ABAC Decision Simulation',
    view: 'Policies',
    purpose: 'Tests authorization outcomes before enforcing them in production request paths.',
    whenToUse: 'Use simulation when authoring or updating policy logic, assignment scope, or decision strategy to avoid unintended deny/allow regressions.',
    learnMore: ['abac-fundamentals', 'policies', 'audit-log'],
    fields: [
      {
        field: 'Subject',
        meaning: 'Actor identity context used by the evaluator (for example user id, roles, groups, tenant).',
        recommendation: 'Model realistic actor context from production requests to avoid false confidence.'
      },
      {
        field: 'Resource',
        meaning: 'Protected target identifier or pattern being accessed.',
        recommendation: 'Use canonical resource naming conventions that match runtime enforcement.'
      },
      {
        field: 'Action',
        meaning: 'Operation attempted on the resource (read, write, approve, revoke, etc.).',
        recommendation: 'Keep actions consistent across services so policy reuse remains predictable.'
      },
      {
        field: 'Context JSON',
        meaning: 'Additional request attributes such as IP, risk, time, or custom claims.',
        recommendation: 'Include only attributes that are reliably available in live request handling.'
      },
      {
        field: 'Decision Strategy',
        meaning: 'Conflict resolver for matching policies (deny_overrides, allow_overrides, first_applicable).',
        recommendation: 'Document strategy choice and validate edge cases with mixed allow/deny rules.'
      }
    ]
  },
  {
    entity: 'Policy Assignment',
    view: 'Policies',
    purpose: 'Attaches a policy definition to a scope boundary such as global, tenant, group, or user.',
    whenToUse: 'Create or update assignments when one policy definition should behave differently by audience or boundary.',
    learnMore: ['policies', 'tenants', 'groups', 'users'],
    fields: [
      {
        field: 'Scope Type',
        meaning: 'Boundary where the policy should apply: global, tenant, group, or user.',
        recommendation: 'Choose the narrowest scope that satisfies the requirement to reduce unintended impact.'
      },
      {
        field: 'Scope ID',
        meaning: 'Specific tenant, group, or user identifier when the scope is not global.',
        recommendation: 'Double-check the ID because a wrong target silently applies the right logic to the wrong audience.'
      },
      {
        field: 'Config JSON',
        meaning: 'Runtime configuration object supplied to the policy logic for this assignment.',
        recommendation: 'Treat config as part of the policy contract and keep shapes stable and documented.'
      },
      {
        field: 'Enabled',
        meaning: 'Whether this assignment is actively enforcing the policy at that scope.',
        recommendation: 'Use assignment toggles for gradual rollout before making global changes.'
      }
    ]
  },
  {
    entity: 'Event Hook',
    view: 'Events and Hooks',
    purpose: 'Delivers selected platform events to an external webhook endpoint for monitoring or automation.',
    whenToUse: 'Create a hook when another system needs to react to auth, user, or admin lifecycle events.',
    learnMore: ['events-hooks', 'audit-log', 'client'],
    fields: [
      {
        field: 'Event Type',
        meaning: 'Specific system event name or wildcard selector that triggers deliveries.',
        recommendation: 'Prefer explicit events unless the downstream system truly needs the full stream.'
      },
      {
        field: 'Target URL',
        meaning: 'Webhook endpoint receiving outbound notifications.',
        recommendation: 'Use a hardened HTTPS endpoint with authentication and replay-safe processing.'
      },
      {
        field: 'Method',
        meaning: 'HTTP verb used when sending the hook request.',
        recommendation: 'Use the method expected by the receiver and standardize across integrations when possible.'
      },
      {
        field: 'Headers JSON',
        meaning: 'Custom headers sent with the request for authentication or routing.',
        recommendation: 'Use headers for secrets or routing metadata instead of hard-coding them into URLs.'
      },
      {
        field: 'Enabled',
        meaning: 'Controls whether the hook is actively delivering events.',
        recommendation: 'Disable temporarily during incident handling or receiver maintenance instead of deleting immediately.'
      }
    ]
  },
  {
    entity: 'Instance Settings',
    view: 'Administration',
    purpose: 'Defines server-wide transport, browser, and OAuth security guardrails that apply across the whole deployment.',
    whenToUse: 'Use Administration when you need to harden or relax instance-wide security behavior instead of changing one client at a time.',
    learnMore: ['instance-settings', 'crypto-enforcement', 'redirect-uris', 'pkce'],
    fields: [
      {
        field: 'Require HTTPS',
        meaning: 'Forces the server to reject non-HTTPS traffic unless it arrives through forwarded HTTPS context.',
        recommendation: 'Enable in any environment exposed outside local development.'
      },
      {
        field: 'Use Secure Cookies',
        meaning: 'Marks admin session and CSRF cookies as secure so browsers only send them over HTTPS.',
        recommendation: 'Enable alongside HTTPS to prevent browser leakage of authentication cookies over plain HTTP.'
      },
      {
        field: 'Allow Any CORS Origin',
        meaning: 'Permits cross-origin browser requests from any origin.',
        recommendation: 'Disable in controlled environments and maintain an explicit allowlist instead.'
      },
      {
        field: 'Allowed Origins',
        meaning: 'Explicit browser origins that may perform cross-origin requests when wildcard access is disabled.',
        recommendation: 'Keep the list narrow and environment-specific.'
      },
      {
        field: 'Require HTTPS Redirect URIs',
        meaning: 'Requires secure redirect URIs for client updates except localhost development callbacks.',
        recommendation: 'Enable to stop production-grade clients from registering insecure callback URLs.'
      },
      {
        field: 'Require S256 PKCE',
        meaning: 'Blocks plain PKCE and requires the stronger S256 challenge method.',
        recommendation: 'Keep enabled unless you have a legacy compatibility exception you can justify.'
      },
      {
        field: 'Allow Implicit Flow',
        meaning: 'Controls whether the platform accepts implicit flow authorization requests.',
        recommendation: 'Disable unless an older integration still requires it and you accept the weaker model.'
      },
      {
        field: 'Token Signing Algorithm',
        meaning: 'Current server-side token signature algorithm used for issued JWTs.',
        recommendation: 'Treat this as deployment posture information and align verifier expectations accordingly.'
      }
    ]
  },
  {
    entity: 'Consent Record',
    view: 'Consents',
    purpose: 'Stores what scopes a user approved for a client so later login flows can skip or revisit consent appropriately.',
    whenToUse: 'Review consent records when validating scope grants, troubleshooting repeated prompts, or revoking prior approvals.',
    learnMore: ['consents', 'scopes', 'client', 'interaction-views'],
    fields: [
      {
        field: 'User ID',
        meaning: 'Identity that granted the consent.',
        recommendation: 'Use it to cross-check who approved access when investigating scope exposure.'
      },
      {
        field: 'Client ID',
        meaning: 'Application that received the approval.',
        recommendation: 'Confirm this matches the actual client the user intended to trust.'
      },
      {
        field: 'Scopes',
        meaning: 'Exact scopes approved for the client.',
        recommendation: 'Review scope drift over time and revoke consents that exceed current need.'
      },
      {
        field: 'Created At',
        meaning: 'Timestamp when the approval was recorded.',
        recommendation: 'Use it to correlate with audit history and support reports.'
      }
    ]
  },
  {
    entity: 'Session Record',
    view: 'Sessions',
    purpose: 'Shows active authenticated browser or login state that can be revoked when needed.',
    whenToUse: 'Review sessions during access anomalies, offboarding, or when users report strange login persistence.',
    learnMore: ['sessions', 'users', 'audit-log', 'crypto-enforcement'],
    fields: [
      {
        field: 'Session ID',
        meaning: 'Unique identifier for the authenticated session.',
        recommendation: 'Use it for precise revocation and audit correlation.'
      },
      {
        field: 'User ID',
        meaning: 'Identity currently associated with the session.',
        recommendation: 'Verify the session belongs to the expected account before revocation or support action.'
      },
      {
        field: 'Created At',
        meaning: 'Timestamp when the session was established.',
        recommendation: 'Use it to distinguish long-lived sessions from newly created suspicious ones.'
      },
      {
        field: 'Expires At / Revoked At',
        meaning: 'Lifecycle end markers for session validity.',
        recommendation: 'Prefer revocation when responding to incidents rather than waiting for expiry.'
      }
    ]
  },
  {
    entity: 'Device Request',
    view: 'Devices',
    purpose: 'Represents a pending device code login approval waiting for the user to complete verification elsewhere.',
    whenToUse: 'Inspect device requests when troubleshooting TV/CLI login flows or excessive polling behavior.',
    learnMore: ['devices', 'grants', 'interaction-views'],
    fields: [
      {
        field: 'Device Code',
        meaning: 'Backend correlation token used during device polling.',
        recommendation: 'Treat it as sensitive operational state even though end users normally see only user_code.'
      },
      {
        field: 'Client ID',
        meaning: 'Application initiating the device authorization request.',
        recommendation: 'Confirm the device flow is coming from an expected client before approving patterns as normal.'
      },
      {
        field: 'Created / Expires / Last Poll',
        meaning: 'Timestamps showing lifecycle and client polling activity.',
        recommendation: 'Use these values to detect stuck or abusive device polling.'
      }
    ]
  },
  {
    entity: 'Device Session',
    view: 'Devices',
    purpose: 'Represents a completed device-based authenticated session after user approval.',
    whenToUse: 'Review device sessions when auditing non-browser access or revoking access on shared devices.',
    learnMore: ['devices', 'sessions', 'grants'],
    fields: [
      {
        field: 'Session ID',
        meaning: 'Identifier for the device-authenticated session.',
        recommendation: 'Use it for targeted revocation rather than deleting all user access.'
      },
      {
        field: 'Client ID',
        meaning: 'Device client that received the approved session.',
        recommendation: 'Check whether the client is appropriate for shared or public device use.'
      },
      {
        field: 'Created / Expires / Revoked',
        meaning: 'Lifecycle timestamps showing session validity and history.',
        recommendation: 'Revoke proactively when the device is lost, shared, or no longer trusted.'
      }
    ]
  },
  {
    entity: 'SCIM Provisioning Token',
    view: 'Administration',
    purpose: 'Bearer credential used by external provisioning systems to call SCIM lifecycle endpoints.',
    whenToUse: 'Create one token per integration boundary and rotate/revoke independently for safer blast-radius control.',
    learnMore: ['scim-fundamentals', 'crypto-enforcement', 'audit-log'],
    fields: [
      {
        field: 'Label',
        meaning: 'Human-readable integration name for operational ownership.',
        recommendation: 'Use environment-qualified labels like okta-hr-prod for fast incident targeting.'
      },
      {
        field: 'Raw Token (one-time)',
        meaning: 'Secret value returned only at creation and never shown again.',
        recommendation: 'Store immediately in a secret manager and avoid sharing in tickets or chats.'
      },
      {
        field: 'Created At / Expires At',
        meaning: 'Lifecycle timestamps controlling token validity window.',
        recommendation: 'Use explicit expiry and pre-plan rotation before expiration windows.'
      },
      {
        field: 'Last Used At',
        meaning: 'Most recent observed API usage for this token.',
        recommendation: 'Revoke tokens that remain unused beyond expected integration cadence.'
      }
    ]
  },
  {
    entity: 'SCIM Provisioning Mapping',
    view: 'Administration',
    purpose: 'Defines how upstream SCIM attributes map into local identity fields and custom attributes.',
    whenToUse: 'Configure mappings whenever upstream profile shape differs from platform user schema.',
    learnMore: ['scim-fundamentals', 'attributes', 'users'],
    fields: [
      {
        field: 'Source Attribute',
        meaning: 'Incoming SCIM path or expression from upstream payloads.',
        recommendation: 'Use stable source identifiers and validate against real provider payloads.'
      },
      {
        field: 'Target Attribute',
        meaning: 'Destination local field path where data is written.',
        recommendation: 'Map to documented schema keys to keep policy and app behavior stable.'
      },
      {
        field: 'Transform Expression',
        meaning: 'Optional expression used to normalize source values before persistence.',
        recommendation: 'Keep transforms deterministic, side-effect free, and easy to test.'
      },
      {
        field: 'Enabled',
        meaning: 'Controls whether the mapping is active in reconciliation and provisioning flows.',
        recommendation: 'Disable during migration rollouts before permanent deletion.'
      }
    ]
  },
  {
    entity: 'SCIM Reconciliation Job',
    view: 'Administration',
    purpose: 'Represents a drift-analysis or synchronization run between upstream SCIM state and local platform state.',
    whenToUse: 'Run reconcile periodically or after mapping updates to measure drift and apply controlled corrections.',
    learnMore: ['scim-fundamentals', 'audit-log'],
    fields: [
      {
        field: 'Dry Run',
        meaning: 'Execution mode that computes drift without applying changes.',
        recommendation: 'Run dry mode first when introducing new mappings or source systems.'
      },
      {
        field: 'Status',
        meaning: 'Job lifecycle state from start to completion.',
        recommendation: 'Investigate stuck or repeatedly failing jobs as operational incidents.'
      },
      {
        field: 'Summary Counters',
        meaning: 'Aggregates such as evaluated records, drift detected, and updates applied.',
        recommendation: 'Track trends over time to catch silent data quality regressions early.'
      },
      {
        field: 'Completed At',
        meaning: 'Finalization timestamp for reporting and audit correlation.',
        recommendation: 'Use completion chronology to correlate with downstream access anomalies.'
      }
    ]
  },
  {
    entity: 'Access Request',
    view: 'Administration',
    purpose: 'Captures a proposed entitlement change that requires approval workflow before access is granted.',
    whenToUse: 'Submit when a user needs new role/group/entitlement access with traceable business justification.',
    learnMore: ['access-governance', 'recertification', 'audit-log'],
    fields: [
      {
        field: 'Subject User ID',
        meaning: 'Identity receiving the requested entitlement if approved.',
        recommendation: 'Validate subject identity carefully to avoid mis-granting access.'
      },
      {
        field: 'Entitlement Type/Value',
        meaning: 'Specific access target requested (for example role or group).',
        recommendation: 'Use canonical entitlement identifiers to prevent ambiguous approvals.'
      },
      {
        field: 'Justification',
        meaning: 'Business reason supporting the access request.',
        recommendation: 'Require concrete operational need, not generic placeholder text.'
      },
      {
        field: 'Expires At',
        meaning: 'Optional timestamp for automatic access expiry after approval.',
        recommendation: 'Set explicit expiry for elevated or temporary access requests.'
      },
      {
        field: 'Status',
        meaning: 'Current workflow state such as pending, approved, rejected, or expired.',
        recommendation: 'Monitor pending backlog and stalled items to maintain SLA quality.'
      }
    ]
  },
  {
    entity: 'Access Review Campaign',
    view: 'Administration',
    purpose: 'Defines a recertification cycle that generates review items for existing assignments.',
    whenToUse: 'Create campaigns quarterly or after org/security changes to validate existing access.',
    learnMore: ['recertification', 'access-governance', 'audit-log'],
    fields: [
      {
        field: 'Name',
        meaning: 'Identifier for the recertification cycle.',
        recommendation: 'Use period-based naming (for example q2-2026-finance-access-review).'
      },
      {
        field: 'Description',
        meaning: 'Scope explanation for reviewers.',
        recommendation: 'State inclusion rules and reviewer expectations explicitly.'
      },
      {
        field: 'Due At',
        meaning: 'Deadline for reviewer decisions.',
        recommendation: 'Set realistic windows and escalate before due date breaches.'
      },
      {
        field: 'Generated Items',
        meaning: 'Count of entitlements queued for certification.',
        recommendation: 'Watch for unusual count shifts indicating scoping bugs.'
      }
    ]
  },
  {
    entity: 'Elevation Request',
    view: 'Administration',
    purpose: 'Represents a PAM-lite request for temporary privileged action on a target resource.',
    whenToUse: 'Create for operational maintenance or incident response requiring short-lived elevated permissions.',
    learnMore: ['pam-lite', 'break-glass', 'audit-log'],
    fields: [
      {
        field: 'Resource',
        meaning: 'Target system or object requiring privileged operations.',
        recommendation: 'Use specific resource identifiers to avoid overbroad elevation scope.'
      },
      {
        field: 'Action',
        meaning: 'Privileged operation requested on the resource.',
        recommendation: 'Align actions to least-privilege verbs and avoid generic admin-all labels.'
      },
      {
        field: 'Justification',
        meaning: 'Reason for requesting elevated access.',
        recommendation: 'Require incident/ticket context to support post-incident audits.'
      },
      {
        field: 'Duration Minutes',
        meaning: 'Time window before automatic expiry.',
        recommendation: 'Prefer the shortest operationally viable duration.'
      },
      {
        field: 'Status',
        meaning: 'Lifecycle from pending to approved/active/revoked/expired.',
        recommendation: 'Ensure status transitions are monitored to prevent orphaned privilege.'
      }
    ]
  },
  {
    entity: 'Break-Glass Elevation',
    view: 'Administration',
    purpose: 'Emergency privileged session that bypasses normal approval path with strict audit requirements.',
    whenToUse: 'Use only for critical incidents where waiting for approval would materially increase impact.',
    learnMore: ['break-glass', 'pam-lite', 'audit-log'],
    fields: [
      {
        field: 'Reason',
        meaning: 'Emergency narrative justifying approval bypass.',
        recommendation: 'Provide incident-specific detail; avoid generic urgency text.'
      },
      {
        field: 'Resource / Action',
        meaning: 'Target scope for emergency privilege.',
        recommendation: 'Constrain as tightly as possible to the immediate incident need.'
      },
      {
        field: 'Duration Minutes',
        meaning: 'Hard expiration for emergency privilege window.',
        recommendation: 'Use minimal duration and require re-invocation if scope changes.'
      },
      {
        field: 'Correlation ID',
        meaning: 'Audit correlation anchor for linked privileged actions.',
        recommendation: 'Track this across logs and postmortem evidence packs.'
      }
    ]
  },
  {
    entity: 'WebAuthn Credential',
    view: 'Documentation',
    purpose: 'Represents one enrolled passkey credential used for phishing-resistant authentication.',
    whenToUse: 'Review when enabling passwordless or strong MFA journeys and during credential lifecycle support.',
    learnMore: ['webauthn-passkeys', 'adaptive-auth', 'crypto-enforcement'],
    fields: [
      {
        field: 'Credential ID',
        meaning: 'Unique identifier for the authenticator credential.',
        recommendation: 'Treat as technical identifier for revocation/troubleshooting, not user-facing label.'
      },
      {
        field: 'AAGUID',
        meaning: 'Authenticator model identifier from the WebAuthn ceremony.',
        recommendation: 'Use for assurance and hardware fleet analysis when needed.'
      },
      {
        field: 'Sign Count',
        meaning: 'Counter used to detect cloned credential replay behavior.',
        recommendation: 'Investigate anomalies or non-monotonic updates as potential compromise indicators.'
      },
      {
        field: 'Transports',
        meaning: 'Authenticator communication methods such as usb, nfc, ble, or internal.',
        recommendation: 'Document expected transport profiles for support and policy tuning.'
      }
    ]
  },
  {
    entity: 'Service Identity',
    view: 'Service Identities',
    purpose: 'Defines a non-human principal used for machine-to-machine token issuance with explicit scope and audience boundaries.',
    whenToUse: 'Create a service identity when an integration or workload needs OAuth tokens without a human login journey.',
    learnMore: ['workload-identity', 'token-exchange', 'scopes', 'audit-log'],
    fields: [
      {
        field: 'Name',
        meaning: 'Human-friendly workload identity label shown in operations and audits.',
        recommendation: 'Use deterministic names that map to owning service and environment.'
      },
      {
        field: 'Description',
        meaning: 'Operator context describing owner, purpose, and operational boundaries.',
        recommendation: 'Document ownership and escalation contact to speed incident response.'
      },
      {
        field: 'Status',
        meaning: 'Lifecycle control for whether credentials should be considered usable.',
        recommendation: 'Suspend or deactivate before deletion for safer rollback windows.'
      },
      {
        field: 'Allowed Scopes',
        meaning: 'Maximum permission set the service identity can request.',
        recommendation: 'Keep scope lists minimal and aligned to one workload purpose.'
      },
      {
        field: 'Allowed Audiences',
        meaning: 'Downstream resource servers this identity can target during token issuance.',
        recommendation: 'Restrict audiences to trusted APIs instead of broad wildcard patterns.'
      }
    ]
  },
  {
    entity: 'Service Identity Credential',
    view: 'Service Identities',
    purpose: 'Represents a concrete client credential pair issued for a service identity with lifecycle and usage tracking.',
    whenToUse: 'Issue a credential for deployment bootstrap, rotate on schedule, and revoke immediately on compromise or ownership change.',
    learnMore: ['workload-identity', 'token-exchange', 'audit-log'],
    fields: [
      {
        field: 'Client ID',
        meaning: 'Public identifier used by workload clients during token requests.',
        recommendation: 'Treat as non-secret but monitor for unexpected usage patterns.'
      },
      {
        field: 'Client Secret (one-time)',
        meaning: 'Confidential value shown only once when issuing or rotating credentials.',
        recommendation: 'Store immediately in a secret manager; never rely on UI retrieval later.'
      },
      {
        field: 'Expires At',
        meaning: 'Credential lifetime boundary for automatic expiration behavior.',
        recommendation: 'Prefer short rotation intervals for high-impact integrations.'
      },
      {
        field: 'Last Used At',
        meaning: 'Most recent observed token usage timestamp for this credential.',
        recommendation: 'Use inactivity windows to identify stale credentials for cleanup.'
      },
      {
        field: 'Revoked At',
        meaning: 'Timestamp showing explicit revocation and end of validity.',
        recommendation: 'Record reason externally so revocation history is actionable.'
      }
    ]
  },
  {
    entity: 'Connector',
    view: 'Connectors',
    purpose: 'Defines one external identity source integration and its sync configuration.',
    whenToUse: 'Create a connector when users or attributes should be synchronized from LDAP, SCIM, CSV, SQL, or custom systems.',
    learnMore: ['connectors-ops', 'auth-metrics', 'audit-log'],
    fields: [
      {
        field: 'Name',
        meaning: 'Operational label for the connector integration.',
        recommendation: 'Name by source system and environment, such as hr-ldap-prod.'
      },
      {
        field: 'Type',
        meaning: 'Connector engine profile controlling expected config and behavior.',
        recommendation: 'Choose the narrowest type matching your source to avoid custom parsing drift.'
      },
      {
        field: 'Status',
        meaning: 'Current operational state used to allow, pause, or flag failures.',
        recommendation: 'Set inactive during planned maintenance and investigate error quickly.'
      },
      {
        field: 'Schedule',
        meaning: 'Cron expression for automatic synchronization cadence.',
        recommendation: 'Balance freshness and source load; avoid overlapping schedules.'
      },
      {
        field: 'Config JSON',
        meaning: 'Type-specific connection and mapping runtime configuration.',
        recommendation: 'Keep secrets out of plain text and validate schema before saving.'
      }
    ]
  },
  {
    entity: 'Connector Mapping',
    view: 'Connectors',
    purpose: 'Maps source attributes into target identity fields with optional transformation logic.',
    whenToUse: 'Define mappings whenever source schema differs from platform identity schema.',
    learnMore: ['connectors-ops', 'attributes', 'users'],
    fields: [
      {
        field: 'Source Field',
        meaning: 'Attribute path from the upstream payload.',
        recommendation: 'Use canonical source names and document nested path assumptions.'
      },
      {
        field: 'Target Field',
        meaning: 'Destination field written into the platform model.',
        recommendation: 'Map to stable schema keys to avoid downstream policy breakage.'
      },
      {
        field: 'Transform',
        meaning: 'Optional normalization expression applied before persistence.',
        recommendation: 'Keep transforms deterministic and test against representative samples.'
      }
    ]
  },
  {
    entity: 'Connector Run',
    view: 'Connectors',
    purpose: 'Represents one sync execution with status, duration, and import/failure counters.',
    whenToUse: 'Review runs after manual sync, scheduled jobs, or incident troubleshooting.',
    learnMore: ['connectors-ops', 'auth-metrics', 'audit-log'],
    fields: [
      {
        field: 'Status',
        meaning: 'Execution state such as pending, running, succeeded, failed, or cancelled.',
        recommendation: 'Track transitions to detect stuck jobs and scheduler health issues.'
      },
      {
        field: 'Started / Finished At',
        meaning: 'Execution timing used to calculate duration and latency trends.',
        recommendation: 'Investigate unusual duration spikes as possible source or mapping problems.'
      },
      {
        field: 'Records Imported',
        meaning: 'Count of successfully processed records.',
        recommendation: 'Baseline expected volume and alert on large drops.'
      },
      {
        field: 'Records Failed',
        meaning: 'Count of records rejected or errored during processing.',
        recommendation: 'Treat sustained failures as data quality or transform regression indicators.'
      },
      {
        field: 'Error Message',
        meaning: 'Top-level error context captured for failed executions.',
        recommendation: 'Correlate with source logs and mapping changes before reruns.'
      }
    ]
  },
  {
    entity: 'SAML Service Provider',
    view: 'Federation Providers',
    purpose: 'Defines enterprise SAML integration endpoints, certificates, and metadata alignment for one relying service.',
    whenToUse: 'Use this when integrating enterprise applications that require SAML rather than OIDC federation.',
    learnMore: ['saml-federation', 'saml-sp-ops', 'crypto-enforcement', 'audit-log'],
    fields: [
      {
        field: 'Entity ID',
        meaning: 'Unique SAML identifier for the service provider.',
        recommendation: 'Keep exact partner-provided value; mismatches break assertions.'
      },
      {
        field: 'ACS URL',
        meaning: 'Assertion Consumer Service endpoint receiving signed responses.',
        recommendation: 'Validate exact HTTPS destination to prevent assertion leakage.'
      },
      {
        field: 'SLO URL',
        meaning: 'Optional single logout endpoint for session handoff.',
        recommendation: 'Populate only when partner supports tested logout workflows.'
      },
      {
        field: 'Metadata XML Upload',
        meaning: 'Imports endpoint and certificate details from partner metadata.',
        recommendation: 'Use overwrite intentionally and review parsed values before saving.'
      },
      {
        field: 'Certificate Rotation (signing/encryption)',
        meaning: 'Dedicated action to replace SP certificates without full object patching.',
        recommendation: 'Rotate before expiry and coordinate rollout windows with partners.'
      }
    ]
  },
  {
    entity: 'Security Risk Event',
    view: 'Administration',
    purpose: 'Represents one normalized security signal derived from raw audit telemetry.',
    whenToUse: 'Review risk events during login incidents, abuse investigations, or posture monitoring.',
    learnMore: ['risk-events', 'audit-log', 'instance-settings'],
    fields: [
      {
        field: 'Source Type',
        meaning: 'Canonical category for the underlying event source (for example login_failed).',
        recommendation: 'Group by source type to identify repeated control failures.'
      },
      {
        field: 'Severity',
        meaning: 'Normalized triage level used for prioritization.',
        recommendation: 'Escalate high/critical quickly and correlate medium spikes.'
      },
      {
        field: 'Title',
        meaning: 'Operator summary describing what happened.',
        recommendation: 'Use title with metadata, not as standalone incident evidence.'
      },
      {
        field: 'IP / Actor Context',
        meaning: 'Network and actor indicators associated with the event.',
        recommendation: 'Cross-reference with audit and session records for attribution.'
      },
      {
        field: 'Created At',
        meaning: 'Time the normalized event was recorded.',
        recommendation: 'Analyze timeline clusters to detect coordinated attacks.'
      }
    ]
  }
]

const ADMIN_VIEW_CATALOG = [
  {
    view: 'Setup',
    route: '/setup (shown when initialization is required)',
    purpose: 'Initial platform bootstrap before first use.',
    functions: [
      'Create first administrator user and credentials.',
      'Initialize baseline tenant, roles, scopes, flows, and defaults.'
    ]
  },
  {
    view: 'Login',
    route: '/login',
    purpose: 'Primary administrator sign-in entry.',
    functions: [
      'Credential login for admin dashboard access.',
      'Session creation and secure cookie issuance.',
      'Supports federated login paths where configured.'
    ]
  },
  {
    view: 'Dashboard',
    route: '/dashboard',
    purpose: 'Operational overview of identity platform state.',
    functions: [
      'High-level visibility into identity objects and activity.',
      'Navigation launch point for all management areas.'
    ]
  },
  {
    view: 'Users',
    route: '/users',
    purpose: 'Lifecycle management of user accounts.',
    functions: [
      'Create, update, deactivate, delete users.',
      'Assign app boundaries and group membership.',
      'Set custom attributes and reset passwords.'
    ]
  },
  {
    view: 'Groups',
    route: '/groups',
    purpose: 'Role aggregation and user segmentation layer.',
    functions: [
      'Create, update, delete groups.',
      'Assign or remove roles on groups.',
      'Organize users by business or access model.'
    ]
  },
  {
    view: 'Roles',
    route: '/roles',
    purpose: 'Permission model definition and enforcement basis.',
    functions: [
      'Create and maintain role permission sets.',
      'Apply app-scoped or platform-scoped access controls.',
      'Support user and group assignment workflows.'
    ]
  },
  {
    view: 'Clients',
    route: '/clients',
    purpose: 'OAuth client registration and protocol behavior control.',
    functions: [
      'Manage redirect URIs, grant types, and scopes.',
      'Configure PKCE requirements and flow linkage.',
      'Create/update/delete client credentials and metadata.'
    ]
  },
  {
    view: 'Consents',
    route: '/consents',
    purpose: 'Consent grant governance for user-client relationships.',
    functions: [
      'List granted consents by user and client.',
      'Revoke consent to force re-approval in future flows.'
    ]
  },
  {
    view: 'Sessions',
    route: '/sessions',
    purpose: 'Authentication session monitoring and control.',
    functions: [
      'View active, expired, and revoked sessions.',
      'Revoke sessions to force re-authentication.'
    ]
  },
  {
    view: 'Devices',
    route: '/devices',
    purpose: 'Device Authorization Grant operations control.',
    functions: [
      'Inspect pending and completed device requests.',
      'Revoke device requests and device-issued sessions.'
    ]
  },
  {
    view: 'Apps',
    route: '/apps',
    purpose: 'Application boundary and assignment management.',
    functions: [
      'Create/update/delete app containers.',
      'Associate users, roles, groups, and clients with apps.',
      'Support app-specific navigation and identity grouping.'
    ]
  },
  {
    view: 'Tenants',
    route: '/tenants',
    purpose: 'Tenant partitioning for multi-tenant operations.',
    functions: [
      'Create and update tenant definitions.',
      'Use tenant context in authentication and policy evaluation.'
    ]
  },
  {
    view: 'Federation Providers',
    route: '/federation',
    purpose: 'External identity provider integration management.',
    functions: [
      'Configure OIDC federation providers.',
      'Operate SAML service providers including metadata import and certificate rotation.',
      'Enable/disable providers and manage secrets/endpoints.',
      'Support identity linking and external login paths.'
    ]
  },
  {
    view: 'Authentication Flows',
    route: '/authentication',
    purpose: 'Flow design for authentication and grant coverage.',
    functions: [
      'Create ordered stage pipelines.',
      'Set grant support per flow.',
      'Activate/deactivate flow definitions for runtime use.'
    ]
  },
  {
    view: 'Interaction Views',
    route: '/interaction-views',
    purpose: 'Operator access to hosted interaction surfaces.',
    functions: [
      'Launch Login, Consent, and Device Verification screens.',
      'Validate user-facing flow behavior during operations.'
    ]
  },
  {
    view: 'User Attributes',
    route: '/user-attributes',
    purpose: 'Schema-level metadata extension for user profiles.',
    functions: [
      'Define typed custom attributes.',
      'Enable/disable attributes globally and by group assignment.'
    ]
  },
  {
    view: 'Policies',
    route: '/policies',
    purpose: 'Security and behavior rules for authentication lifecycle.',
    functions: [
      'Create policy definitions and stage bindings.',
      'Assign policies by global, tenant, group, or user scope.',
      'Configure optional JavaScript policy logic.'
    ]
  },
  {
    view: 'Administration',
    route: '/administration',
    purpose: 'Instance-wide transport, CORS, and OAuth security posture management.',
    functions: [
      'Manage SCIM provisioning tokens, mappings, and reconciliation operations.',
      'Operate access governance workflows: access requests, approvals, recertification campaigns, and reviewer decisions.',
      'Run PAM-lite controls for elevation requests, activation/revocation, and emergency break-glass flows.',
      'Customize login, consent, and portal surfaces globally or with client/app-specific overrides.',
      'Require HTTPS and secure cookies for browser and admin traffic.',
      'Manage CORS allowlist behavior for cross-origin browser requests.',
      'Enforce stricter OAuth settings such as HTTPS redirect URIs and S256-only PKCE.',
      'Review normalized security risk events derived from audit telemetry.'
    ]
  },
  {
    view: 'Events',
    route: '/events',
    purpose: 'Event distribution and webhook delivery operations.',
    functions: [
      'Create/update/delete hooks per event type or wildcard.',
      'Run hook test dispatch and inspect delivery logs.',
      'Monitor failure states for downstream integrations.'
    ]
  },
  {
    view: 'Audit Log',
    route: '/audit',
    purpose: 'Compliance and forensic visibility into system activity.',
    functions: [
      'Inspect auth, token, session, and admin lifecycle events.',
      'Review metadata, actor context, and timestamps.'
    ]
  },
  {
    view: 'Consent Interaction Screen',
    route: '/consent',
    purpose: 'Hosted consent screen used in interactive OAuth/OIDC flows.',
    functions: [
      'Approve or deny requested scopes.',
      'Return response using query, fragment, or form_post mode.'
    ]
  },
  {
    view: 'Device Verification Interaction Screen',
    route: '/oauth/device/verify',
    purpose: 'Hosted approval screen for device user_code entry.',
    functions: [
      'Validate user credentials and user_code.',
      'Approve or deny device authorization requests.'
    ]
  },
  {
    view: 'Service Identities',
    route: '/service-identities',
    purpose: 'Manage non-human identities and machine credentials for service-to-service authentication.',
    functions: [
      'Create service identities with explicit allowed scopes and audiences.',
      'Issue, rotate, and revoke credentials with one-time secret visibility.',
      'Monitor credential usage telemetry and lifecycle status (active/expired/revoked).'
    ]
  },
  {
    view: 'Documentation',
    route: '/documentation',
    purpose: 'Built-in knowledge base for platform operators and developers.',
    functions: [
      'Reference API route catalog with request/response examples.',
      'Understand operational modules and extension boundaries.'
    ]
  },
  {
    view: 'Connectors',
    route: '/connectors',
    purpose: 'Manage external identity source connectors (LDAP, SCIM, CSV, SQL, custom) and monitor auth performance metrics.',
    functions: [
      'Create and configure connectors with type-specific JSON config.',
      'Trigger manual sync runs and view historical run results.',
      'Define source→target field mappings with optional transform expressions.',
      'View auth metric rollups (login success/failure, tokens issued, policy denials) aggregated by hour.'
    ]
  },
  {
    view: 'Plugins',
    route: '/plugins',
    purpose: 'Validate and upload extension bundles for governed platform extensibility.',
    functions: [
      'Validate plugin manifests before upload and inspect warnings/errors.',
      'Upload ZIP bundles, compute checksums, and catalog metadata for review.',
      'Review registered hooks/permissions and remove bundles when no longer needed.'
    ]
  }
]

const DEV_EXTENSION_POINTS = [
  {
    name: 'Policies',
    where: 'Admin: Policies page, Backend: policy service and repositories',
    guidance: 'Add new policy definitions and stage bindings safely. Prefer assignment config and deterministic validators; keep JavaScript policy logic side-effect free and bounded.'
  },
  {
    name: 'Authentication Flows',
    where: 'Admin: Authentication Flows page, Backend: authentication flow service',
    guidance: 'Extend flow behavior via supported stage types and grant mappings. Keep active flow coverage aligned with client grants and setup defaults.'
  },
  {
    name: 'Event Hooks',
    where: 'Admin: Events page, Backend: event hook service emit points',
    guidance: 'Add event types deliberately and emit from explicit state transitions only. Reuse hook test dispatch for verification before enabling production webhooks.'
  },
  {
    name: 'Federation Providers',
    where: 'Admin: Federation page, Backend: federation service',
    guidance: 'Add provider templates and metadata mapping without bypassing callback/state validation. Keep secrets redacted in admin responses.'
  },
  {
    name: 'Domain CRUD Modules',
    where: 'Admin pages, useApi hooks, backend routes and services',
    guidance: 'For new manageable resources, follow existing pattern: schema -> route -> service -> repository -> admin hook -> page. Preserve CSRF and permission checks on mutating admin routes.'
  },
  {
    name: 'Front-End Navigation',
    where: 'Admin sidebar and route map',
    guidance: 'Add new sections under existing domain groups and gate routes with explicit permissions through the shared route guard wrapper.'
  },
  {
    name: 'Plugin Runtime',
    where: 'Admin: Plugins page, Backend: plugin service and plugin routes',
    guidance: 'Treat plugin uploads as untrusted artifacts: validate manifest IDs/versions, cap bundle size, checksum every upload, and keep execution behind a dedicated feature flag and security review gate.'
  }
]

const API_TUTORIALS: TutorialSection[] = [
  {
    title: 'Tutorial 1: First OAuth Login (Authorization Code + PKCE)',
    goal: 'Understand the end-to-end browser login path and token exchange.',
    steps: [
      'Create or identify a client with authorization_code grant and redirect URI.',
      'Start login using /oauth/authorize with response_type=code, client_id, scope, redirect_uri, state, and PKCE challenge.',
      'Authenticate in the hosted login UI, then approve consent when required.',
      'Receive authorization code at the redirect URI.',
      'Exchange code at /oauth/token using code_verifier and client credentials.',
      'Call /oauth/userinfo with the returned access token to verify user identity claims.'
    ],
    expectedResult: 'You receive access_token, id_token, refresh_token, and can resolve user claims from UserInfo.'
  },
  {
    title: 'Tutorial 2: Service-to-Service Authentication',
    goal: 'Issue an access token without user interaction.',
    steps: [
      'Use a client that supports client_credentials grant.',
      'POST /oauth/token with grant_type=client_credentials, client_id, client_secret, and optional scope.',
      'Use returned access token in downstream API calls requiring bearer auth.',
      'Optionally validate token state with /oauth/introspect during troubleshooting.'
    ],
    expectedResult: 'A valid bearer access token representing client identity is issued.'
  },
  {
    title: 'Tutorial 3: Device Authorization Flow',
    goal: 'Authenticate constrained devices with secondary user approval.',
    steps: [
      'POST /oauth/device/authorize with client_id and client_secret to obtain device_code and user_code.',
      'Display user_code and verification URI on the device.',
      'User approves code on /oauth/device/verify using account credentials.',
      'Device polls /oauth/token with grant_type=urn:ietf:params:oauth:grant-type:device_code.',
      'Handle pending and slow_down responses until approval is complete.'
    ],
    expectedResult: 'Polling endpoint returns normal token payload once user approves.'
  },
  {
    title: 'Tutorial 4: Session and Consent Revocation',
    goal: 'Force re-authentication and re-consent when required.',
    steps: [
      'List active sessions from /api/admin/sessions and consent records from /api/admin/consents.',
      'Revoke a session using DELETE /api/admin/sessions/:id when access must end immediately.',
      'Revoke consent using DELETE /api/admin/consents/:id to require fresh user approval.',
      'Verify behavior by initiating new authorize requests and confirming required user interaction.'
    ],
    expectedResult: 'Revoked sessions stop working immediately and revoked consents are requested again on next flow.'
  }
]

const ADMIN_TUTORIALS: TutorialSection[] = [
  {
    title: 'Day 0: Initial Setup And First Admin Login',
    goal: 'Bring a new deployment into an operational state.',
    steps: [
      'Open the setup screen when requiresSetup=true and create the first administrator.',
      'Sign in at Login view and confirm Dashboard access.',
      'Review default tenant, roles, scopes, and authentication flow baselines before onboarding users.'
    ],
    expectedResult: 'Platform is initialized, first admin account is active, and core defaults exist.'
  },
  {
    title: 'User And Role Onboarding Tutorial',
    goal: 'Provision a user with predictable permissions.',
    steps: [
      'Create role with required permissions in Roles view.',
      'Create group in Groups view and assign the role to that group.',
      'Create user in Users view and assign group membership.',
      'Validate effective permissions by checking /api/admin/me for the target account context.'
    ],
    expectedResult: 'User receives role-derived access via group assignment with clear traceability.'
  },
  {
    title: 'Client And Consent Tutorial',
    goal: 'Enable an application to authenticate users correctly.',
    steps: [
      'Create OAuth client in Clients view with proper grants, scopes, redirect URIs, and PKCE setting.',
      'Run a login flow via Interaction Views or external app start path.',
      'Inspect consent records in Consents view after user approval.',
      'Revoke consent to test re-prompt behavior and scope governance.'
    ],
    expectedResult: 'Client authentication works, consent is persisted, and revocation behavior is understood.'
  },
  {
    title: 'Session And Device Security Tutorial',
    goal: 'Operate active access controls during incidents.',
    steps: [
      'Monitor active sessions in Sessions view and identify anomalous user/client combinations.',
      'Use Devices view to inspect pending device codes and issued device sessions.',
      'Revoke suspicious sessions and device requests immediately.',
      'Confirm revocation by re-checking status and observing failed follow-up access attempts.'
    ],
    expectedResult: 'Potentially unsafe access is cut off and security posture is restored quickly.'
  },
  {
    title: 'Federation Tutorial',
    goal: 'Allow external identity provider sign-in safely.',
    steps: [
      'Configure a provider in Federation view with auth/token/userinfo endpoints and client credentials.',
      'Enable provider and test start/callback flow path.',
      'Verify resulting local session creation and audit/event trace entries.',
      'Disable provider if callback validation or claim mapping behavior is not as expected.'
    ],
    expectedResult: 'Federated login path is operational and controllable from admin UI.'
  },
  {
    title: 'Flow, Policy, And Attribute Tutorial',
    goal: 'Customize authentication behavior with controlled complexity.',
    steps: [
      'Adjust authentication stages and grant support in Authentication Flows view.',
      'Define user attributes and apply attribute availability rules by group.',
      'Create policies with stage bindings and assignment scopes in Policies view.',
      'Optionally add JavaScript policy logic for advanced checks and validate results in a non-production tenant first.'
    ],
    expectedResult: 'Authentication behavior follows explicit flow and policy definitions aligned with organization rules.'
  },
  {
    title: 'Event And Audit Operations Tutorial',
    goal: 'Establish observability and external automation signals.',
    steps: [
      'Create webhook targets in Events view and bind event type filters.',
      'Run Send Test for each hook and verify delivery logs and response codes.',
      'Inspect Audit Log view for security and lifecycle evidence.',
      'Tune hook retry/target systems based on failed delivery patterns.'
    ],
    expectedResult: 'Operational events are observable, testable, and available to downstream automation systems.'
  },
  {
    title: 'View-by-View Usage Quick Guide',
    goal: 'Use every admin and interaction view with confidence.',
    steps: [
      'Dashboard: start here for current system posture and navigation.',
      'Users, Groups, Roles: manage identity lifecycle and permission graph.',
      'Clients, Consents, Sessions, Devices: govern OAuth clients and active access state.',
      'Apps and Tenants: control domain boundaries and segmentation.',
      'Federation and Authentication Flows: control login source and stage pipeline.',
      'User Attributes and Policies: model profile data and enforcement logic.',
      'Events and Audit: monitor and integrate operational signals.',
      'Interaction Views, Consent, Device Verification: validate hosted user-facing flow screens.',
      'Documentation: use as reference and operator training base.'
    ],
    expectedResult: 'Operators know where to perform each task and why each view exists.'
  }
]

const DEV_TUTORIALS: TutorialSection[] = [
  {
    title: 'Tutorial A: Add A New Admin-Managed Resource',
    goal: 'Extend platform domain safely from backend to UI.',
    steps: [
      'Define domain model and repository contract.',
      'Implement repository persistence and service-level validation.',
      'Add Zod schemas and register admin API routes with permission and CSRF patterns.',
      'Add useApi query/mutation hooks and admin page UI.',
      'Wire route and sidebar, then verify build and permission behavior.'
    ],
    expectedResult: 'New resource is manageable in admin dashboard with same security conventions as existing modules.'
  },
  {
    title: 'Tutorial B: Add A New Event Type',
    goal: 'Expose a new operational signal without breaking delivery semantics.',
    steps: [
      'Add the event type to system event type list in event hook service.',
      'Emit the event only at a single authoritative lifecycle transition.',
      'Validate hook filtering and payload shape using hook test and real event triggers.',
      'Document expected payload fields in the documentation page for operators.'
    ],
    expectedResult: 'New event is discoverable, testable, and delivered consistently to enabled hooks.'
  },
  {
    title: 'Tutorial C: Extend Authentication Behavior',
    goal: 'Introduce additional enforcement with minimal regression risk.',
    steps: [
      'Prefer stage-bound policy rules before introducing new flow stages.',
      'If adding new stage behavior, align flow schema, service validation, and UI options.',
      'Use tenant or group-scoped assignments for gradual rollout.',
      'Validate with integration and e2e tests covering authorize, token, and userinfo impacts.'
    ],
    expectedResult: 'Authentication changes are controlled, testable, and reversible.'
  }
]

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function endpointDocs(route: ApiRoute): ApiEndpointDocs {
  const idParam = route.path.includes(':id')
  const credentialIdParam = route.path.includes(':credentialId')
  const connectorIdParam = route.path.includes(':connectorId')
  const mappingIdParam = route.path.includes(':mappingId')
  const deviceCodeParam = route.path.includes(':deviceCode')
  const groupIdParam = route.path.includes(':groupId')
  const providerIdParam = route.path.includes(':providerId')

  const params: string[] = []
  if (idParam) params.push('Path: id (string)')
  if (credentialIdParam) params.push('Path: credentialId (string)')
  if (connectorIdParam) params.push('Path: connectorId (string)')
  if (mappingIdParam) params.push('Path: mappingId (string)')
  if (deviceCodeParam) params.push('Path: deviceCode (string)')
  if (groupIdParam) params.push('Path: groupId (string)')
  if (providerIdParam) params.push('Path: providerId (string)')
  if (route.path === '/oauth/authorize') {
    params.push('Query: response_type, client_id, redirect_uri, scope, state?')
    params.push('Query: nonce?, prompt?, approval_prompt?, response_mode?, code_challenge?, code_challenge_method?')
  }
  if (route.path === '/oauth/userinfo') {
    params.push('Header: Authorization: Bearer <access_token>')
    params.push('Query: format=signed|jwt (optional)')
  }
  if (route.path === '/api/admin/events/notifications' || route.path === '/api/admin/audit') {
    params.push('Query: limit (number, optional)')
  }
  if (route.path === '/api/admin/access-requests') {
    params.push('Query: status? (pending|approved|rejected|expired|cancelled), limit?')
  }
  if (route.path === '/oauth/frontchannel-logout') {
    params.push('Query: sid? | sub? | post_logout_redirect_uri? | state?')
  }

  const isMutation = route.method !== 'GET'
  const defaultMutationBody = prettyJson({})

  if (route.path === '/api/setup/initialize') {
    return {
      parameters: params,
      requestJson: prettyJson({ name: 'Admin User', email: 'admin@example.com', username: 'admin', password: 'change-me-now' }),
      expectedResponse: prettyJson({ created: true, adminUserId: 'user_xxx' })
    }
  }

  if (route.path === '/api/setup/status') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ setupRequired: false, initialized: true })
    }
  }

  if (route.path === '/api/csrf-token') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ csrf_token: 'csrf_xxx' })
    }
  }

  if (route.path === '/health') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ status: 'ok', timestamp: '2026-04-20T12:34:56.000Z' })
    }
  }

  if (route.path === '/connect/register') {
    return {
      parameters: params,
      requestJson: prettyJson({
        app_id: 'app_xxx',
        client_name: 'Example App',
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'openid profile email'
      }),
      expectedResponse: prettyJson({ client_id: 'dyn_xxx', client_secret: 'secret_xxx', app_id: 'app_xxx', redirect_uris: ['http://localhost:3000/callback'] })
    }
  }

  if (route.path === '/oauth/token') {
    return {
      parameters: params,
      requestJson: prettyJson({ grant_type: 'authorization_code', code: 'code_xxx', client_id: 'client_id', client_secret: 'client_secret', redirect_uri: 'http://localhost:3000/callback' }),
      expectedResponse: prettyJson({ access_token: 'eyJ...', token_type: 'Bearer', expires_in: 900, refresh_token: 'r_xxx', id_token: 'eyJ...' })
    }
  }

  if (route.path === '/oauth/token/exchange') {
    return {
      parameters: [...params, 'Header: Authorization: Bearer <subject_access_token> (or provide subject_token in body)'],
      requestJson: prettyJson({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: 'eyJ_subject_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'openid profile email',
        audience: 'internal-api'
      }),
      expectedResponse: prettyJson({
        access_token: 'eyJ_exchanged_token',
        token_type: 'Bearer',
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        expires_in: 900,
        scope: 'openid profile email'
      })
    }
  }

  if (route.path === '/oauth/introspect') {
    return {
      parameters: params,
      requestJson: prettyJson({
        token: 'eyJ_access_or_refresh_token',
        client_id: 'client_id',
        client_secret: 'client_secret'
      }),
      expectedResponse: prettyJson({
        active: true,
        sub: 'user_xxx',
        client_id: 'client_id',
        scope: 'openid profile email',
        exp: 1776694496
      })
    }
  }

  if (route.path === '/oauth/token/revoke') {
    return {
      parameters: params,
      requestJson: prettyJson({
        token: 'eyJ_access_or_refresh_token',
        token_type_hint: 'refresh_token'
      }),
      expectedResponse: prettyJson({})
    }
  }

  if (route.path === '/oauth/device/authorize') {
    return {
      parameters: params,
      requestJson: prettyJson({ client_id: 'client_id', client_secret: 'client_secret', scope: 'openid profile email' }),
      expectedResponse: prettyJson({ device_code: 'device_xxx', user_code: 'ABCD1234', verification_uri: '/oauth/device/verify', expires_in: 600, interval: 5 })
    }
  }

  if (route.path === '/oauth/device/verify') {
    return {
      parameters: params,
      requestJson: prettyJson({ user_code: 'ABCD1234', username: 'admin', password: 'change-me-now', approve: true }),
      expectedResponse: prettyJson({ status: 'approved' })
    }
  }

  if (route.path === '/oauth/logout') {
    return {
      parameters: [...params, 'Query: post_logout_redirect_uri?, state?'],
      expectedResponse: '302 redirect to the validated post-logout URI or `/login` after clearing the session cookie.'
    }
  }

  if (route.path === '/oauth/frontchannel-logout') {
    return {
      parameters: params,
      expectedResponse: '200 HTML logout confirmation, or 302 redirect when `post_logout_redirect_uri` is supplied and validated.'
    }
  }

  if (route.path === '/oauth/backchannel-logout') {
    return {
      parameters: params,
      requestJson: prettyJson({
        client_id: 'client_id',
        client_secret: 'client_secret',
        sid: 'sid_xxx'
      }),
      expectedResponse: prettyJson({ revoked: 1 })
    }
  }

  if (route.path === '/scim/v2/ServiceProviderConfig') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        patch: { supported: true },
        filter: { supported: true, maxResults: 200 },
        authenticationSchemes: [{ type: 'oauthbearertoken', primary: true }]
      })
    }
  }

  if (route.path === '/scim/v2/Schemas') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 2,
        Resources: [
          { id: 'urn:ietf:params:scim:schemas:core:2.0:User', name: 'User' },
          { id: 'urn:ietf:params:scim:schemas:core:2.0:Group', name: 'Group' }
        ]
      })
    }
  }

  if (route.path === '/scim/v2/ResourceTypes') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 2,
        Resources: [
          { id: 'User', endpoint: '/Users', schema: 'urn:ietf:params:scim:schemas:core:2.0:User' },
          { id: 'Group', endpoint: '/Groups', schema: 'urn:ietf:params:scim:schemas:core:2.0:Group' }
        ]
      })
    }
  }

  if (route.path === '/scim/v2/Users' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: startIndex? count? filter?'],
      expectedResponse: prettyJson({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 1,
        Resources: [{ id: 'user_xxx', userName: 'scim.user', active: true }]
      })
    }
  }

  if (route.path === '/scim/v2/Users' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        externalId: 'okta:user:1001',
        userName: 'scim.user',
        name: { givenName: 'Scim', familyName: 'User' },
        emails: [{ value: 'scim.user@example.com', primary: true }],
        active: true
      }),
      expectedResponse: prettyJson({ id: 'user_xxx', externalId: 'okta:user:1001', userName: 'scim.user', active: true })
    }
  }

  if (route.path === '/scim/v2/Users/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        Operations: [
          { op: 'replace', path: 'name.givenName', value: 'Updated' },
          { op: 'replace', path: 'externalId', value: 'okta:user:1001-updated' },
          { op: 'replace', path: 'active', value: false }
        ]
      }),
      expectedResponse: prettyJson({ id: 'user_xxx', externalId: 'okta:user:1001-updated', userName: 'scim.user', active: false })
    }
  }

  if (route.path === '/scim/v2/Groups' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        externalId: 'okta:group:5001',
        displayName: 'Finance Team',
        members: [{ value: 'user_xxx' }]
      }),
      expectedResponse: prettyJson({ id: 'group_xxx', externalId: 'okta:group:5001', displayName: 'Finance Team' })
    }
  }

  if (route.path === '/scim/v2/Groups/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        Operations: [
          { op: 'replace', path: 'displayName', value: 'Finance and Ops' },
          { op: 'replace', path: 'externalId', value: 'okta:group:5001' },
          { op: 'add', path: 'members', value: [{ value: 'user_abc' }] }
        ]
      }),
      expectedResponse: prettyJson({ id: 'group_xxx', externalId: 'okta:group:5001', displayName: 'Finance and Ops' })
    }
  }

  if (route.path === '/auth/login') {
    return {
      parameters: params,
      requestJson: prettyJson({ email: 'admin@example.com', password: 'change-me-now', clientId: 'sso-admin-ui', scope: ['openid', 'profile', 'email'] }),
      expectedResponse: prettyJson({ session: { id: 'sid_xxx', userId: 'user_xxx' }, accessToken: 'eyJ...', refreshToken: 'r_xxx' })
    }
  }

  if (route.path === '/auth/login/webauthn/begin') {
    return {
      parameters: params,
      requestJson: prettyJson({
        identifier: 'admin@example.com',
        clientId: 'sso-admin-ui',
        scope: ['openid', 'profile', 'email']
      }),
      expectedResponse: prettyJson({
        loginId: 'webauthn_login_xxx',
        challenge: 'base64url_challenge_xxx',
        rpId: 'localhost',
        allowCredentials: [
          {
            id: 'credential_xxx',
            transports: ['internal']
          }
        ]
      })
    }
  }

  if (route.path === '/auth/login/webauthn/finish') {
    return {
      parameters: params,
      requestJson: prettyJson({
        loginId: 'webauthn_login_xxx',
        credentialId: 'credential_xxx',
        signCount: 42
      }),
      expectedResponse: prettyJson({
        session: { id: 'sid_xxx', userId: 'user_xxx', clientId: 'sso-admin-ui' },
        accessToken: 'eyJ...',
        refreshToken: 'r_xxx'
      })
    }
  }

  if (route.path.startsWith('/api/admin/users') && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ email: 'user@example.com', username: 'newuser', password: 'StrongPass123!', givenName: 'New', familyName: 'User' }),
      expectedResponse: prettyJson({ id: 'user_xxx', email: 'user@example.com', username: 'newuser' })
    }
  }

  if (route.path.startsWith('/api/admin/clients') && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        id: 'my-client',
        name: 'My Client',
        secret: 'super-secret-client-key',
        redirectUris: ['http://localhost:3000/callback'],
        allowedScopes: ['openid', 'profile', 'email'],
        grants: ['authorization_code', 'refresh_token'],
        requirePkce: true
      }),
      expectedResponse: prettyJson({ id: 'my-client', name: 'My Client', secretPreview: 'supe...-key' })
    }
  }

  if (route.path.startsWith('/api/admin/events/hooks') && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ eventType: 'auth.login.succeeded', targetUrl: 'https://hooks.example.com/sso', method: 'POST', headers: { 'x-key': 'value' }, enabled: true }),
      expectedResponse: prettyJson({ id: 'hook_xxx', eventType: 'auth.login.succeeded', enabled: true })
    }
  }

  if (route.path === '/api/admin/policies' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        key: 'abac_finance_write_guard',
        name: 'Finance Write Guard',
        description: 'Prevents write actions on finance resources unless explicitly allowed.',
        category: 'authorization',
        effect: 'deny',
        resourcePattern: 'finance:*',
        actionPattern: 'write',
        stageBindings: [],
        javascriptCode: 'return false',
        enabled: true
      }),
      expectedResponse: prettyJson({ id: 'policy_xxx', key: 'abac_finance_write_guard', category: 'authorization', effect: 'deny' })
    }
  }

  if (route.path === '/api/admin/policies/:id' && route.method === 'PUT') {
    return {
      parameters: params,
      requestJson: prettyJson({
        effect: 'allow',
        resourcePattern: 'finance:invoice:*',
        actionPattern: 'read',
        javascriptCode: 'return true'
      }),
      expectedResponse: prettyJson({ id: 'policy_xxx', effect: 'allow', resourcePattern: 'finance:invoice:*', actionPattern: 'read' })
    }
  }

  if (route.path === '/api/admin/policies/:id/assignments' && route.method === 'PUT') {
    return {
      parameters: params,
      requestJson: prettyJson({
        scopeType: 'global',
        enabled: true,
        priority: 200,
        decisionStrategy: 'deny_overrides',
        config: {
          priority: 200,
          effect: 'deny'
        }
      }),
      expectedResponse: prettyJson({ id: 'policy_assignment_xxx', scopeType: 'global', priority: 200, decisionStrategy: 'deny_overrides' })
    }
  }

  if (route.path === '/api/admin/provisioning/tokens' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        label: 'okta-prod-hr',
        expiresAt: '2026-07-19T10:00:00.000Z'
      }),
      expectedResponse: prettyJson({
        id: 'scimtok_xxx',
        label: 'okta-prod-hr',
        token: 'scim_xxx',
        createdAt: '2026-04-20T10:00:00.000Z',
        expiresAt: '2026-07-19T10:00:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/provisioning/tokens' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'scimtok_xxx',
          label: 'okta-prod-hr',
          createdAt: '2026-04-20T10:00:00.000Z',
          expiresAt: '2026-07-19T10:00:00.000Z',
          lastUsedAt: '2026-04-20T12:33:12.000Z',
          updatedAt: '2026-04-20T12:33:12.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/provisioning/mappings' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        name: 'workday_manager_mapping',
        sourceAttribute: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager.value',
        targetAttribute: 'customAttributes.managerId',
        transformExpression: 'value?.toLowerCase()',
        enabled: true
      }),
      expectedResponse: prettyJson({
        id: 'map_xxx',
        name: 'workday_manager_mapping',
        sourceAttribute: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager.value',
        targetAttribute: 'customAttributes.managerId',
        enabled: true
      })
    }
  }

  if (route.path === '/api/admin/provisioning/mappings' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'map_xxx',
          name: 'workday_manager_mapping',
          sourceAttribute: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager.value',
          targetAttribute: 'customAttributes.managerId',
          transformExpression: 'value?.toLowerCase()',
          enabled: true,
          createdAt: '2026-04-20T09:00:00.000Z',
          updatedAt: '2026-04-20T09:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/provisioning/jobs/reconcile' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ dryRun: true }),
      expectedResponse: prettyJson({
        id: 'job_xxx',
        jobType: 'reconcile',
        status: 'completed',
        summary: {
          dryRun: true,
          usersEvaluated: 42,
          groupsEvaluated: 8,
          mappingsApplied: 3,
          driftDetected: 5,
          updatedUsers: 0,
          updatedGroups: 0
        },
        createdAt: '2026-04-20T12:00:00.000Z',
        completedAt: '2026-04-20T12:00:01.000Z'
      })
    }
  }

  if (route.path === '/api/admin/provisioning/deprovisioning-queue' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: limit?'],
      expectedResponse: prettyJson([
        {
          id: 'dq_xxx',
          subjectType: 'user',
          subjectId: 'user_xxx',
          actionType: 'user_offboard',
          status: 'pending',
          payload: { source: 'scim', requestedAt: '2026-04-20T12:15:00.000Z' },
          createdAt: '2026-04-20T12:15:00.000Z',
          processedAt: null
        }
      ])
    }
  }

  if (route.path === '/api/admin/provisioning/jobs' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: limit?'],
      expectedResponse: prettyJson([
        {
          id: 'job_xxx',
          jobType: 'reconcile',
          status: 'completed',
          summary: {
            dryRun: true,
            usersEvaluated: 42,
            groupsEvaluated: 8,
            mappingsApplied: 3,
            driftDetected: 0
          },
          createdAt: '2026-04-20T12:00:00.000Z',
          completedAt: '2026-04-20T12:00:01.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/access-requests' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        subjectUserId: 'user_xxx',
        entitlementType: 'role',
        entitlementValue: 'finance_approver',
        justification: 'User is onboarding to the Accounts Payable rotation.',
        expiresAt: '2026-05-20T12:00:00.000Z'
      }),
      expectedResponse: prettyJson({
        id: 'ar_xxx',
        requesterId: 'admin_xxx',
        subjectUserId: 'user_xxx',
        entitlementType: 'role',
        entitlementValue: 'finance_approver',
        status: 'pending',
        justification: 'User is onboarding to the Accounts Payable rotation.',
        expiresAt: '2026-05-20T12:00:00.000Z',
        createdAt: '2026-04-20T12:00:00.000Z',
        updatedAt: '2026-04-20T12:00:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/access-requests' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'ar_xxx',
          requesterId: 'admin_xxx',
          subjectUserId: 'user_xxx',
          entitlementType: 'role',
          entitlementValue: 'finance_approver',
          status: 'pending',
          justification: 'User is onboarding to the Accounts Payable rotation.',
          createdAt: '2026-04-20T12:00:00.000Z',
          updatedAt: '2026-04-20T12:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/access-requests/:id/approve' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ rationale: 'Business owner approval attached to ticket FIN-2194.' }),
      expectedResponse: prettyJson({
        id: 'ar_xxx',
        status: 'approved',
        updatedAt: '2026-04-20T12:15:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/access-requests/:id/reject' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ rationale: 'Missing required data-classification justification.' }),
      expectedResponse: prettyJson({
        id: 'ar_xxx',
        status: 'rejected',
        updatedAt: '2026-04-20T12:20:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/access-requests/process-expirations' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ dryRun: false }),
      expectedResponse: prettyJson({
        now: '2026-04-20T13:00:00.000Z',
        dryRun: false,
        examinedApprovedRequests: 12,
        expiredRequests: 2,
        revokedAssignments: 2
      })
    }
  }

  if (route.path === '/api/admin/access-reviews/campaigns' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        name: 'Quarterly Access Recertification',
        description: 'Review direct roles and group memberships for active users.',
        dueAt: '2026-05-20T12:00:00.000Z'
      }),
      expectedResponse: prettyJson({
        campaign: {
          id: 'arc_xxx',
          name: 'Quarterly Access Recertification',
          status: 'active',
          createdByUserId: 'admin_xxx',
          dueAt: '2026-05-20T12:00:00.000Z',
          createdAt: '2026-04-20T12:30:00.000Z',
          updatedAt: '2026-04-20T12:30:00.000Z'
        },
        generatedItems: 14
      })
    }
  }

  if (route.path === '/api/admin/access-reviews/campaigns/:id' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        campaign: {
          id: 'arc_xxx',
          name: 'Quarterly Access Recertification',
          status: 'active',
          createdByUserId: 'admin_xxx',
          createdAt: '2026-04-20T12:30:00.000Z',
          updatedAt: '2026-04-20T12:30:00.000Z'
        },
        items: [
          {
            id: 'ari_xxx',
            campaignId: 'arc_xxx',
            subjectUserId: 'user_xxx',
            entitlementType: 'role',
            entitlementValue: 'role_finance_approver',
            currentState: 'granted',
            createdAt: '2026-04-20T12:30:00.000Z',
            updatedAt: '2026-04-20T12:30:00.000Z'
          }
        ]
      })
    }
  }

  if (route.path === '/api/admin/access-reviews/items/:id/decision' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ decision: 'revoked', rationale: 'No longer required for current responsibilities.' }),
      expectedResponse: prettyJson({
        id: 'ari_xxx',
        campaignId: 'arc_xxx',
        decision: 'revoked',
        decidedByUserId: 'admin_xxx',
        decidedAt: '2026-04-20T12:45:00.000Z',
        updatedAt: '2026-04-20T12:45:00.000Z'
      }),
      notes: [
        'Each review decision emits attestation evidence metadata in audit events (`type=access_review_item_decided`) for downstream export pipelines.'
      ]
    }
  }

    if (route.path === '/api/admin/access-requests/stalled' && route.method === 'GET') {
      return {
        parameters: params,
        expectedResponse: prettyJson({
          stalledRequests: [
            { id: 'gar_xxx', requesterId: 'usr_yyy', entitlement: 'role:admin', status: 'pending', createdAt: '2026-04-20T10:00:00.000Z', stalledMinutes: 85 }
          ]
        })
      }
    }

    if (route.path === '/api/admin/elevations' && route.method === 'POST') {
      return {
        parameters: params,
        requestJson: prettyJson({ justification: 'Emergency database maintenance', resource: 'db:prod', action: 'write', durationMinutes: 60 }),
        expectedResponse: prettyJson({ id: 'elv_xxx', correlationId: 'corr_abc123', requesterId: 'usr_yyy', resource: 'db:prod', action: 'write', status: 'pending', expiresAt: '2026-04-20T13:00:00.000Z', createdAt: '2026-04-20T12:00:00.000Z' })
      }
    }

    if (route.path === '/api/admin/elevations' && route.method === 'GET') {
      return {
        parameters: params,
        expectedResponse: prettyJson([
          { id: 'elv_xxx', correlationId: 'corr_abc123', requesterId: 'usr_yyy', resource: 'db:prod', action: 'write', status: 'pending', expiresAt: '2026-04-20T13:00:00.000Z', createdAt: '2026-04-20T12:00:00.000Z' }
        ])
      }
    }

    if (route.path === '/api/admin/elevations/:id' && route.method === 'GET') {
      return {
        parameters: params,
        expectedResponse: prettyJson({ id: 'elv_xxx', correlationId: 'corr_abc123', requesterId: 'usr_yyy', resource: 'db:prod', action: 'write', status: 'approved', approvedAt: '2026-04-20T12:05:00.000Z', expiresAt: '2026-04-20T13:00:00.000Z' })
      }
    }

    if (route.path === '/api/admin/elevations/sessions' && route.method === 'GET') {
      return {
        parameters: params,
        expectedResponse: prettyJson([
          { id: 'els_xxx', correlationId: 'corr_abc123', elevationRequestId: 'elv_xxx', requesterId: 'usr_yyy', resource: 'db:prod', action: 'write', status: 'active', startedAt: '2026-04-20T12:10:00.000Z', expiresAt: '2026-04-20T13:10:00.000Z' }
        ])
      }
    }

    if (route.path === '/api/admin/elevations/:id/approve' && route.method === 'POST') {
      return {
        parameters: params,
        requestJson: prettyJson({ rationale: 'Verified emergency maintenance window' }),
        expectedResponse: prettyJson({ id: 'elv_xxx', status: 'approved', approvedByUserId: 'adm_zzz', approvedAt: '2026-04-20T12:05:00.000Z' })
      }
    }

    if (route.path === '/api/admin/elevations/:id/activate' && route.method === 'POST') {
      return {
        parameters: params,
        expectedResponse: prettyJson({ id: 'elv_xxx', status: 'active', activatedAt: '2026-04-20T12:10:00.000Z', expiresAt: '2026-04-20T13:10:00.000Z' })
      }
    }

    if (route.path === '/api/admin/elevations/:id/revoke' && route.method === 'POST') {
      return {
        parameters: params,
        requestJson: prettyJson({ reason: 'Maintenance completed early' }),
        expectedResponse: prettyJson({ id: 'elv_xxx', status: 'revoked', revokedAt: '2026-04-20T12:45:00.000Z' })
      }
    }

    if (route.path === '/api/admin/elevations/process-expirations' && route.method === 'POST') {
      return {
        parameters: params,
        expectedResponse: prettyJson({ expired: 2 })
      }
    }

    if (route.path === '/api/admin/elevations/check' && route.method === 'POST') {
      return {
        parameters: params,
        requestJson: prettyJson({ resource: 'db:prod', action: 'write' }),
        expectedResponse: prettyJson({ allowed: true, sessionId: 'els_xxx' })
      }
    }

    if (route.path === '/api/admin/elevations/break-glass' && route.method === 'POST') {
      return {
        parameters: params,
        requestJson: prettyJson({ 
          resource: 'backup:prod', 
          action: 'restore',
          reason: 'Production database corruption detected - immediate restore required for RTO',
          durationMinutes: 15 
        }),
        expectedResponse: prettyJson({
          breakGlassId: 'bg_emergency_20260420_prod_db',
          request: {
            id: 'elev_req_yyy',
            status: 'active',
            correlationId: 'corr_xyz',
            resource: 'backup:prod',
            action: 'restore',
            expiresAt: '2026-04-20T10:15:00.000Z'
          },
          session: {
            id: 'els_bg_yyy',
            status: 'active',
            startedAt: '2026-04-20T10:00:00.000Z',
            expiresAt: '2026-04-20T10:15:00.000Z'
          }
        })
      }
    }

  if (route.path === '/api/admin/events/notifications') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'notif_xxx',
          eventType: 'auth.login.succeeded',
          status: 'delivered',
          responseStatus: 200,
          createdAt: '2026-04-18T10:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/me') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ id: 'user_xxx', email: 'admin@example.com', username: 'admin', roles: ['platform_admin'], permissions: ['*:*'] })
    }
  }

  if (route.path === '/api/admin/security/risk-events') {
    return {
      parameters: [...params, 'Query: limit?'],
      expectedResponse: prettyJson([
        {
          id: 'aud_xxx',
          sourceType: 'login_failed',
          severity: 'medium',
          title: 'Failed login attempt',
          createdAt: '2026-04-20T12:45:00.000Z',
          ip: '127.0.0.1'
        }
      ])
    }
  }

  if (route.path === '/api/admin/saml/service-providers/:id/metadata' && route.method === 'POST') {
    return {
      parameters: [...params, 'Body: metadataXml (string), applyParsedFields? (boolean)'],
      requestJson: prettyJson({
        metadataXml: '<EntityDescriptor entityID="https://sp.example.com/metadata">...</EntityDescriptor>',
        applyParsedFields: true
      }),
      expectedResponse: prettyJson({
        id: 'sp_xxx',
        metadataStored: true,
        applied: {
          entityId: 'https://sp.example.com/metadata',
          acsUrl: 'https://sp.example.com/saml/acs',
          sloUrl: 'https://sp.example.com/saml/slo'
        }
      })
    }
  }

  if (route.path === '/api/admin/saml/service-providers/:id/certificates/rotate' && route.method === 'POST') {
    return {
      parameters: [...params, 'Body: use (signing|encryption), algorithm?, expiresAt?'],
      requestJson: prettyJson({
        use: 'signing',
        algorithm: 'rsa-sha256',
        expiresAt: '2027-01-01T00:00:00.000Z'
      }),
      expectedResponse: prettyJson({
        id: 'sp_xxx',
        certificate: {
          use: 'signing',
          kid: 'cert_new_xxx',
          rotatedAt: '2026-04-20T15:00:00.000Z',
          expiresAt: '2027-01-01T00:00:00.000Z'
        }
      })
    }
  }

  if (route.path === '/api/admin/service-identities' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'svc_xxx',
          name: 'billing-worker',
          description: 'Background invoice processor',
          status: 'active',
          allowedScopes: ['billing.read', 'billing.write'],
          allowedAudiences: ['internal-api'],
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/service-identities' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        name: 'billing-worker',
        description: 'Background invoice processor',
        allowedScopes: ['billing.read', 'billing.write'],
        allowedAudiences: ['internal-api']
      }),
      expectedResponse: prettyJson({
        id: 'svc_xxx',
        name: 'billing-worker',
        status: 'active',
        allowedScopes: ['billing.read', 'billing.write'],
        allowedAudiences: ['internal-api']
      })
    }
  }

  if (route.path === '/api/admin/service-identities/:id' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        id: 'svc_xxx',
        name: 'billing-worker',
        status: 'active',
        description: 'Background invoice processor',
        allowedScopes: ['billing.read', 'billing.write'],
        allowedAudiences: ['internal-api'],
        credentials: [
          {
            id: 'cred_xxx',
            clientId: 'svc_billing_worker',
            status: 'active',
            createdAt: '2026-04-20T10:05:00.000Z',
            lastUsedAt: '2026-04-20T12:45:00.000Z'
          }
        ]
      })
    }
  }

  if (route.path === '/api/admin/service-identities/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        description: 'Updated description',
        status: 'active',
        allowedScopes: ['billing.read'],
        allowedAudiences: ['internal-api', 'analytics-api']
      }),
      expectedResponse: prettyJson({
        id: 'svc_xxx',
        status: 'active',
        description: 'Updated description',
        allowedScopes: ['billing.read'],
        allowedAudiences: ['internal-api', 'analytics-api'],
        updatedAt: '2026-04-20T13:00:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/service-identities/:id/credentials' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ label: 'primary-credential' }),
      expectedResponse: prettyJson({
        id: 'cred_xxx',
        clientId: 'svc_billing_worker',
        clientSecret: 'svc_secret_xxx',
        status: 'active',
        createdAt: '2026-04-20T13:05:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/service-identities/:id/credentials/rotate' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ reason: 'Routine rotation' }),
      expectedResponse: prettyJson({
        revokedCredentialId: 'cred_old_xxx',
        credential: {
          id: 'cred_new_xxx',
          clientId: 'svc_billing_worker',
          clientSecret: 'svc_secret_new_xxx',
          status: 'active'
        }
      })
    }
  }

  if (route.path === '/api/admin/service-identities/:id/credentials/:credentialId' && route.method === 'DELETE') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ id: 'cred_xxx', revoked: true, revokedAt: '2026-04-20T13:10:00.000Z' })
    }
  }

  if (route.path === '/api/admin/service-identities/:id/usage' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        identityId: 'svc_xxx',
        totalTokenRequests24h: 142,
        credentials: [
          {
            id: 'cred_xxx',
            clientId: 'svc_billing_worker',
            status: 'active',
            lastUsedAt: '2026-04-20T12:45:00.000Z',
            requests24h: 142
          }
        ]
      })
    }
  }

  if (route.path === '/api/admin/connectors' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'conn_xxx',
          name: 'Corporate LDAP',
          type: 'ldap',
          status: 'active',
          scheduleCron: '*/15 * * * *',
          createdAt: '2026-04-20T09:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/admin/connectors' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        name: 'Corporate LDAP',
        type: 'ldap',
        config: {
          host: 'ldap.example.com',
          port: 636,
          baseDn: 'dc=example,dc=com',
          bindDn: 'cn=sync,dc=example,dc=com'
        },
        scheduleCron: '*/15 * * * *'
      }),
      expectedResponse: prettyJson({ id: 'conn_xxx', name: 'Corporate LDAP', type: 'ldap', status: 'active' })
    }
  }

  if (route.path === '/api/admin/connectors/:id' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        id: 'conn_xxx',
        name: 'Corporate LDAP',
        type: 'ldap',
        status: 'active',
        config: { host: 'ldap.example.com', port: 636 },
        scheduleCron: '*/15 * * * *',
        lastRunAt: '2026-04-20T12:30:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/connectors/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        name: 'Corporate LDAP (Primary)',
        status: 'active',
        scheduleCron: '*/10 * * * *'
      }),
      expectedResponse: prettyJson({
        id: 'conn_xxx',
        name: 'Corporate LDAP (Primary)',
        status: 'active',
        scheduleCron: '*/10 * * * *',
        updatedAt: '2026-04-20T13:15:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/connectors/:id/sync' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ reason: 'Manual sync from admin UI' }),
      expectedResponse: prettyJson({
        id: 'run_xxx',
        connectorId: 'conn_xxx',
        status: 'queued',
        triggeredBy: 'admin_xxx',
        createdAt: '2026-04-20T13:20:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/connectors/:id/runs' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: limit?'],
      expectedResponse: prettyJson([
        {
          id: 'run_xxx',
          connectorId: 'conn_xxx',
          status: 'succeeded',
          startedAt: '2026-04-20T12:30:00.000Z',
          finishedAt: '2026-04-20T12:31:12.000Z',
          stats: {
            fetched: 123,
            created: 4,
            updated: 18,
            failed: 0
          }
        }
      ])
    }
  }

  if (route.path === '/api/admin/connectors/:id/mappings' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          id: 'map_xxx',
          connectorId: 'conn_xxx',
          sourcePath: 'mail',
          targetField: 'email',
          transform: 'value?.toLowerCase()'
        }
      ])
    }
  }

  if (route.path === '/api/admin/connectors/:id/mappings' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        sourcePath: 'department',
        targetField: 'customAttributes.department',
        transform: 'value?.trim()'
      }),
      expectedResponse: prettyJson({
        id: 'map_new_xxx',
        connectorId: 'conn_xxx',
        sourcePath: 'department',
        targetField: 'customAttributes.department',
        transform: 'value?.trim()'
      })
    }
  }

  if (route.path === '/api/admin/connectors/:connectorId/mappings/:mappingId' && route.method === 'DELETE') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ id: 'map_xxx', connectorId: 'conn_xxx', deleted: true })
    }
  }

  if (route.path === '/api/admin/metrics/auth' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: startHour?, endHour?, event?'],
      expectedResponse: prettyJson({
        buckets: [
          {
            hour: '2026-04-20T12:00:00.000Z',
            loginSuccess: 214,
            loginFailure: 9,
            mfaChallenge: 37,
            tokenIssued: 298
          }
        ],
        totals: {
          loginSuccess: 214,
          loginFailure: 9,
          mfaChallenge: 37,
          tokenIssued: 298
        }
      })
    }
  }

  if (route.path === '/api/admin/plugins' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        data: [
          {
            id: 'acme.audit-enricher',
            name: 'ACME Audit Enricher',
            version: '1.0.0',
            status: 'uploaded',
            entrypoint: 'dist/index.js',
            hooks: ['user.created', 'auth.login.success'],
            permissions: ['events:emit'],
            bundleChecksum: '4c8fa2...d13a',
            bundleBytes: 81402,
            uploadedAt: '2026-04-21T10:00:00.000Z',
            updatedAt: '2026-04-21T10:00:00.000Z'
          }
        ]
      })
    }
  }

  if (route.path === '/api/admin/plugins/validate' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        manifest: {
          id: 'acme.audit-enricher',
          name: 'ACME Audit Enricher',
          version: '1.0.0',
          entrypoint: 'dist/index.js',
          permissions: ['events:emit'],
          hooks: ['user.created']
        },
        bundleBase64: 'data:application/zip;base64,UEsDB...'
      }),
      expectedResponse: prettyJson({
        valid: true,
        errors: [],
        warnings: []
      })
    }
  }

  if (route.path === '/api/admin/plugins' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        manifest: {
          id: 'acme.audit-enricher',
          name: 'ACME Audit Enricher',
          version: '1.0.0',
          entrypoint: 'dist/index.js',
          permissions: ['events:emit'],
          hooks: ['user.created']
        },
        bundleBase64: 'data:application/zip;base64,UEsDB...',
        activate: false
      }),
      expectedResponse: prettyJson({
        id: 'acme.audit-enricher',
        name: 'ACME Audit Enricher',
        version: '1.0.0',
        status: 'uploaded',
        entrypoint: 'dist/index.js',
        permissions: ['events:emit'],
        hooks: ['user.created'],
        bundleChecksum: '4c8fa2...d13a',
        bundleBytes: 81402,
        uploadedAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z'
      })
    }
  }

  if (route.path === '/api/admin/plugins/:id' && route.method === 'DELETE') {
    return {
      parameters: params,
      expectedResponse: prettyJson({ deleted: true })
    }
  }

  if (route.path === '/api/ui/customization' && route.method === 'GET') {
    return {
      parameters: [...params, 'Query: surface (required), clientId?, appId?'],
      expectedResponse: prettyJson({
        surface: 'admin_login',
        customization: {
          title: 'Contoso Identity',
          subtitle: 'Sign in to continue',
          logoUrl: 'https://cdn.example.com/brand/logo.svg',
          primaryColor: '#0b1220',
          accentColor: '#1d4ed8',
          backgroundCss: 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%)'
        }
      })
    }
  }

  if (route.path === '/api/portal/me' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson({
        id: 'user_xxx',
        email: 'user@example.com',
        username: 'portal.user',
        givenName: 'Portal',
        familyName: 'User',
        avatarUrl: 'https://cdn.example.com/users/user_xxx/avatar.png',
        customAttributes: { department: 'Finance' },
        appId: 'app_portal',
        roles: ['employee'],
        groups: ['finance-team'],
        permissions: ['portal:read'],
        rolePermissions: [
          {
            id: 'role_xxx',
            name: 'employee',
            scope: 'platform',
            permissions: ['portal:read']
          }
        ],
        apps: [
          {
            id: 'app_portal',
            name: 'Employee Portal',
            description: 'Self-service access hub',
            imageUrl: 'https://cdn.example.com/apps/portal.png',
            url: 'https://portal.example.com'
          }
        ]
      }),
      notes: [
        'Use this endpoint as the single source of truth for portal self state after login or profile changes.',
        'roles/groups/permissions arrays represent effective access for the current user session.',
        'rolePermissions provides role-by-role permission expansion useful for explaining UI access decisions.'
      ]
    }
  }

  if (route.path === '/api/portal/profile' && route.method === 'PATCH') {
    return {
      parameters: [...params, 'CSRF: provide x-csrf-token header from GET /api/csrf-token when cookies are used'],
      requestJson: prettyJson({
        givenName: 'Updated',
        familyName: 'User',
        customAttributes: { department: 'Operations' }
      }),
      expectedResponse: '204 No Content',
      notes: [
        'Only supplied fields are updated; omitted fields remain unchanged.',
        'customAttributes should contain keys already defined in your platform attribute schema.'
      ]
    }
  }

  if (route.path === '/api/portal/change-password' && route.method === 'POST') {
    return {
      parameters: [...params, 'CSRF: provide x-csrf-token header from GET /api/csrf-token when cookies are used'],
      requestJson: prettyJson({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      }),
      expectedResponse: '204 No Content',
      notes: [
        'currentPassword must match the active credential for the logged-in account.',
        'After password change, rotate/re-authenticate other device sessions according to your security policy.'
      ]
    }
  }

  if (route.path === '/api/portal/account' && route.method === 'DELETE') {
    return {
      parameters: [...params, 'CSRF: provide x-csrf-token header from GET /api/csrf-token when cookies are used'],
      expectedResponse: '204 No Content',
      notes: [
        'This is destructive and irreversible for the local account record.',
        'Expect current browser session to become invalid immediately after successful deletion.'
      ]
    }
  }

  if (route.path === '/api/portal/avatar' && route.method === 'POST') {
    return {
      parameters: [
        ...params,
        'CSRF: provide x-csrf-token header from GET /api/csrf-token when cookies are used',
        'Body: multipart/form-data with file image field'
      ],
      expectedResponse: prettyJson({
        avatarUrl: '/media/uploads/users/user_xxx/avatar_20260420.png'
      }),
      notes: [
        'Use image/png, image/jpeg, image/webp, or image/gif upload types.',
        'The returned avatarUrl should be persisted client-side and refreshed in profile UI immediately.'
      ]
    }
  }

  if (route.path === '/api/account/mfa/webauthn/credentials' && route.method === 'GET') {
    return {
      parameters: params,
      expectedResponse: prettyJson([
        {
          credentialId: 'credential_xxx',
          transports: ['internal'],
          aaguid: 'adce0002-35bc-c60a-648b-0b25f1f05503',
          signCount: 42,
          createdAt: '2026-04-20T12:00:00.000Z'
        }
      ])
    }
  }

  if (route.path === '/api/account/mfa/webauthn/register/begin' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({ displayName: 'Work Laptop Passkey' }),
      expectedResponse: prettyJson({
        registrationId: 'reg_xxx',
        challenge: 'base64url_challenge_xxx',
        rp: { id: 'localhost', name: 'SSO' },
        user: { id: 'user_xxx', name: 'user@example.com', displayName: 'Work Laptop Passkey' }
      })
    }
  }

  if (route.path === '/api/account/mfa/webauthn/register/finish' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        registrationId: 'reg_xxx',
        credentialId: 'credential_xxx',
        publicKey: 'base64_public_key_xxx',
        transports: ['internal'],
        aaguid: 'adce0002-35bc-c60a-648b-0b25f1f05503',
        signCount: 0
      }),
      expectedResponse: prettyJson({
        credentialId: 'credential_xxx',
        transports: ['internal'],
        aaguid: 'adce0002-35bc-c60a-648b-0b25f1f05503',
        signCount: 0,
        createdAt: '2026-04-20T12:00:00.000Z'
      })
    }
  }

  if (route.path === '/api/account/mfa/webauthn/credentials/:credentialId' && route.method === 'DELETE') {
    return {
      parameters: params,
      expectedResponse: '204 No Content'
    }
  }

  if (route.path === '/oauth/revoke' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        tokenType: 'refresh',
        tokenId: 'jti_refresh_xxx'
      }),
      expectedResponse: prettyJson({ revoked: true })
    }
  }

  if (!isMutation) {
    return {
      parameters: params,
      expectedResponse: prettyJson([{ id: 'id_xxx', message: 'Successful response payload for this resource.' }])
    }
  }

  return {
    parameters: params,
    requestJson: defaultMutationBody,
    expectedResponse: prettyJson({ ok: true })
  }
}

function ApiDocs() {
  const [query, setQuery] = useState('')
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)
  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase()
    if (!needle) return API_ROUTES
    return API_ROUTES.filter((route) =>
      route.path.toLowerCase().includes(needle) ||
      route.method.toLowerCase().includes(needle) ||
      route.auth.toLowerCase().includes(needle) ||
      route.description.toLowerCase().includes(needle)
    )
  }, [deferredQuery])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-emerald-900">API Learning Path</h3>
        <p className="mt-2 text-sm text-emerald-800">
          Start with Tutorial 1 if you are new to OAuth/OIDC, then move to device, service, and revocation tutorials.
          These tutorials explain the why and the expected behavior, not just the endpoint list.
        </p>
      </div>

      {API_TUTORIALS.map((tutorial) => (
        <div key={tutorial.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{tutorial.title}</h3>
          <p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Goal:</span> {tutorial.goal}</p>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Steps</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {tutorial.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">Expected result:</span> {tutorial.expectedResult}
          </p>
        </div>
      ))}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          This catalog reflects all accessible endpoints currently exposed by the platform, including OAuth2/OIDC protocol routes,
          admin APIs, portal APIs, and compatibility routes.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by method, path, auth, or description"
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing {filtered.length} of {API_ROUTES.length} endpoints.
        </p>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
          Tip: swipe horizontally on small screens to view all columns.
        </div>
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Path</th>
              <th className="px-4 py-3 font-semibold">Auth</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((route) => {
              const key = `${route.method}:${route.path}`
              const docs = endpointDocs(route)
              const isOpen = expandedRoute === key
              return (
                <Fragment key={key}>
                  <tr key={key} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">{route.method}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{route.path}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{route.auth}</td>
                    <td className="px-4 py-3 text-slate-600">{route.description}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRoute(isOpen ? null : key)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        {isOpen ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-slate-100 bg-slate-50/50">
                      <td className="px-4 py-4" colSpan={5}>
                        <div className="grid gap-4 lg:grid-cols-1">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parameters</p>
                            {docs.parameters.length ? (
                              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                {docs.parameters.map((param) => (
                                  <li key={param}>{param}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">No required parameters.</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Request JSON</p>
                            <pre className="mt-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700">{docs.requestJson ?? 'N/A for this endpoint'}</pre>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expected Response</p>
                            <pre className="mt-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-700">{docs.expectedResponse}</pre>
                          </div>
                          {docs.notes?.length ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                {docs.notes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminDocs() {
  const conceptById = new Map(ADMIN_CONCEPT_GUIDES.map((item) => [item.id, item]))
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const searchNeedle = deferredSearch.trim().toLowerCase()

  const conceptMatches = (concept: ConceptGuide) => matchesSearch(searchNeedle, [
    concept.title,
    concept.plainExplanation,
    concept.whyItMatters,
    concept.whoDefinesIt,
    ...concept.whereInAdmin,
    ...concept.details,
  ])

  const tutorialMatches = (tutorial: EntityFieldGuide) => matchesSearch(searchNeedle, [
    tutorial.entity,
    tutorial.view,
    tutorial.purpose,
    tutorial.whenToUse,
    ...tutorial.fields.flatMap((field) => [field.field, field.meaning, field.recommendation]),
    ...tutorial.learnMore.map((conceptId) => conceptById.get(conceptId)?.title),
  ])

  const coreConcepts = OIDC_OAUTH_CONCEPTS.filter((item) => matchesSearch(searchNeedle, [item.title, item.detail]))
  const visibleConcepts = ADMIN_CONCEPT_GUIDES.filter(conceptMatches)

  const pageGuides = ADMIN_VIEW_CATALOG.map((item) => {
    const relatedConcepts = (VIEW_LEARN_MORE[item.view] ?? [])
      .map((conceptId) => conceptById.get(conceptId))
      .filter((concept): concept is ConceptGuide => Boolean(concept))

    const allTutorials = ENTITY_FIELD_TUTORIALS.filter((tutorial) => tutorial.view === item.view)
    const tutorials = searchNeedle ? allTutorials.filter(tutorialMatches) : allTutorials
    const concepts = searchNeedle ? relatedConcepts.filter(conceptMatches) : relatedConcepts

    const pageMatches = matchesSearch(searchNeedle, [
      item.view,
      item.route,
      item.purpose,
      ...item.functions,
    ])

    return {
      item,
      tutorials,
      concepts,
      isVisible: !searchNeedle || pageMatches || tutorials.length > 0 || concepts.length > 0,
    }
  }).filter((section) => section.isVisible)

  const hasResults = pageGuides.length > 0 || visibleConcepts.length > 0 || coreConcepts.length > 0

  const navPages = pageGuides.map(({ item }) => ({
    id: `page-${slugify(item.view)}`,
    label: item.view,
  }))

  const navConcepts = visibleConcepts.map((concept) => ({
    id: `concept-${concept.id}`,
    label: concept.title,
  }))

  const authFlowApiRoutes = [
    'GET /api/admin/authentication/flows',
    'POST /api/admin/authentication/flows',
    'PUT /api/admin/authentication/flows/:id',
    'DELETE /api/admin/authentication/flows/:id',
  ]

  const authFlowGrantTypes = [
    'authorization_code',
    'client_credentials',
    'refresh_token',
    'password',
    'device_code',
  ]

  const authFlowStageTypes = [
    'password',
    'federation',
    'consent',
    'mfa_totp',
    'risk_check',
    'identification',
    'email_verification',
    'captcha',
    'prompt',
    'user_write',
    'user_login',
    'user_logout',
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-0 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Documentation Menu</p>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              {menuOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages, entities, concepts"
              className="h-9 w-full rounded-lg border border-slate-200 bg-transparent pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
          </div>

          <div className={`mt-4 space-y-4 text-sm ${menuOpen ? 'block' : 'hidden lg:block'}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overview</p>
              <div className="mt-2 space-y-1">
                <a href="#admin-guide-start" className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">How To Use This Guide</a>
                <a href="#admin-learning-path" className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Learning Path</a>
                <a href="#admin-core-concepts" className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Core OAuth2/OIDC</a>
                <a href="#admin-page-guides" className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Page Guides</a>
                <a href="#admin-concept-library" className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Concept Library</a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pages</p>
              <div className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
                {navPages.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concepts</p>
              <div className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
                {navConcepts.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        {searchNeedle ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Search results: {pageGuides.length} page guide sections, {visibleConcepts.length} concept entries, {coreConcepts.length} core concepts.
          </div>
        ) : null}

        <div id="admin-guide-start" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-amber-900">How To Use This Admin Guide</h3>
          <p className="mt-2 text-sm text-amber-800">
            Use the floating menu to jump by page or concept, and use search to narrow the documentation before you read.
            The page guides are grouped by admin view so the explanation for each entity lives close to the screen where operators actually use it.
          </p>
        </div>

        <div id="admin-learning-path" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-indigo-900">Admin Operator Learning Path</h3>
          <p className="mt-2 text-sm text-indigo-800">
            Use the tutorials below in order for onboarding. They walk from setup and identity basics into advanced policy,
            federation, and event operations with expected outcomes.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-emerald-900">Authentication Flows Quick Reference</h3>
          <p className="mt-2 text-sm text-emerald-800">
            Authentication flows are managed from the Authentication view and define ordered stage pipelines for supported grants.
            Use this reference when operating or troubleshooting flow configuration.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Admin API Routes</p>
              <ul className="mt-2 space-y-1 text-xs font-mono text-emerald-900">
                {authFlowApiRoutes.map((route) => (
                  <li key={route}>{route}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Grant Types</p>
              <ul className="mt-2 space-y-1 text-xs font-mono text-emerald-900">
                {authFlowGrantTypes.map((grant) => (
                  <li key={grant}>{grant}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Stage Types</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-1 text-xs font-mono text-emerald-900">
                {authFlowStageTypes.map((stage) => (
                  <li key={stage}>{stage}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {ADMIN_TUTORIALS.map((tutorial) => (
          <div key={tutorial.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{tutorial.title}</h3>
            <p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Goal:</span> {tutorial.goal}</p>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Steps</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {tutorial.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold">Expected result:</span> {tutorial.expectedResult}
            </p>
          </div>
        ))}

        <div id="admin-core-concepts" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Core OAuth2 And OIDC Concepts</h3>
          <p className="mt-2 text-sm text-slate-600">
            These are the baseline concepts used throughout the admin views and API operations.
          </p>
          <div className="mt-4 space-y-3">
            {coreConcepts.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
            {searchNeedle && coreConcepts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">No core concept matches the current search.</p>
            ) : null}
          </div>
        </div>

        <div id="admin-page-guides" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Page Guides</h3>
          <p className="mt-2 text-sm text-slate-600">
            Every page guide combines the view purpose, available functions, related concepts, and field-by-field entity tutorials in one place.
          </p>
        </div>

        {pageGuides.map(({ item, tutorials, concepts }) => (
          <section id={`page-${slugify(item.view)}`} key={`${item.view}:${item.route}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-slate-900">{item.view}</h4>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">{item.route}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.purpose}</p>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Functions</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {item.functions.map((fn) => (
                  <li key={fn}>{fn}</li>
                ))}
              </ul>
            </div>

            {concepts.length ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Related Concepts</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {concepts.map((concept) => (
                    <a
                      key={`${item.view}:${concept.id}`}
                      href={`#concept-${concept.id}`}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {concept.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {tutorials.length ? (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Field Tutorials</p>
                  <p className="mt-1 text-sm text-slate-600">These are the entities operators configure from this page or directly alongside it.</p>
                </div>

                {tutorials.map((tutorial) => (
                  <div key={`${item.view}:${tutorial.entity}`} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <h5 className="text-base font-semibold text-slate-900">{tutorial.entity}</h5>
                    <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Purpose:</span> {tutorial.purpose}</p>
                    <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">When to use it:</span> {tutorial.whenToUse}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tutorial.learnMore.map((conceptId) => {
                        const concept = conceptById.get(conceptId)
                        return concept ? (
                          <a
                            key={`${tutorial.entity}:${conceptId}`}
                            href={`#concept-${conceptId}`}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            {concept.title}
                          </a>
                        ) : null
                      })}
                    </div>
                    <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
                        Tip: swipe horizontally on small screens to view all field columns.
                      </div>
                      <table className="min-w-[760px] w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Field</th>
                            <th className="px-4 py-3 font-semibold">What It Means</th>
                            <th className="px-4 py-3 font-semibold">Recommended Practice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tutorial.fields.map((field) => (
                            <tr key={`${tutorial.entity}:${field.field}`} className="border-t border-slate-100 align-top">
                              <td className="px-4 py-3 font-semibold text-slate-900">{field.field}</td>
                              <td className="px-4 py-3 text-slate-700">{field.meaning}</td>
                              <td className="px-4 py-3 text-slate-700">{field.recommendation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}

        {!hasResults ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
            No admin pages or concepts matched the current search. Try a page name like Users or a concept like PKCE.
          </div>
        ) : null}

        <div id="admin-concept-library" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Concept Library</h3>
          <p className="mt-2 text-sm text-slate-600">
            Deep explanations of the concepts referenced by the page guides. Use these when you need the mental model behind a field or workflow.
          </p>
        </div>

        {visibleConcepts.map((concept) => (
          <section id={`concept-${concept.id}`} key={concept.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">{concept.title}</h4>
            <p className="mt-2 text-sm text-slate-700 p-2"><span className="font-semibold">Plain explanation:</span> {concept.plainExplanation}</p>
            <p className="mt-1 text-sm text-slate-700 p-2"><span className="font-semibold">Why it matters:</span> {concept.whyItMatters}</p>
            <p className="mt-1 text-sm text-slate-700 p-2"><span className="font-semibold">Who defines it:</span> {concept.whoDefinesIt}</p>
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Where in Admin</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {concept.whereInAdmin.map((where) => (
                  <li className="ml-4 list-disc" key={where}>{where}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {concept.details.map((detail) => (
                  <li className="pl-1" key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function DevDocs() {
  const pluginManifestExample = prettyJson({
    id: 'acme.audit-enricher',
    name: 'ACME Audit Enricher',
    version: '1.0.0',
    description: 'Adds custom risk metadata to selected lifecycle events.',
    entrypoint: 'dist/index.js',
    permissions: ['events:emit', 'users:read'],
    hooks: ['user.created', 'auth.login.succeeded'],
    homepage: 'https://plugins.example.com/acme-audit-enricher'
  })

  const pluginRuntimeExample = `module.exports.onEvent = async function onEvent(event, api) {
  if (event.type === 'user.created') {
    const userId = event.payload?.userId || 'unknown'
    api.log('Plugin observed user creation', { userId })
  }

  if (event.type === 'auth.login.succeeded') {
    const ip = event.payload?.ip || 'n/a'
    api.log('Login success observed by plugin', { ip })
  }
}`

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 shadow-sm">
        Extension is supported through explicit service and admin modules. Keep security invariants intact: permission checks,
        CSRF enforcement on admin mutations, and audit/event emission for state-changing operations.
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-emerald-900">Plugin Runtime Development Guide</h3>
        <p className="mt-2 text-sm text-emerald-800">
          Plugins run in a sandboxed runtime and are invoked on declared hook events. Upload as ZIP with an entrypoint file that exports
          <span className="font-mono"> onEvent(event, api)</span>.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-emerald-900">
          <li>- Runtime hook invocation uses manifest.hooks exact event names.</li>
          <li>- Keep handlers deterministic and fast; execution uses strict timeout bounds.</li>
          <li>- Use <span className="font-mono">api.log(message, metadata)</span> for plugin diagnostics (captured in audit telemetry).</li>
          <li>- Avoid side effects outside declared integration behavior.</li>
        </ul>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Manifest Example</p>
            <pre className="mt-2 overflow-auto rounded-lg border border-emerald-200 bg-white p-3 text-[11px] text-slate-700">{pluginManifestExample}</pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Entrypoint Example</p>
            <pre className="mt-2 overflow-auto rounded-lg border border-emerald-200 bg-white p-3 text-[11px] text-slate-700">{pluginRuntimeExample}</pre>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Plugin Lifecycle</h3>
        <p className="mt-2 text-sm text-slate-600">
          See <span className="font-mono">docs/PLUGIN_DEVELOPMENT.md</span> for the full plugin packaging and runtime reference.
        </p>
        <ol className="mt-2 space-y-1 text-sm text-slate-700">
          <li>1. Build plugin bundle as ZIP with entrypoint path matching manifest.entrypoint.</li>
          <li>2. Validate bundle and manifest in Admin Plugins.</li>
          <li>3. Upload and optionally activate plugin.</li>
          <li>4. Runtime hot-reloads active plugins after upload/delete.</li>
          <li>5. Verify behavior by triggering matching events and reviewing audit logs for plugin_runtime_* events.</li>
        </ol>
      </div>

      {DEV_TUTORIALS.map((tutorial) => (
        <div key={tutorial.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{tutorial.title}</h3>
          <p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Goal:</span> {tutorial.goal}</p>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Steps</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {tutorial.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">Expected result:</span> {tutorial.expectedResult}
          </p>
        </div>
      ))}

      {DEV_EXTENSION_POINTS.map((item) => (
        <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-2 text-xs uppercase tracking-wider text-slate-400">{item.where}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.guidance}</p>
        </div>
      ))}
    </div>
  )
}

export default function Documentation() {
  const [area, setArea] = useState<DocArea>('api')

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Knowledge Base</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Documentation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Centralized documentation for API surface, admin system capabilities, and safe developer extension paths.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setArea('api')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${area === 'api' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <Server size={14} />
          API Documentation
        </button>
        <button
          onClick={() => setArea('admin')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${area === 'admin' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <BookText size={14} />
          Admin Documentation
        </button>
        <button
          onClick={() => setArea('dev')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${area === 'dev' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <Code2 size={14} />
          Dev Documentation
        </button>
      </div>

      {area === 'api' ? <ApiDocs /> : null}
      {area === 'admin' ? <AdminDocs /> : null}
      {area === 'dev' ? <DevDocs /> : null}
    </div>
  )
}
