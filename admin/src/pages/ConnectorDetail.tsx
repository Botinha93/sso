import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play, RefreshCw } from 'lucide-react'
import { PageHeader, Skeleton } from '../components/PageHeader'
import Button from '../components/ui/Button'
import {
  useConnector,
  useConnectorRuns,
  useConnectorMappings,
  useTriggerConnectorSync,
} from '../hooks/useApi'
import React from 'react';
export default function ConnectorDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: connector, isLoading } = useConnector(id)
  const { data: runsData, isFetching: isRunsRefreshing, refetch: refetchRuns } = useConnectorRuns(id)
  const { data: mappingsData, isFetching: isMappingsRefreshing, refetch: refetchMappings } = useConnectorMappings(id)
  const triggerSync = useTriggerConnectorSync()

  if (!id) {
    return <div className="text-sm text-slate-500">Missing connector id.</div>
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!connector) {
    return <div className="text-sm text-slate-500">Connector not found.</div>
  }

  const runs = runsData?.data ?? []
  const mappings = mappingsData?.data ?? []
  const isRefreshing = isRunsRefreshing || isMappingsRefreshing

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data Sync"
        title={connector.name}
        description={`Connector detail for ${connector.type.toUpperCase()} (${connector.id})`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/connectors" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={13} /> Back
            </Link>
          <Button
            variant="secondary"
            onClick={() => { refetchRuns(); refetchMappings() }}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => triggerSync.mutate(id)}
            disabled={triggerSync.isPending}
          >
            <Play size={14} /> {triggerSync.isPending ? 'Syncing…' : 'Trigger Sync'}
          </Button>
        </div>
        }
      />

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