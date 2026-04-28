import { Plus, RefreshCw, Trash2, Shield, ChevronRight, X, Pencil } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useScopes, useCreateScope, useDeleteScope, useAuthenticationFlows, useApps } from '../hooks/useApi'

interface OAuthClient {
  id: string
  appId?: string
  name: string
  secretPreview: string
  redirectUris: string[]
  allowedScopes: string[]
  grants: string[]
  requirePkce: boolean
  resources: string[]
  flowIds: string[]
  createdAt: string
}

type GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token' | 'password' | 'device_code' | 'token_exchange' | 'jwt_bearer' | 'saml2_bearer' | 'ciba'

const GRANT_OPTIONS: Array<{ value: GrantType; label: string }> = [
  { value: 'authorization_code', label: 'Authorization Code' },
  { value: 'refresh_token', label: 'Refresh Token' },
  { value: 'client_credentials', label: 'Client Credentials' },
  { value: 'password', label: 'Password' },
  { value: 'device_code', label: 'Device Code' },
  { value: 'token_exchange', label: 'Token Exchange (RFC 8693)' },
  { value: 'jwt_bearer', label: 'JWT Bearer Assertion' },
  { value: 'saml2_bearer', label: 'SAML 2.0 Bearer Assertion' },
  { value: 'ciba', label: 'CIBA (Backchannel Authentication)' },
]

const generateClientSecret = () => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const defaultForm = () => ({
  appId: '',
  id: '',
  name: '',
  secret: generateClientSecret(),
  redirectUris: '',
  allowedScopes: ['openid', 'profile', 'email'] as string[],
  grants: ['authorization_code', 'refresh_token'] as GrantType[],
  requirePkce: false,
  flowIds: [] as string[]
})

const formFromClient = (client: OAuthClient) => ({
  appId: client.appId ?? '',
  id: client.id,
  name: client.name,
  secret: '',
  redirectUris: client.redirectUris.join('\n'),
  allowedScopes: [...client.allowedScopes],
  grants: [...client.grants] as GrantType[],
  requirePkce: client.requirePkce,
  flowIds: [...(client.flowIds ?? [])]
})

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Clients = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<OAuthClient | null>(null)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [resourcesClient, setResourcesClient] = useState<OAuthClient | null>(null)
  const [newResource, setNewResource] = useState('')
  const [newScopeName, setNewScopeName] = useState('')
  const [newScopeDescription, setNewScopeDescription] = useState('')
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const { data: clients, isLoading, refetch } = useClients()
  const { data: apps = [] } = useApps()
  const { data: scopes = [] } = useScopes()
  const { data: flows = [] } = useAuthenticationFlows()
  const createClient = useCreateClient()
  const createScope = useCreateScope()
  const deleteScope = useDeleteScope()
  const deleteClient = useDeleteClient()
  const updateClient = useUpdateClient()
  const [formData, setFormData] = useState(defaultForm)
  const appNameById = new Map((apps as any[]).map((app: any) => [app.id, app.name]))
  const filteredClients = (clients as OAuthClient[] | undefined)?.filter((client) => appFilterId === 'all'
    ? true
    : appFilterId === 'none'
      ? !client.appId
      : client.appId === appFilterId)

  const handleCreate = async () => {
    if (!formData.id || !formData.name || !formData.secret) return
    await createClient.mutateAsync({
      appId: formData.appId || undefined,
      id: formData.id,
      name: formData.name,
      secret: formData.secret,
      redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
      allowedScopes: formData.allowedScopes,
      grants: formData.grants,
      requirePkce: formData.requirePkce,
      flowIds: formData.flowIds
    })
    setCreateModalOpen(false)
    setFormData(defaultForm())
  }

  const handleDelete = (id: string) => {
    setClientToDelete(id)
  }

  const handleEdit = (client: OAuthClient) => {
    setFormData(formFromClient(client))
    setEditClient(client)
  }

  const closeClientModal = () => {
    setCreateModalOpen(false)
    setEditClient(null)
    setFormData(defaultForm())
  }

  const confirmDeleteClient = () => {
    if (!clientToDelete) return
    deleteClient.mutate(clientToDelete, { onSuccess: () => setClientToDelete(null) })
  }

  const handleAddResource = () => {
    const resource = newResource.trim()
    if (!resource || !resourcesClient) return
    const current: string[] = resourcesClient.resources ?? []
    if (current.includes(resource)) return
    const updated = [...current, resource]
    updateClient.mutate(
      { id: resourcesClient.id, resources: updated },
      { onSuccess: () => { setResourcesClient(c => c ? { ...c, resources: updated } : null); setNewResource('') } }
    )
  }

  const handleRemoveResource = (resource: string) => {
    if (!resourcesClient) return
    const updated = (resourcesClient.resources ?? []).filter(r => r !== resource)
    updateClient.mutate(
      { id: resourcesClient.id, resources: updated },
      { onSuccess: () => setResourcesClient(c => c ? { ...c, resources: updated } : null) }
    )
  }

  const toggleScope = (scopeName: string) => {
    setFormData(f => {
      const has = f.allowedScopes.includes(scopeName)
      return {
        ...f,
        allowedScopes: has ? f.allowedScopes.filter(s => s !== scopeName) : [...f.allowedScopes, scopeName]
      }
    })
  }

  const handleCreateScope = async () => {
    if (!newScopeName.trim()) return
    await createScope.mutateAsync({ name: newScopeName.trim(), description: newScopeDescription.trim() })
    setFormData(f => ({ ...f, allowedScopes: f.allowedScopes.includes(newScopeName.trim()) ? f.allowedScopes : [...f.allowedScopes, newScopeName.trim()] }))
    setNewScopeName('')
    setNewScopeDescription('')
  }

  const handleDeleteScope = async (scope: { id: string; name: string }) => {
    if (!window.confirm(`Delete scope "${scope.name}"?`)) return
    await deleteScope.mutateAsync(scope.id)
    setFormData((f) => ({ ...f, allowedScopes: f.allowedScopes.filter((s) => s !== scope.name) }))
  }

  const toggleFlow = (flowId: string) => {
    setFormData(f => {
      const has = f.flowIds.includes(flowId)
      return {
        ...f,
        flowIds: has ? f.flowIds.filter(id => id !== flowId) : [...f.flowIds, flowId]
      }
    })
  }

  const toggleGrant = (grant: GrantType) => {
    setFormData(f => {
      const has = f.grants.includes(grant)
      return {
        ...f,
        grants: has ? f.grants.filter(item => item !== grant) : [...f.grants, grant]
      }
    })
  }

  const handleUpdate = async () => {
    if (!editClient || !formData.name || formData.allowedScopes.length === 0 || formData.grants.length === 0) return
    await updateClient.mutateAsync({
      id: editClient.id,
      appId: formData.appId || undefined,
      name: formData.name,
      secret: formData.secret.trim() ? formData.secret : undefined,
      redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
      allowedScopes: formData.allowedScopes,
      grants: formData.grants,
      requirePkce: formData.requirePkce,
      flowIds: formData.flowIds
    })
    closeClientModal()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">OAuth Clients</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Registered Applications</h2>
        </div>
        <button
          onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true); setEditClient(null) }}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={14} />
          New Client
        </button>
      </div>

      <div className="mb-4 max-w-sm">
        <label className={labelCls}>Filter by App</label>
        <select className={fieldCls} value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
          <option value="all">All Apps</option>
          <option value="none">Unassigned</option>
          {(apps as any[]).map((app: any) => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Clients</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading clients…</div>
        ) : !filteredClients?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No clients registered</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredClients.map((client: OAuthClient) => (
              <div key={client.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-slate-900">{client.name}</h5>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {client.appId ? appNameById.get(client.appId) ?? 'App' : 'No App'}
                    </span>
                    {client.requirePkce && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 flex items-center gap-1">
                        <Shield size={9} />PKCE
                      </span>
                    )}
                    {(client.resources?.length ?? 0) > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                        {client.resources.length} resource{client.resources.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {(client.flowIds?.length ?? 0) > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {client.flowIds.length} flow{client.flowIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{client.id}</p>
                  <div className="flex gap-1 flex-wrap">
                    {client.grants.map(g => (
                      <span key={g} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">{g}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {client.redirectUris.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit client"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setResourcesClient(client); setNewResource('') }}
                    className="p-1.5 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Manage resources"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    disabled={deleteClient.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                    title="Delete client"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createModalOpen || !!editClient} onClose={closeClientModal} title={editClient ? `Edit OAuth Client: ${editClient.name}` : 'Create OAuth Client'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>App</label>
              <select value={formData.appId} onChange={e => setFormData(f => ({ ...f, appId: e.target.value }))} className={fieldCls}>
                <option value="">No app</option>
                {(apps as any[]).map((app: any) => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Client ID</label>
              <input
                type="text"
                value={formData.id}
                onChange={e => setFormData(f => ({ ...f, id: e.target.value }))}
                disabled={!!editClient}
                className={`${fieldCls} font-mono ${editClient ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                placeholder="my-app"
              />
            </div>
            <div>
              <label className={labelCls}>{editClient ? 'Rotate Client Secret' : 'Client Secret'}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.secret}
                  onChange={e => setFormData(f => ({ ...f, secret: e.target.value }))}
                  className={`${fieldCls} font-mono`}
                  placeholder={editClient ? 'Leave blank to keep current secret' : 'Auto-generated secret'}
                />
                {!editClient ? (
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, secret: generateClientSecret() }))}
                    className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Regenerate
                  </button>
                ) : null}
              </div>
              {!editClient ? (
                <p className="mt-1 text-xs text-slate-500">A strong secret is generated automatically for new confidential clients.</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className={labelCls}>Client Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className={fieldCls} placeholder="My Application" />
          </div>
          <div>
            <label className={labelCls}>Redirect URIs (one per line)</label>
            <textarea
              value={formData.redirectUris}
              onChange={e => setFormData(f => ({ ...f, redirectUris: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[72px] font-mono"
              placeholder="https://app.example.com/callback"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Allowed Scopes</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[180px] overflow-auto bg-slate-50/40 space-y-1.5">
                {scopes.length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No scopes defined.</p>}
                {scopes.map((scope: any) => (
                  <label key={scope.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedScopes.includes(scope.name)}
                      onChange={() => toggleScope(scope.name)}
                      className="rounded border-slate-300"
                    />
                    <span className="font-mono">{scope.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Grants</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[180px] overflow-auto bg-slate-50/40 space-y-1.5">
                {GRANT_OPTIONS.map((grant) => (
                  <label key={grant.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer rounded-md px-1 py-1 hover:bg-white/70">
                    <input
                      type="checkbox"
                      checked={formData.grants.includes(grant.value)}
                      onChange={() => toggleGrant(grant.value)}
                      className="rounded border-slate-300"
                    />
                    <span className="font-mono">{grant.value}</span>
                    <span className="text-slate-400">{grant.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Allowed Authentication Flows</label>
            <div className="rounded-lg border border-slate-200 p-2 max-h-[120px] overflow-auto bg-slate-50/40 space-y-1.5">
              {(flows as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No flows defined.</p>}
              {(flows as any[]).map((flow: any) => (
                <label key={flow.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.flowIds.includes(flow.id)}
                    onChange={() => toggleFlow(flow.id)}
                    className="rounded border-slate-300"
                  />
                  <span>{flow.name}</span>
                  {flow.enabled && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">active</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Create Scope</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                className={`${fieldCls} font-mono`}
                placeholder="PDV"
              />
              <input
                type="text"
                value={newScopeDescription}
                onChange={e => setNewScopeDescription(e.target.value)}
                className={fieldCls}
                placeholder="Sales point system"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreateScope}
                disabled={createScope.isPending || !newScopeName.trim()}
                className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {createScope.isPending ? 'Adding…' : 'Add Scope'}
              </button>
            </div>
            <div className="space-y-1.5">
              {scopes.length === 0 ? (
                <p className="text-xs text-slate-400">No scopes available.</p>
              ) : (
                scopes.map((scope: any) => (
                  <div key={scope.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-mono text-slate-700">{scope.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{scope.description || 'No description'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteScope(scope)}
                      disabled={deleteScope.isPending}
                      className="ml-2 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete scope"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requirePkce}
              onChange={e => setFormData(f => ({ ...f, requirePkce: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Require PKCE (recommended for public clients)
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={closeClientModal} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={editClient ? handleUpdate : handleCreate}
              disabled={
                editClient
                  ? updateClient.isPending || !formData.name || formData.allowedScopes.length === 0 || formData.grants.length === 0
                  : createClient.isPending || !formData.id || !formData.name || !formData.secret || formData.allowedScopes.length === 0 || formData.grants.length === 0
              }
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {editClient ? (updateClient.isPending ? 'Saving…' : 'Save Changes') : (createClient.isPending ? 'Creating…' : 'Create Client')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Resources modal */}
      <Modal isOpen={!!resourcesClient} onClose={() => setResourcesClient(null)} title={`Resources: ${resourcesClient?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Define the resource identifiers for this client. These appear as selectable resources in the role permission matrix.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newResource}
              onChange={e => setNewResource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddResource() }}
              className={`${fieldCls} font-mono flex-1`}
              placeholder="invoices"
            />
            <button
              onClick={handleAddResource}
              disabled={!newResource.trim() || updateClient.isPending}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {(resourcesClient?.resources ?? []).length === 0 && (
              <p className="text-xs text-slate-400 py-2 text-center">No resources defined yet.</p>
            )}
            {(resourcesClient?.resources ?? []).map(r => (
              <div key={r} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-sm font-mono text-slate-700">{r}</span>
                <button
                  onClick={() => handleRemoveResource(r)}
                  className="text-slate-400 hover:text-red-600 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={() => setResourcesClient(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!clientToDelete}
        title="Delete Client"
        message={`Delete client "${clientToDelete ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete Client"
        pending={deleteClient.isPending}
        onConfirm={confirmDeleteClient}
        onCancel={() => setClientToDelete(null)}
      />
    </div>
  )
}

export default Clients;
