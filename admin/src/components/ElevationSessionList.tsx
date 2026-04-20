import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useElevationSessions, type ElevationSessionDto } from '../hooks/useApi'

const statusStyles: Record<ElevationSessionDto['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  revoked: 'bg-rose-100 text-rose-800',
  expired: 'bg-slate-100 text-slate-600'
}

const statusLabels: Record<ElevationSessionDto['status'], string> = {
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired'
}

export default function ElevationSessionList() {
  const [statusFilter, setStatusFilter] = useState<ElevationSessionDto['status'] | undefined>('active')
  const { data: sessions = [], isLoading } = useElevationSessions(statusFilter)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Elevation Sessions</h3>
        <select
          value={statusFilter ?? ''}
          onChange={e => setStatusFilter((e.target.value as ElevationSessionDto['status']) || undefined)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-400">No elevation sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-900">
                  <span className="font-mono">{session.resource}</span>
                  {' → '}
                  <span className="font-mono">{session.action}</span>
                </p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[session.status]}`}>
                  {statusLabels[session.status]}
                </span>
              </div>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Clock3 size={11} />
                Started {new Date(session.startedAt).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Expires {new Date(session.expiresAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
