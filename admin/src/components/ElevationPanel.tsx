import Card from './ui/Card'
import Textarea from './ui/Textarea'
import Select from './ui/Select'
import { useState } from 'react'
import { ShieldAlert, Plus, CheckCircle, PlayCircle, XCircle, Clock, Zap } from 'lucide-react'
import {
  useElevationRequests,
  useCreateElevationRequest,
  useApproveElevationRequest,
  useActivateElevationRequest,
  useRevokeElevationRequest,
  useBreakGlassElevation,
  type ElevationRequestDto
} from '../hooks/useApi'
import ElevationSessionList from './ElevationSessionList'

const statusColors: Record<ElevationRequestDto['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  revoked: 'bg-rose-100 text-rose-800',
  expired: 'bg-muted text-muted-foreground'
}

const statusLabels: Record<ElevationRequestDto['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired'
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'
const btnPrimary = 'inline-flex h-9 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50'
const btnSecondary = 'inline-flex h-7 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50'

interface CreateFormState {
  justification: string
  resource: string
  action: string
  durationMinutes: string
}

const defaultForm: CreateFormState = {
  justification: '',
  resource: '',
  action: '',
  durationMinutes: '60'
}

export default function ElevationPanel() {
  const [statusFilter, setStatusFilter] = useState<ElevationRequestDto['status'] | undefined>(undefined)
  const [form, setForm] = useState<CreateFormState>(defaultForm)
  const [error, setError] = useState<string | null>(null)

  const [bgForm, setBgForm] = useState({ resource: '', action: '', reason: '', durationMinutes: '60' })
  const [bgSuccess, setBgSuccess] = useState<string | null>(null)
  const [bgError, setBgError] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useElevationRequests(statusFilter)
  const createRequest = useCreateElevationRequest()
  const approveRequest = useApproveElevationRequest()
  const activateRequest = useActivateElevationRequest()
  const revokeRequest = useRevokeElevationRequest()
  const breakGlass = useBreakGlassElevation()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await createRequest.mutateAsync({
        justification: form.justification,
        resource: form.resource,
        action: form.action,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined
      })
      setForm(defaultForm)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create elevation request')
    }
  }

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault()
    setBgError(null)
    setBgSuccess(null)
    try {
      await breakGlass.mutateAsync({
        resource: bgForm.resource,
        action: bgForm.action,
        reason: bgForm.reason,
        durationMinutes: bgForm.durationMinutes ? Number(bgForm.durationMinutes) : undefined
      })
      setBgForm({ resource: '', action: '', reason: '', durationMinutes: '60' })
      setBgSuccess('Emergency break-glass elevation granted and audited.')
    } catch (err: unknown) {
      setBgError(err instanceof Error ? err.message : 'Break-glass failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Privileged Access Elevations</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Form */}
        <Card className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Request Elevation</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelCls}>Justification</label>
              <Textarea
                value={form.justification}
                onChange={e => setForm(v => ({ ...v, justification: e.target.value }))}
                rows={3}
                required
                placeholder="Describe why elevated access is needed"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Resource</label>
                <input
                  value={form.resource}
                  onChange={e => setForm(v => ({ ...v, resource: e.target.value }))}
                  required
                  placeholder="admin:users"
                />
              </div>
              <div>
                <label className={labelCls}>Action</label>
                <input
                  value={form.action}
                  onChange={e => setForm(v => ({ ...v, action: e.target.value }))}
                  required
                  placeholder="delete"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Duration (minutes)</label>
              <input
                type="number"
                min={1}
                max={480}
                value={form.durationMinutes}
                onChange={e => setForm(v => ({ ...v, durationMinutes: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Maximum 480 minutes (8 hours)</p>
            </div>
            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : null}
            <button type="submit" disabled={createRequest.isPending} className={btnPrimary}>
              <Plus size={14} className="mr-1.5" />
              {createRequest.isPending ? 'Creating…' : 'Request Elevation'}
            </button>
          </form>
        </Card>

        {/* Requests List */}
        <Card className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Elevation Requests</h3>
            <Select
              value={statusFilter ?? ''}
              onChange={e => setStatusFilter((e.target.value as ElevationRequestDto['status']) || undefined)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No elevation requests found.</p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{req.justification}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{req.resource}</span>
                        {' → '}
                        <span className="font-mono">{req.action}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[req.status]}`}>
                      {statusLabels[req.status]}
                    </span>
                  </div>
                  {req.expiresAt ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      Expires {new Date(req.expiresAt).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {req.status === 'pending' ? (
                      <button
                        onClick={() => approveRequest.mutate(req.id)}
                        disabled={approveRequest.isPending}
                        className={btnSecondary}
                      >
                        <CheckCircle size={11} className="mr-1 text-emerald-600" />
                        Approve
                      </button>
                    ) : null}
                    {req.status === 'approved' ? (
                      <button
                        onClick={() => activateRequest.mutate(req.id)}
                        disabled={activateRequest.isPending}
                        className={btnSecondary}
                      >
                        <PlayCircle size={11} className="mr-1 text-blue-600" />
                        Activate
                      </button>
                    ) : null}
                    {(req.status === 'active' || req.status === 'approved') ? (
                      <button
                        onClick={() => revokeRequest.mutate(req.id)}
                        disabled={revokeRequest.isPending}
                        className={`${btnSecondary} text-rose-700`}
                      >
                        <XCircle size={11} className="mr-1" />
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <ElevationSessionList />
      </div>

      {/* Break-Glass Section */}
      <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-rose-500" />
          <h3 className="text-sm font-semibold text-rose-800">Emergency Break-Glass</h3>
        </div>
        <p className="text-xs text-rose-700 mb-4">Grants immediate elevation without approval. All break-glass activations are permanently audited and require justification.</p>
        <form onSubmit={handleBreakGlass} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Resource</label>
              <input value={bgForm.resource} onChange={e => setBgForm(v => ({ ...v, resource: e.target.value }))} required placeholder="admin:users" />
            </div>
            <div>
              <label className={labelCls}>Action</label>
              <input value={bgForm.action} onChange={e => setBgForm(v => ({ ...v, action: e.target.value }))} required placeholder="delete" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Reason (required)</label>
            <Textarea value={bgForm.reason} onChange={e => setBgForm(v => ({ ...v, reason: e.target.value }))} rows={2} required placeholder="Describe the emergency requiring break-glass access" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20" />
          </div>
          <div>
            <label className={labelCls}>Duration (minutes)</label>
            <input type="number" min={1} max={480} value={bgForm.durationMinutes} onChange={e => setBgForm(v => ({ ...v, durationMinutes: e.target.value }))} />
          </div>
          {bgError ? <p className="text-sm text-rose-600">{bgError}</p> : null}
          {bgSuccess ? <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">{bgSuccess}</p> : null}
          <button type="submit" disabled={breakGlass.isPending} className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50">
            <Zap size={14} className="mr-1.5" />
            {breakGlass.isPending ? 'Activating…' : 'Activate Break-Glass'}
          </button>
        </form>
      </section>
    </div>
  )
}
