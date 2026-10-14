// Example: PKCE helper utilities for mobile/native app style login

import { createHash, randomBytes } from 'node:crypto'

export function createCodeVerifier() {
  return randomBytes(32).toString('base64url')
}

export function createCodeChallenge(codeVerifier) {
  return createHash('sha256').update(codeVerifier).digest('base64url')
}

if (process.argv[1]?.endsWith('pkce.js')) {
  const verifier = createCodeVerifier()
  const challenge = createCodeChallenge(verifier)
  console.log(JSON.stringify({ verifier, challenge, method: 'S256' }, null, 2))
}
