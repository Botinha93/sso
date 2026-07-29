export type ScopeType = 'global' | 'tenant' | 'group' | 'user'
export type PolicyCategory = 'authentication' | 'authorization'
export type PolicyDecisionStrategy = 'deny_overrides' | 'allow_overrides' | 'first_applicable'
export type AuthStageType =
  | 'password'
  | 'federation'
  | 'consent'
  | 'mfa_totp'
  | 'risk_check'
  | 'identification'
  | 'email_verification'
  | 'captcha'
  | 'prompt'
  | 'user_write'
  | 'user_login'
  | 'user_logout'

export const AUTH_STAGES: AuthStageType[] = [
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

export const exampleConfigs: Record<string, string> = {
  password_requirements: '{"minLength":12,"requireUppercase":true,"requireLowercase":true,"requireNumber":true,"requireSymbol":true}',
  password_expiration_days: '{"days":90,"warnDaysBefore":14}',
  unique_email: '{"enabled":true}',
  two_factor_required: '{"required":true}',
  brute_force_lockout: '{"maxAttempts":5,"windowMinutes":15,"lockMinutes":30}',
  new_device_verification: '{"requireStepUp":true,"trustedDeviceTtlDays":30}',
  impossible_travel_risk: '{"maxKmPerHour":900,"action":"challenge"}',
  restricted_login_hours: '{"timezone":"UTC","allowedHours":[8,20],"allowedWeekdays":[1,2,3,4,5]}',
  ip_allowlist: '{"allowCidrs":["10.0.0.0/8","192.168.0.0/16"],"enforceForAdmins":true}',
  session_concurrency_limit: '{"maxActiveSessions":3,"strategy":"revoke_oldest"}',
  reauth_for_sensitive_actions: '{"reauthMinutes":15}',
  tenant_isolation_guard: '{"strictTenantAudience":true,"denyCrossTenantScopes":true}',
  service_user_constraints: '{"requireServiceUser":true,"denyInteractiveLogin":true,"allowedGrants":["client_credentials"]}',
  token_hardening: '{"requireNarrowScopes":true,"maxAccessTokenMinutes":10}',
  consent_freshness: '{"reconsentDays":180,"forceOnScopeIncrease":true}',
  attribute_completeness: '{"requiredAttributes":["department","employee_id"]}',
}

export const defaultJsTemplate = `// policy interfaces:
// policy.key            -> string
// policy.name           -> string
// policy.stage          -> stage being evaluated
// policy.assignment     -> { enabled, config }
// policy.user           -> authenticated user profile + customAttributes
// policy.request        -> { tenantId, clientId, ip, resource, action, context }
// now()                 -> helper returning current ISO timestamp
//
// return styles:
// - true / undefined -> allow
// - false -> deny with generic message
// - "message" -> deny with custom message
// - { allow: false, message: "reason" } -> deny with custom message

if (policy.user.customAttributes.account_locked === 'true') {
  return { allow: false, message: 'Account is currently locked by policy.' }
}

return true
`

export const DECISION_STRATEGIES: PolicyDecisionStrategy[] = [
  'deny_overrides',
  'allow_overrides',
  'first_applicable',
]
