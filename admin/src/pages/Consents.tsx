import { RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
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
  const { data: consents, isLoading, refetch } = useConsents()
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
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Consent Management</p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Granted Permissions</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Consent Records</h4>
          <button
            onClick={() => refetch()}
            className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading consents…</div>
        ) : !consents?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No consents recorded</div>
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
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono border border-slate-200">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">Granted {new Date(consent.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleRevoke(consent.id)}
                  disabled={revokeConsent.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  title="Revoke consent"
                >
                  <Trash2 size={14} />
                </button>
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
