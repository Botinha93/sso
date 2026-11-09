import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'

const enabled = process.env.NEXUSID_HUB_INSTALLER_WIZARD_BROWSER_ACCEPTANCE === '1'
const port = Number(process.env.NEXUSID_RESOURCE_PROCESS_PORT)
const apiOrigin = `http://127.0.0.1:${port}`
const uiOrigin = 'http://127.0.0.1:4179'
const password = 'Disposable-Admin-Pass-42'

async function json(response) {
  const raw = await response.text()
  let body
  try { body = JSON.parse(raw) } catch { body = null }
  return { status: response.status, body, raw }
}

async function waitForVite(child) {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Admin Vite exited early (${child.exitCode})`)
    try { if ((await fetch(uiOrigin)).ok) return } catch {}
    await delay(200)
  }
  throw new Error('Timed out waiting for the NexusID Admin Vite server')
}

test('live NexusID Admin wizard resumes after an issuer outage and downloads real issuer credentials', {
  skip: !enabled && 'Set NEXUSID_HUB_INSTALLER_WIZARD_BROWSER_ACCEPTANCE=1 through the disposable issuer process harness',
  timeout: 180_000,
}, async t => {
  assert.ok(Number.isInteger(port) && port > 0, 'the issuer process harness must provide its live API port')

  const initialize = await fetch(`${apiOrigin}/api/setup/initialize`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Disposable NexusHub Wizard Admin', email: 'admin@example.test', username: 'admin', password,
      databaseProvider: process.env.DATABASE_PROVIDER, externalDatabaseUrl: process.env.DATABASE_URL,
    }),
  }).then(json)
  assert.equal(initialize.status, 201, initialize.raw)

  const vite = spawn('npm', ['run', 'dev:admin', '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXUSID_ADMIN_API_PROXY_TARGET: apiOrigin },
  })
  let viteOutput = ''
  vite.stdout.on('data', chunk => { viteOutput += chunk.toString() })
  vite.stderr.on('data', chunk => { viteOutput += chunk.toString() })
  t.after(async () => {
    if (vite.exitCode === null) vite.kill('SIGTERM')
    await new Promise(resolve => vite.once('exit', resolve))
  })
  await waitForVite(vite)

  const browser = await chromium.launch({ headless: true })
  t.after(() => browser.close())
  const context = await browser.newContext({ acceptDownloads: true })
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  const calls = { identities: [], credentials: [], enrollments: [] }
  let enrollmentResult
  let injectedOutage = false
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST' && path === '/api/admin/service-identities') calls.identities.push(request.postDataJSON())
    if (request.method() === 'POST' && /\/api\/admin\/service-identities\/[^/]+\/credentials$/.test(path)) calls.credentials.push(path)
    if (request.method() === 'PUT' && /\/api\/admin\/service-identities\/[^/]+\/nexushub-enrollment$/.test(path)) calls.enrollments.push(path)
  })
  page.on('response', response => {
    if (response.status() === 201 && /\/api\/admin\/service-identities\/[^/]+\/nexushub-enrollment$/.test(new URL(response.url()).pathname)) {
      void response.json().then(body => { enrollmentResult = body.data }).catch(() => {})
    }
  })
  await page.route('**/api/admin/service-identities/*/nexushub-enrollment', async route => {
    if (!injectedOutage && route.request().method() === 'PUT') {
      injectedOutage = true
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled temporary NexusID issuer outage' }) })
      return
    }
    await route.continue()
  })

  try {
    await page.goto(`${uiOrigin}/login`)
    await page.getByLabel('Email or Username').fill('admin@example.test')
    await page.getByRole('textbox', { name: 'Password' }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('link', { name: 'Service Identities' }).click()
    await page.getByRole('button', { name: 'Prepare NexusHub' }).click()
    await page.getByLabel('NexusHub public origin').fill('https://hub.acceptance.example.test')
    await page.getByLabel('LiberIDE API origin (optional)').fill('https://ide.acceptance.example.test')
    await page.getByRole('button', { name: 'Create and enroll' }).click()
    await page.getByText('Controlled temporary NexusID issuer outage').waitFor()
    assert.equal(injectedOutage, true)
    await page.getByRole('button', { name: 'Resume setup' }).click()
    await page.getByText('NexusID setup complete').waitFor()

    assert.equal(calls.identities.length, 2, 'the real issuer created exactly the provisioner and runner identities')
    assert.equal(calls.credentials.length, 2, 'the real issuer issued exactly one credential for each identity')
    assert.equal(calls.enrollments.length, 2, 'resume retried only enrollment after the controlled 503')
    assert.ok(enrollmentResult?.installationId, 'successful enrollment response came from the live NexusID issuer')
    assert.deepEqual(calls.identities[0].allowedScopes, [])
    assert.deepEqual(calls.identities[0].allowedAudiences, [])
    assert.deepEqual(calls.identities[0].roleIds, [])

    const list = await page.evaluate(async () => {
      const response = await fetch('/api/admin/service-identities', { credentials: 'include' })
      return { status: response.status, body: await response.json() }
    })
    assert.equal(list.status, 200)
    const identities = list.body.data
    assert.equal(identities.length, 2)
    const provisioner = identities.find(item => item.name.startsWith('NexusHub provisioning ('))
    const runner = identities.find(item => item.name.startsWith('NexusHub LiberIDE build runner ('))
    assert.ok(provisioner?.id && runner?.id)
    const runnerDetail = await page.evaluate(async id => {
      const response = await fetch(`/api/admin/service-identities/${encodeURIComponent(id)}`, { credentials: 'include' })
      return { status: response.status, body: await response.json() }
    }, runner.id)
    assert.equal(runnerDetail.status, 200)
    const hubClientId = `nh_${createHash('sha256').update(`nexushub-installation:${enrollmentResult.installationId}`).digest('hex').slice(0, 40)}`
    assert.deepEqual([...runnerDetail.body.allowedScopes].sort(), [
      'nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import',
    ].sort())
    assert.deepEqual(runnerDetail.body.allowedAudiences, [hubClientId])
    assert.deepEqual(runnerDetail.body.roleIds ?? [], [])

    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download credential bundle' }).click()
    const download = await downloadEvent
    assert.equal(download.suggestedFilename(), 'nexushub-issuer-credentials.json')
    const credentialBundle = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'))
    assert.equal(credentialBundle.issuerSetup.publicOrigin, 'https://hub.acceptance.example.test')
    assert.equal(credentialBundle.issuerSetup.provisioningIdentityId, provisioner.id)
    assert.equal(credentialBundle.issuerSetup.installationId, enrollmentResult.installationId)
    assert.equal(credentialBundle.issuerSetup.hubClientId, hubClientId)
    assert.equal(credentialBundle.buildRunner.identityId, runner.id)
    assert.ok(credentialBundle.issuerSetup.provisioningClientSecret)
    assert.ok(credentialBundle.buildRunner.clientSecret)
    assert.deepEqual(credentialBundle.buildRunner.allowedScopes, runnerDetail.body.allowedScopes)
    assert.deepEqual(errors, [], `browser had no uncaught errors: ${errors.join('; ')}; Vite output: ${viteOutput.slice(-1000)}`)
  } finally {
    await context.close()
    await browser.close()
  }
})
