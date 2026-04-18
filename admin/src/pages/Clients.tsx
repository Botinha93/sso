import { Plus, RefreshCw, Trash2, Shield, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useScopes, useCreateScope, useAuthenticationFlows } from '../hooks/useApi'

interface OAuthClient {
  id: string
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

const defaultForm = () => ({
  id: '',
  name: '',
  secret: '',
  redirectUris: '',
  allowedScopes: ['openid', 'profile', 'email'] as string[],
  grants: 'authorization_code refresh_token',
  requirePkce: false,
  flowIds: [] as string[]
})

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Clients = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [resourcesClient, setResourcesClient] = useState<OAuthClient | null>(null)
  const [newResource, setNewResource] = useState('')
  const [newScopeName, setNewScopeName] = useState('')
  const [newScopeDescription, setNewScopeDescription] = useState('')
  const { data: clients, isLoading, refetch } = useClients()
  const { data: scopes = [] } = useScopes()
  const { data: flows = [] } = useAuthenticationFlows()
  const createClient = useCreateClient()
  const createScope = useCreateScope()
  const deleteClient = useDeleteClient()
  const updateClient = useUpdateClient()
  const [formData, setFormData] = useState(defaultForm)

  const handleCreate = async () => {
    if (!formData.id || !formData.name || !formData.secret) return
    await createClient.mutateAsync({
      id: formData.id,
      name: formData.name,
      secret: formData.secret,
      redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
      allowedScopes: formData.allowedScopes,
      grants: formData.grants.split(' ').filter(Boolean),
      requirePkce: formData.requirePkce,
      flowIds: formData.flowIds
    })
    setCreateModalOpen(false)
    setFormData(defaultForm())
  }

  const handleDelete = (id: string) => {
    setClientToDelete(id)
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

  const toggleFlow = (flowId: string) => {
    setFormData(f => {
      const has = f.flowIds.includes(flowId)
      return {
        ...f,
        flowIds: has ? f.flowIds.filter(id => id !== flowId) : [...f.flowIds, flowId]
      }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">OAuth Clients</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Registered Applications</h2>
        </div>
        <button
          onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true) }}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={14} />
          New Client
        </button>
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
        ) : !clients?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No clients registered</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {clients.map((client: OAuthClient) => (
              <div key={client.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-slate-900">{client.name}</h5>
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

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create OAuth Client">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client ID</label>
              <input type="text" value={formData.id} onChange={e => setFormData(f => ({ ...f, id: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="my-app" />
            </div>
            <div>
              <label className={labelCls}>Client Secret</label>
              <input type="text" value={formData.secret} onChange={e => setFormData(f => ({ ...f, secret: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="min 16 chars" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Allowed Scopes</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
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
              <input type="text" value={formData.grants} onChange={e => setFormData(f => ({ ...f, grants: e.target.value }))} className={`${fieldCls} font-mono`} />
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
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                className={`${fieldCls} font-mono`}
                placeholder="orders.read"
              />
              <input
                type="text"
                value={newScopeDescription}
                onChange={e => setNewScopeDescription(e.target.value)}
                className={fieldCls}
                placeholder="Read order data"
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
            <button onClick={() => setCreateModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createClient.isPending || !formData.id || !formData.name || !formData.secret || formData.allowedScopes.length === 0}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {createClient.isPending ? 'Creating…' : 'Create Client'}
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