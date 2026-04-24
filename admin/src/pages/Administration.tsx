import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Lock, Mail, Network, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  useAdminMe,
  useAdminRiskEvents,
  useApps,
  useInstanceSettings,
  useMigrateDatabaseFromSqlite,
  useTestExternalDatabaseConnection,
  useTestInstanceEmail,
  useUpdateInstanceSettings
} from '../hooks/useApi'
import ProvisioningAdminPanel from '../components/ProvisioningAdminPanel'

interface SettingsForm {
  databaseProvider: 'sqlite' | 'postgresql' | 'mysql'
  databasePath: string
  externalDatabaseUrl: string
  requireHttps: boolean
  secureCookies: boolean
  allowAnyCorsOrigin: boolean
  corsAllowedOriginsText: string
  requireHttpsRedirectUris: boolean
  requireS256Pkce: boolean
  allowImplicitFlow: boolean
  loginFailureWindowMinutes: number
  loginLockoutThreshold: number
  loginLockoutDurationMinutes: number
  sessionAnomalyConcurrencyThreshold: number
  emailTransport: 'disabled' | 'log' | 'smtp'
  emailFrom: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  testEmailTo: string
  uiCustomizationsText: string
}

const checkboxCls = 'h-4 w-4 rounded border-slate-300 text-slate-900 accent-slate-900'
const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
const parseOrigins = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

const parseHttpOrigin = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

const defaultForm: SettingsForm = {
  databaseProvider: 'sqlite',
  databasePath: './data/sso.sqlite',
  externalDatabaseUrl: '',
  requireHttps: false,
  secureCookies: false,
  allowAnyCorsOrigin: true,
  corsAllowedOriginsText: '',
  requireHttpsRedirectUris: false,
  requireS256Pkce: true,
  allowImplicitFlow: true,
  loginFailureWindowMinutes: 15,
  loginLockoutThreshold: 5,
  loginLockoutDurationMinutes: 15,
  sessionAnomalyConcurrencyThreshold: 5,
  emailTransport: 'log',
  emailFrom: 'no-reply@example.local',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  testEmailTo: '',
  uiCustomizationsText: JSON.stringify({
    defaultBySurface: {},
    byClientId: {},
    byAppId: {}
  }, null, 2),
}

export default function Administration() {
  const { data: adminMe } = useAdminMe()
  const { data, isLoading, refetch } = useInstanceSettings()
  const { data: apps = [] } = useApps()
  const { data: riskEvents, refetch: refetchRiskEvents } = useAdminRiskEvents(15)
  const updateSettings = useUpdateInstanceSettings()
  const testEmail = useTestInstanceEmail()
  const testExternalDb = useTestExternalDatabaseConnection()
  const migrateDatabase = useMigrateDatabaseFromSqlite()
  const [form, setForm] = useState<SettingsForm>(defaultForm)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const permissions: string[] = (adminMe as any)?.permissions ?? []
  const can = (permission: string) => permissions.includes('*:*') || permissions.includes(permission)
  const appCorsOrigins = useMemo(() => {
    const origins = new Set<string>()
    for (const app of apps as any[]) {
      const appOrigin = parseHttpOrigin(app?.url)
      if (appOrigin) origins.add(appOrigin)

      const resources = Array.isArray(app?.resources) ? app.resources : []
      for (const resource of resources) {
        const resourceOrigin = parseHttpOrigin(resource)
        if (resourceOrigin) origins.add(resourceOrigin)
      }
    }
    return Array.from(origins).sort()
  }, [apps])

  const operationLinks = [
    {
      to: '/access-governance',
      title: 'Access Governance',
      description: 'Requests, approvals, stalled queue, and review campaigns.',
      permission: 'administration:view'
    },
    {
      to: '/elevations',
      title: 'Elevation Operations',
      description: 'Request, approve, activate, revoke, and break-glass elevation.',
      permission: 'administration:view'
    },
    {
      to: '/elevation-sessions',
      title: 'Elevation Sessions',
      description: 'Track active, revoked, and expired privileged sessions.',
      permission: 'administration:view'
    },
    {
      to: '/metrics',
      title: 'Auth Metrics',
      description: 'Authentication throughput trends and event distribution.',
      permission: 'connectors:view'
    }
  ].filter((item) => can(item.permission))

  useEffect(() => {
    if (!data) {
      return
    }

    setForm({
      databaseProvider: (((data as any).databaseProvider ?? 'sqlite') as SettingsForm['databaseProvider']),
      databasePath: String((data as any).databasePath ?? './data/sso.sqlite'),
      externalDatabaseUrl: String((data as any).externalDatabaseUrl ?? ''),
      requireHttps: Boolean((data as any).requireHttps),
      secureCookies: Boolean((data as any).secureCookies),
      allowAnyCorsOrigin: Boolean((data as any).allowAnyCorsOrigin),
      corsAllowedOriginsText: Array.isArray((data as any).corsAllowedOrigins) ? (data as any).corsAllowedOrigins.join('\n') : '',
      requireHttpsRedirectUris: Boolean((data as any).requireHttpsRedirectUris),
      requireS256Pkce: Boolean((data as any).requireS256Pkce),
      allowImplicitFlow: Boolean((data as any).allowImplicitFlow),
      loginFailureWindowMinutes: Math.max(1, Math.round(Number((data as any).loginFailureWindowMs ?? 15 * 60 * 1000) / 60_000)),
      loginLockoutThreshold: Number((data as any).loginLockoutThreshold ?? 5),
      loginLockoutDurationMinutes: Math.max(1, Math.round(Number((data as any).loginLockoutDurationMs ?? 15 * 60 * 1000) / 60_000)),
      sessionAnomalyConcurrencyThreshold: Number((data as any).sessionAnomalyConcurrencyThreshold ?? 5),
      emailTransport: ((data as any).emailTransport as SettingsForm['emailTransport']) ?? 'log',
      emailFrom: String((data as any).emailFrom ?? 'no-reply@example.local'),
      smtpHost: String((data as any).smtpHost ?? ''),
      smtpPort: Number((data as any).smtpPort ?? 587),
      smtpSecure: Boolean((data as any).smtpSecure ?? false),
      smtpUser: String((data as any).smtpUser ?? ''),
      smtpPass: String((data as any).smtpPass ?? ''),
      testEmailTo: String((data as any).emailFrom ?? ''),
      uiCustomizationsText: JSON.stringify((data as any).uiCustomizations ?? {
        defaultBySurface: {},
        byClientId: {},
        byAppId: {}
      }, null, 2)
    })
  }, [data])

  const save = async () => {
    try {
      setSaveMessage(null)
      setSaveError(null)
      let uiCustomizations: any
      try {
        uiCustomizations = JSON.parse(form.uiCustomizationsText)
      } catch {
        setSaveError('UI customizations must be valid JSON')
        return
      }
      await updateSettings.mutateAsync({
        databaseProvider: form.databaseProvider,
        databasePath: form.databaseProvider === 'sqlite' ? form.databasePath : undefined,
        externalDatabaseUrl: form.databaseProvider === 'sqlite' ? undefined : (form.externalDatabaseUrl || undefined),
        requireHttps: form.requireHttps,
        secureCookies: form.secureCookies,
        allowAnyCorsOrigin: form.allowAnyCorsOrigin,
        corsAllowedOrigins: form.allowAnyCorsOrigin
          ? []
          : Array.from(new Set([...parseOrigins(form.corsAllowedOriginsText), ...appCorsOrigins])),
        requireHttpsRedirectUris: form.requireHttpsRedirectUris,
        requireS256Pkce: form.requireS256Pkce,
        allowImplicitFlow: form.allowImplicitFlow,
        loginFailureWindowMs: form.loginFailureWindowMinutes * 60_000,
        loginLockoutThreshold: form.loginLockoutThreshold,
        loginLockoutDurationMs: form.loginLockoutDurationMinutes * 60_000,
        sessionAnomalyConcurrencyThreshold: form.sessionAnomalyConcurrencyThreshold,
        emailTransport: form.emailTransport,
        emailFrom: form.emailFrom,
        smtpHost: form.smtpHost || undefined,
        smtpPort: form.smtpPort,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser || undefined,
        smtpPass: form.smtpPass || undefined,
        uiCustomizations,
      })
      setSaveMessage('Instance settings saved. Some changes affect the next request immediately.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save instance settings')
    }
  }

  const sendTestEmail = async () => {
    try {
      setSaveMessage(null)
      setSaveError(null)
      await testEmail.mutateAsync({
        to: form.testEmailTo,
        subject: 'SSO test email',
        message: 'This is a test email sent from Administration settings.'
      })
      setSaveMessage('Test email submitted successfully.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to send test email')
    }
  }

  const testDatabaseConnection = async () => {
    if (form.databaseProvider === 'sqlite') {
      setSaveError('Connection test is available only for PostgreSQL/MySQL providers')
      setSaveMessage(null)
      return
    }

    try {
      setSaveMessage(null)
      setSaveError(null)
      await testExternalDb.mutateAsync({
        provider: form.databaseProvider,
        externalDatabaseUrl: form.externalDatabaseUrl
      })
      setSaveMessage('External database connection is valid.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to connect to external database')
    }
  }

  const migrateFromSqlite = async () => {
    if (form.databaseProvider === 'sqlite') {
      setSaveError('Select PostgreSQL or MySQL provider before migration')
      setSaveMessage(null)
      return
    }

    try {
      setSaveMessage(null)
      setSaveError(null)
      const result = await migrateDatabase.mutateAsync({
        provider: form.databaseProvider,
        externalDatabaseUrl: form.externalDatabaseUrl,
        sqlitePath: form.databasePath
      }) as { migratedTables?: number }
      setSaveMessage(`SQLite migration completed${typeof result?.migratedTables === 'number' ? ` (${result.migratedTables} tables)` : ''}.`)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Database migration failed')
    }
  }

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading instance settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Instance Controls</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administration</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Configure instance-wide transport, browser, OAuth, and runtime attack controls. These settings affect how the server accepts requests, issues tokens, and reacts to suspicious authentication behavior.
          </p>
        </div>
        <button onClick={() => refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Operational warning</p>
            <p className="mt-1 text-amber-800">
              Enabling HTTPS or secure cookies while you are still using plain HTTP in development can immediately block login or future admin requests.
            </p>
          </div>
        </div>
      </div>

      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Recent Security Risk Events</h2>
          </div>
          <button onClick={() => refetchRiskEvents()} className="text-xs font-medium text-slate-500 hover:text-slate-700">Refresh</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Normalized risk telemetry derived from audit activity (login failures, lockouts, anomaly detections, protocol guardrails).</p>
        <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {(riskEvents ?? []).length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No risk events recorded yet.</div>
          ) : (
            (riskEvents ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{event.title}</p>
                  <p className="text-xs text-slate-500">{event.sourceType} {event.ip ? `• ${event.ip}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${event.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : event.severity === 'high' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                    {event.severity}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <ProvisioningAdminPanel />

      <section className={sectionCls}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">Dedicated Operations Views</h2>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Governance, elevation tracking, and auth metrics now have dedicated pages for focused workflows.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {operationLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-lg border border-slate-200 bg-white p-4 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-600">{item.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                Open view <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
          {operationLinks.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              You do not currently have permission to access these dedicated operations views.
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <Network size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Database Provider</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Provider</label>
              <select
                value={form.databaseProvider}
                onChange={(e) => setForm((v) => ({ ...v, databaseProvider: e.target.value as SettingsForm['databaseProvider'] }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              >
                <option value="sqlite">SQLite</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>

            {form.databaseProvider === 'sqlite' ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SQLite Database Path</label>
                <input
                  value={form.databasePath}
                  onChange={(e) => setForm((v) => ({ ...v, databasePath: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder="./data/sso.sqlite"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">External Database URL</label>
                <input
                  value={form.externalDatabaseUrl}
                  onChange={(e) => setForm((v) => ({ ...v, externalDatabaseUrl: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder={form.databaseProvider === 'postgresql' ? 'postgresql://user:pass@host:5432/sso' : 'mysql://user:pass@host:3306/sso'}
                />
              </div>
            )}

            <p className="text-xs text-slate-500">
              Provider settings are persisted now; full PostgreSQL/MySQL runtime persistence is part of the ongoing repository rewrite.
            </p>

            {form.databaseProvider !== 'sqlite' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={testDatabaseConnection}
                  disabled={testExternalDb.isPending || !form.externalDatabaseUrl}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {testExternalDb.isPending ? 'Testing…' : 'Test Connection'}
                </button>
                <button
                  onClick={migrateFromSqlite}
                  disabled={migrateDatabase.isPending || !form.externalDatabaseUrl}
                  className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {migrateDatabase.isPending ? 'Migrating…' : 'Migrate From SQLite'}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Transport Security</h2>
          </div>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.requireHttps} onChange={(e) => setForm((v) => ({ ...v, requireHttps: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Require HTTPS</p>
                <p className="mt-1 text-slate-600">Reject non-HTTPS requests at the server edge unless they arrive through a forwarded HTTPS proxy.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.secureCookies} onChange={(e) => setForm((v) => ({ ...v, secureCookies: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Use secure cookies</p>
                <p className="mt-1 text-slate-600">Marks admin session and CSRF cookies as secure so browsers only send them over HTTPS.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.requireHttpsRedirectUris} onChange={(e) => setForm((v) => ({ ...v, requireHttpsRedirectUris: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Require HTTPS redirect URIs</p>
                <p className="mt-1 text-slate-600">Enforces HTTPS for newly created or updated client redirect URIs, except localhost development callbacks.</p>
              </div>
            </label>
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <Network size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">CORS Policy</h2>
          </div>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.allowAnyCorsOrigin} onChange={(e) => setForm((v) => ({ ...v, allowAnyCorsOrigin: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Allow any origin</p>
                <p className="mt-1 text-slate-600">Permits cross-origin requests from any browser origin. Disable this for production-grade isolation.</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Auto-Added App Origins</label>
              <div className="min-h-[48px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {appCorsOrigins.length === 0 ? (
                  <p className="text-xs text-slate-500">No app URLs or resource URLs found to auto-allow.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {appCorsOrigins.map((origin) => (
                      <span key={origin} className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono text-slate-700">
                        {origin}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">These origins are synced from app URL and app resource URLs and are included automatically when saving.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Allowed Origins</label>
              <textarea
                value={form.corsAllowedOriginsText}
                onChange={(e) => setForm((v) => ({ ...v, corsAllowedOriginsText: e.target.value }))}
                disabled={form.allowAnyCorsOrigin}
                className="min-h-[140px] w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50 disabled:text-slate-400 font-mono"
                placeholder={'https://admin.example.com\nhttps://portal.example.com'}
              />
              <p className="mt-2 text-xs text-slate-500">One origin per line. Include scheme and host, for example <span className="font-mono">https://admin.example.com</span>. Manual values here are merged with the auto-added app origins.</p>
            </div>
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">OAuth And Token Security</h2>
          </div>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.requireS256Pkce} onChange={(e) => setForm((v) => ({ ...v, requireS256Pkce: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Require S256 PKCE</p>
                <p className="mt-1 text-slate-600">Rejects plain PKCE and requires the stronger S256 code challenge method for authorization requests.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.allowImplicitFlow} onChange={(e) => setForm((v) => ({ ...v, allowImplicitFlow: e.target.checked }))} className={checkboxCls} />
              <div>
                <p className="font-medium text-slate-900">Allow implicit flow</p>
                <p className="mt-1 text-slate-600">Keeps <span className="font-mono">response_type=token</span> available. Disable this to remove the weaker implicit flow path.</p>
              </div>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Token signing algorithm</p>
              <div className="mt-2 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-mono text-emerald-700">RS256</div>
              <p className="mt-2 text-slate-600">Tokens are currently signed using RS256. This implementation remains enforced server-side.</p>
            </div>
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Runtime Attack Controls</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Login Failure Window</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={form.loginFailureWindowMinutes}
                onChange={(e) => setForm((v) => ({ ...v, loginFailureWindowMinutes: Number(e.target.value || 1) }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              />
              <p className="mt-2 text-xs text-slate-500">How long failed logins are counted before the counter resets, in minutes.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Lockout Threshold</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.loginLockoutThreshold}
                onChange={(e) => setForm((v) => ({ ...v, loginLockoutThreshold: Number(e.target.value || 1) }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              />
              <p className="mt-2 text-xs text-slate-500">Number of failed logins allowed before the account is temporarily locked.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Lockout Duration</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={form.loginLockoutDurationMinutes}
                onChange={(e) => setForm((v) => ({ ...v, loginLockoutDurationMinutes: Number(e.target.value || 1) }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              />
              <p className="mt-2 text-xs text-slate-500">How long the lockout remains active after the threshold is reached, in minutes.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Session Anomaly Concurrency</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.sessionAnomalyConcurrencyThreshold}
                onChange={(e) => setForm((v) => ({ ...v, sessionAnomalyConcurrencyThreshold: Number(e.target.value || 1) }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              />
              <p className="mt-2 text-xs text-slate-500">Raises a session anomaly event when a user exceeds this many concurrent active sessions.</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">What these controls affect</p>
            <p className="mt-2 text-slate-600">These values are applied immediately to login lockout tracking and session anomaly detection without restarting the server.</p>
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Email Delivery</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Transport</label>
              <select
                value={form.emailTransport}
                onChange={(e) => setForm((v) => ({ ...v, emailTransport: e.target.value as SettingsForm['emailTransport'] }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              >
                <option value="disabled">Disabled</option>
                <option value="log">Log only (development)</option>
                <option value="smtp">SMTP</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">From Address</label>
              <input
                type="email"
                value={form.emailFrom}
                onChange={(e) => setForm((v) => ({ ...v, emailFrom: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                placeholder="no-reply@example.com"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SMTP Host</label>
                <input
                  value={form.smtpHost}
                  onChange={(e) => setForm((v) => ({ ...v, smtpHost: e.target.value }))}
                  disabled={form.emailTransport !== 'smtp'}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50"
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SMTP Port</label>
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => setForm((v) => ({ ...v, smtpPort: Number(e.target.value || 587) }))}
                  disabled={form.emailTransport !== 'smtp'}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(e) => setForm((v) => ({ ...v, smtpSecure: e.target.checked }))}
                disabled={form.emailTransport !== 'smtp'}
                className={checkboxCls}
              />
              <div>
                <p className="font-medium text-slate-900">Use TLS (secure)</p>
                <p className="mt-1 text-slate-600">Enable for SMTPS transports, usually port 465.</p>
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SMTP Username</label>
                <input
                  value={form.smtpUser}
                  onChange={(e) => setForm((v) => ({ ...v, smtpUser: e.target.value }))}
                  disabled={form.emailTransport !== 'smtp'}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SMTP Password</label>
                <input
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm((v) => ({ ...v, smtpPass: e.target.value }))}
                  disabled={form.emailTransport !== 'smtp'}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Send Test Email</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  value={form.testEmailTo}
                  onChange={(e) => setForm((v) => ({ ...v, testEmailTo: e.target.value }))}
                  className="h-9 min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                  placeholder="you@example.com"
                />
                <button
                  onClick={sendTestEmail}
                  disabled={testEmail.isPending || !form.testEmailTo}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {testEmail.isPending ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionCls}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Experience Customization</h2>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Manage login, consent, and portal branding in the dedicated Experience Customization workspace.
            </p>
            <p className="text-xs text-slate-500">
              The dedicated editor supports default, client, and app scopes with guided fields and preview.
            </p>
            <Link
              to="/experience-customization"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Open Experience Customization
            </Link>
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-900">What Changes Immediately</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>HTTPS requirement is applied on the next incoming request.</li>
            <li>CORS origin policy is checked on the next browser preflight or cross-origin request.</li>
            <li>Cookie security changes affect the next issued CSRF or session cookie.</li>
            <li>Redirect URI and PKCE enforcement apply to subsequent client changes and authorize requests.</li>
            <li>Disabling implicit flow immediately blocks new <span className="font-mono">response_type=token</span> authorize requests.</li>
            <li>Lockout and anomaly thresholds are applied immediately to new authentication and session observation events.</li>
            <li>Database provider settings are persisted immediately and take effect once the backend storage rewrite path is activated.</li>
            <li>Email transport settings are used immediately for recovery and other email-driven flows.</li>
          </ul>
        </section>
      </div>

      {(saveMessage || saveError) ? (
        <div className={`rounded-xl border p-4 text-sm shadow-sm ${saveError ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {saveError ?? saveMessage}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={updateSettings.isPending}
          className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {updateSettings.isPending ? 'Saving…' : 'Save Instance Settings'}
        </button>
      </div>
    </div>
  )
}