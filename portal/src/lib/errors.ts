const humanizeFieldName = (path: unknown) => {
  if (!Array.isArray(path) || path.length === 0) return 'Request'
  const last = String(path[path.length - 1])
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
}

const formatValidationIssue = (issue: any) => {
  const field = humanizeFieldName(issue?.path)
  if (issue?.code === 'invalid_string' && issue?.validation === 'email') {
    return `${field} must be a valid email address`
  }
  if (issue?.code === 'too_small' && issue?.type === 'string') {
    if (issue?.minimum === 1) return `${field} is required`
    return `${field} must be at least ${issue?.minimum} characters`
  }
  if (typeof issue?.message === 'string' && issue.message.trim()) {
    return `${field}: ${issue.message}`
  }
  return null
}

const LOGIN_CREDENTIAL_ERROR_MESSAGES = new Set([
  'Incorrect username or password',
  'Invalid credentials',
])

const isAccountLockedPayload = (payload: any) =>
  !!payload && typeof payload === 'object' && (payload.code === 'account_locked' || payload.error === 'AccountLockedError')

const lockedRetryMinutes = (payload: any) => {
  const seconds = Number(payload?.retryAfterSeconds)
  if (Number.isFinite(seconds) && seconds > 0) return String(Math.max(1, Math.ceil(seconds / 60)))
  return '15'
}

export const resolveLoginCredentialError = (
  errorPayload: unknown,
  localizedMessage: string,
  t?: (key: string, params?: Record<string, string>) => string,
) => {
  if (isAccountLockedPayload(errorPayload) && t) {
    return t('login.accountLocked', { minutes: lockedRetryMinutes(errorPayload) })
  }
  const message = extractErrorMessage(errorPayload, '')
  if (!message || LOGIN_CREDENTIAL_ERROR_MESSAGES.has(message)) {
    return localizedMessage
  }
  return message
}

export const extractErrorMessage = (errorPayload: any, fallback: string) => {
  if (typeof errorPayload === 'string' && errorPayload.trim()) return errorPayload
  if (!errorPayload || typeof errorPayload !== 'object') return fallback
  if (Array.isArray(errorPayload.details) && errorPayload.details.length > 0) {
    const message = formatValidationIssue(errorPayload.details[0])
    if (message) return message
  }
  if (typeof errorPayload.message === 'string' && errorPayload.message.trim() && errorPayload.message !== 'Request validation failed') return errorPayload.message
  if (typeof errorPayload.error_description === 'string' && errorPayload.error_description.trim()) return errorPayload.error_description
  if (typeof errorPayload.detail === 'string' && errorPayload.detail.trim()) return errorPayload.detail
  if (typeof errorPayload.error === 'string' && errorPayload.error.trim()) return errorPayload.error
  if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) return errorPayload.message
  return fallback
}
