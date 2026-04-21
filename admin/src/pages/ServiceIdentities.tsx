import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, Key, RotateCw, Copy, Eye, EyeOff, ChevronRight, X } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  useServiceIdentities,
  useCreateServiceIdentity,
  useUpdateServiceIdentity,
  useDeleteServiceIdentity,
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

const statusBadge = (status: ServiceIdentityDto['status']) => {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-50 text-slate-600 border-slate-200',
    suspended: 'bg-red-50 text-red-700 border-red-200'
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.inactive}`}>
      {status}
    </span>
  )
}

const defaultForm = () => ({
  name: '',
  description: '',
  status: 'active' as ServiceIdentityDto['status'],
  allowedScopes: '',
  allowedAudiences: ''
})

interface NewSecretInfo {
  clientId: string
  plainClientSecret: string
}

const ServiceIdentityDetail = ({
  identity,
  onClose
}: {
  identity: ServiceIdentityDto
  onClose: () => void
}) => {
  const { data, refetch } = useServiceIdentity(identity.id)
  const issueCredential = useIssueServiceIdentityCredential()
  const rotateCredential = useRotateServiceIdentityCredential()
  const revokeCredential = useRevokeServiceIdentityCredential()
  const { data: usageData, refetch: refetchUsage } = useServiceIdentityUsage(identity.id)
  const updateIdentity = useUpdateServiceIdentity()
  const [expiresInDays, setExpiresInDays] = useState<string>('365')
  const [newSecret, setNewSecret] = useState<NewSecretInfo | null>(null)
  const [secretVisible, setSecretVisible] = useState(false)
  const [credentialToRevoke, setCredentialToRevoke] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    description: identity.description ?? '',
    status: identity.status,
    allowedScopes: identity.allowedScopes.join(', '),
    allowedAudiences: identity.allowedAudiences.join(', ')
  })

  const si = data ?? identity

  useEffect(() => {
    setEditForm({
      description: si.description ?? '',
      status: si.status,
      allowedScopes: si.allowedScopes.join(', '),
      allowedAudiences: si.allowedAudiences.join(', ')
    })
  }, [si.description, si.status, si.allowedScopes, si.allowedAudiences])

  const usage = usageData?.data ?? []

  const handleSaveIdentity = async () => {
    await updateIdentity.mutateAsync({
      id: si.id,
      data: {
        description: editForm.description || undefined,
        status: editForm.status,
        allowedScopes: editForm.allowedScopes.split(',').map((value) => value.trim()).filter(Boolean),
        allowedAudiences: editForm.allowedAudiences.split(',').map((value) => value.trim()).filter(Boolean)
      }
    })
    await refetch()
    await refetchUsage()
  }

  const handleIssueCredential = async () => {
    const result = await issueCredential.mutateAsync({
      id: si.id,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined
    })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    refetch()
    await refetch()
    await refetchUsage()
  }

  const handleRotate = async (credentialId: string) => {
    const result = await rotateCredential.mutateAsync({ id: si.id, credentialId })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    refetch()
    await refetch()
    await refetchUsage()
  }

  const handleRevoke = async () => {
    if (!credentialToRevoke) return
    await revokeCredential.mutateAsync({ id: si.id, credentialId: credentialToRevoke })
    setCredentialToRevoke(null)
    refetch()
    await refetch()
    await refetchUsage()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{si.name}</h2>
          {si.description && <p className="text-sm text-slate-500 mt-0.5">{si.description}</p>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Identity Settings</h3>
                <div>
                  <label className={labelCls}>Description</label>
                  <input
                    className={fieldCls}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Status</label>
                    <select
                      className={fieldCls}
                      value={editForm.status}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as ServiceIdentityDto['status'] }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Allowed Scopes</label>
                    <input
                      className={fieldCls}
                      value={editForm.allowedScopes}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, allowedScopes: e.target.value }))}
                      placeholder="read:users, write:reports"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Allowed Audiences</label>
                  <input
                    className={fieldCls}
                    value={editForm.allowedAudiences}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, allowedAudiences: e.target.value }))}
                    placeholder="api.example.com"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveIdentity}
                    disabled={updateIdentity.isPending}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {updateIdentity.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</span>
          <div className="mt-1">{statusBadge(si.status)}</div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">ID</span>
          <p className="mt-1 font-mono text-xs text-slate-600 truncate">{si.id}</p>
        </div>
        {si.allowedScopes.length > 0 && (
          <div className="col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed Scopes</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {si.allowedScopes.map(s => (
                <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{s}</span>
              ))}
            </div>
          </div>
        )}
        {si.allowedAudiences.length > 0 && (
          <div className="col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed Audiences</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {si.allowedAudiences.map(a => (
                <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{a}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {newSecret && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900 mb-2">⚠ Save Client Secret — shown only once</p>
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
                <button onClick={() => setSecretVisible(!secretVisible)} className="p-1 text-amber-600 hover:text-amber-800">
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
          <h3 className="text-sm font-semibold text-slate-900">Credentials</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1" max="3650"
              value={expiresInDays}
              onChange={e => setExpiresInDays(e.target.value)}
              placeholder="Expires (days)"
              className="h-7 w-28 rounded border border-slate-200 px-2 text-xs text-slate-700"
            />
            <button
              onClick={handleIssueCredential}
              disabled={issueCredential.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Key className="h-3.5 w-3.5" />
              Issue Credential
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(si.credentials ?? []).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No credentials yet.</p>
          )}
          {(si.credentials ?? []).map((cred: ServiceIdentityCredentialDto) => {
            const isRevoked = !!cred.revokedAt
            const isExpired = cred.expiresAt ? new Date(cred.expiresAt) < new Date() : false
            const credStatus = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active'

            return (
              <div key={cred.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isRevoked || isExpired ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono text-slate-700 truncate block">{cred.clientId}</code>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span className={`font-medium ${credStatus === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{credStatus}</span>
                    {cred.expiresAt && <span>Expires {new Date(cred.expiresAt).toLocaleDateString()}</span>}
                    {cred.lastUsedAt && <span>Last used {new Date(cred.lastUsedAt).toLocaleString()}</span>}
                  </div>
                </div>
                {!isRevoked && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleRotate(cred.id)}
                      title="Rotate"
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCredentialToRevoke(cred.id)}
                      title="Revoke"
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
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
  const [selectedIdentity, setSelectedIdentity] = useState<ServiceIdentityDto | null>(null)
  const [identityToDelete, setIdentityToDelete] = useState<string | null>(null)
  const [formData, setFormData] = useState(defaultForm)

  const { data, isLoading, refetch } = useServiceIdentities()
  const createIdentity = useCreateServiceIdentity()
  const deleteIdentity = useDeleteServiceIdentity()

  const identities: ServiceIdentityDto[] = (data as any)?.data ?? []

  const handleCreate = async () => {
    if (!formData.name) return
    await createIdentity.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      allowedScopes: formData.allowedScopes.split(',').map(s => s.trim()).filter(Boolean),
      allowedAudiences: formData.allowedAudiences.split(',').map(s => s.trim()).filter(Boolean)
    })
    setCreateModalOpen(false)
    setFormData(defaultForm())
    refetch()
  }

  const handleDelete = async () => {
    if (!identityToDelete) return
    await deleteIdentity.mutateAsync(identityToDelete)
    setIdentityToDelete(null)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Identities</h1>
          <p className="text-sm text-slate-500 mt-1">Manage non-human identities for machine-to-machine authentication.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Identity
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">Loading...</div>
      ) : identities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="rounded-full bg-slate-100 p-4 mb-4">
            <Key className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No service identities yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to enable machine-to-machine authentication</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create Service Identity
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Scopes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {identities.map((identity) => (
                <tr key={identity.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{identity.name}</p>
                      {identity.description && <p className="text-xs text-slate-500">{identity.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(identity.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {identity.allowedScopes.slice(0, 3).map(s => (
                        <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{s}</span>
                      ))}
                      {identity.allowedScopes.length > 3 && (
                        <span className="text-xs text-slate-400">+{identity.allowedScopes.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(identity.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedIdentity(identity)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        Manage <ChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setIdentityToDelete(identity.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createModalOpen} onClose={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} title="New Service Identity">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={fieldCls}
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="my-worker-service"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={fieldCls}
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
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
            <label className={labelCls}>Allowed Scopes (comma-separated)</label>
            <input
              className={fieldCls}
              value={formData.allowedScopes}
              onChange={e => setFormData(f => ({ ...f, allowedScopes: e.target.value }))}
              placeholder="read:users, write:reports"
            />
          </div>
          <div>
            <label className={labelCls}>Allowed Audiences (comma-separated)</label>
            <input
              className={fieldCls}
              value={formData.allowedAudiences}
              onChange={e => setFormData(f => ({ ...f, allowedAudiences: e.target.value }))}
              placeholder="api.example.com"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name || createIdentity.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createIdentity.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail slide-over */}
      <Modal
        isOpen={!!selectedIdentity}
        onClose={() => setSelectedIdentity(null)}
        title=""
        size="lg"
      >
        {selectedIdentity && (
          <ServiceIdentityDetail
            identity={selectedIdentity}
            onClose={() => setSelectedIdentity(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!identityToDelete}
        title="Delete Service Identity"
        message="This will permanently delete the service identity and all of its credentials. Services using these credentials will lose access immediately."
        onConfirm={handleDelete}
        onCancel={() => setIdentityToDelete(null)}
      />
    </div>
  )
}

export default ServiceIdentities
