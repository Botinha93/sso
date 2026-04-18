import { RefreshCw } from 'lucide-react'
import { useAuditLog } from '../hooks/useApi'

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
  login: 'bg-green-50 text-green-700 border-green-100',
  login_failed: 'bg-red-50 text-red-600 border-red-100',
  logout: 'bg-sky-50 text-sky-700 border-sky-100',
  token_issued: 'bg-violet-50 text-violet-700 border-violet-100',
  token_refreshed: 'bg-violet-50 text-violet-700 border-violet-100',
  token_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  consent_granted: 'bg-teal-50 text-teal-700 border-teal-100',
  consent_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  session_revoked: 'bg-red-50 text-red-600 border-red-100',
  client_created: 'bg-green-50 text-green-700 border-green-100',
  client_updated: 'bg-sky-50 text-sky-700 border-sky-100',
  client_deleted: 'bg-red-50 text-red-600 border-red-100',
  user_created: 'bg-green-50 text-green-700 border-green-100',
}

const AuditLog = () => {
  const { data: events, isLoading, refetch } = useAuditLog(200)

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Audit Trail</p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Activity Log</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Events</h4>
          <button
            onClick={() => refetch()}
            className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading events…</div>
        ) : !events?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No audit events recorded</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event: AuditEvent) => (
              <div key={event.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono border mt-0.5 whitespace-nowrap ${eventBadge[event.type] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {event.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">
                    {event.actorType}{event.actorId ? ` · ${event.actorId.slice(0, 12)}…` : ''}
                    {event.clientId ? ` · client: ${event.clientId}` : ''}
                    {event.ip ? ` · ip: ${event.ip}` : ''}
                  </p>
                  {event.metadata && (
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      {JSON.stringify(event.metadata)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditLog
