import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play, RefreshCw } from 'lucide-react'
import {
  useConnector,
  useConnectorRuns,
  useConnectorMappings,
  useTriggerConnectorSync,
} from '../hooks/useApi'

export default function ConnectorDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: connector, isLoading } = useConnector(id)
  const { data: runsData, refetch: refetchRuns } = useConnectorRuns(id)
  const { data: mappingsData, refetch: refetchMappings } = useConnectorMappings(id)
  const triggerSync = useTriggerConnectorSync()

  if (!id) {
    return <div className="text-sm text-slate-500">Missing connector id.</div>
  }

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading connector...</div>
  }

  if (!connector) {
    return <div className="text-sm text-slate-500">Connector not found.</div>
  }

  const runs = runsData?.data ?? []
  const mappings = mappingsData?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/connectors" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft size={12} /> Back to connectors
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{connector.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Connector detail for {connector.type.toUpperCase()} ({connector.id})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchRuns()
              refetchMappings()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => triggerSync.mutate(id)}
            disabled={triggerSync.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Play size={14} /> {triggerSync.isPending ? 'Syncing…' : 'Trigger Sync'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Recent Runs</h2>
          <div className="mt-3 space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-slate-500">No runs yet.</p>
            ) : runs.map((run) => (
              <div key={run.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{run.status}</span>
                  <span className="text-xs text-slate-500">{run.id.slice(0, 8)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">Imported {run.recordsImported} · Failed {run.recordsFailed}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Field Mappings</h2>
          <div className="mt-3 space-y-2">
            {mappings.length === 0 ? (
              <p className="text-sm text-slate-500">No mappings configured.</p>
            ) : mappings.map((mapping) => (
              <div key={mapping.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-mono text-slate-800">{mapping.sourceField} -&gt; {mapping.targetField}</p>
                {mapping.transform ? <p className="mt-1 text-xs text-slate-600">Transform: {mapping.transform}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}