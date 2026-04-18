import { RefreshCw } from 'lucide-react'

const Sessions = () => {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Session Management</p>
        <h2 className="text-2xl font-semibold">Active Sessions</h2>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-medium">Current Sessions</h4>
          <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          No active sessions
        </div>
      </div>
    </div>
  )
}

export default Sessions