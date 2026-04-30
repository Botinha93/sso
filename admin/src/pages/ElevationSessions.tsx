import { useMemo, useState } from 'react'
import { Clock3, ShieldAlert } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import { type ElevationSessionDto, useElevationSessions } from '../hooks/useApi'

const statusStyles: Record<ElevationSessionDto['status'], 'success' | 'danger' | 'neutral'> = {
  active: 'success',
  revoked: 'danger',
  expired: 'neutral'
}

export default function ElevationSessions() {
  const [status, setStatus] = useState<ElevationSessionDto['status'] | 'all'>('active')
  const { data: sessions = [], isLoading } = useElevationSessions(status === 'all' ? undefined : status)

  const stats = useMemo(() => {
    return sessions.reduce(
      (acc, session) => {
        acc.total += 1
        acc[session.status] += 1
        return acc
      },
      { total: 0, active: 0, revoked: 0, expired: 0 }
    )
  }, [sessions])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Elevation Sessions"
        description="Inspect active and historical privileged sessions created through elevation approvals and emergency break-glass operations."
        action={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ElevationSessionDto['status'] | 'all')}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Active</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Revoked</p>
          <p className="mt-2 text-2xl font-bold text-rose-800">{stats.revoked}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Expired</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{stats.expired}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Session Timeline</h2>
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No elevation sessions found"
            description="Privilege escalation sessions will appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <div key={session.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-900">
                    <span className="font-mono">{session.resource}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="font-mono">{session.action}</span>
                  </p>
                  <StatusBadge tone={statusStyles[session.status]}>{session.status}</StatusBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono">session {session.id.slice(0, 12)}...</span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={12} />
                    Started {new Date(session.startedAt).toLocaleString()}
                  </span>
                  <span>Expires {new Date(session.expiresAt).toLocaleString()}</span>
                  {session.endedAt ? <span>Ended {new Date(session.endedAt).toLocaleString()}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
