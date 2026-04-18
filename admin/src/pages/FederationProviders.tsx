import { AppWindow, ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useCreateFederationProvider,
  useDeleteFederationProvider,
  useFederationProviders,
  useUpdateFederationProvider,
} from '../hooks/useApi'

interface FederationProvider {
  id: string
  label: string
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint: string
  clientId: string
  scopes: string[]
  enabled: boolean
  source: 'env' | 'db'
  secretPreview?: string
}

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

// ─── Provider templates ────────────────────────────────────────────────────────

interface ProviderTemplate {
  id: string
  label: string
  logo: string
  color: string
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint: string
  scopes: string
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'google',
    label: 'Google',
    logo: 'https://www.google.com/favicon.ico',
    color: '#4285F4',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    logo: 'https://www.microsoft.com/favicon.ico',
    color: '#00A4EF',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: 'openid profile email User.Read',
  },
  {
    id: 'github',
    label: 'GitHub',
    logo: 'https://github.com/favicon.ico',
    color: '#24292F',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userInfoEndpoint: 'https://api.github.com/user',
    scopes: 'read:user user:email',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    logo: 'https://www.linkedin.com/favicon.ico',
    color: '#0A66C2',
    authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    logo: 'https://www.facebook.com/favicon.ico',
    color: '#1877F2',
    authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoEndpoint: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: 'public_profile email',
  },
  {
    id: 'discord',
    label: 'Discord',
    logo: 'https://discord.com/assets/favicon.ico',
    color: '#5865F2',
    authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    userInfoEndpoint: 'https://discord.com/api/users/@me',
    scopes: 'identify email',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    logo: 'https://twitter.com/favicon.ico',
    color: '#000000',
    authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    userInfoEndpoint: 'https://api.twitter.com/2/users/me',
    scopes: 'tweet.read users.read offline.access',
  },
  {
    id: 'apple',
    label: 'Apple',
    logo: 'https://www.apple.com/favicon.ico',
    color: '#000000',
    authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
    tokenEndpoint: 'https://appleid.apple.com/auth/token',
    userInfoEndpoint: 'https://appleid.apple.com/auth/userinfo',
    scopes: 'openid name email',
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    logo: 'https://gitlab.com/favicon.ico',
    color: '#FC6D26',
    authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
    tokenEndpoint: 'https://gitlab.com/oauth/token',
    userInfoEndpoint: 'https://gitlab.com/oauth/userinfo',
    scopes: 'openid profile email read_user',
  },
  {
    id: 'okta',
    label: 'Okta',
    logo: 'https://www.okta.com/favicon.ico',
    color: '#007DC1',
    authorizationEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/authorize',
    tokenEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/token',
    userInfoEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'auth0',
    label: 'Auth0',
    logo: 'https://auth0.com/favicon.ico',
    color: '#EB5424',
    authorizationEndpoint: 'https://{your-tenant}.auth0.com/authorize',
    tokenEndpoint: 'https://{your-tenant}.auth0.com/oauth/token',
    userInfoEndpoint: 'https://{your-tenant}.auth0.com/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    logo: 'https://www.keycloak.org/resources/favicon.ico',
    color: '#00B8D9',
    authorizationEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/auth',
    tokenEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/token',
    userInfoEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/userinfo',
    scopes: 'openid profile email',
  },
]

// ─── Template picker component ────────────────────────────────────────────────

function TemplatePicker({ onSelect }: { onSelect: (t: ProviderTemplate) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-5">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-700"
      >
        <span>Start from a template</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="grid grid-cols-4 gap-2 p-3">
          {PROVIDER_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors group"
              title={`Use ${t.label} template`}
            >
              <img
                src={t.logo}
                alt={t.label}
                className="w-6 h-6 rounded object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium text-center leading-tight">{t.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors group"
            title="Start blank"
          >
            <Plus size={18} className="text-slate-400 group-hover:text-slate-700" />
            <span className="text-xs text-slate-500 group-hover:text-slate-800 font-medium text-center leading-tight">Custom</span>
          </button>
        </div>
      )}
    </div>
  )
}

const blankForm = {
  id: '',
  label: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userInfoEndpoint: '',
  clientId: '',
  clientSecret: '',
  scopes: 'openid profile email',
  enabled: true,
}

const FederationProviders = () => {
  const { data, isLoading, refetch } = useFederationProviders()
  const createProvider = useCreateFederationProvider()
  const updateProvider = useUpdateFederationProvider()
  const deleteProvider = useDeleteFederationProvider()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<FederationProvider | null>(null)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string>('')
  const [templatePicked, setTemplatePicked] = useState(false)

  const providers = useMemo(() => (data ?? []) as FederationProvider[], [data])

  const openCreate = () => {
    setForm(blankForm)
    setTemplatePicked(false)
    setCreateOpen(true)
  }

  const applyTemplate = (t: ProviderTemplate) => {
    setForm(p => ({
      ...p,
      id: t.id,
      label: t.label,
      authorizationEndpoint: t.authorizationEndpoint,
      tokenEndpoint: t.tokenEndpoint,
      userInfoEndpoint: t.userInfoEndpoint,
      scopes: t.scopes,
    }))
    setTemplatePicked(true)
  }

  const openEdit = (provider: FederationProvider) => {
    setEditingId(provider.id)
    setForm({
      id: provider.id,
      label: provider.label,
      authorizationEndpoint: provider.authorizationEndpoint,
      tokenEndpoint: provider.tokenEndpoint,
      userInfoEndpoint: provider.userInfoEndpoint,
      clientId: provider.clientId,
      clientSecret: '',
      scopes: provider.scopes.join(' '),
      enabled: provider.enabled,
    })
    setEditOpen(true)
  }

  const onCreate = async () => {
    if (!form.id || !form.label || !form.authorizationEndpoint || !form.tokenEndpoint || !form.userInfoEndpoint || !form.clientId || !form.clientSecret) {
      return
    }

    await createProvider.mutateAsync({
      id: form.id.trim(),
      label: form.label.trim(),
      authorizationEndpoint: form.authorizationEndpoint.trim(),
      tokenEndpoint: form.tokenEndpoint.trim(),
      userInfoEndpoint: form.userInfoEndpoint.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      scopes: form.scopes.split(' ').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
    })
    setCreateOpen(false)
    setForm(blankForm)
  }

  const onEdit = async () => {
    if (!editingId) return

    await updateProvider.mutateAsync({
      id: editingId,
      label: form.label.trim(),
      authorizationEndpoint: form.authorizationEndpoint.trim(),
      tokenEndpoint: form.tokenEndpoint.trim(),
      userInfoEndpoint: form.userInfoEndpoint.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret || undefined,
      scopes: form.scopes.split(' ').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
    })

    setEditOpen(false)
    setEditingId('')
    setForm(blankForm)
  }

  const onDelete = (provider: FederationProvider) => {
    if (provider.source === 'env') return
    setProviderToDelete(provider)
  }

  const confirmDeleteProvider = () => {
    if (!providerToDelete) return
    deleteProvider.mutate(providerToDelete.id, { onSuccess: () => setProviderToDelete(null) })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">User Federation</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Federation Providers</h2>
        </div>
        <button
          onClick={openCreate}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={14} />
          New Provider
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Configured Providers</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading providers…</div>
        ) : providers.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No federation providers configured</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {providers.map((provider) => (
              <div key={provider.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                      <AppWindow size={14} className="text-slate-500" />
                    </div>
                    <h5 className="text-sm font-medium text-slate-900">{provider.label}</h5>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md border ${provider.enabled ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md border ${provider.source === 'env' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                      {provider.source.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{provider.id}</p>
                  <p className="text-xs text-slate-500 truncate">auth: {provider.authorizationEndpoint}</p>
                  <p className="text-xs text-slate-500 truncate">token: {provider.tokenEndpoint}</p>
                  <p className="text-xs text-slate-500 truncate">userinfo: {provider.userInfoEndpoint}</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {provider.scopes.map((scope) => (
                      <span key={scope} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">{scope}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(provider)}
                    disabled={provider.source === 'env'}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                    title={provider.source === 'env' ? 'Environment providers are read-only' : 'Edit provider'}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(provider)}
                    disabled={provider.source === 'env' || deleteProvider.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    title={provider.source === 'env' ? 'Environment providers are read-only' : 'Delete provider'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Federation Provider">
        <TemplatePicker onSelect={applyTemplate} />
        <ProviderForm form={form} setForm={setForm} showId onSubmit={onCreate} submitLabel={createProvider.isPending ? 'Creating…' : 'Create Provider'} pending={createProvider.isPending} />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Federation Provider">
        <ProviderForm form={form} setForm={setForm} onSubmit={onEdit} submitLabel={updateProvider.isPending ? 'Saving…' : 'Save Changes'} pending={updateProvider.isPending} />
      </Modal>

      <ConfirmDialog
        isOpen={!!providerToDelete}
        title="Delete Federation Provider"
        message={`Delete provider "${providerToDelete?.label ?? ''}"?`}
        confirmLabel="Delete Provider"
        pending={deleteProvider.isPending}
        onConfirm={confirmDeleteProvider}
        onCancel={() => setProviderToDelete(null)}
      />
    </div>
  )
}

function ProviderForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  pending,
  showId = false,
}: {
  form: typeof blankForm
  setForm: Dispatch<SetStateAction<typeof blankForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
  showId?: boolean
}) {
  return (
    <div className="space-y-4">
      {showId && (
        <div>
          <label className={labelCls}>Provider ID</label>
          <input className={`${fieldCls} font-mono`} value={form.id} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))} placeholder="google" />
        </div>
      )}
      <div>
        <label className={labelCls}>Label</label>
        <input className={fieldCls} value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Google Workspace" />
      </div>
      <div>
        <label className={labelCls}>Authorization Endpoint</label>
        <input className={`${fieldCls} font-mono`} value={form.authorizationEndpoint} onChange={(e) => setForm((p) => ({ ...p, authorizationEndpoint: e.target.value }))} placeholder="https://accounts.google.com/o/oauth2/v2/auth" />
      </div>
      <div>
        <label className={labelCls}>Token Endpoint</label>
        <input className={`${fieldCls} font-mono`} value={form.tokenEndpoint} onChange={(e) => setForm((p) => ({ ...p, tokenEndpoint: e.target.value }))} placeholder="https://oauth2.googleapis.com/token" />
      </div>
      <div>
        <label className={labelCls}>UserInfo Endpoint</label>
        <input className={`${fieldCls} font-mono`} value={form.userInfoEndpoint} onChange={(e) => setForm((p) => ({ ...p, userInfoEndpoint: e.target.value }))} placeholder="https://openidconnect.googleapis.com/v1/userinfo" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Client ID</label>
          <input className={`${fieldCls} font-mono`} value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Client Secret</label>
          <input className={`${fieldCls} font-mono`} value={form.clientSecret} onChange={(e) => setForm((p) => ({ ...p, clientSecret: e.target.value }))} placeholder="Leave empty to keep existing" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Scopes</label>
        <input className={`${fieldCls} font-mono`} value={form.scopes} onChange={(e) => setForm((p) => ({ ...p, scopes: e.target.value }))} placeholder="openid profile email" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
        Provider is enabled
      </label>
      <div className="flex justify-end">
        <button onClick={onSubmit} disabled={pending} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

export default FederationProviders
