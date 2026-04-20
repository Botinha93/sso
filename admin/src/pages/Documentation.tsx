import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { BookText, Code2, Search, Server } from 'lucide-react'

type DocArea = 'api' | 'admin' | 'dev'

interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  auth: 'public' | 'session' | 'bearer' | 'client' | 'session+csrf'
  description: string
}

interface ApiEndpointDocs {
  parameters: string[]
  requestJson?: string
  expectedResponse: string
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
  { method: 'POST', path: '/scim/v2/Users', auth: 'bearer', description: 'Creates SCIM user.' },
  { method: 'GET', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Gets SCIM user by id.' },
  { method: 'PUT', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Replaces SCIM user profile.' },
  { method: 'PATCH', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Applies SCIM patch operations to user profile.' },
  { method: 'DELETE', path: '/scim/v2/Users/:id', auth: 'bearer', description: 'Deletes SCIM user.' },
  { method: 'GET', path: '/scim/v2/Groups', auth: 'bearer', description: 'Lists SCIM groups with optional filter and pagination.' },
  { method: 'POST', path: '/scim/v2/Groups', auth: 'bearer', description: 'Creates SCIM group.' },
  { method: 'GET', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Gets SCIM group by id.' },
  { method: 'PUT', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Replaces SCIM group display name and members.' },
  { method: 'PATCH', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Applies SCIM patch operations to group display name/members.' },
  { method: 'DELETE', path: '/scim/v2/Groups/:id', auth: 'bearer', description: 'Deletes SCIM group.' },

  { method: 'POST', path: '/auth/login', auth: 'public', description: 'Login endpoint creating session cookie and issuing initial tokens.' },
  { method: 'POST', path: '/auth/logout', auth: 'session+csrf', description: 'Clears active session cookie and emits logout event.' },
  { method: 'GET', path: '/auth/federation/providers', auth: 'public', description: 'Lists enabled federation providers for sign-in screen.' },
  { method: 'GET', path: '/auth/federation/:providerId/start', auth: 'public', description: 'Starts external IdP authorization redirect.' },
  { method: 'GET', path: '/auth/federation/:providerId/callback', auth: 'public', description: 'Processes external IdP callback and creates local session.' },

  { method: 'GET', path: '/api/admin/me', auth: 'session', description: 'Returns authenticated admin profile, roles, groups, and permissions.' },
  { method: 'GET', path: '/api/admin/settings', auth: 'session', description: 'Returns persisted instance-wide administration and security settings.' },
  { method: 'PUT', path: '/api/admin/settings', auth: 'session+csrf', description: 'Updates instance-wide transport, CORS, OAuth, email, and runtime security controls.' },
  { method: 'POST', path: '/api/admin/settings/database/test', auth: 'session+csrf', description: 'Tests connectivity to a PostgreSQL/MySQL target database URL.' },
  { method: 'POST', path: '/api/admin/settings/database/migrate', auth: 'session+csrf', description: 'Copies data from SQLite into the configured external PostgreSQL/MySQL database.' },
  { method: 'GET', path: '/api/admin/provisioning/tokens', auth: 'session', description: 'Lists SCIM provisioning tokens with audit-friendly metadata.' },
  { method: 'POST', path: '/api/admin/provisioning/tokens', auth: 'session+csrf', description: 'Creates a SCIM provisioning token. Raw token is returned only once.' },
  { method: 'DELETE', path: '/api/admin/provisioning/tokens/:id', auth: 'session+csrf', description: 'Revokes a SCIM provisioning token by id.' },
  { method: 'GET', path: '/api/admin/provisioning/mappings', auth: 'session', description: 'Lists configured provisioning attribute mappings.' },
  { method: 'POST', path: '/api/admin/provisioning/mappings', auth: 'session+csrf', description: 'Creates a provisioning attribute mapping rule.' },
  { method: 'DELETE', path: '/api/admin/provisioning/mappings/:id', auth: 'session+csrf', description: 'Deletes a provisioning attribute mapping rule.' },
  { method: 'GET', path: '/api/admin/provisioning/jobs', auth: 'session', description: 'Lists recent provisioning reconciliation jobs.' },
  { method: 'POST', path: '/api/admin/provisioning/jobs/reconcile', auth: 'session+csrf', description: 'Starts a provisioning reconciliation run (dry-run supported).' },

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

  { method: 'GET', path: '/api/portal/me', auth: 'session', description: 'Returns portal user profile and assigned apps.' },
  { method: 'PATCH', path: '/api/portal/profile', auth: 'session+csrf', description: 'Updates profile and custom attributes for current portal user.' },
  { method: 'POST', path: '/api/portal/change-password', auth: 'session+csrf', description: 'Changes password for current portal user.' },
  { method: 'DELETE', path: '/api/portal/account', auth: 'session+csrf', description: 'Deletes current portal account and revokes sessions.' },

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
    plainExplanation: 'An app is a logical boundary used to organize users, roles, groups, and clients around one product or business surface.',
    whyItMatters: 'Apps help keep identity objects separated by product domain and simplify access governance at scale.',
    whoDefinesIt: 'Platform administrators define and manage apps.',
    whereInAdmin: ['Apps view', 'Users view', 'Groups view', 'Roles view', 'Clients view'],
    details: [
      'Users, groups, roles, and clients can be app-scoped.',
      'App assignment is organizational and governance-focused, not an OAuth protocol field.',
      'Use app boundaries to avoid mixing identities for unrelated products.'
    ]
  },
  {
    id: 'user-registration',
    title: 'How Users Register Or Appear In The System',
    plainExplanation: 'Users can be created by an admin, provisioned through federation, or created through setup/bootstrap paths.',
    whyItMatters: 'Knowing origin helps with lifecycle management, policy enforcement, and support troubleshooting.',
    whoDefinesIt: 'Admins create local users; federation configuration controls externally sourced identities.',
    whereInAdmin: ['Users view', 'Federation view', 'Setup view'],
    details: [
      'Admin-created users are explicit local identities with managed credentials.',
      'Federated users can be linked/provisioned from external IdP login callbacks.',
      'Password policies and active flags still govern local account usability.'
    ]
  },
  {
    id: 'users',
    title: 'Users: The Human Or Service Identity Record',
    plainExplanation: 'A user is the core identity object representing a person or managed account that can authenticate and receive roles, groups, sessions, and consents.',
    whyItMatters: 'Most downstream decisions in the platform are anchored to a user record, including login eligibility, role mapping, and audit history.',
    whoDefinesIt: 'Admins create and maintain local users; federation may provision or link them automatically.',
    whereInAdmin: ['Users view', 'Sessions view', 'Consents view', 'Audit Log'],
    details: [
      'Users can be active or inactive depending on lifecycle state.',
      'A user record is separate from a session or token and persists over time.',
      'Group membership, role assignments, and policy decisions often aggregate onto the user.'
    ]
  },
  {
    id: 'groups',
    title: 'Groups: Membership Bundles For Operational Management',
    plainExplanation: 'Groups collect users into manageable sets so access and attributes can be administered in bulk.',
    whyItMatters: 'Without groups, every access decision and attribute mapping becomes per-user manual work.',
    whoDefinesIt: 'Admins create groups, assign users into them, and optionally attach roles or attributes at the group level.',
    whereInAdmin: ['Groups view', 'Users view', 'Roles view', 'Policies view', 'User Attributes'],
    details: [
      'Groups are an operational convenience layer, not an OAuth standard object.',
      'A group may represent a team, department, application audience, or region.',
      'Use groups when many users should share the same roles or policy treatment.'
    ]
  },
  {
    id: 'roles',
    title: 'Roles: Named Access Intent',
    plainExplanation: 'Roles are named access labels that represent what a user is allowed to do inside an application or tenant context.',
    whyItMatters: 'Roles create a stable language between identity administration and application authorization logic.',
    whoDefinesIt: 'Admins define roles and decide how applications interpret them.',
    whereInAdmin: ['Roles view', 'Users view', 'Groups view', 'Clients view', 'UserInfo and token claims'],
    details: [
      'A role name should reflect business responsibility, not a low-level permission list.',
      'Roles often appear as claims in ID or access tokens when the relevant scope is granted.',
      'Applications consume roles to drive menus, API authorization, and workflow decisions.'
    ]
  },
  {
    id: 'role-assignments',
    title: 'Role Assignments: How Roles Reach Users',
    plainExplanation: 'Role assignments are the links that attach roles to users directly or indirectly through groups, tenants, or policies.',
    whyItMatters: 'Defining a role is not enough; assignment determines who actually receives that access.',
    whoDefinesIt: 'Admins assign roles directly to users or indirectly through group and policy structures.',
    whereInAdmin: ['Users view', 'Groups view', 'Roles view', 'Policies view'],
    details: [
      'Direct assignment is precise but harder to scale.',
      'Group-based assignment is easier to operate for teams and departments.',
      'Always review role propagation so users do not accumulate unintended access.'
    ]
  },
  {
    id: 'apps-governance',
    title: 'Apps As Governance Boundaries',
    plainExplanation: 'Apps partition identity objects by product or platform domain so access decisions stay understandable and constrained.',
    whyItMatters: 'Without app boundaries, roles, groups, and clients from unrelated products can become mixed and hard to govern.',
    whoDefinesIt: 'Platform administrators define apps and decide which objects belong to each one.',
    whereInAdmin: ['Apps view', 'Users view', 'Groups view', 'Roles view', 'Clients view'],
    details: [
      'An app is useful for organizing both business ownership and identity administration.',
      'Use separate apps when products have different administrators or security expectations.',
      'App boundaries help documentation, onboarding, and audit review remain clear.'
    ]
  },
  {
    id: 'client',
    title: 'What Is An OAuth Client?',
    plainExplanation: 'A client represents an application that requests tokens from this authorization server.',
    whyItMatters: 'Every protocol decision (redirects, grants, scopes, PKCE requirement) is enforced through client configuration.',
    whoDefinesIt: 'Admins create clients in Clients view; dynamic clients can also be registered via /connect/register.',
    whereInAdmin: ['Clients view', 'Authentication Flows view', 'Consents view', 'Sessions view'],
    details: [
      'Client metadata controls what that app is allowed to request.',
      'Misconfigured clients are a common source of login and token errors.',
      'Client records are security-critical and should be reviewed as part of release readiness.'
    ]
  },
  {
    id: 'client-id-secret',
    title: 'Client ID And Client Secret',
    plainExplanation: 'Client ID is the public identifier; client secret is the confidential credential used for trusted clients.',
    whyItMatters: 'The secret proves client authenticity at token endpoints for confidential flows.',
    whoDefinesIt: 'Admins define both values when creating clients.',
    whereInAdmin: ['Clients view'],
    details: [
      'Client ID can be public and appears in authorize requests.',
      'Client secret must be protected server-side and never shipped in public browser/mobile code.',
      'Rotate secrets when compromise is suspected.'
    ]
  },
  {
    id: 'redirect-uris',
    title: 'Redirect URIs',
    plainExplanation: 'Redirect URIs are allowed callback locations where authorization responses can be sent after login/consent.',
    whyItMatters: 'Strict URI matching prevents token/code leakage to untrusted domains.',
    whoDefinesIt: 'Admins define allowed redirect URIs per client.',
    whereInAdmin: ['Clients view'],
    details: [
      'Only exact registered redirects should be accepted.',
      'Use environment-specific values carefully for local/stage/prod.',
      'Do not use wildcard redirects for production clients.'
    ]
  },
  {
    id: 'scopes',
    title: 'Scopes: What They Are And Where They Come From',
    plainExplanation: 'Scopes are named permissions/claims bundles a client can request (for example openid, profile, email, roles).',
    whyItMatters: 'Scopes control what access and identity information gets granted.',
    whoDefinesIt: 'Platform scope catalog is defined by admins; each client has its own allowed scope subset.',
    whereInAdmin: ['Clients view', 'Consents view', 'Scopes API usage in Clients'],
    details: [
      'A requested scope is granted only if the client allows it and user/flow conditions pass.',
      'Consent records persist approved scopes for user-client pairs.',
      'Scope names should reflect business meaning and least privilege principles.'
    ]
  },
  {
    id: 'grants',
    title: 'Grants: What They Mean And Who Defines Them',
    plainExplanation: 'Grant types define how tokens are obtained (authorization_code, refresh_token, client_credentials, password, device_code).',
    whyItMatters: 'Different client types require different grants and security assumptions.',
    whoDefinesIt: 'Admins assign grants to clients; active authentication flows must also support those grants.',
    whereInAdmin: ['Clients view', 'Authentication Flows view'],
    details: [
      'Client grant list is an allowlist at client level.',
      'Authentication flow grantTypes are an allowlist at platform runtime flow level.',
      'A grant must be enabled in both places to work reliably.'
    ]
  },
  {
    id: 'flows',
    title: 'What Are Authentication Flows?',
    plainExplanation: 'Flows are ordered stage pipelines that define authentication behavior and enforcement steps.',
    whyItMatters: 'Flows determine whether login requires only password or includes federation, consent, MFA, risk checks, and policy stages.',
    whoDefinesIt: 'Admins define flow stages and activate the intended flow.',
    whereInAdmin: ['Authentication Flows view', 'Policies view'],
    details: [
      'Each flow can be enabled/disabled and associated with grants.',
      'Stages execute in order and can be required or optional depending on configuration.',
      'Policy assignments can influence stage outcomes.'
    ]
  },
  {
    id: 'pkce',
    title: 'PKCE And Cryptographic Proof',
    plainExplanation: 'PKCE binds authorization code usage to the original client by requiring a code_verifier that matches the original code_challenge.',
    whyItMatters: 'It protects public clients from authorization code interception attacks.',
    whoDefinesIt: 'Admins enforce PKCE per client with requirePkce and by restricting grants appropriately.',
    whereInAdmin: ['Clients view'],
    details: [
      'Use S256 method to enforce cryptographic challenge derivation.',
      'Enable requirePkce for public/browser/mobile clients.',
      'Do not disable PKCE for clients that cannot securely keep a secret.'
    ]
  },
  {
    id: 'crypto-enforcement',
    title: 'How To Enforce Strong Cryptography In Practice',
    plainExplanation: 'Use signed JWT tokens, HTTPS, PKCE S256, strict redirect matching, and secret hygiene for confidential clients.',
    whyItMatters: 'Most OAuth/OIDC incidents are caused by weak transport, weak client configuration, or token leakage.',
    whoDefinesIt: 'Admins enforce through client settings and deployment security posture.',
    whereInAdmin: ['Clients view', 'Documentation API tutorials', 'Deployment settings outside UI'],
    details: [
      'Require HTTPS in production environments.',
      'Use PKCE with S256 and exact redirect URIs for public clients.',
      'Rotate client secrets and avoid embedding them in frontend code.',
      'Use least-privileged scopes and revoke unused sessions/consents quickly.'
    ]
  },
  {
    id: 'tenants',
    title: 'Tenants: Isolation For Organizations Or Customers',
    plainExplanation: 'A tenant represents a top-level business partition, often corresponding to a customer, organization, or isolated operational domain.',
    whyItMatters: 'Tenants prevent identities, roles, and policies from being applied across the wrong customer or organizational boundary.',
    whoDefinesIt: 'Admins define tenants and decide which users, roles, clients, and policies apply inside them.',
    whereInAdmin: ['Tenants view', 'Users view', 'Roles view', 'Policies view', 'Clients view'],
    details: [
      'Tenants are stronger business isolation than groups because they represent distinct administrative domains.',
      'Use tenant scoping when data, branding, or policy must differ between organizations.',
      'Be explicit about which roles and flows are tenant-aware.'
    ]
  },
  {
    id: 'consents',
    title: 'Consents: User Approval Memory',
    plainExplanation: 'A consent record stores that a user approved a client to access a specific set of scopes.',
    whyItMatters: 'Consent is how the platform remembers what a user already agreed to, which affects future authorize prompts.',
    whoDefinesIt: 'Users create consent by approving a request; admins can review and revoke it.',
    whereInAdmin: ['Consents view', 'Consent Interaction Screen', 'Clients view'],
    details: [
      'Consent is tied to a user-client-scope relationship.',
      'Revoking consent forces the next interactive flow to request approval again if consent is required.',
      'Consent helps explain why a client received scopes during a past login.'
    ]
  },
  {
    id: 'sessions',
    title: 'Sessions: Live Browser Or Login State',
    plainExplanation: 'A session tracks an active authenticated state for a user, usually backed by secure cookies and related issuance context.',
    whyItMatters: 'Sessions are what keep a user signed in between requests and are often the first object to inspect during login support issues.',
    whoDefinesIt: 'The platform creates sessions during successful login; admins can review and revoke them.',
    whereInAdmin: ['Sessions view', 'Login view', 'Logout flow', 'Audit Log'],
    details: [
      'A session is not the same thing as an access token, though they may be related operationally.',
      'Revoking sessions is a rapid response tool after compromise or offboarding.',
      'Session lifetime, fixation protection, and secure cookie settings are core security controls.'
    ]
  },
  {
    id: 'devices',
    title: 'Devices And Device Code Login',
    plainExplanation: 'Devices represent user approvals or login handshakes for clients that cannot show a full browser-based login flow directly.',
    whyItMatters: 'Device flows are common for TVs, terminals, and constrained clients where traditional redirect-based login is not practical.',
    whoDefinesIt: 'Admins allow device_code grant support through client and flow configuration; end users complete verification during the flow.',
    whereInAdmin: ['Devices view', 'Device Verification Interaction Screen', 'Clients view', 'Authentication Flows view'],
    details: [
      'The device receives a code and waits while the user approves on another screen.',
      'This flow must still respect client, scope, and policy restrictions.',
      'Monitor device flows for abnormal polling or abuse patterns.'
    ]
  },
  {
    id: 'federation',
    title: 'Federation Providers: External Identity Sources',
    plainExplanation: 'Federation providers connect this platform to external identity providers so users can log in with identities managed elsewhere.',
    whyItMatters: 'Federation reduces password sprawl and lets organizations centralize authentication in an upstream IdP.',
    whoDefinesIt: 'Admins configure provider metadata, client credentials, mapping, and linking behavior.',
    whereInAdmin: ['Federation Providers view', 'Login view', 'Users view', 'Authentication Flows view'],
    details: [
      'Federation can link an existing local user or auto-provision a new one.',
      'Claim mapping quality determines whether imported identities behave correctly.',
      'Treat provider credentials and callback configuration as security-sensitive integration assets.'
    ]
  },
  {
    id: 'attributes',
    title: 'User Attributes: Extensible Identity Data',
    plainExplanation: 'User attributes are custom typed fields attached to identities so business-specific metadata can participate in policy and application logic.',
    whyItMatters: 'Not every organization can fit its identity model into name/email/role alone; attributes capture the rest.',
    whoDefinesIt: 'Admins define attribute schema, enablement, and optional group-level behavior.',
    whereInAdmin: ['User Attributes view', 'Users view', 'Groups view', 'Policies view'],
    details: [
      'Attributes should be governed like schema, not treated as arbitrary free text.',
      'Only add attributes with a real consumer such as policy logic or application behavior.',
      'Keep naming clear so downstream systems understand the meaning.'
    ]
  },
  {
    id: 'policies',
    title: 'Policies: Decision Rules Applied Across Scope',
    plainExplanation: 'Policies are reusable rules that influence access, stage behavior, or enforcement for specific scopes such as global, tenant, group, or user.',
    whyItMatters: 'Policies let you apply consistent behavior without rewriting every client or flow individually.',
    whoDefinesIt: 'Admins define policies and assign them at the correct scope boundary.',
    whereInAdmin: ['Policies view', 'Authentication Flows view', 'Users view', 'Groups view', 'Tenants view'],
    details: [
      'The same policy may produce different outcomes depending on assignment scope.',
      'Global policies should be used carefully because they affect many identities at once.',
      'Good policy design keeps enforcement predictable and auditable.'
    ]
  },
  {
    id: 'interaction-views',
    title: 'Interaction Views: What The User Actually Sees During Auth',
    plainExplanation: 'Interaction views are the screens rendered during the authentication journey, such as login, consent, and device verification.',
    whyItMatters: 'These views are where security decisions become user-facing behavior, so mismatch between backend rules and UI wording causes confusion.',
    whoDefinesIt: 'The platform defines the screens; admins influence behavior through flow, client, and policy configuration.',
    whereInAdmin: ['Interaction Views view', 'Login view', 'Consent Interaction Screen', 'Device Verification Interaction Screen'],
    details: [
      'Interaction views should accurately reflect requested scopes and required steps.',
      'Changes in flows or policies often surface first as differences in these screens.',
      'Use them to validate the real end-user experience, not just backend configuration.'
    ]
  },
  {
    id: 'events-hooks',
    title: 'Events And Hooks: Outbound Notifications Of Change',
    plainExplanation: 'Events describe important system actions, while hooks deliver selected events to external systems for automation or monitoring.',
    whyItMatters: 'Hooks turn the identity system into an integration point for SIEM, workflow engines, and operational alerting.',
    whoDefinesIt: 'Admins configure webhook targets and decide which downstream systems consume them.',
    whereInAdmin: ['Events view', 'Audit Log', 'Policies view'],
    details: [
      'Not every event should trigger the same downstream action; choose consumers carefully.',
      'Delivery history is important when debugging failed automation.',
      'Event design should separate informational telemetry from security-critical alerts.'
    ]
  },
  {
    id: 'audit-log',
    title: 'Audit Log: Forensics And Accountability Record',
    plainExplanation: 'The audit log is the chronological record of meaningful security and administrative activity in the platform.',
    whyItMatters: 'It is the main source for answering who changed what, when it happened, and what context surrounded the event.',
    whoDefinesIt: 'The platform emits audit entries automatically; admins consume them for review and incident response.',
    whereInAdmin: ['Audit Log', 'Users view', 'Clients view', 'Sessions view', 'Events view'],
    details: [
      'Audit entries should be reviewed during access anomalies, client misconfiguration, and offboarding investigations.',
      'Good audit data links actor, action, target, and timestamp clearly.',
      'Treat the audit log as evidence, not just dashboard noise.'
    ]
  },
  {
    id: 'instance-settings',
    title: 'Instance Settings: Global Security Posture Controls',
    plainExplanation: 'Instance settings are server-wide controls that change how the platform accepts requests and enforces transport or OAuth security rules.',
    whyItMatters: 'These switches affect every client and admin operator because they sit above per-client configuration.',
    whoDefinesIt: 'Platform administrators with administration access define and update these settings.',
    whereInAdmin: ['Administration view', 'Clients view', 'Login view'],
    details: [
      'Use instance settings for platform-wide guardrails such as HTTPS enforcement and CORS allowlists.',
      'Client settings refine behavior for one integration; instance settings set the security baseline for all of them.',
      'Changes can take effect on the next request, so operators should stage and communicate them carefully.'
    ]
  }
]

const VIEW_LEARN_MORE: Record<string, string[]> = {
  Setup: ['user-registration', 'users', 'crypto-enforcement'],
  Login: ['flows', 'scopes', 'sessions', 'interaction-views'],
  Dashboard: ['app', 'apps-governance', 'client', 'audit-log'],
  Users: ['user-registration', 'users', 'groups', 'roles', 'role-assignments', 'attributes', 'sessions'],
  Groups: ['groups', 'roles', 'role-assignments', 'attributes', 'apps-governance'],
  Roles: ['roles', 'role-assignments', 'scopes', 'tenants', 'apps-governance'],
  Clients: ['client', 'client-id-secret', 'redirect-uris', 'scopes', 'grants', 'flows', 'pkce', 'crypto-enforcement'],
  Consents: ['consents', 'scopes', 'client', 'interaction-views'],
  Sessions: ['sessions', 'users', 'crypto-enforcement', 'audit-log'],
  Devices: ['devices', 'grants', 'flows', 'interaction-views'],
  Apps: ['app', 'apps-governance', 'roles', 'groups', 'client'],
  Tenants: ['tenants', 'roles', 'policies', 'flows', 'scopes'],
  'Federation Providers': ['federation', 'user-registration', 'users', 'flows', 'crypto-enforcement'],
  'Authentication Flows': ['flows', 'grants', 'policies', 'interaction-views'],
  'Interaction Views': ['interaction-views', 'flows', 'scopes', 'consents', 'devices'],
  'User Attributes': ['attributes', 'users', 'groups', 'policies'],
  Policies: ['policies', 'flows', 'tenants', 'groups', 'crypto-enforcement'],
  Administration: ['instance-settings', 'crypto-enforcement', 'redirect-uris', 'pkce'],
  Events: ['events-hooks', 'audit-log', 'client'],
  'Audit Log': ['audit-log', 'sessions', 'events-hooks', 'crypto-enforcement'],
  'Consent Interaction Screen': ['consents', 'scopes', 'interaction-views'],
  'Device Verification Interaction Screen': ['devices', 'grants', 'interaction-views'],
  Documentation: ['client', 'roles', 'groups', 'policies', 'scopes', 'pkce']
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
      'Require HTTPS and secure cookies for browser and admin traffic.',
      'Manage CORS allowlist behavior for cross-origin browser requests.',
      'Enforce stricter OAuth settings such as HTTPS redirect URIs and S256-only PKCE.'
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
    view: 'Documentation',
    route: '/documentation',
    purpose: 'Built-in knowledge base for platform operators and developers.',
    functions: [
      'Reference API route catalog with request/response examples.',
      'Understand operational modules and extension boundaries.'
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
  const deviceCodeParam = route.path.includes(':deviceCode')
  const groupIdParam = route.path.includes(':groupId')
  const providerIdParam = route.path.includes(':providerId')

  const params: string[] = []
  if (idParam) params.push('Path: id (string)')
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
        userName: 'scim.user',
        name: { givenName: 'Scim', familyName: 'User' },
        emails: [{ value: 'scim.user@example.com', primary: true }],
        active: true
      }),
      expectedResponse: prettyJson({ id: 'user_xxx', userName: 'scim.user', active: true })
    }
  }

  if (route.path === '/scim/v2/Users/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        Operations: [
          { op: 'replace', path: 'name.givenName', value: 'Updated' },
          { op: 'replace', path: 'active', value: false }
        ]
      }),
      expectedResponse: prettyJson({ id: 'user_xxx', userName: 'scim.user', active: false })
    }
  }

  if (route.path === '/scim/v2/Groups' && route.method === 'POST') {
    return {
      parameters: params,
      requestJson: prettyJson({
        displayName: 'Finance Team',
        members: [{ value: 'user_xxx' }]
      }),
      expectedResponse: prettyJson({ id: 'group_xxx', displayName: 'Finance Team' })
    }
  }

  if (route.path === '/scim/v2/Groups/:id' && route.method === 'PATCH') {
    return {
      parameters: params,
      requestJson: prettyJson({
        Operations: [
          { op: 'replace', path: 'displayName', value: 'Finance and Ops' },
          { op: 'add', path: 'members', value: [{ value: 'user_abc' }] }
        ]
      }),
      expectedResponse: prettyJson({ id: 'group_xxx', displayName: 'Finance and Ops' })
    }
  }

  if (route.path === '/auth/login') {
    return {
      parameters: params,
      requestJson: prettyJson({ email: 'admin@example.com', password: 'change-me-now', clientId: 'sso-admin-ui', scope: ['openid', 'profile', 'email'] }),
      expectedResponse: prettyJson({ session: { id: 'sid_xxx', userId: 'user_xxx' }, accessToken: 'eyJ...', refreshToken: 'r_xxx' })
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
          driftDetected: 0,
          updatedUsers: 0,
          updatedGroups: 0
        },
        createdAt: '2026-04-20T12:00:00.000Z',
        completedAt: '2026-04-20T12:00:01.000Z'
      })
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
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return API_ROUTES
    return API_ROUTES.filter((route) =>
      route.path.toLowerCase().includes(needle) ||
      route.method.toLowerCase().includes(needle) ||
      route.description.toLowerCase().includes(needle)
    )
  }, [query])

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
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by method, path, or description"
          className="mt-3 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
        />
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                        <div className="grid gap-4 lg:grid-cols-3">
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
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">In-Page Menu</p>
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

          <div className="mt-4 space-y-4 text-sm">
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
            <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Plain explanation:</span> {concept.plainExplanation}</p>
            <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Why it matters:</span> {concept.whyItMatters}</p>
            <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Who defines it:</span> {concept.whoDefinesIt}</p>
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Where in Admin</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {concept.whereInAdmin.map((where) => (
                  <li key={where}>{where}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {concept.details.map((detail) => (
                  <li key={detail}>{detail}</li>
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
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 shadow-sm">
        Extension is supported through explicit service and admin modules. Keep security invariants intact: permission checks,
        CSRF enforcement on admin mutations, and audit/event emission for state-changing operations.
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
