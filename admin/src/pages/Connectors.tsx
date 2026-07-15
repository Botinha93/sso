import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import Select from '../components/ui/Select'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Trash2, Play, Settings2, GitMerge } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import React from 'react';
import {
  useConnectors,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTriggerConnectorSync,
  type ConnectorDto,
} from '../hooks/useApi'

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

type SchedulePreset = 'none' | 'every_15m' | 'hourly' | 'daily_02_00' | 'weekly_mon_02_00' | 'custom_existing'

const scheduleFromPreset = (preset: Exclude<SchedulePreset, 'custom_existing'>): string => {
  if (preset === 'none') return ''
  if (preset === 'every_15m') return '*/15 * * * *'
  if (preset === 'hourly') return '0 * * * *'
  if (preset === 'daily_02_00') return '0 2 * * *'
  return '0 2 * * 1'
}

const presetFromSchedule = (schedule?: string | null): SchedulePreset => {
  const value = (schedule ?? '').trim()
  if (!value) return 'none'
  if (value === '*/15 * * * *') return 'every_15m'
  if (value === '0 * * * *') return 'hourly'
  if (value === '0 2 * * *') return 'daily_02_00'
  if (value === '0 2 * * 1') return 'weekly_mon_02_00'
  return 'custom_existing'
}

const ConnectorStatusBadge = ({ status }: { status: ConnectorDto['status'] }) => {
  const toneByStatus: Record<string, 'success' | 'neutral' | 'danger'> = {
    active: 'success',
    inactive: 'neutral',
    error: 'danger'
  }
  return (
    <StatusBadge tone={toneByStatus[status] ?? 'neutral'}>
      {status}
    </StatusBadge>
  )
}

const defaultConnectorForm = () => ({
  name: '',
  type: 'scim' as ConnectorDto['type'],
  schedulePreset: 'none' as SchedulePreset,
  schedule: '',
  config: '{}'
})

export default function Connectors() {
  const { data, isLoading, isFetching, refetch } = useConnectors()
  const createConnector = useCreateConnector()
  const updateConnector = useUpdateConnector()
  const deleteConnector = useDeleteConnector()
  const triggerSync = useTriggerConnectorSync()

  const [showCreate, setShowCreate] = useState(false)
  const [editConnector, setEditConnector] = useState<ConnectorDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectorDto | null>(null)
  const [form, setForm] = useState(defaultConnectorForm())
  const [formError, setFormError] = useState<string | null>(null)

  const connectors = data?.data ?? []

  const openCreate = () => {
    setForm(defaultConnectorForm())
    setFormError(null)
    setShowCreate(true)
  }

  const openEdit = (c: ConnectorDto) => {
    setForm({
      name: c.name,
      type: c.type,
      schedulePreset: presetFromSchedule(c.schedule),
      schedule: c.schedule ?? '',
      config: JSON.stringify(c.config, null, 2)
    })
    setFormError(null)
    setEditConnector(c)
  }

  const resolveSchedule = () => {
    if (form.schedulePreset === 'custom_existing') {
      return form.schedule
    }
    return scheduleFromPreset(form.schedulePreset)
  }

  const handleCreate = async () => {
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    setFormError(null)
    const schedule = resolveSchedule()
    try {
      await createConnector.mutateAsync({ name: form.name, type: form.type, config, schedule: schedule || undefined })
      setShowCreate(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create connector')
    }
  }

  const handleSave = async () => {
    if (!editConnector) return
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    setFormError(null)
    const schedule = resolveSchedule()
    try {
      await updateConnector.mutateAsync({ id: editConnector.id, data: { name: form.name, type: form.type, config, schedule: schedule || undefined } })
      setEditConnector(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update connector')
    }
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
      {formError && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{formError}</div>}
      <div>
        <label className={labelCls}>Name</label>
        <Input placeholder="My Connector" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Type</label>
        <Select value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ConnectorDto['type'] }))}>
          {(['ldap', 'scim', 'csv', 'sql', 'custom'] as const).map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className={labelCls}>Sync Schedule (optional)</label>
        <Select
          value={form.schedulePreset}
          onChange={(e) => setForm((f) => ({ ...f, schedulePreset: e.target.value as SchedulePreset }))}
        >
          <option value="none">Manual only (no automatic sync)</option>
          <option value="every_15m">Every 15 minutes</option>
          <option value="hourly">Every hour</option>
          <option value="daily_02_00">Daily at 02:00</option>
          <option value="weekly_mon_02_00">Weekly on Monday at 02:00</option>
          {form.schedulePreset === 'custom_existing' ? <option value="custom_existing">Keep existing custom schedule</option> : null}
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          Automatic sync cadence is selected as a policy option; cron syntax is handled internally.
        </p>
        {form.schedulePreset === 'custom_existing' ? (
          <p className="mt-1 text-xs text-amber-700">
            This connector currently uses a custom legacy schedule. Choose another option to replace it.
          </p>
        ) : null}
      </div>
      <div>
        <label className={labelCls}>Config (JSON)</label>
        <Textarea
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          rows={5}
          value={form.config}
          onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={() => { setShowCreate(false); setEditConnector(null) }}>Cancel</Button>
        <Button variant="primary" onClick={onSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data Sync"
        title="Connectors"
        description="Manage external identity sources and sync execution."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/metrics" className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted/50">View Auth Metrics</Link>
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Connector
            </Button>
          </div>
        }
      />

      <>
          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : !connectors.length ? (
            <EmptyState
              icon={GitMerge}
              title="No connectors yet"
              description="Create a connector to sync users from an external source."
              action={<Button variant="primary" size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> New Connector</Button>}
            />
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    {['Name', 'Type', 'Status', 'Schedule', 'Last Sync', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {connectors.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{c.type.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3"><ConnectorStatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.schedule ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => handleSync(c.id)}
                            disabled={triggerSync.isPending}
                            title="Trigger sync"
                          >
                            <Play className="h-3.5 w-3.5" /> Sync
                          </Button>
                          <Link
                            to={`/connectors/${c.id}`}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                            title="View connector details"
                          >
                            Details
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(c)}
                            title="Edit"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-rose-50 hover:text-rose-500"
                            onClick={() => setDeleteTarget(c)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
      </>

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
    </div>
  )
}
