import { useMemo, useState } from 'react'
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useRemovePolicyAssignment,
  useSetPolicyAssignment,
  useUpdatePolicy,
} from '../hooks/useApi'

type ScopeType = 'global' | 'tenant' | 'group' | 'user'

const exampleConfigs: Record<string, string> = {
  password_requirements: '{"minLength":12,"requireUppercase":true,"requireLowercase":true,"requireNumber":true,"requireSymbol":true}',
  password_expiration_days: '{"days":90}',
  unique_email: '{"enabled":true}',
  two_factor_required: '{"required":true}'
}

export default function Policies() {
  const { data: policies = [], isLoading } = usePolicies()
  const createPolicy = useCreatePolicy()
  const updatePolicy = useUpdatePolicy()
  const deletePolicy = useDeletePolicy()
  const setAssignment = useSetPolicyAssignment()
  const removeAssignment = useRemovePolicyAssignment()

  const [newPolicy, setNewPolicy] = useState({ key: '', name: '', description: '', enabled: true })
  const [assignmentTarget, setAssignmentTarget] = useState<Record<string, { scopeType: ScopeType; scopeId: string; config: string }>>({})

  const sortedPolicies = useMemo(() => [...policies].sort((a: any, b: any) => a.key.localeCompare(b.key)), [policies])

  if (isLoading) {
    return <div className="p-6">Loading policies...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
        <p className="mt-1 text-sm text-slate-600">Create custom policies and assign them globally or per tenant, group, and user.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Create Policy</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="rounded border px-3 py-2" placeholder="key" value={newPolicy.key} onChange={(e) => setNewPolicy((v) => ({ ...v, key: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="name" value={newPolicy.name} onChange={(e) => setNewPolicy((v) => ({ ...v, name: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="description" value={newPolicy.description} onChange={(e) => setNewPolicy((v) => ({ ...v, description: e.target.value }))} />
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={async () => {
              await createPolicy.mutateAsync(newPolicy)
              setNewPolicy({ key: '', name: '', description: '', enabled: true })
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedPolicies.map((policy: any) => {
          const localState = assignmentTarget[policy.id] ?? {
            scopeType: 'global' as ScopeType,
            scopeId: '',
            config: exampleConfigs[policy.key] ?? '{}'
          }

          return (
            <div key={policy.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{policy.name}</h3>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{policy.key}</span>
                <button
                  className={`rounded px-2 py-1 text-xs ${policy.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
                  onClick={() => updatePolicy.mutate({ id: policy.id, enabled: !policy.enabled })}
                >
                  {policy.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button className="ml-auto rounded bg-rose-100 px-2 py-1 text-xs text-rose-700" onClick={() => deletePolicy.mutate(policy.id)}>
                  Delete
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600">{policy.description}</p>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  className="rounded border px-3 py-2"
                  value={localState.scopeType}
                  onChange={(e) => setAssignmentTarget((prev) => ({ ...prev, [policy.id]: { ...localState, scopeType: e.target.value as ScopeType } }))}
                >
                  <option value="global">global</option>
                  <option value="tenant">tenant</option>
                  <option value="group">group</option>
                  <option value="user">user</option>
                </select>
                <input
                  className="rounded border px-3 py-2"
                  placeholder="scope id (skip for global)"
                  value={localState.scopeId}
                  onChange={(e) => setAssignmentTarget((prev) => ({ ...prev, [policy.id]: { ...localState, scopeId: e.target.value } }))}
                />
                <input
                  className="rounded border px-3 py-2 font-mono text-xs"
                  placeholder='config json e.g. {"days":90}'
                  value={localState.config}
                  onChange={(e) => setAssignmentTarget((prev) => ({ ...prev, [policy.id]: { ...localState, config: e.target.value } }))}
                />
                <button
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white"
                  onClick={async () => {
                    const payload = {
                      id: policy.id,
                      scopeType: localState.scopeType,
                      scopeId: localState.scopeType === 'global' ? undefined : localState.scopeId,
                      enabled: true,
                      config: JSON.parse(localState.config || '{}')
                    }
                    await setAssignment.mutateAsync(payload)
                  }}
                >
                  Upsert Assignment
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {(policy.assignments ?? []).map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <span className="font-mono">{assignment.scopeType}</span>
                    <span>{assignment.scopeId || 'global'}</span>
                    <span className="font-mono text-slate-500">{JSON.stringify(assignment.config)}</span>
                    <button
                      className="ml-auto rounded bg-rose-100 px-2 py-1 text-rose-700"
                      onClick={() => removeAssignment.mutate({
                        id: policy.id,
                        scopeType: assignment.scopeType,
                        scopeId: assignment.scopeType === 'global' ? undefined : assignment.scopeId
                      })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
