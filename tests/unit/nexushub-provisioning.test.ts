import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canonicalHttpsOrigin,
  prepareNexusHubSetup,
  serializeNexusHubCredentials,
  type NexusHubSetupApi,
  type NexusHubSetupBundle,
} from '../../admin/src/lib/nexushub-provisioning.ts'

function fakeApi(overrides: Partial<NexusHubSetupApi> = {}) {
  const calls: { create: Parameters<NexusHubSetupApi['createIdentity']>[0][]; issue: string[]; enroll: Parameters<NexusHubSetupApi['enroll']>[0][] } = { create: [], issue: [], enroll: [] }
  const api: NexusHubSetupApi = {
    createIdentity: async input => {
      calls.create.push(input)
      return { id: `identity-${calls.create.length}` }
    },
    issueCredential: async input => {
      calls.issue.push(input.id)
      return { credential: { clientId: `client-${calls.issue.length}`, id: `credential-${calls.issue.length}` }, plainClientSecret: `secret-${calls.issue.length}` }
    },
    enroll: async input => {
      calls.enroll.push(input)
      return { data: { installationId: 'installation-1' } }
    },
    ...overrides,
  }
  return { api, calls }
}

test('NexusHub setup enrolls exact origins and gives the runner only two scopes, one audience and no roles', async () => {
  assert.equal(canonicalHttpsOrigin('https://hub.example.test/'), 'https://hub.example.test')
  assert.throws(() => canonicalHttpsOrigin('http://hub.example.test'), /canonical HTTPS origin/)
  assert.throws(() => canonicalHttpsOrigin('https://hub.example.test/path'), /canonical HTTPS origin/)

  const { api, calls } = fakeApi()
  const progress: NexusHubSetupBundle[] = []
  const result = await prepareNexusHubSetup({
    publicOrigin: 'https://hub.example.test', liberideOrigin: 'https://ide.example.test',
  }, 365, api, bundle => progress.push(bundle))

  assert.deepEqual(calls.enroll[0], {
    id: 'identity-1', credentialId: 'credential-1', publicOrigin: 'https://hub.example.test',
    liberideOrigin: 'https://ide.example.test',
  })
  assert.deepEqual(calls.create[0], {
    name: 'NexusHub provisioning (hub.example.test)',
    description: 'Least-privilege NexusHub installer identity; no roles or OAuth scopes.',
    status: 'active', allowedScopes: [], allowedAudiences: [], roleIds: [], groupIds: [],
  })
  assert.deepEqual(calls.create[1].allowedScopes, [
    'nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import',
  ])
  assert.deepEqual(calls.create[1].allowedAudiences, [result.hubClientId])
  assert.deepEqual(calls.create[1].roleIds, [])
  assert.deepEqual(calls.create[1].groupIds, [])
  assert.equal(calls.create[1].status, 'active')
  assert.equal(result.provisionerSecret, 'secret-1')
  assert.equal(result.runnerSecret, 'secret-2')
  assert.ok(progress.some(bundle => bundle.provisionerSecret === 'secret-1'))

  const exported = JSON.parse(serializeNexusHubCredentials(result))
  assert.equal(exported.issuerSetup.provisioningClientSecret, 'secret-1')
  assert.equal(exported.buildRunner.clientSecret, 'secret-2')
  assert.equal(exported.buildRunner.audience, result.hubClientId)
  assert.deepEqual(exported.buildRunner.allowedScopes, calls.create[1].allowedScopes)
})

test('a failed enrollment can resume without duplicating identities or reissuing secrets', async () => {
  let failEnrollment = true
  const { api, calls } = fakeApi({
    enroll: async input => {
      calls.enroll.push(input)
      if (failEnrollment) throw new Error('temporary issuer outage')
      return { data: { installationId: 'installation-1' } }
    },
  })
  const partial: NexusHubSetupBundle[] = []
  await assert.rejects(
    prepareNexusHubSetup({ publicOrigin: 'https://hub.example.test' }, 365, api, bundle => partial.push(bundle)),
    /temporary issuer outage/,
  )
  const checkpoint = partial.at(-1)!
  assert.equal(checkpoint.provisionerIdentityId, 'identity-1')
  assert.equal(checkpoint.provisionerSecret, 'secret-1')
  assert.equal(calls.create.length, 1)
  assert.equal(calls.issue.length, 1)

  failEnrollment = false
  const result = await prepareNexusHubSetup(checkpoint, 365, api, () => {})
  assert.equal(calls.create.length, 2) // only the runner is created on resume
  assert.deepEqual(calls.issue, ['identity-1', 'identity-2'])
  assert.equal(calls.enroll.length, 2)
  assert.equal(result.provisionerIdentityId, 'identity-1')
  assert.equal(result.provisionerSecret, 'secret-1')
  assert.equal(result.runnerIdentityId, 'identity-2')
  assert.equal(result.runnerSecret, 'secret-2')
})
