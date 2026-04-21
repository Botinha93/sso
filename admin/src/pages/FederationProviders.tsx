import { AppWindow, ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Shield, Trash2, Upload } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useCreateFederationProvider,
  useDeleteFederationProvider,
  useFederationProviders,
  useRotateSamlServiceProviderCertificate,
  useSamlServiceProviders,
  useUploadSamlServiceProviderMetadata,
  useUpdateFederationProvider,
  useCreateSamlServiceProvider,
  useUpdateSamlServiceProvider,
  useDeleteSamlServiceProvider,
  useSamlAssertions,
  type SamlServiceProviderDto,
  type SamlAssertionAuditDto,
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
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
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
  const { data: samlData, isLoading: samlLoading, refetch: refetchSamlProviders } = useSamlServiceProviders({ limit: 100, offset: 0 })
  const { data: assertionsData, isLoading: assertionsLoading, refetch: refetchAssertions } = useSamlAssertions({ limit: 50 })
  const createProvider = useCreateFederationProvider()
  const updateProvider = useUpdateFederationProvider()
  const deleteProvider = useDeleteFederationProvider()
  const uploadSamlMetadata = useUploadSamlServiceProviderMetadata()
  const rotateSamlCertificate = useRotateSamlServiceProviderCertificate()
  const createSamlSp = useCreateSamlServiceProvider()
  const updateSamlSp = useUpdateSamlServiceProvider()
  const deleteSamlSp = useDeleteSamlServiceProvider()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<FederationProvider | null>(null)
  const [metadataTarget, setMetadataTarget] = useState<SamlServiceProviderDto | null>(null)
  const [rotateTarget, setRotateTarget] = useState<SamlServiceProviderDto | null>(null)
  const [metadataXml, setMetadataXml] = useState('')
  const [overwriteManualFields, setOverwriteManualFields] = useState(true)
  const [certificateType, setCertificateType] = useState<'signing' | 'encryption'>('signing')
  const [certificatePem, setCertificatePem] = useState('')
  const [samlActionMessage, setSamlActionMessage] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string>('')
  const [templatePicked, setTemplatePicked] = useState(false)

  // SAML SP CRUD state
  const [samlSpCreateOpen, setSamlSpCreateOpen] = useState(false)
  const [samlSpEditTarget, setSamlSpEditTarget] = useState<SamlServiceProviderDto | null>(null)
  const [samlSpDeleteTarget, setSamlSpDeleteTarget] = useState<SamlServiceProviderDto | null>(null)
  const [samlSpForm, setSamlSpForm] = useState<{
    entityId: string; acsUrl: string; sloUrl: string;
    nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean
  }>({ entityId: '', acsUrl: '', sloUrl: '', nameIdFormat: 'persistent', enabled: true })
  const [samlSpError, setSamlSpError] = useState<string | null>(null)

  // Assertions tab
  const [assertionsSpFilter, setAssertionsSpFilter] = useState('')

  const providers = useMemo(() => (data ?? []) as FederationProvider[], [data])
  const samlProviders = useMemo(() => samlData?.items ?? [], [samlData])
  const assertions = useMemo(() => {
    const items = (assertionsData as any)?.items ?? []
    if (!assertionsSpFilter) return items as SamlAssertionAuditDto[]
    return (items as SamlAssertionAuditDto[]).filter(a => a.spId === assertionsSpFilter)
  }, [assertionsData, assertionsSpFilter])

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

  const openMetadataUpload = (provider: SamlServiceProviderDto) => {
    setMetadataTarget(provider)
    setMetadataXml(provider.metadata ?? '')
    setOverwriteManualFields(true)
    setSamlActionMessage(null)
  }

  const openCertificateRotate = (provider: SamlServiceProviderDto, type: 'signing' | 'encryption') => {
    setRotateTarget(provider)
    setCertificateType(type)
    setCertificatePem('')
    setSamlActionMessage(null)
  }

  const submitMetadataUpload = async () => {
    if (!metadataTarget || !metadataXml.trim()) return
    await uploadSamlMetadata.mutateAsync({
      id: metadataTarget.id,
      metadata: metadataXml,
      overwriteManualFields,
    })
    setMetadataTarget(null)
    setSamlActionMessage('Service provider metadata uploaded successfully.')
    await refetchSamlProviders()
  }

  const submitCertificateRotation = async () => {
    if (!rotateTarget || !certificatePem.trim()) return
    await rotateSamlCertificate.mutateAsync({
      id: rotateTarget.id,
      certificateType,
      certificate: certificatePem,
    })
    setRotateTarget(null)
    setSamlActionMessage(`${certificateType === 'signing' ? 'Signing' : 'Encryption'} certificate rotated.`)
    await refetchSamlProviders()
  }

  const openSamlSpCreate = () => {
    setSamlSpForm({ entityId: '', acsUrl: '', sloUrl: '', nameIdFormat: 'persistent', enabled: true })
    setSamlSpError(null)
    setSamlSpCreateOpen(true)
  }

  const submitSamlSpCreate = async () => {
    setSamlSpError(null)
    try {
      await createSamlSp.mutateAsync({
        entityId: samlSpForm.entityId,
        acsUrl: samlSpForm.acsUrl,
        sloUrl: samlSpForm.sloUrl || undefined,
        nameIdFormat: samlSpForm.nameIdFormat,
      })
      setSamlSpCreateOpen(false)
      setSamlActionMessage('SAML service provider created.')
    } catch (err: unknown) {
      setSamlSpError(err instanceof Error ? err.message : 'Failed to create service provider')
    }
  }

  const openSamlSpEdit = (sp: SamlServiceProviderDto) => {
    setSamlSpForm({
      entityId: sp.entityId,
      acsUrl: sp.acsUrl,
      sloUrl: sp.sloUrl ?? '',
      nameIdFormat: sp.nameIdFormat,
      enabled: sp.enabled,
    })
    setSamlSpError(null)
    setSamlSpEditTarget(sp)
  }

  const submitSamlSpEdit = async () => {
    if (!samlSpEditTarget) return
    setSamlSpError(null)
    try {
      await updateSamlSp.mutateAsync({
        id: samlSpEditTarget.id,
        entityId: samlSpForm.entityId,
        acsUrl: samlSpForm.acsUrl,
        sloUrl: samlSpForm.sloUrl || undefined,
        nameIdFormat: samlSpForm.nameIdFormat,
        enabled: samlSpForm.enabled,
      })
      setSamlSpEditTarget(null)
      setSamlActionMessage('SAML service provider updated.')
    } catch (err: unknown) {
      setSamlSpError(err instanceof Error ? err.message : 'Failed to update service provider')
    }
  }

  const confirmSamlSpDelete = () => {
    if (!samlSpDeleteTarget) return
    deleteSamlSp.mutate(samlSpDeleteTarget.id, {
      onSuccess: () => {
        setSamlSpDeleteTarget(null)
        setSamlActionMessage('SAML service provider deleted.')
      }
    })
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">SAML Service Providers</h4>
            <p className="text-xs text-slate-500 mt-0.5">Manage SAML 2.0 service provider registrations, metadata, and certificates.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetchSamlProviders()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
              <RefreshCw size={12} />
              Refresh
            </button>
            <button onClick={openSamlSpCreate} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 transition-colors">
              <Plus size={12} />
              Add SP
            </button>
          </div>
        </div>

        {samlActionMessage ? (
          <div className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{samlActionMessage}</div>
        ) : null}

        {samlLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading SAML providers…</div>
        ) : samlProviders.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No SAML service providers configured</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['Entity ID', 'ACS URL', 'Status', 'Updated', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {samlProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-50/40">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-700 break-all">{provider.entityId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-600 break-all">{provider.acsUrl}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${provider.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {provider.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(provider.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => openMetadataUpload(provider)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Upload size={12} /> Metadata
                        </button>
                        <button
                          onClick={() => openCertificateRotate(provider, 'signing')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Shield size={12} /> Rotate Signing
                        </button>
                        <button
                          onClick={() => openCertificateRotate(provider, 'encryption')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Shield size={12} /> Rotate Encryption
                        </button>
                        <button
                          onClick={() => openSamlSpEdit(provider)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setSamlSpDeleteTarget(provider)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SAML Assertions Audit Log */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">SAML Assertion Audit Log</h4>
            <p className="text-xs text-slate-500 mt-0.5">Recent assertion activity across all service providers.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={assertionsSpFilter}
              onChange={e => setAssertionsSpFilter(e.target.value)}
              className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
            >
              <option value="">All SPs</option>
              {samlProviders.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.entityId}</option>
              ))}
            </select>
            <button onClick={() => refetchAssertions()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
        {assertionsLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading assertions…</div>
        ) : assertions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No assertion records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {['SP', 'Subject', 'Assertion ID', 'Session Index', 'Time'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assertions.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 break-all max-w-[160px] truncate">{samlProviders.find(sp => sp.id === a.spId)?.entityId ?? a.spId}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700 break-all max-w-[160px] truncate">{a.subject ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 break-all max-w-[160px] truncate">{a.assertionId}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{a.sessionIndex ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* SAML SP Create Modal */}
      <Modal isOpen={samlSpCreateOpen} onClose={() => setSamlSpCreateOpen(false)} title="Add SAML Service Provider">
        <SamlSpForm form={samlSpForm} setForm={setSamlSpForm} error={samlSpError} onSubmit={submitSamlSpCreate} submitLabel={createSamlSp.isPending ? 'Creating…' : 'Create SP'} pending={createSamlSp.isPending} />
      </Modal>

      {/* SAML SP Edit Modal */}
      <Modal isOpen={!!samlSpEditTarget} onClose={() => setSamlSpEditTarget(null)} title="Edit SAML Service Provider">
        <SamlSpForm form={samlSpForm} setForm={setSamlSpForm} error={samlSpError} onSubmit={submitSamlSpEdit} submitLabel={updateSamlSp.isPending ? 'Saving…' : 'Save Changes'} pending={updateSamlSp.isPending} />
      </Modal>

      <ConfirmDialog
        isOpen={!!samlSpDeleteTarget}
        title="Delete SAML Service Provider"
        message={`Delete service provider "${samlSpDeleteTarget?.entityId ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete SP"
        pending={deleteSamlSp.isPending}
        onConfirm={confirmSamlSpDelete}
        onCancel={() => setSamlSpDeleteTarget(null)}
      />

      <Modal isOpen={!!metadataTarget} onClose={() => setMetadataTarget(null)} title="Upload SAML Metadata">
        <div className="space-y-3">
          {metadataTarget ? <p className="text-xs text-slate-500">Target: <span className="font-mono">{metadataTarget.entityId}</span></p> : null}
          <div>
            <label className={labelCls}>Metadata XML</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              rows={10}
              placeholder="<EntityDescriptor ...>...</EntityDescriptor>"
              value={metadataXml}
              onChange={(e) => setMetadataXml(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={overwriteManualFields}
              onChange={(e) => setOverwriteManualFields(e.target.checked)}
            />
            Overwrite manually configured SAML fields with parsed metadata values
          </label>
          <div className="flex justify-end">
            <button
              onClick={submitMetadataUpload}
              disabled={uploadSamlMetadata.isPending || !metadataXml.trim()}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {uploadSamlMetadata.isPending ? 'Uploading…' : 'Upload Metadata'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!rotateTarget} onClose={() => setRotateTarget(null)} title="Rotate SAML Certificate">
        <div className="space-y-3">
          {rotateTarget ? <p className="text-xs text-slate-500">Target: <span className="font-mono">{rotateTarget.entityId}</span></p> : null}
          <div>
            <label className={labelCls}>Certificate Type</label>
            <select
              className={fieldCls}
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value as 'signing' | 'encryption')}
            >
              <option value="signing">Signing</option>
              <option value="encryption">Encryption</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Certificate (PEM)</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              rows={10}
              placeholder="-----BEGIN CERTIFICATE-----"
              value={certificatePem}
              onChange={(e) => setCertificatePem(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={submitCertificateRotation}
              disabled={rotateSamlCertificate.isPending || !certificatePem.trim()}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {rotateSamlCertificate.isPending ? 'Rotating…' : 'Rotate Certificate'}
            </button>
          </div>
        </div>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

function SamlSpForm({
  form,
  setForm,
  error,
  onSubmit,
  submitLabel,
  pending,
}: {
  form: { entityId: string; acsUrl: string; sloUrl: string; nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean }
  setForm: Dispatch<SetStateAction<{ entityId: string; acsUrl: string; sloUrl: string; nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean }>>
  error: string | null
  onSubmit: () => void
  submitLabel: string
  pending: boolean
}) {
  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
      <div>
        <label className={labelCls}>Entity ID</label>
        <input className={`${fieldCls} font-mono`} value={form.entityId} onChange={e => setForm(p => ({ ...p, entityId: e.target.value }))} placeholder="https://sp.example.com/saml/metadata" required />
      </div>
      <div>
        <label className={labelCls}>ACS URL</label>
        <input className={`${fieldCls} font-mono`} value={form.acsUrl} onChange={e => setForm(p => ({ ...p, acsUrl: e.target.value }))} placeholder="https://sp.example.com/saml/acs" required />
      </div>
      <div>
        <label className={labelCls}>SLO URL (optional)</label>
        <input className={`${fieldCls} font-mono`} value={form.sloUrl} onChange={e => setForm(p => ({ ...p, sloUrl: e.target.value }))} placeholder="https://sp.example.com/saml/slo" />
      </div>
      <div>
        <label className={labelCls}>Name ID Format</label>
        <select className={fieldCls} value={form.nameIdFormat} onChange={e => setForm(p => ({ ...p, nameIdFormat: e.target.value as typeof form.nameIdFormat }))}>
          <option value="persistent">Persistent</option>
          <option value="transient">Transient</option>
          <option value="emailAddress">Email Address</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
        Service provider is enabled
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
