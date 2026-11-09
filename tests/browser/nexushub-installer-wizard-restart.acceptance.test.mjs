import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

const enabled = process.env.NEXUSID_HUB_INSTALLER_WIZARD_RESTART_ACCEPTANCE === '1'
const apiOrigin = `http://127.0.0.1:${Number(process.env.NEXUSID_RESOURCE_PROCESS_PORT)}`

test('NexusHub issuer identities and exact permissions survive an API process restart', { skip: !enabled }, async () => {
  const login = await fetch(`${apiOrigin}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'Disposable-Admin-Pass-42', clientId: 'sso-admin-ui', scope: ['openid', 'profile', 'email'] }),
  })
  assert.equal(login.status, 200, await login.clone().text())
  const cookies = (login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') ?? ''])
    .map(value => value.split(';')[0]).filter(Boolean)
  assert.ok(cookies.some(value => value.startsWith('sid=')), 'admin session was re-established against restarted issuer')

  const headers = { cookie: cookies.join('; ') }
  const listed = await fetch(`${apiOrigin}/api/admin/service-identities`, { headers })
  assert.equal(listed.status, 200, await listed.clone().text())
  const identities = (await listed.json()).data
  const provisioning = identities.filter(item => item.name === 'NexusHub provisioning (hub.acceptance.example.test)')
  const runners = identities.filter(item => item.name === 'NexusHub LiberIDE build runner (hub.acceptance.example.test)')
  assert.equal(provisioning.length, 1, 'the issuer persisted exactly one provisioning identity')
  assert.equal(runners.length, 1, 'the issuer persisted exactly one build-runner identity')

  const [provisionerResponse, runnerResponse] = await Promise.all([
    fetch(`${apiOrigin}/api/admin/service-identities/${encodeURIComponent(provisioning[0].id)}`, { headers }),
    fetch(`${apiOrigin}/api/admin/service-identities/${encodeURIComponent(runners[0].id)}`, { headers }),
  ])
  assert.equal(provisionerResponse.status, 200)
  assert.equal(runnerResponse.status, 200)
  const [provisioner, runner] = await Promise.all([provisionerResponse.json(), runnerResponse.json()])
  assert.deepEqual(provisioner.allowedScopes, [])
  assert.deepEqual(provisioner.roleIds ?? [], [])
  assert.deepEqual(provisioner.groupIds ?? [], [])
  assert.ok(provisioner.allowedAudiences.includes('urn:nexusid:nexushub:client-provisioning'))
  const enrollment = provisioner.metadata?.nexushub_enrollment
  assert.equal(enrollment?.status, 'active')
  assert.ok(enrollment.installationId)
  assert.equal(enrollment.publicOrigin, 'https://hub.acceptance.example.test')
  assert.equal(enrollment.liberideOrigin, 'https://ide.acceptance.example.test')
  assert.deepEqual(enrollment.profileVersions, ['nexushub:1', 'liberide:1'])

  const expectedAudience = `nh_${createHash('sha256').update(`nexushub-installation:${enrollment.installationId}`).digest('hex').slice(0, 40)}`
  assert.deepEqual([...runner.allowedScopes].sort(), [
    'nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import',
  ].sort())
  assert.deepEqual(runner.allowedAudiences, [expectedAudience])
  assert.deepEqual(runner.roleIds ?? [], [])
  assert.deepEqual(runner.groupIds ?? [], [])
  for (const identity of [provisioner, runner]) {
    assert.ok(Array.isArray(identity.credentials) && identity.credentials.length === 1, 'one credential record remains attached')
    assert.ok(identity.credentials.every(credential => !('plainClientSecret' in credential) && !('clientSecret' in credential)), 'readback never re-discloses one-time secrets')
  }
})
