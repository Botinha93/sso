import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import {
  useCreateProvisioningMapping,
  useCreateProvisioningToken,
  useDeleteProvisioningMapping,
  useDeleteProvisioningToken,
  useDeprovisioningQueue,
  useProvisioningJobs,
  useProvisioningMappings,
  useProvisioningTokens,
  useRunProvisioningReconcile,
  type DeprovisioningQueueItemDto
} from '../hooks/useApi'

const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

export default function ProvisioningAdminPanel() {
  const { data: tokens = [] } = useProvisioningTokens()
  const { data: mappings = [] } = useProvisioningMappings()
  const { data: jobs = [] } = useProvisioningJobs(15)
  const { data: deprovisioningQueue = [] } = useDeprovisioningQueue(20)
  const createToken = useCreateProvisioningToken()
  const deleteToken = useDeleteProvisioningToken()
  const createMapping = useCreateProvisioningMapping()
  const deleteMapping = useDeleteProvisioningMapping()
  const runReconcile = useRunProvisioningReconcile()

  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiryDate, setTokenExpiryDate] = useState('')
  const [tokenExpiryTime, setTokenExpiryTime] = useState('23:59')
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [sourceAttribute, setSourceAttribute] = useState('')
  const [targetAttribute, setTargetAttribute] = useState('')
  const [transformExpression, setTransformExpression] = useState('')

  const latestJob = useMemo(() => jobs[0], [jobs])

  const getStatusIcon = (status: DeprovisioningQueueItemDto['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-emerald-600" />
      case 'failed':
        return <XCircle size={16} className="text-red-600" />
      case 'in_progress':
        return <Clock size={16} className="text-blue-600 animate-spin" />
      default:
        return <AlertCircle size={16} className="text-amber-600" />
    }
  }

  const getStatusColor = (status: DeprovisioningQueueItemDto['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200'
    }
  }

  const createNewToken = async () => {
    setIssuedToken(null)
    const expiresAt = tokenExpiryDate
      ? new Date(`${tokenExpiryDate}T${tokenExpiryTime || '23:59'}:00`).toISOString()
      : undefined

    const created = await createToken.mutateAsync({
      label: tokenLabel,
      expiresAt
    })
    setIssuedToken(created.token)
    setTokenLabel('')
    setTokenExpiryDate('')
    setTokenExpiryTime('23:59')
  }

  const createNewMapping = async () => {
    await createMapping.mutateAsync({
      name: mappingName,
      sourceAttribute,
      targetAttribute,
      transformExpression: transformExpression || undefined,
      enabled: true
    })
    setMappingName('')
    setSourceAttribute('')
    setTargetAttribute('')
    setTransformExpression('')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-slate-900">SCIM Provisioning Tokens</h2>
        <p className="mt-1 text-sm text-slate-600">Issue one-time display bearer tokens for directory connectors and revoke them when rotating integrations.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={tokenLabel}
            onChange={(event) => setTokenLabel(event.target.value)}
            placeholder="okta-prod"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={tokenExpiryDate}
              onChange={(event) => setTokenExpiryDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
            <input
              type="time"
              value={tokenExpiryTime}
              onChange={(event) => setTokenExpiryTime(event.target.value)}
              step={60}
              disabled={!tokenExpiryDate}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Expiry is optional. Pick a date first, then an end time.</p>
        <div className="mt-3">
          <button
            onClick={createNewToken}
            disabled={createToken.isPending || tokenLabel.trim().length < 2}
            className="inline-flex h-9 items-center rounded-lg bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {createToken.isPending ? 'Issuing…' : 'Issue Token'}
          </button>
        </div>

        {issuedToken ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Copy now, this token is shown once</p>
            <p className="mt-2 break-all rounded border border-amber-200 bg-white px-2 py-1 font-mono">{issuedToken}</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {tokens.length === 0 ? <p className="text-sm text-slate-500">No provisioning tokens yet.</p> : null}
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{token.label}</p>
                <p className="text-xs text-slate-500">Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'}</p>
              </div>
              <button
                onClick={() => deleteToken.mutate(token.id)}
                disabled={deleteToken.isPending}
                className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-slate-900">Provisioning Mappings</h2>
        <p className="mt-1 text-sm text-slate-600">Map external directory attributes into local profile fields for lifecycle sync.</p>

        <div className="mt-4 grid gap-2">
          <input
            value={mappingName}
            onChange={(event) => setMappingName(event.target.value)}
            placeholder="Workday manager mapping"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={sourceAttribute}
              onChange={(event) => setSourceAttribute(event.target.value)}
              placeholder="urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager"
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
            <input
              value={targetAttribute}
              onChange={(event) => setTargetAttribute(event.target.value)}
              placeholder="customAttributes.managerId"
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
          </div>
          <input
            value={transformExpression}
            onChange={(event) => setTransformExpression(event.target.value)}
            placeholder="value?.toLowerCase()"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <div>
            <button
              onClick={createNewMapping}
              disabled={createMapping.isPending || mappingName.trim().length < 2 || sourceAttribute.trim().length === 0 || targetAttribute.trim().length === 0}
              className="inline-flex h-9 items-center rounded-lg bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {createMapping.isPending ? 'Saving…' : 'Add Mapping'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {mappings.length === 0 ? <p className="text-sm text-slate-500">No mappings configured.</p> : null}
          {mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{mapping.name}</p>
                <button
                  onClick={() => deleteMapping.mutate(mapping.id)}
                  disabled={deleteMapping.isPending}
                  className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600">{mapping.sourceAttribute} → {mapping.targetAttribute}</p>
              {mapping.transformExpression ? <p className="mt-1 text-xs text-slate-500">Transform: {mapping.transformExpression}</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">Run Reconciliation</p>
            <button
              onClick={() => runReconcile.mutate({ dryRun: true })}
              disabled={runReconcile.isPending}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {runReconcile.isPending ? 'Running…' : 'Run Dry-Run'}
            </button>
          </div>
          {latestJob ? (
            <p className="mt-2 text-xs text-slate-600">
              Last job: {latestJob.status} at {new Date(latestJob.createdAt).toLocaleString()} ({String((latestJob.summary as Record<string, unknown>).usersEvaluated ?? 0)} users scanned)
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No reconcile jobs yet.</p>
          )}
        </div>
      </section>

      <section className={`${sectionCls} xl:col-span-2`}>
        <h2 className="text-base font-semibold text-slate-900">Deprovisioning Queue</h2>
        <p className="mt-1 text-sm text-slate-600">Monitor pending revocation and deactivation tasks from provisioning sync operations.</p>

        {deprovisioningQueue.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
            No pending deprovisioning tasks.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">User</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Action</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Resource</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Reason</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {deprovisioningQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.userId.slice(0, 12)}…</td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{item.action}</code>
                    </td>
                    <td className="px-3 py-2 truncate text-slate-700">{item.resourceName}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{item.reason || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deprovisioningQueue.length > 10 && (
              <p className="mt-2 text-xs text-slate-500">Showing {deprovisioningQueue.length} tasks. Older tasks are automatically cleaned after completion.</p>
            )}
          </div>
        )}

        {deprovisioningQueue.some(item => item.status === 'failed') && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">⚠️ Failed deprovisioning tasks detected</p>
            <p className="mt-1 text-xs">Some deprovisioning operations have failed and may require manual intervention.</p>
          </div>
        )}
      </section>
    </div>
  )
}
