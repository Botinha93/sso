import { RefreshCw, Trash2, CheckSquare } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import { useConsents, useRevokeConsent } from '../hooks/useApi'

interface Consent {
  id: string
  userId: string
  clientId: string
  scope: string[]
  createdAt: string
  updatedAt: string
}

const Consents = () => {
  const { data: consents, isLoading, isFetching, refetch } = useConsents()
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Consent Records</h4>
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
        ) : !consents?.length ? (
          <EmptyState
            title="No consents recorded"
            description="Granted OAuth consent scopes will appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {consents.map((consent: Consent) => (
              <div key={consent.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium font-mono text-slate-800">{consent.clientId}</p>
                  <p className="text-xs text-slate-500">
                    User: <span className="font-mono">{consent.userId.slice(0, 12)}…</span>
                  </p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {consent.scope.map((s) => (
                      <StatusBadge key={s} tone="neutral" mono>{s}</StatusBadge>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">Granted {new Date(consent.createdAt).toLocaleString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-red-50 hover:text-red-600"
                  onClick={() => handleRevoke(consent.id)}
                  disabled={revokeConsent.isPending}
                  title="Revoke consent"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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
