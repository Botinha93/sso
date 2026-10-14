/** Claims emitted when each scope is granted (kept in sync with src/domain/oidc-scopes.ts). */
export const SCOPE_CLAIM_MAP: Record<string, readonly string[]> = {
  profile: ['preferred_username', 'given_name', 'family_name', 'picture'],
  email: ['email', 'email_verified'],
  roles: ['roles'],
  groups: ['groups'],
  permissions: ['permissions']
}

export const SCOPE_CONSENT_LABELS: Record<string, string> = {
  openid: 'Verify your identity (OpenID Connect)',
  profile: 'Access your name, username, and profile picture',
  email: 'Access your email address',
  offline_access: 'Stay signed in with refresh tokens',
  roles: 'Read your assigned roles',
  groups: 'Read your group memberships',
  permissions: 'Read your effective permissions'
}

export const DEFAULT_CLIENT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'roles',
  'groups',
  'permissions'
] as const
