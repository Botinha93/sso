import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import Select from '../components/ui/Select'
import { Plus, RefreshCw, Trash2, Shield, ChevronRight, X, Pencil } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useScopes, useCreateScope, useDeleteScope, useAuthenticationFlows, useApps } from '../hooks/useApi'
import { DEFAULT_CLIENT_SCOPES, SCOPE_CLAIM_MAP } from '../constants/oidc-scopes'
import React from 'react';

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
  accessTokenTtlSeconds?: number | null
  refreshTokenTtlSeconds?: number | null
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
  allowedScopes: [...DEFAULT_CLIENT_SCOPES] as string[],
  grants: ['authorization_code', 'refresh_token'] as GrantType[],
  requirePkce: false,
  flowIds: [] as string[],
  accessTokenTtlSeconds: '' as number | '',
  refreshTokenTtlSeconds: '' as number | ''
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
  flowIds: [...(client.flowIds ?? [])],
  accessTokenTtlSeconds: (client.accessTokenTtlSeconds ?? '') as number | '',
  refreshTokenTtlSeconds: (client.refreshTokenTtlSeconds ?? '') as number | ''
})

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

const Clients = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<OAuthClient | null>(null)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [resourcesClient, setResourcesClient] = useState<OAuthClient | null>(null)
  const [newResource, setNewResource] = useState('')
  const [newScopeName, setNewScopeName] = useState('')
  const [newScopeDescription, setNewScopeDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: clients, isLoading, isFetching, refetch } = useClients(debouncedSearch)
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

    setFormError('')
    try {
      await createClient.mutateAsync({
        appId: formData.appId || undefined,
        id: formData.id,
        name: formData.name,
        secret: formData.secret,
        redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
        allowedScopes: formData.allowedScopes,
        grants: formData.grants,
        requirePkce: formData.requirePkce,
        flowIds: formData.flowIds,
        accessTokenTtlSeconds: formData.accessTokenTtlSeconds === '' ? undefined : Number(formData.accessTokenTtlSeconds),
        refreshTokenTtlSeconds: formData.refreshTokenTtlSeconds === '' ? undefined : Number(formData.refreshTokenTtlSeconds)
      })
      setCreateModalOpen(false)
      setFormData(defaultForm())
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create client')
    }
  }

  const handleDelete = (id: string) => {
    setClientToDelete(id)
  }

  const handleEdit = (client: OAuthClient) => {
    setFormError('')
    setFormData(formFromClient(client))
    setEditClient(client)
  }

  const closeClientModal = () => {
    setFormError('')
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

    setFormError('')
    try {
      await createScope.mutateAsync({ name: newScopeName.trim(), description: newScopeDescription.trim() })
      setFormData(f => ({ ...f, allowedScopes: f.allowedScopes.includes(newScopeName.trim()) ? f.allowedScopes : [...f.allowedScopes, newScopeName.trim()] }))
      setNewScopeName('')
      setNewScopeDescription('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create scope')
    }
  }

  const handleDeleteScope = async (scope: { id: string; name: string }) => {
    if (!window.confirm(`Delete scope "${scope.name}"?`)) return

    setFormError('')
    try {
      await deleteScope.mutateAsync(scope.id)
      setFormData((f) => ({ ...f, allowedScopes: f.allowedScopes.filter((s) => s !== scope.name) }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete scope')
    }
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

    setFormError('')
    try {
      await updateClient.mutateAsync({
        id: editClient.id,
        appId: formData.appId || undefined,
        name: formData.name,
        secret: formData.secret.trim() ? formData.secret : undefined,
        redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
        allowedScopes: formData.allowedScopes,
        grants: formData.grants,
        requirePkce: formData.requirePkce,
        flowIds: formData.flowIds,
        accessTokenTtlSeconds: formData.accessTokenTtlSeconds === '' ? null : Number(formData.accessTokenTtlSeconds),
        refreshTokenTtlSeconds: formData.refreshTokenTtlSeconds === '' ? null : Number(formData.refreshTokenTtlSeconds)
      })
      closeClientModal()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update client')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="OAuth Clients"
        title="Registered Applications"
        action={
          <Button
            onClick={() => { setFormError(''); setFormData(defaultForm()); setCreateModalOpen(true); setEditClient(null) }}
            variant="primary"
          >
            <Plus size={14} />
            New Client
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search clients by id or name…" />
        <div className="max-w-sm w-full">
          <label className={labelCls}>Filter by App</label>
          <Select value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
            <option value="all">All Apps</option>
            <option value="none">Unassigned</option>
            {(apps as any[]).map((app: any) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <Table>
        <TableHeaderRow>
          <h4 className="text-sm font-semibold text-foreground">All Clients</h4>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !filteredClients?.length ? (
          <EmptyState
            title="No clients registered"
            description="Register an OAuth client to start authorizing applications."
          />
        ) : (
          <TableBody>
            {filteredClients.map((client: OAuthClient) => (
              <TableRow key={client.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors group">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-foreground">{client.name}</h5>
                    <StatusBadge tone="accent">
                      {client.appId ? appNameById.get(client.appId) ?? 'App' : 'No App'}
                    </StatusBadge>
                    {client.requirePkce && (
                      <StatusBadge tone="info">
                        <Shield size={9} />PKCE
                      </StatusBadge>
                    )}
                    {(client.resources?.length ?? 0) > 0 && (
                      <StatusBadge tone="accent">
                        {client.resources.length} resource{client.resources.length !== 1 ? 's' : ''}
                      </StatusBadge>
                    )}
                    {(client.flowIds?.length ?? 0) > 0 && (
                      <StatusBadge tone="success">
                        {client.flowIds.length} flow{client.flowIds.length !== 1 ? 's' : ''}
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{client.id}</p>
                  <div className="flex gap-1 flex-wrap">
                    {client.grants.map(g => (
                      <StatusBadge key={g} tone="neutral" mono>{g}</StatusBadge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {client.redirectUris.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 hover:bg-sky-50 hover:text-sky-600"
                    onClick={() => handleEdit(client)}
                    title="Edit client"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 hover:bg-sky-50 hover:text-sky-600"
                    onClick={() => { setResourcesClient(client); setNewResource('') }}
                    title="Manage resources"
                  >
                    <ChevronRight size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => handleDelete(client.id)}
                    disabled={deleteClient.isPending}
                    title="Delete client"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>

      <Modal isOpen={createModalOpen || !!editClient} onClose={closeClientModal} title={editClient ? `Edit OAuth Client: ${editClient.name}` : 'Create OAuth Client'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>App</label>
              <Select value={formData.appId} onChange={e => setFormData(f => ({ ...f, appId: e.target.value }))}>
                <option value="">No app</option>
                {(apps as any[]).map((app: any) => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className={labelCls}>Client ID</label>
              <Input
                type="text"
                value={formData.id}
                onChange={e => setFormData(f => ({ ...f, id: e.target.value }))}
                disabled={!!editClient}
                className={`font-mono ${editClient ? 'cursor-not-allowed bg-muted text-muted-foreground' : ''}`}
                placeholder="my-app"
              />
            </div>
            <div>
              <label className={labelCls}>{editClient ? 'Rotate Client Secret' : 'Client Secret'}</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.secret}
                  onChange={e => setFormData(f => ({ ...f, secret: e.target.value }))}
                  className="font-mono"
                  placeholder={editClient ? 'Leave blank to keep current secret' : 'Auto-generated secret'}
                />
                {!editClient ? (
                  <Button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, secret: generateClientSecret() }))}
                    size="md"
                    variant="secondary"
                    className="shrink-0 px-3 text-xs"
                  >
                    Regenerate
                  </Button>
                ) : null}
              </div>
              {!editClient ? (
                <p className="mt-1 text-xs text-muted-foreground">A strong secret is generated automatically for new confidential clients.</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className={labelCls}>Client Name</label>
            <Input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="My Application" />
          </div>
          <div>
            <label className={labelCls}>Redirect URIs (one per line)</label>
            <Textarea
              value={formData.redirectUris}
              onChange={e => setFormData(f => ({ ...f, redirectUris: e.target.value }))}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-[72px] font-mono"
              placeholder="https://app.example.com/callback"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Allowed Scopes</label>
              <p className="mb-1.5 text-[11px] text-muted-foreground">
                Select which scopes this client may request. Known scopes map to specific token claims.
              </p>
              <div className="rounded-lg border border-border p-2 max-h-[220px] overflow-auto bg-muted/40 space-y-1.5">
                {scopes.length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">No scopes defined.</p>}
                {scopes.map((scope: any) => {
                  const claimHints = SCOPE_CLAIM_MAP[scope.name]
                  return (
                    <label key={scope.id} className="flex items-start gap-2 text-xs text-foreground cursor-pointer rounded-md px-1 py-1 hover:bg-card/70">
                      <input
                        type="checkbox"
                        checked={formData.allowedScopes.includes(scope.name)}
                        onChange={() => toggleScope(scope.name)}
                        className="mt-0.5 rounded border-border"
                      />
                      <span className="min-w-0">
                        <span className="font-mono text-foreground">{scope.name}</span>
                        {scope.description && (
                          <span className="block text-[11px] text-muted-foreground">{scope.description}</span>
                        )}
                        {claimHints && (
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            claims: {claimHints.join(', ')}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <label className={labelCls}>Grants</label>
              <div className="rounded-lg border border-border p-2 max-h-[180px] overflow-auto bg-muted/40 space-y-1.5">
                {GRANT_OPTIONS.map((grant) => (
                  <label key={grant.value} className="flex items-center gap-2 text-xs text-foreground cursor-pointer rounded-md px-1 py-1 hover:bg-card/70">
                    <input
                      type="checkbox"
                      checked={formData.grants.includes(grant.value)}
                      onChange={() => toggleGrant(grant.value)}
                      className="rounded border-border"
                    />
                    <span className="font-mono">{grant.value}</span>
                    <span className="text-muted-foreground">{grant.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Allowed Authentication Flows</label>
            <div className="rounded-lg border border-border p-2 max-h-[120px] overflow-auto bg-muted/40 space-y-1.5">
              {(flows as any[]).length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">No flows defined.</p>}
              {(flows as any[]).map((flow: any) => (
                <label key={flow.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.flowIds.includes(flow.id)}
                    onChange={() => toggleFlow(flow.id)}
                    className="rounded border-border"
                  />
                  <span>{flow.name}</span>
                  {flow.enabled && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">active</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/40 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope Catalog</p>
            <p className="text-[11px] text-muted-foreground">
              Add custom API scopes here, then enable them for clients above. Built-in scopes unlock standard OIDC claims.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                type="text"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                className="font-mono"
                placeholder="PDV"
              />
              <Input
                type="text"
                value={newScopeDescription}
                onChange={e => setNewScopeDescription(e.target.value)}
                placeholder="Sales point system"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleCreateScope}
                disabled={createScope.isPending || !newScopeName.trim()}
                variant="primary"
                size="sm"
              >
                {createScope.isPending ? 'Adding…' : 'Add Scope'}
              </Button>
            </div>
            <div className="space-y-1.5">
              {scopes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No scopes available.</p>
              ) : (
                scopes.map((scope: any) => (
                  <div key={scope.id} className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-mono text-foreground">{scope.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{scope.description || 'No description'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => handleDeleteScope(scope)}
                      disabled={deleteScope.isPending}
                      title="Delete scope"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requirePkce}
              onChange={e => setFormData(f => ({ ...f, requirePkce: e.target.checked }))}
              className="rounded border-border"
            />
            Require PKCE (recommended for public clients)
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Access token TTL (seconds)</label>
              <Input
                type="number"
                min={60}
                max={86400}
                value={formData.accessTokenTtlSeconds}
                onChange={(e) => setFormData(f => ({ ...f, accessTokenTtlSeconds: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="900"
              />
              <p className="mt-1 text-xs text-muted-foreground">Lifetime of issued access tokens. Leave blank to use the default (900 = 15 min). Allowed: 60 – 86,400.</p>
            </div>
            <div>
              <label className={labelCls}>Refresh token TTL (seconds)</label>
              <Input
                type="number"
                min={300}
                max={31536000}
                value={formData.refreshTokenTtlSeconds}
                onChange={(e) => setFormData(f => ({ ...f, refreshTokenTtlSeconds: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="2592000"
              />
              <p className="mt-1 text-xs text-muted-foreground">Lifetime of issued refresh tokens. Leave blank to use the default (2,592,000 = 30 days). Allowed: 300 – 31,536,000.</p>
            </div>
          </div>
          {formError && <p className="text-xs text-rose-600">{formError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={closeClientModal} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={editClient ? handleUpdate : handleCreate}
              disabled={
                editClient
                  ? updateClient.isPending || !formData.name || formData.allowedScopes.length === 0 || formData.grants.length === 0
                  : createClient.isPending || !formData.id || !formData.name || !formData.secret || formData.allowedScopes.length === 0 || formData.grants.length === 0
              }
              variant="primary"
            >
              {editClient ? (updateClient.isPending ? 'Saving…' : 'Save Changes') : (createClient.isPending ? 'Creating…' : 'Create Client')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resources modal */}
      <Modal isOpen={!!resourcesClient} onClose={() => setResourcesClient(null)} title={`Resources: ${resourcesClient?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Define the resource identifiers for this client. These appear as selectable resources in the role permission matrix.</p>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newResource}
              onChange={e => setNewResource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddResource() }}
              className="font-mono flex-1"
              placeholder="invoices"
            />
            <Button
              onClick={handleAddResource}
              disabled={!newResource.trim() || updateClient.isPending}
              variant="primary"
              className="shrink-0 px-3"
            >
              <Plus size={14} />
            </Button>
          </div>
          <div className="space-y-1.5">
            {(resourcesClient?.resources ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">No resources defined yet.</p>
            )}
            {(resourcesClient?.resources ?? []).map(r => (
              <div key={r} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border">
                <span className="text-sm font-mono text-foreground">{r}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-rose-600"
                  onClick={() => handleRemoveResource(r)}
                >
                  <X size={13} />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={() => setResourcesClient(null)} variant="secondary">
              Done
            </Button>
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
