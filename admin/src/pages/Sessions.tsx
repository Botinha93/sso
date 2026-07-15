import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { RefreshCw, ShieldOff, MonitorSmartphone } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Button from '../components/ui/Button'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSessions, useRevokeSession } from '../hooks/useApi'
import React from 'react';

interface Session {
  id: string
  userId: string
  clientId: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
}

const Sessions = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: sessions, isLoading, isFetching, refetch } = useSessions(debouncedSearch)
  const revokeSession = useRevokeSession()
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setSessionToRevoke(id)
  }

  const confirmRevoke = () => {
    if (!sessionToRevoke) return
    revokeSession.mutate(sessionToRevoke, { onSuccess: () => setSessionToRevoke(null) })
  }

  return (
    <div>
      <PageHeader eyebrow="Session Management" title="Active Sessions" />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search sessions by user or client…" />
      </div>

      <Table className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/50">
          <h4 className="text-sm font-semibold text-foreground">All Sessions</h4>
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
          <TableSkeleton rows={5} />
        ) : !sessions?.length ? (
          <EmptyState
            title="No sessions found"
            description="Active sessions will appear here once users authenticate."
          />
        ) : (
          <TableBody className="divide-y divide-border">
            {sessions.map((session: Session) => {
              const isRevoked = !!session.revokedAt
              const isExpired = new Date(session.expiresAt) < new Date()
              return (
                <TableRow key={session.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium font-mono text-foreground">{session.id.slice(0, 16)}…</p>
                    <p className="text-xs text-muted-foreground">
                      User: <span className="font-mono">{session.userId.slice(0, 8)}…</span>
                      {' · '}Client: <span className="font-mono">{session.clientId}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(session.createdAt).toLocaleString()}
                      {' · '} Expires {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRevoked ? (
                      <StatusBadge tone="danger">Revoked</StatusBadge>
                    ) : isExpired ? (
                      <StatusBadge tone="neutral">Expired</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Active</StatusBadge>
                    )}
                    {!isRevoked && !isExpired && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleRevoke(session.id)}
                        disabled={revokeSession.isPending}
                        title="Revoke session"
                      >
                        <ShieldOff size={14} />
                      </Button>
                    )}
                  </div>
                </TableRow>
              )
            })}
          </TableBody>
        )}
      </Table>

      <ConfirmDialog
        isOpen={!!sessionToRevoke}
        title="Revoke Session"
        message="Revoke this session? The user will be signed out immediately."
        confirmLabel="Revoke Session"
        pending={revokeSession.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setSessionToRevoke(null)}
      />
    </div>
  )
}

export default Sessions
import StatusBadge from '../components/ui/StatusBadge'
