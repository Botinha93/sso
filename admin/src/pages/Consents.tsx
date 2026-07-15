import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { RefreshCw, Trash2, CheckSquare } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useConsents, useRevokeConsent } from '../hooks/useApi'
import React from 'react';

interface Consent {
  id: string
  userId: string
  clientId: string
  scope: string[]
  createdAt: string
  updatedAt: string
}

const Consents = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: consents, isLoading, isFetching, refetch } = useConsents(debouncedSearch)
  const revokeConsent = useRevokeConsent()
  const [consentToRevoke, setConsentToRevoke] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setConsentToRevoke(id)
  }

  const confirmRevoke = () => {
    if (!consentToRevoke) return
    revokeConsent.mutate(consentToRevoke, { onSuccess: () => setConsentToRevoke(null) })
  }

  return (
    <div>
      <PageHeader eyebrow="Consent Management" title="Granted Permissions" />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search consents by user or client…" />
      </div>

      <Table className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/50">
          <h4 className="text-sm font-semibold text-foreground">Consent Records</h4>
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
        ) : !consents?.length ? (
          <EmptyState
            title="No consents recorded"
            description="Granted OAuth consent scopes will appear here."
          />
        ) : (
          <TableBody className="divide-y divide-border">
            {consents.map((consent: Consent) => (
              <TableRow key={consent.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium font-mono text-foreground">{consent.clientId}</p>
                  <p className="text-xs text-muted-foreground">
                    User: <span className="font-mono">{consent.userId.slice(0, 12)}…</span>
                  </p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {consent.scope.map((s) => (
                      <StatusBadge key={s} tone="neutral" mono>{s}</StatusBadge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Granted {new Date(consent.createdAt).toLocaleString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => handleRevoke(consent.id)}
                  disabled={revokeConsent.isPending}
                  title="Revoke consent"
                >
                  <Trash2 size={14} />
                </Button>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>

      <ConfirmDialog
        isOpen={!!consentToRevoke}
        title="Revoke Consent"
        message="Revoke this consent? The user will be asked to consent again on next login."
        confirmLabel="Revoke Consent"
        pending={revokeConsent.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setConsentToRevoke(null)}
      />
    </div>
  )
}

export default Consents
