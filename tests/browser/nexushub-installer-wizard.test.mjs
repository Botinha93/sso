import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:4179'

async function waitForVite(child) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early (${child.exitCode})`)
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {}
    await delay(200)
  }
  throw new Error('Timed out waiting for the NexusID Admin Vite server')
}

test('Prepare NexusHub wizard resumes after enrollment failure and downloads one-time credentials', async t => {
  const vite = spawn('npm', ['run', 'dev:admin', '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  })
  let viteOutput = ''
  vite.stdout.on('data', chunk => { viteOutput += chunk.toString() })
  vite.stderr.on('data', chunk => { viteOutput += chunk.toString() })
  t.after(() => vite.kill('SIGTERM'))
  await waitForVite(vite)

  const browser = await chromium.launch({ headless: true })
  t.after(() => browser.close())
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  const calls = { identities: [], credentialIdentityIds: [], enrollments: [] }
  let enrollmentShouldFail = true

  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/api/setup/status') return json({ requiresSetup: false })
    if (path === '/api/admin/me') return json({ id: 'admin-1', name: 'Test Admin', email: 'admin@example.test', username: 'admin', permissions: ['service_identities:view'] })
    if (path === '/api/csrf-token') return json({ csrf_token: 'browser-test-csrf' })
    if (path === '/api/admin/service-identities' && method === 'GET') return json({ data: [] })
    if (path === '/api/admin/scopes') return json({ data: [] })
    if (path === '/api/admin/roles') return json({ data: [] })
    if (path === '/api/admin/groups') return json({ data: [] })

    if (path === '/api/admin/service-identities' && method === 'POST') {
      const input = request.postDataJSON()
      calls.identities.push(input)
      return json({ id: `identity-${calls.identities.length}` }, 201)
    }
    const issue = path.match(/^\/api\/admin\/service-identities\/(identity-\d+)\/credentials$/)
    if (issue && method === 'POST') {
      calls.credentialIdentityIds.push(issue[1])
      const number = calls.credentialIdentityIds.length
      return json({ credential: { clientId: `client-${number}`, id: `credential-${number}` }, plainClientSecret: `secret-${number}` }, 201)
    }
    const enrollment = path.match(/^\/api\/admin\/service-identities\/(identity-\d+)\/nexushub-enrollment$/)
    if (enrollment && method === 'PUT') {
      calls.enrollments.push({ id: enrollment[1], ...request.postDataJSON() })
      if (enrollmentShouldFail) {
        enrollmentShouldFail = false
        return json({ message: 'temporary issuer outage' }, 503)
      }
      return json({ data: { installationId: 'installation-browser-test' } })
    }
    return json({ message: `Unexpected browser test request: ${method} ${path}` }, 500)
  })

  const browserErrors = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto(`${origin}/service-identities`)
  await page.getByRole('button', { name: 'Prepare NexusHub' }).click()
  await page.getByLabel('NexusHub public origin').fill('https://hub.example.test')
  await page.getByLabel('LiberIDE API origin (optional)').fill('https://ide.example.test')
  await page.getByRole('button', { name: 'Create and enroll' }).click()

  await page.getByText('temporary issuer outage').waitFor()
  await page.getByRole('button', { name: 'Resume setup' }).click()
  await page.getByText('NexusID setup complete').waitFor()

  assert.equal(calls.identities.length, 2, 'resume creates only the runner identity after the issuer outage')
  assert.deepEqual(calls.credentialIdentityIds, ['identity-1', 'identity-2'], 'resume does not reissue the already returned provisioning secret')
  assert.equal(calls.enrollments.length, 2)
  const expectedHubClientId = `nh_${createHash('sha256').update('nexushub-installation:installation-browser-test').digest('hex').slice(0, 40)}`
  assert.deepEqual(calls.enrollments[1], {
    id: 'identity-1', credentialId: 'credential-1', publicOrigin: 'https://hub.example.test', liberideOrigin: 'https://ide.example.test',
  })
  assert.deepEqual(calls.identities[0].roleIds, [])
  assert.deepEqual(calls.identities[1].allowedScopes, ['nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import'])
  assert.deepEqual(calls.identities[1].allowedAudiences, [expectedHubClientId])
  assert.deepEqual(calls.identities[1].roleIds, [])

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download credential bundle' }).click()
  const download = await downloadEvent
  assert.equal(download.suggestedFilename(), 'nexushub-issuer-credentials.json')
  const downloadPath = await download.path()
  const credentials = JSON.parse(await (await import('node:fs/promises')).readFile(downloadPath, 'utf8'))
  assert.equal(credentials.issuerSetup.provisioningClientSecret, 'secret-1')
  assert.equal(credentials.issuerSetup.installationId, 'installation-browser-test')
  assert.equal(credentials.buildRunner.clientSecret, 'secret-2')
  assert.equal(credentials.buildRunner.clientId, 'client-2')
  assert.deepEqual(credentials.buildRunner.allowedScopes, ['nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import'])
  assert.equal(credentials.buildRunner.audience, expectedHubClientId)
  assert.deepEqual(browserErrors, [], `browser had no uncaught errors: ${browserErrors.join('; ')}`)
  await context.close()
})
