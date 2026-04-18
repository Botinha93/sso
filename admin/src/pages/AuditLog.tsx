import { RefreshCw } from 'lucide-react'

const AuditLog = () => {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Audit Trail</p>
        <h2 className="text-2xl font-semibold">System Activity Log</h2>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-medium">Events</h4>
          <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          No audit events recorded
        </div>
      </div>
    </div>
  )
}

export default AuditLog