import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, Key, RotateCw, Copy, Eye, EyeOff, Pencil, X, Bot } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  useServiceIdentities,
  useCreateServiceIdentity,
  useUpdateServiceIdentity,
  useDeleteServiceIdentity,
  useScopes,
  useRoles,
  useGroups,
  useServiceIdentity,
  useServiceIdentityUsage,
  useIssueServiceIdentityCredential,
  useRotateServiceIdentityCredential,
  useRevokeServiceIdentityCredential,
  type ServiceIdentityDto,
  type ServiceIdentityCredentialDto
} from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const defaultForm = () => ({
  name: '',
  description: '',
  status: 'active' as ServiceIdentityDto['status'],
  allowedScopes: [] as string[],
  roleIds: [] as string[],
  groupIds: [] as string[],
  allowedAudiences: ''
})

interface NewSecretInfo {
  clientId: string
  plainClientSecret: string
}

const statusBadge = (status: ServiceIdentityDto['status']) => {
  const styles: Record<ServiceIdentityDto['status'], string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    suspended: 'bg-red-50 text-red-600 border-red-100'
  }

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-md border ${styles[status]}`}>
      {status}
    </span>
  )
}

function parseCommaSeparated(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function toggleScopeSelection(scopes: string[], scopeName: string) {
  return scopes.includes(scopeName)
    ? scopes.filter((scope) => scope !== scopeName)
    : [...scopes, scopeName]
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

const CredentialsPanel = ({
  identity,
}: {
  identity: ServiceIdentityDto
}) => {
  const { data, refetch } = useServiceIdentity(identity.id)
  const { data: usageData, refetch: refetchUsage } = useServiceIdentityUsage(identity.id)
  const issueCredential = useIssueServiceIdentityCredential()
  const rotateCredential = useRotateServiceIdentityCredential()
  const revokeCredential = useRevokeServiceIdentityCredential()
  const [expiresInDays, setExpiresInDays] = useState<string>('365')
  const [newSecret, setNewSecret] = useState<NewSecretInfo | null>(null)
  const [secretVisible, setSecretVisible] = useState(false)
  const [credentialToRevoke, setCredentialToRevoke] = useState<string | null>(null)

  const si = data ?? identity
  const usage = usageData?.data ?? []

  const refreshAll = async () => {
    await refetch()
    await refetchUsage()
  }

  const handleIssueCredential = async () => {
    const result = await issueCredential.mutateAsync({
      id: si.id,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined
    })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    await refreshAll()
  }

  const handleRotate = async (credentialId: string) => {
    const result = await rotateCredential.mutateAsync({ id: si.id, credentialId })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    await refreshAll()
  }

  const handleRevoke = async () => {
    if (!credentialToRevoke) return
    await revokeCredential.mutateAsync({ id: si.id, credentialId: credentialToRevoke })
    setCredentialToRevoke(null)
    await refreshAll()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Status</label>
          <div className="h-9 flex items-center">{statusBadge(si.status)}</div>
        </div>
        <div>
          <label className={labelCls}>Identity ID</label>
          <div className="h-9 flex items-center rounded-lg border border-slate-200 px-3 text-xs font-mono text-slate-600 truncate">
            {si.id}
          </div>
        </div>
      </div>

      {newSecret && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900 mb-2">Save this OAuth client secret. It is shown only once.</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-amber-700 mb-1">Client ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white border border-amber-200 px-2 py-1 text-xs font-mono text-slate-800">{newSecret.clientId}</code>
                <button onClick={() => navigator.clipboard.writeText(newSecret.clientId)} className="p-1 text-amber-600 hover:text-amber-800">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-amber-700 mb-1">Client Secret</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white border border-amber-200 px-2 py-1 text-xs font-mono text-slate-800">
                  {secretVisible ? newSecret.plainClientSecret : '••••••••••••••••••••••••••••••••'}
                </code>
                <button onClick={() => setSecretVisible((prev) => !prev)} className="p-1 text-amber-600 hover:text-amber-800">
                  {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => navigator.clipboard.writeText(newSecret.plainClientSecret)} className="p-1 text-amber-600 hover:text-amber-800">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-3 text-xs text-amber-700 underline">Dismiss</button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">OAuth Client Credentials</h3>
            <p className="mt-0.5 text-xs text-slate-500">Use these with /oauth/token and grant_type=client_credentials.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="3650"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Expires (days)"
              className="h-8 w-28 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
            />
            <button
              onClick={handleIssueCredential}
              disabled={issueCredential.isPending}
              className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Key className="h-3.5 w-3.5" />
              Issue Client Secret
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(si.credentials ?? []).length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm rounded-xl border border-slate-200">No credentials yet</div>
          ) : (
            (si.credentials ?? []).map((cred: ServiceIdentityCredentialDto) => {
              const isRevoked = !!cred.revokedAt
              const isExpired = cred.expiresAt ? new Date(cred.expiresAt) < new Date() : false
              const status = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active'

              return (
                <div key={cred.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <code className="text-xs font-mono text-slate-700 truncate block">{cred.clientId}</code>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className={`font-medium ${status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{status}</span>
                      {cred.expiresAt && <span>Expires {new Date(cred.expiresAt).toLocaleDateString()}</span>}
                      {cred.lastUsedAt && <span>Last used {new Date(cred.lastUsedAt).toLocaleString()}</span>}
                    </div>
                  </div>
                  {!isRevoked && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRotate(cred.id)}
                        title="Rotate credential"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setCredentialToRevoke(cred.id)}
                        title="Revoke credential"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Credential Usage Telemetry</h3>
          <button onClick={() => refetchUsage()} className="text-xs text-slate-500 hover:text-slate-700">Refresh</button>
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-slate-500">No usage telemetry available yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {usage.map((entry) => (
              <div key={entry.credentialId} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-xs font-mono text-slate-700">{entry.clientId}</p>
                  <p className="text-xs text-slate-500">{entry.lastUsedAt ? `Last used ${new Date(entry.lastUsedAt).toLocaleString()}` : 'Never used'}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${entry.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : entry.status === 'expired' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!credentialToRevoke}
        title="Revoke Credential"
        message="This will permanently revoke the credential. Any service using it will lose access immediately."
        onConfirm={handleRevoke}
        onCancel={() => setCredentialToRevoke(null)}
      />
    </div>
  )
}

const ServiceIdentities = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [identityToEdit, setIdentityToEdit] = useState<ServiceIdentityDto | null>(null)
  const [identityToManage, setIdentityToManage] = useState<ServiceIdentityDto | null>(null)
  const [identityToDelete, setIdentityToDelete] = useState<ServiceIdentityDto | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceIdentityDto['status']>('all')
  const [formData, setFormData] = useState(defaultForm)
  const [editFormData, setEditFormData] = useState(defaultForm)

  const { data, isLoading, refetch } = useServiceIdentities()
  const { data: scopes = [] } = useScopes()
  const { data: roles = [] } = useRoles()
  const { data: groups = [] } = useGroups()
  const createIdentity = useCreateServiceIdentity()
  const updateIdentity = useUpdateServiceIdentity()
  const deleteIdentity = useDeleteServiceIdentity()

  const identities: ServiceIdentityDto[] = (data as any)?.data ?? []
  const filteredIdentities = identities.filter((identity) => statusFilter === 'all' ? true : identity.status === statusFilter)

  useEffect(() => {
    if (!identityToEdit) return
    setEditFormData({
      name: identityToEdit.name,
      description: identityToEdit.description ?? '',
      status: identityToEdit.status,
      allowedScopes: [...identityToEdit.allowedScopes],
      roleIds: [...(identityToEdit.roleIds ?? [])],
      groupIds: [...(identityToEdit.groupIds ?? [])],
      allowedAudiences: identityToEdit.allowedAudiences.join(', ')
    })
  }, [identityToEdit])

  const handleCreate = async () => {
    if (!formData.name) return
    await createIdentity.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      allowedScopes: formData.allowedScopes,
      roleIds: formData.roleIds,
      groupIds: formData.groupIds,
      allowedAudiences: parseCommaSeparated(formData.allowedAudiences)
    })
    setCreateModalOpen(false)
    setFormData(defaultForm())
    refetch()
  }

  const handleEdit = (identity: ServiceIdentityDto) => {
    setIdentityToEdit(identity)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!identityToEdit || !editFormData.name) return
    await updateIdentity.mutateAsync({
      id: identityToEdit.id,
      data: {
        name: editFormData.name,
        description: editFormData.description || undefined,
        status: editFormData.status,
        allowedScopes: editFormData.allowedScopes,
        roleIds: editFormData.roleIds,
        groupIds: editFormData.groupIds,
        allowedAudiences: parseCommaSeparated(editFormData.allowedAudiences)
      }
    })
    setEditModalOpen(false)
    setIdentityToEdit(null)
    setEditFormData(defaultForm())
    refetch()
  }

  const handleDelete = async () => {
    if (!identityToDelete) return
    await deleteIdentity.mutateAsync(identityToDelete.id)
    setIdentityToDelete(null)
    refetch()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Machine Directory"
        title="Service Identities"
        action={
          <button
            onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true) }}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            New Identity
          </button>
        }
      />

      <div className="mb-4 max-w-sm">
        <label className={labelCls}>Filter by Status</label>
        <select className={fieldCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ServiceIdentityDto['status'])}>
          <option value="all">All Identities</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Service Identities</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredIdentities.length === 0 ? (
          <EmptyState
            title="No service identities registered"
            description="Create a machine identity, then issue an OAuth client ID and secret for client-credentials tokens."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredIdentities.map((identity) => (
              <div key={identity.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900">{identity.name}</p>
                    {statusBadge(identity.status)}
                  </div>
                  <p className="text-xs text-slate-500">{identity.description || 'No description'}</p>
                  {identity.allowedScopes.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {identity.allowedScopes.map((scope) => (
                        <span key={scope} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">{scope}</span>
                      ))}
                    </div>
                  )}
                  {identity.allowedAudiences.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {identity.allowedAudiences.map((audience) => (
                        <span key={audience} className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">{audience}</span>
                      ))}
                    </div>
                  )}
                  {!!identity.roleIds?.length && (
                    <p className="text-xs text-slate-500">Direct roles: {identity.roleIds.length}</p>
                  )}
                  {!!identity.groupIds?.length && (
                    <p className="text-xs text-slate-500">Group memberships: {identity.groupIds.length}</p>
                  )}
                  <p className="text-xs text-slate-400 font-mono">Created {new Date(identity.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setIdentityToManage(identity)
                      setManageModalOpen(true)
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Manage Credentials
                  </button>
                  <button
                    onClick={() => handleEdit(identity)}
                    disabled={updateIdentity.isPending}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Edit identity"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setIdentityToDelete(identity)}
                    disabled={deleteIdentity.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    title="Delete identity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createModalOpen} onClose={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} title="Create Service Identity">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              className={fieldCls}
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="reporting-worker"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={fieldCls}
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Machine identity for scheduled reporting jobs"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={fieldCls}
                value={formData.status}
                onChange={e => setFormData(f => ({ ...f, status: e.target.value as ServiceIdentityDto['status'] }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Token Scopes</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(scopes as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No scopes defined.</p>}
                {(scopes as any[]).map((scope: any) => (
                  <label key={scope.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedScopes.includes(scope.name)}
                      onChange={() => setFormData((f) => ({ ...f, allowedScopes: toggleScopeSelection(f.allowedScopes, scope.name) }))}
                      className="rounded border-slate-300"
                    />
                    <span className="font-mono">{scope.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Token Audiences</label>
            <input
              className={fieldCls}
              value={formData.allowedAudiences}
              onChange={e => setFormData(f => ({ ...f, allowedAudiences: e.target.value }))}
              placeholder="api.example.com, jobs.internal"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Direct Roles</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(roles as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No roles defined.</p>}
                {(roles as any[]).map((role: any) => (
                  <label key={role.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.roleIds.includes(role.id)}
                      onChange={() => setFormData((f) => ({ ...f, roleIds: toggleSelection(f.roleIds, role.id) }))}
                      className="rounded border-slate-300"
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Groups</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(groups as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No groups defined.</p>}
                {(groups as any[]).map((group: any) => (
                  <label key={group.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.groupIds.includes(group.id)}
                      onChange={() => setFormData((f) => ({ ...f, groupIds: toggleSelection(f.groupIds, group.id) }))}
                      className="rounded border-slate-300"
                    />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name || createIdentity.isPending}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {createIdentity.isPending ? 'Creating…' : 'Create Identity'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setIdentityToEdit(null) }} title={`Edit Service Identity${identityToEdit ? `: ${identityToEdit.name}` : ''}`}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              className={fieldCls}
              value={editFormData.name}
              onChange={e => setEditFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="reporting-worker"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={fieldCls}
              value={editFormData.description}
              onChange={e => setEditFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Machine identity for scheduled reporting jobs"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={fieldCls}
                value={editFormData.status}
                onChange={e => setEditFormData(f => ({ ...f, status: e.target.value as ServiceIdentityDto['status'] }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Token Scopes</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(scopes as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No scopes defined.</p>}
                {(scopes as any[]).map((scope: any) => (
                  <label key={scope.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.allowedScopes.includes(scope.name)}
                      onChange={() => setEditFormData((f) => ({ ...f, allowedScopes: toggleScopeSelection(f.allowedScopes, scope.name) }))}
                      className="rounded border-slate-300"
                    />
                    <span className="font-mono">{scope.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Token Audiences</label>
            <input
              className={fieldCls}
              value={editFormData.allowedAudiences}
              onChange={e => setEditFormData(f => ({ ...f, allowedAudiences: e.target.value }))}
              placeholder="api.example.com, jobs.internal"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Direct Roles</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(roles as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No roles defined.</p>}
                {(roles as any[]).map((role: any) => (
                  <label key={role.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.roleIds.includes(role.id)}
                      onChange={() => setEditFormData((f) => ({ ...f, roleIds: toggleSelection(f.roleIds, role.id) }))}
                      className="rounded border-slate-300"
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Groups</label>
              <div className="rounded-lg border border-slate-200 p-2 max-h-[140px] overflow-auto bg-slate-50/40 space-y-1.5">
                {(groups as any[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No groups defined.</p>}
                {(groups as any[]).map((group: any) => (
                  <label key={group.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.groupIds.includes(group.id)}
                      onChange={() => setEditFormData((f) => ({ ...f, groupIds: toggleSelection(f.groupIds, group.id) }))}
                      className="rounded border-slate-300"
                    />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setEditModalOpen(false); setIdentityToEdit(null) }} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editFormData.name || updateIdentity.isPending}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {updateIdentity.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={manageModalOpen} onClose={() => { setManageModalOpen(false); setIdentityToManage(null) }} title={`Manage Credentials${identityToManage ? `: ${identityToManage.name}` : ''}`} size="lg">
        {identityToManage && <CredentialsPanel identity={identityToManage} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!identityToDelete}
        title="Delete Service Identity"
        message={`Delete service identity "${identityToDelete?.name ?? ''}"? This will permanently revoke all associated credentials.`}
        onConfirm={handleDelete}
        onCancel={() => setIdentityToDelete(null)}
      />
    </div>
  )
}

export default ServiceIdentities
