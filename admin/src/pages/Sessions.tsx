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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Sessions</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !sessions?.length ? (
          <EmptyState
            title="No sessions found"
            description="Active sessions will appear here once users authenticate."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session: Session) => {
              const isRevoked = !!session.revokedAt
              const isExpired = new Date(session.expiresAt) < new Date()
              return (
                <div key={session.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium font-mono text-slate-800">{session.id.slice(0, 16)}…</p>
                    <p className="text-xs text-slate-500">
                      User: <span className="font-mono">{session.userId.slice(0, 8)}…</span>
                      {' · '}Client: <span className="font-mono">{session.clientId}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Created {new Date(session.createdAt).toLocaleString()}
                      {' · '} Expires {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRevoked ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">Revoked</span>
                    ) : isExpired ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">Expired</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100">Active</span>
                    )}
                    {!isRevoked && !isExpired && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRevoke(session.id)}
                        disabled={revokeSession.isPending}
                        title="Revoke session"
                      >
                        <ShieldOff size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
