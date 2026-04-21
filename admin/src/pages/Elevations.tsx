import ElevationPanel from '../components/ElevationPanel'

export default function Elevations() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Governance</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Elevation Operations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Request, approve, activate, revoke, and emergency break-glass privileged elevation workflows.
        </p>
      </div>

      <ElevationPanel />
    </div>
  )
}