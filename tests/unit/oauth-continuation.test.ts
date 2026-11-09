import assert from 'node:assert/strict'
import test from 'node:test'
import { oauthConsentContinuation, oauthLoginContinuation } from '../../portal/src/lib/oauth-continuation.ts'

const valid = new URLSearchParams({
  response_type: 'code', client_id: 'client-1', redirect_uri: 'https://hub.example.test/auth/callback',
  scope: 'openid profile', state: 'state-value', nonce: 'nonce-value',
  code_challenge: 'pkce-value', code_challenge_method: 'S256',
})

test('login continuation preserves the PKCE authorization request on the issuer-local route', () => {
  valid.set('password', 'must-not-leak')
  valid.set('return_to', 'https://attacker.example/')
  const result = oauthLoginContinuation(`?${valid}`)
  assert.ok(result)
  const url = new URL(result, 'https://issuer.example')
  assert.equal(url.origin, 'https://issuer.example')
  assert.equal(url.pathname, '/oauth/authorize')
  assert.equal(url.searchParams.get('state'), 'state-value')
  assert.equal(url.searchParams.get('nonce'), 'nonce-value')
  assert.equal(url.searchParams.get('code_challenge'), 'pkce-value')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('account_selection'), 'continue')
  assert.equal(url.searchParams.has('password'), false)
  assert.equal(url.searchParams.has('return_to'), false)
})

test('login continuation rejects incomplete, non-code, non-S256, and credential-bearing callback URLs', () => {
  assert.equal(oauthLoginContinuation('?client_id=x'), undefined)
  const implicit = new URLSearchParams(valid); implicit.set('response_type', 'token')
  assert.equal(oauthLoginContinuation(`?${implicit}`), undefined)
  const weakPkce = new URLSearchParams(valid); weakPkce.set('code_challenge_method', 'plain')
  assert.equal(oauthLoginContinuation(`?${weakPkce}`), undefined)
  const credentialCallback = new URLSearchParams(valid); credentialCallback.set('redirect_uri', 'https://user:pass@hub.example.test/callback')
  assert.equal(oauthLoginContinuation(`?${credentialCallback}`), undefined)
})

test('consent decision resumes the same issuer-local request and denial carries consent=deny', () => {
  const authorization = Object.fromEntries(valid.entries())
  authorization.external_return = 'https://attacker.example/'
  const approved = new URL(oauthConsentContinuation(authorization, 'approve')!, 'https://issuer.example')
  assert.equal(approved.origin, 'https://issuer.example')
  assert.equal(approved.pathname, '/oauth/authorize')
  assert.equal(approved.searchParams.get('state'), 'state-value')
  assert.equal(approved.searchParams.get('nonce'), 'nonce-value')
  assert.equal(approved.searchParams.get('code_challenge'), 'pkce-value')
  assert.equal(approved.searchParams.get('consent'), null)
  assert.equal(approved.searchParams.has('external_return'), false)
  const denied = new URL(oauthConsentContinuation(authorization, 'deny')!, 'https://issuer.example')
  assert.equal(denied.searchParams.get('consent'), 'deny')
  assert.equal(denied.searchParams.get('state'), 'state-value')
})

test('NexusHub resource consent preserves only the exact installation and resource binding', () => {
  const authorization = Object.fromEntries(valid.entries())
  authorization.nexushub_profile = 'nexushub:1'
  authorization.nexushub_installation_id = 'hub-installation-17'
  authorization.resource_audience = 'https://context.example/resources'
  authorization.nexushub_actor_app_id = 'untrusted-extra-field'
  const approved = new URL(oauthConsentContinuation(authorization, 'approve')!, 'https://issuer.example')
  assert.equal(approved.searchParams.get('nexushub_profile'), 'nexushub:1')
  assert.equal(approved.searchParams.get('nexushub_installation_id'), 'hub-installation-17')
  assert.equal(approved.searchParams.get('resource_audience'), 'https://context.example/resources')
  assert.equal(approved.searchParams.has('nexushub_actor_app_id'), false)
  const denied = new URL(oauthConsentContinuation(authorization, 'deny')!, 'https://issuer.example')
  assert.equal(denied.searchParams.get('consent'), 'deny')
  assert.equal(denied.searchParams.get('nexushub_installation_id'), 'hub-installation-17')
})
