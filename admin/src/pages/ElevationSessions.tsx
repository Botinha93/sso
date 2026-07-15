import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import { useMemo, useState } from 'react'
import { Clock3, ShieldAlert } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import { type ElevationSessionDto, useElevationSessions } from '../hooks/useApi'
import React from 'react';

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
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as ElevationSessionDto['status'] | 'all')}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Active</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Revoked</p>
          <p className="mt-2 text-2xl font-bold text-rose-800">{stats.revoked}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expired</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.expired}</p>
        </div>
      </div>

      <Table className="rounded-xl border border-border bg-card shadow-sm">
        <TableHeaderRow className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Session Timeline</h2>
        </TableHeaderRow>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No elevation sessions found"
            description="Privilege escalation sessions will appear here."
          />
        ) : (
          <TableBody className="divide-y divide-border">
            {sessions.map((session) => (
              <TableRow key={session.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">
                    <span className="font-mono">{session.resource}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-mono">{session.action}</span>
                  </p>
                  <StatusBadge tone={statusStyles[session.status]}>{session.status}</StatusBadge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">session {session.id.slice(0, 12)}...</span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={12} />
                    Started {new Date(session.startedAt).toLocaleString()}
                  </span>
                  <span>Expires {new Date(session.expiresAt).toLocaleString()}</span>
                  {session.endedAt ? <span>Ended {new Date(session.endedAt).toLocaleString()}</span> : null}
                </div>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>
    </div>
  )
}
