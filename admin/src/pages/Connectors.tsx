import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Play, ChevronRight, X, Settings2, GitMerge, BarChart3 } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  useConnectors,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTriggerConnectorSync,
  useConnectorRuns,
  useConnectorMappings,
  useCreateConnectorMapping,
  useDeleteConnectorMapping,
  useAuthMetrics,
  type ConnectorDto,
  type ConnectorRunDto,
  type ConnectorMappingDto,
  type AuthMetricDto
} from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const ConnectorStatusBadge = ({ status }: { status: ConnectorDto['status'] }) => {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-50 text-slate-600 border-slate-200',
    error: 'bg-red-50 text-red-700 border-red-200'
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.inactive}`}>
      {status}
    </span>
  )
}

const RunStatusBadge = ({ status }: { status: ConnectorRunDto['status'] }) => {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    running: 'bg-blue-50 text-blue-700 border-blue-200',
    succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-slate-50 text-slate-500 border-slate-200'
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}

const ConnectorRunsPanel = ({
  connector,
  onClose
}: {
  connector: ConnectorDto
  onClose: () => void
}) => {
  const { data, refetch, isLoading } = useConnectorRuns(connector.id)
  const { data: mappingsData } = useConnectorMappings(connector.id)
  const createMapping = useCreateConnectorMapping()
  const deleteMapping = useDeleteConnectorMapping()
  const [tab, setTab] = useState<'runs' | 'mappings'>('runs')
  const [mappingForm, setMappingForm] = useState({ sourceField: '', targetField: '', transform: '' })
  const [showMappingForm, setShowMappingForm] = useState(false)

  const handleAddMapping = async () => {
    if (!mappingForm.sourceField || !mappingForm.targetField) return
    await createMapping.mutateAsync({
      connectorId: connector.id,
      data: {
        sourceField: mappingForm.sourceField,
        targetField: mappingForm.targetField,
        transform: mappingForm.transform || undefined
      }
    })
    setMappingForm({ sourceField: '', targetField: '', transform: '' })
    setShowMappingForm(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{connector.name}</h2>
            <p className="text-xs text-slate-500">
              {connector.type} · <span className="font-mono">{connector.id.slice(0, 8)}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-100">
          {(['runs', 'mappings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="max-h-[480px] overflow-y-auto p-6">
          {tab === 'runs' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Sync Runs</h3>
                <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              {isLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : !data?.data?.length ? (
                <p className="text-sm text-slate-500">No runs yet. Trigger a sync to create the first run.</p>
              ) : (
                <div className="space-y-2">
                  {data.data.map((run) => (
                    <div key={run.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <RunStatusBadge status={run.status} />
                        <span className="text-xs text-slate-400 font-mono">{run.id.slice(0, 8)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span>Imported: <strong>{run.recordsImported}</strong></span>
                        <span>Failed: <strong className={run.recordsFailed > 0 ? 'text-red-600' : ''}>{run.recordsFailed}</strong></span>
                      </div>
                      {run.errorMessage && (
                        <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{run.errorMessage}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Not started'}
                        {run.finishedAt && ` → ${new Date(run.finishedAt).toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'mappings' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Field Mappings</h3>
                <button
                  onClick={() => setShowMappingForm(!showMappingForm)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                >
                  <Plus className="h-3 w-3" /> Add Mapping
                </button>
              </div>

              {showMappingForm && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Source Field</label>
                      <input className={fieldCls} placeholder="e.g. mail" value={mappingForm.sourceField}
                        onChange={(e) => setMappingForm((f) => ({ ...f, sourceField: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Target Field</label>
                      <input className={fieldCls} placeholder="e.g. email" value={mappingForm.targetField}
                        onChange={(e) => setMappingForm((f) => ({ ...f, targetField: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Transform (optional)</label>
                    <input className={fieldCls} placeholder="e.g. lowercase" value={mappingForm.transform}
                      onChange={(e) => setMappingForm((f) => ({ ...f, transform: e.target.value }))} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowMappingForm(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                    <button onClick={handleAddMapping} disabled={createMapping.isPending}
                      className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                      Save
                    </button>
                  </div>
                </div>
              )}

              {!mappingsData?.data?.length ? (
                <p className="text-sm text-slate-500">No field mappings configured.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {mappingsData.data.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.sourceField}</code>
                        <span className="text-slate-400">→</span>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.targetField}</code>
                        {m.transform && <span className="text-xs text-slate-400">({m.transform})</span>}
                      </div>
                      <button onClick={() => deleteMapping.mutate({ connectorId: connector.id, mappingId: m.id })}
                        className="p-1 text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const defaultConnectorForm = () => ({
  name: '',
  type: 'scim' as ConnectorDto['type'],
  schedule: '',
  config: '{}'
})

const MetricsPanel = () => {
  const { data, isLoading } = useAuthMetrics()
  const metrics = data?.data ?? []

  const grouped = metrics.reduce<Record<string, number>>((acc, m) => {
    acc[m.event] = (acc[m.event] ?? 0) + m.count
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Auth Metrics (last 24h)</h3>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : !Object.keys(grouped).length ? (
        <p className="text-sm text-slate-500">No metric data available yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(grouped).map(([event, count]) => (
            <div key={event} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500 font-medium">{event.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{count.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Connectors() {
  const { data, isLoading, refetch } = useConnectors()
  const createConnector = useCreateConnector()
  const updateConnector = useUpdateConnector()
  const deleteConnector = useDeleteConnector()
  const triggerSync = useTriggerConnectorSync()

  const [tab, setTab] = useState<'connectors' | 'metrics'>('connectors')
  const [showCreate, setShowCreate] = useState(false)
  const [editConnector, setEditConnector] = useState<ConnectorDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectorDto | null>(null)
  const [detailConnector, setDetailConnector] = useState<ConnectorDto | null>(null)
  const [form, setForm] = useState(defaultConnectorForm())
  const [formError, setFormError] = useState<string | null>(null)

  const connectors = data?.data ?? []

  const openCreate = () => {
    setForm(defaultConnectorForm())
    setFormError(null)
    setShowCreate(true)
  }

  const openEdit = (c: ConnectorDto) => {
    setForm({ name: c.name, type: c.type, schedule: c.schedule ?? '', config: JSON.stringify(c.config, null, 2) })
    setFormError(null)
    setEditConnector(c)
  }

  const handleCreate = async () => {
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    await createConnector.mutateAsync({ name: form.name, type: form.type, config, schedule: form.schedule || undefined })
    setShowCreate(false)
  }

  const handleSave = async () => {
    if (!editConnector) return
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    await updateConnector.mutateAsync({ id: editConnector.id, data: { name: form.name, type: form.type, config, schedule: form.schedule || undefined } })
    setEditConnector(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteConnector.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleSync = async (id: string) => {
    await triggerSync.mutateAsync(id)
  }

  const ConnectorForm = ({ onSubmit, isLoading }: { onSubmit: () => void; isLoading: boolean }) => (
    <div className="space-y-4">
      {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>}
      <div>
        <label className={labelCls}>Name</label>
        <input className={fieldCls} placeholder="My Connector" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Type</label>
        <select className={fieldCls} value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ConnectorDto['type'] }))}>
          {(['ldap', 'scim', 'csv', 'sql', 'custom'] as const).map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Schedule (cron, optional)</label>
        <input className={fieldCls} placeholder="0 * * * *" value={form.schedule}
          onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Config (JSON)</label>
        <textarea
          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          rows={5}
          value={form.config}
          onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={() => { setShowCreate(false); setEditConnector(null) }}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
        <button onClick={onSubmit} disabled={isLoading}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {isLoading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connectors</h1>
          <p className="mt-1 text-sm text-slate-500">Manage external identity sources and view auth performance metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          {tab === 'connectors' && (
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              <Plus className="h-4 w-4" /> New Connector
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {([['connectors', 'Connectors'], ['metrics', 'Auth Metrics']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === key ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && <MetricsPanel />}

      {tab === 'connectors' && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">Loading connectors…</div>
          ) : !connectors.length ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <GitMerge className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No connectors yet</p>
              <p className="mt-1 text-xs text-slate-400">Create a connector to sync users from an external source.</p>
              <button onClick={openCreate} className="mt-4 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                <Plus className="h-4 w-4" /> New Connector
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {['Name', 'Type', 'Status', 'Schedule', 'Last Sync', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {connectors.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{c.type.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3"><ConnectorStatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.schedule ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSync(c.id)} disabled={triggerSync.isPending}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            title="Trigger sync">
                            <Play className="h-3.5 w-3.5" /> Sync
                          </button>
                          <button onClick={() => setDetailConnector(c)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                            title="View runs & mappings">
                            <ChevronRight className="h-3.5 w-3.5" /> Details
                          </button>
                          <button onClick={() => openEdit(c)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit">
                            <Settings2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(c)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="Delete">
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
        </>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Connector">
        <ConnectorForm onSubmit={handleCreate} isLoading={createConnector.isPending} />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editConnector} onClose={() => setEditConnector(null)} title="Edit Connector">
        <ConnectorForm onSubmit={handleSave} isLoading={updateConnector.isPending} />
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Connector"
        message={`Are you sure you want to delete connector "${deleteTarget?.name}"? This will also remove all runs and mappings.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Detail panel */}
      {detailConnector && (
        <ConnectorRunsPanel connector={detailConnector} onClose={() => setDetailConnector(null)} />
      )}
    </div>
  )
}
