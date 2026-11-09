const OAUTH_CONTINUATION_PARAMETERS = [
  'response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'nonce',
  'code_challenge', 'code_challenge_method', 'response_mode', 'prompt', 'resource',
  'nexushub_profile', 'nexushub_installation_id', 'resource_audience',
] as const

/** Return only an issuer-local authorization route, retaining a valid code-flow request. */
export function oauthLoginContinuation(search: string): string | undefined {
  const incoming = new URLSearchParams(search)
  return buildContinuation(incoming)
}

export function oauthConsentContinuation(authorization: Record<string, string>, decision: 'approve' | 'deny'): string | undefined {
  return buildContinuation(new URLSearchParams(authorization), decision)
}

function buildContinuation(incoming: URLSearchParams, decision?: 'approve' | 'deny'): string | undefined {
  const clientId = incoming.get('client_id')
  const redirectUri = incoming.get('redirect_uri')
  const responseType = incoming.get('response_type')
  const state = incoming.get('state')
  const nonce = incoming.get('nonce')
  const challenge = incoming.get('code_challenge')
  const challengeMethod = incoming.get('code_challenge_method')
  const scope = incoming.get('scope')
  if (!clientId || !redirectUri || responseType !== 'code' || !state || !nonce || !challenge ||
      challengeMethod !== 'S256' || !scope) return undefined

  try {
    const callback = new URL(redirectUri)
    if (!['http:', 'https:'].includes(callback.protocol) || callback.username || callback.password || callback.hash) return undefined
  } catch {
    return undefined
  }

  const continuation = new URLSearchParams()
  for (const key of OAUTH_CONTINUATION_PARAMETERS) {
    const value = incoming.get(key)
    if (value !== null) continuation.set(key, value)
  }
  // The login UI has just reauthenticated the selected user; skip the
  // issuer's subsequent account-selection prompt without changing OIDC state.
  continuation.set('account_selection', 'continue')
  if (decision === 'deny') continuation.set('consent', 'deny')
  return `/oauth/authorize?${continuation.toString()}`
}
