import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { RefreshCw, ClipboardList } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import Button from '../components/ui/Button'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuditLog } from '../hooks/useApi'
import { useState } from 'react'
import React from 'react';

interface AuditEvent {
  id: string
  type: string
  actorId?: string
  actorType: string
  clientId?: string
  ip?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

const eventBadge: Record<string, string> = {
  login: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  login_failed: 'bg-rose-50 text-rose-600 border-rose-100',
  logout: 'bg-sky-50 text-sky-700 border-sky-100',
  token_issued: 'bg-sky-50 text-sky-700 border-sky-100',
  token_refreshed: 'bg-sky-50 text-sky-700 border-sky-100',
  token_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  consent_granted: 'bg-teal-50 text-teal-700 border-teal-100',
  consent_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  session_revoked: 'bg-rose-50 text-rose-600 border-rose-100',
  client_created: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  client_updated: 'bg-sky-50 text-sky-700 border-sky-100',
  client_deleted: 'bg-rose-50 text-rose-600 border-rose-100',
  user_created: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

const AuditLog = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: events, isLoading, isFetching, refetch } = useAuditLog(200, debouncedSearch)

  return (
    <div>
      <PageHeader eyebrow="Audit Trail" title="System Activity Log" />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search events by type, actor, client…" />
      </div>

      <Table className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/50">
          <h4 className="text-sm font-semibold text-foreground">Events</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !events?.length ? (
          <EmptyState
            title="No audit events recorded"
            description="Authentication and administrative events will appear here."
          />
        ) : (
          <TableBody className="divide-y divide-border">
            {events.map((event: AuditEvent) => (
              <TableRow key={event.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono border mt-0.5 whitespace-nowrap ${eventBadge[event.type] ?? 'bg-muted text-muted-foreground border-border'}`}>
                  {event.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {event.actorType}{event.actorId ? ` · ${event.actorId.slice(0, 12)}…` : ''}
                    {event.clientId ? ` · client: ${event.clientId}` : ''}
                    {event.ip ? ` · ip: ${event.ip}` : ''}
                  </p>
                  {event.metadata && (
                    <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {JSON.stringify(event.metadata)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>
    </div>
  )
}

export default AuditLog
