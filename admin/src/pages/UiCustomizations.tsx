import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApps, useClients, useInstanceSettings, useUpdateInstanceSettings } from '../hooks/useApi'
import ColorInput from '../components/ColorInput'

type UiSurface = 'admin_login' | 'consent' | 'portal_login' | 'portal_launcher'

type UiSurfaceCustomization = {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

type UiCustomizationSettings = {
  defaultBySurface: Record<string, UiSurfaceCustomization>
  byClientId: Record<string, Record<string, UiSurfaceCustomization>>
  byAppId: Record<string, Record<string, UiSurfaceCustomization>>
}

type Scope = 'default' | 'client' | 'app'

const surfaces: Array<{ key: UiSurface; label: string; route: string }> = [
  { key: 'admin_login', label: 'Admin Login', route: '/login' },
  { key: 'consent', label: 'Consent', route: '/consent' },
  { key: 'portal_login', label: 'Portal Login', route: '/portal/login' },
  { key: 'portal_launcher', label: 'Portal Launcher', route: '/portal' },
]

const fieldCls = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500'
const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

const emptyDraft: UiSurfaceCustomization = {
  title: '',
  subtitle: '',
  logoUrl: '',
  primaryColor: '',
  accentColor: '',
  backgroundCss: '',
}

function normalize(input: any): UiCustomizationSettings {
  return {
    defaultBySurface: typeof input?.defaultBySurface === 'object' && input.defaultBySurface ? input.defaultBySurface : {},
    byClientId: typeof input?.byClientId === 'object' && input.byClientId ? input.byClientId : {},
    byAppId: typeof input?.byAppId === 'object' && input.byAppId ? input.byAppId : {},
  }
}

function cleanDraft(draft: UiSurfaceCustomization): UiSurfaceCustomization {
  const out: UiSurfaceCustomization = {}
  const entries: Array<keyof UiSurfaceCustomization> = ['title', 'subtitle', 'logoUrl', 'primaryColor', 'accentColor', 'backgroundCss']
  for (const key of entries) {
    const value = draft[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) out[key] = trimmed
    }
  }
  return out
}

function isEmptyCustomization(customization: UiSurfaceCustomization) {
  return Object.keys(customization).length === 0
}

export default function UiCustomizations() {
  const { data: settings, isLoading, refetch } = useInstanceSettings()
  const { data: clients = [] } = useClients()
  const { data: apps = [] } = useApps()
  const updateSettings = useUpdateInstanceSettings()

  const [config, setConfig] = useState<UiCustomizationSettings>(normalize(null))
  const [scope, setScope] = useState<Scope>('default')
  const [surface, setSurface] = useState<UiSurface>('admin_login')
  const [clientId, setClientId] = useState('')
  const [appId, setAppId] = useState('')
  const [draft, setDraft] = useState<UiSurfaceCustomization>(emptyDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setConfig(normalize((settings as any)?.uiCustomizations))
  }, [settings])

  const clientOptions = useMemo(
    () => (clients as any[]).map((client: any) => ({ id: String(client.id), name: String(client.name ?? client.id) })),
    [clients]
  )

  const appOptions = useMemo(
    () => (apps as any[]).map((app: any) => ({ id: String(app.id), name: String(app.name ?? app.id) })),
    [apps]
  )

  useEffect(() => {
    if (!clientId && clientOptions.length > 0) setClientId(clientOptions[0].id)
  }, [clientId, clientOptions])

  useEffect(() => {
    if (!appId && appOptions.length > 0) setAppId(appOptions[0].id)
  }, [appId, appOptions])

  const scopedSurfaceCustomization = useMemo(() => {
    if (scope === 'default') {
      return config.defaultBySurface[surface] ?? {}
    }
    if (scope === 'client') {
      if (!clientId) return {}
      return config.byClientId[clientId]?.[surface] ?? {}
    }
    if (!appId) return {}
    return config.byAppId[appId]?.[surface] ?? {}
  }, [appId, clientId, config, scope, surface])

  useEffect(() => {
    setDraft({ ...emptyDraft, ...scopedSurfaceCustomization })
  }, [scopedSurfaceCustomization])

  const saveScopedCustomization = () => {
    setMessage(null)
    setError(null)

    if (scope === 'client' && !clientId) {
      setError('Select a client before saving a client-scoped customization.')
      return
    }

    if (scope === 'app' && !appId) {
      setError('Select an app before saving an app-scoped customization.')
      return
    }

    const cleaned = cleanDraft(draft)

    setConfig((prev) => {
      const next: UiCustomizationSettings = {
        defaultBySurface: { ...prev.defaultBySurface },
        byClientId: { ...prev.byClientId },
        byAppId: { ...prev.byAppId },
      }

      if (scope === 'default') {
        if (isEmptyCustomization(cleaned)) {
          delete next.defaultBySurface[surface]
        } else {
          next.defaultBySurface[surface] = cleaned
        }
        return next
      }

      if (scope === 'client') {
        const selectedClientId = clientId
        const clientMap = { ...(next.byClientId[selectedClientId] ?? {}) }
        if (isEmptyCustomization(cleaned)) {
          delete clientMap[surface]
        } else {
          clientMap[surface] = cleaned
        }
        if (Object.keys(clientMap).length === 0) {
          delete next.byClientId[selectedClientId]
        } else {
          next.byClientId[selectedClientId] = clientMap
        }
        return next
      }

      const selectedAppId = appId
      const appMap = { ...(next.byAppId[selectedAppId] ?? {}) }
      if (isEmptyCustomization(cleaned)) {
        delete appMap[surface]
      } else {
        appMap[surface] = cleaned
      }
      if (Object.keys(appMap).length === 0) {
        delete next.byAppId[selectedAppId]
      } else {
        next.byAppId[selectedAppId] = appMap
      }
      return next
    })

    setMessage('Customization staged locally. Click Save All to persist.')
  }

  const clearScopedCustomization = () => {
    setDraft(emptyDraft)
    setMessage('Draft cleared. Click Apply To Scope and then Save All to persist removal.')
    setError(null)
  }

  const saveAll = async () => {
    try {
      setMessage(null)
      setError(null)
      await updateSettings.mutateAsync({ uiCustomizations: config })
      setMessage('UI customizations saved successfully.')
      refetch()
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Failed to save UI customizations')
    }
  }

  const previewStyles: React.CSSProperties = {
    background: draft.backgroundCss?.trim() || 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #e2e8f0 100%)',
  }

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading customization settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Branding And UX</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Experience Customization</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Configure titles, visual accents, logos, and backgrounds for hosted interaction surfaces. You can define global defaults and override by OAuth client or app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={saveAll}
            disabled={updateSettings.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={14} />
            {updateSettings.isPending ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-900">Editor</h2>
          <p className="mt-2 text-xs text-slate-500">Select scope and surface, update fields, apply to scope, then save all changes.</p>

          <div className="mt-4 grid gap-4">
            <div>
              <label className={labelCls}>Scope</label>
              <div className="grid grid-cols-3 gap-2">
                {(['default', 'client', 'app'] as Scope[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={`h-9 rounded-lg border text-sm font-medium capitalize transition-colors ${scope === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {scope === 'client' ? (
              <div>
                <label className={labelCls}>Client Override Target</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldCls}>
                  {clientOptions.length === 0 ? <option value="">No clients available</option> : null}
                  {clientOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name} ({option.id})</option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === 'app' ? (
              <div>
                <label className={labelCls}>App Override Target</label>
                <select value={appId} onChange={(e) => setAppId(e.target.value)} className={fieldCls}>
                  {appOptions.length === 0 ? <option value="">No apps available</option> : null}
                  {appOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name} ({option.id})</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className={labelCls}>Surface</label>
              <div className="grid grid-cols-2 gap-2">
                {surfaces.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSurface(item.key)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${surface === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Title</label>
              <input value={draft.title ?? ''} onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))} className={fieldCls} placeholder="Welcome back" />
            </div>

            <div>
              <label className={labelCls}>Subtitle</label>
              <input value={draft.subtitle ?? ''} onChange={(e) => setDraft((v) => ({ ...v, subtitle: e.target.value }))} className={fieldCls} placeholder="Sign in with your enterprise account" />
            </div>

            <div>
              <label className={labelCls}>Logo URL</label>
              <input value={draft.logoUrl ?? ''} onChange={(e) => setDraft((v) => ({ ...v, logoUrl: e.target.value }))} className={fieldCls} placeholder="https://example.com/logo.svg" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Primary Color</label>
                <ColorInput
                  value={draft.primaryColor ?? ''}
                  onChange={(value) => setDraft((v) => ({ ...v, primaryColor: value }))}
                  placeholder="#0f172a"
                  defaultColor="#0f172a"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Accent Color</label>
                <ColorInput
                  value={draft.accentColor ?? ''}
                  onChange={(value) => setDraft((v) => ({ ...v, accentColor: value }))}
                  placeholder="#0ea5e9"
                  defaultColor="#0ea5e9"
                  className={fieldCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Background CSS</label>
              <textarea
                value={draft.backgroundCss ?? ''}
                onChange={(e) => setDraft((v) => ({ ...v, backgroundCss: e.target.value }))}
                className="min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                placeholder="linear-gradient(130deg, #e2e8f0, #f8fafc)"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveScopedCustomization}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Sparkles size={14} />
                Apply To Scope
              </button>
              <button
                type="button"
                onClick={clearScopedCustomization}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 size={14} />
                Clear Draft
              </button>
            </div>
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-900">Preview</h2>
          <p className="mt-2 text-xs text-slate-500">Preview approximates the selected surface styling. Final rendering can vary by page layout.</p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200" style={previewStyles}>
            <div className="min-h-[300px] px-6 py-8" style={{ color: draft.primaryColor?.trim() || '#0f172a' }}>
              {draft.logoUrl?.trim() ? (
                <img src={draft.logoUrl} alt="Customization logo" className="mb-5 h-10 w-auto max-w-[180px] rounded object-contain" />
              ) : (
                <div className="mb-5 inline-flex h-10 items-center rounded-lg bg-white/70 px-3 text-xs font-semibold text-slate-600">Logo preview</div>
              )}
              <h3 className="text-2xl font-bold tracking-tight">{draft.title?.trim() || 'Sign in to continue'}</h3>
              <p className="mt-2 max-w-md text-sm opacity-90">{draft.subtitle?.trim() || 'Use your organization account to access protected applications.'}</p>
              <button
                type="button"
                className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: draft.accentColor?.trim() || '#0ea5e9' }}
              >
                Continue
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Surface</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {surfaces.map((item) => (
                <Link
                  key={item.key}
                  to={item.route}
                  className="inline-flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Scope precedence: default values are baseline, client overrides apply when a client context exists, and app overrides apply when an app context exists.
          </p>
        </section>
      </div>

      {(message || error) ? (
        <div className={`rounded-xl border p-4 text-sm shadow-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ?? message}
        </div>
      ) : null}
    </div>
  )
}
