import { useMemo, useState } from 'react'
import {
  useCreateProvisioningMapping,
  useCreateProvisioningToken,
  useDeleteProvisioningMapping,
  useDeleteProvisioningToken,
  useProvisioningJobs,
  useProvisioningMappings,
  useProvisioningTokens,
  useRunProvisioningReconcile
} from '../hooks/useApi'

const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

export default function ProvisioningAdminPanel() {
  const { data: tokens = [] } = useProvisioningTokens()
  const { data: mappings = [] } = useProvisioningMappings()
  const { data: jobs = [] } = useProvisioningJobs(15)
  const createToken = useCreateProvisioningToken()
  const deleteToken = useDeleteProvisioningToken()
  const createMapping = useCreateProvisioningMapping()
  const deleteMapping = useDeleteProvisioningMapping()
  const runReconcile = useRunProvisioningReconcile()

  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('')
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [sourceAttribute, setSourceAttribute] = useState('')
  const [targetAttribute, setTargetAttribute] = useState('')
  const [transformExpression, setTransformExpression] = useState('')

  const latestJob = useMemo(() => jobs[0], [jobs])

  const createNewToken = async () => {
    setIssuedToken(null)
    const created = await createToken.mutateAsync({
      label: tokenLabel,
      expiresAt: tokenExpiry ? new Date(tokenExpiry).toISOString() : undefined
    })
    setIssuedToken(created.token)
    setTokenLabel('')
    setTokenExpiry('')
  }

  const createNewMapping = async () => {
    await createMapping.mutateAsync({
      name: mappingName,
      sourceAttribute,
      targetAttribute,
      transformExpression: transformExpression || undefined,
      enabled: true
    })
    setMappingName('')
    setSourceAttribute('')
    setTargetAttribute('')
    setTransformExpression('')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-slate-900">SCIM Provisioning Tokens</h2>
        <p className="mt-1 text-sm text-slate-600">Issue one-time display bearer tokens for directory connectors and revoke them when rotating integrations.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={tokenLabel}
            onChange={(event) => setTokenLabel(event.target.value)}
            placeholder="okta-prod"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <input
            type="datetime-local"
            value={tokenExpiry}
            onChange={(event) => setTokenExpiry(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={createNewToken}
            disabled={createToken.isPending || tokenLabel.trim().length < 2}
            className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createToken.isPending ? 'Issuing…' : 'Issue Token'}
          </button>
        </div>

        {issuedToken ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Copy now, this token is shown once</p>
            <p className="mt-2 break-all rounded border border-amber-200 bg-white px-2 py-1 font-mono">{issuedToken}</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {tokens.length === 0 ? <p className="text-sm text-slate-500">No provisioning tokens yet.</p> : null}
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{token.label}</p>
                <p className="text-xs text-slate-500">Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'}</p>
              </div>
              <button
                onClick={() => deleteToken.mutate(token.id)}
                disabled={deleteToken.isPending}
                className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-slate-900">Provisioning Mappings</h2>
        <p className="mt-1 text-sm text-slate-600">Map external directory attributes into local profile fields for lifecycle sync.</p>

        <div className="mt-4 grid gap-2">
          <input
            value={mappingName}
            onChange={(event) => setMappingName(event.target.value)}
            placeholder="Workday manager mapping"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={sourceAttribute}
              onChange={(event) => setSourceAttribute(event.target.value)}
              placeholder="urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager"
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
            <input
              value={targetAttribute}
              onChange={(event) => setTargetAttribute(event.target.value)}
              placeholder="customAttributes.managerId"
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
          </div>
          <input
            value={transformExpression}
            onChange={(event) => setTransformExpression(event.target.value)}
            placeholder="value?.toLowerCase()"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
          <div>
            <button
              onClick={createNewMapping}
              disabled={createMapping.isPending || mappingName.trim().length < 2 || sourceAttribute.trim().length === 0 || targetAttribute.trim().length === 0}
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {createMapping.isPending ? 'Saving…' : 'Add Mapping'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {mappings.length === 0 ? <p className="text-sm text-slate-500">No mappings configured.</p> : null}
          {mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{mapping.name}</p>
                <button
                  onClick={() => deleteMapping.mutate(mapping.id)}
                  disabled={deleteMapping.isPending}
                  className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600">{mapping.sourceAttribute} → {mapping.targetAttribute}</p>
              {mapping.transformExpression ? <p className="mt-1 text-xs text-slate-500">Transform: {mapping.transformExpression}</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">Run Reconciliation</p>
            <button
              onClick={() => runReconcile.mutate({ dryRun: true })}
              disabled={runReconcile.isPending}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {runReconcile.isPending ? 'Running…' : 'Run Dry-Run'}
            </button>
          </div>
          {latestJob ? (
            <p className="mt-2 text-xs text-slate-600">
              Last job: {latestJob.status} at {new Date(latestJob.createdAt).toLocaleString()} ({String((latestJob.summary as Record<string, unknown>).usersEvaluated ?? 0)} users scanned)
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No reconcile jobs yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
