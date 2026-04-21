import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useRemovePolicyAssignment,
  useSetPolicyAssignment,
  useUpdatePolicy,
  usePolicyDecisions,
} from '../hooks/useApi'
import { PolicyDecisionSimulator } from '../components/policies/PolicyDecisionSimulator'
import {
  AUTH_STAGES,
  defaultJsTemplate,
  exampleConfigs,
  type AuthStageType,
  type PolicyCategory,
  type ScopeType,
} from '../components/policies/policy-config'

function PolicyCodeEditor({
  value,
  onChange,
  placeholder,
  height = 220,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  height?: number
}) {
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <Editor
        language="javascript"
        value={value}
        height={height}
        onChange={(next) => onChange(next ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
        loading={
          <textarea
            className="min-h-[180px] w-full border-0 px-3 py-2 font-mono text-xs outline-none"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        }
      />
    </div>
  )
}

export default function Policies() {
  const { data: policies = [], isLoading } = usePolicies()
  const { data: decisions = [], isLoading: decisionsLoading } = usePolicyDecisions(100)
  const createPolicy = useCreatePolicy()
  const updatePolicy = useUpdatePolicy()
  const deletePolicy = useDeletePolicy()
  const setAssignment = useSetPolicyAssignment()
  const removeAssignment = useRemovePolicyAssignment()

  const [activeTab, setActiveTab] = useState<'policies' | 'decisions'>('policies')
  const [newPolicy, setNewPolicy] = useState({
    key: '',
    name: '',
    description: '',
    category: 'authentication' as PolicyCategory,
    stageBindings: [] as AuthStageType[],
    javascriptCode: '',
    enabled: true
  })
  const [assignmentTarget, setAssignmentTarget] = useState<Record<string, { scopeType: ScopeType; scopeId: string; config: string }>>({})
  const [policyEditState, setPolicyEditState] = useState<Record<string, { category: PolicyCategory; stageBindings: AuthStageType[]; javascriptCode: string }>>({})

  const sortedPolicies = useMemo(() => [...policies].sort((a: any, b: any) => a.key.localeCompare(b.key)), [policies])

  if (isLoading) {
    return <div className="p-6">Loading policies...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bind policies to authentication stages and optionally run server-side JavaScript validators with policy/user/request context.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'policies', label: 'Policies' },
          { key: 'decisions', label: 'Decision History' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'policies' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Create Policy</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input className="rounded border px-3 py-2" placeholder="key" value={newPolicy.key} onChange={(e) => setNewPolicy((v) => ({ ...v, key: e.target.value }))} />
              <input className="rounded border px-3 py-2" placeholder="name" value={newPolicy.name} onChange={(e) => setNewPolicy((v) => ({ ...v, name: e.target.value }))} />
              <input className="rounded border px-3 py-2" placeholder="description" value={newPolicy.description} onChange={(e) => setNewPolicy((v) => ({ ...v, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="rounded border px-3 py-2"
                value={newPolicy.category}
                onChange={(e) => setNewPolicy((v) => ({
                  ...v,
                  category: e.target.value as PolicyCategory,
                  stageBindings: e.target.value === 'authorization' ? [] : v.stageBindings
                }))}
              >
            <option value="authentication">authentication</option>
            <option value="authorization">authorization</option>
          </select>
        </div>

        {newPolicy.category === 'authentication' ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stage Bindings</p>
            <div className="flex flex-wrap gap-2">
              {AUTH_STAGES.map((stage) => {
                const active = newPolicy.stageBindings.includes(stage)
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setNewPolicy((v) => ({
                      ...v,
                      stageBindings: active ? v.stageBindings.filter((s) => s !== stage) : [...v.stageBindings, stage]
                    }))}
                    className={`rounded px-2 py-1 text-xs font-mono transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {stage}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Authorization policies are evaluated by resource/action/context and do not use stage bindings.</p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">JavaScript Validator (optional)</p>
          <PolicyCodeEditor
            value={newPolicy.javascriptCode}
            placeholder={defaultJsTemplate}
            onChange={(next) => setNewPolicy((v) => ({ ...v, javascriptCode: next }))}
          />
        </div>

        <div className="flex justify-end">
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={async () => {
              await createPolicy.mutateAsync({
                ...newPolicy,
                stageBindings: newPolicy.category === 'authorization' ? [] : newPolicy.stageBindings,
                javascriptCode: newPolicy.javascriptCode.trim() || undefined
              })
              setNewPolicy({ key: '', name: '', description: '', category: 'authentication', stageBindings: [], javascriptCode: '', enabled: true })
            }}
          >
            Add
          </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">JavaScript Policy Interface</h2>
            <p className="mt-1 text-sm text-slate-600">Available objects/functions in server-side policy scripts:</p>
            <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
{`policy.key
policy.name
policy.stage
policy.assignment.enabled
policy.assignment.config
policy.user.id
policy.user.email
policy.user.username
policy.user.givenName
policy.user.familyName
policy.user.active
policy.user.isServiceUser
policy.user.customAttributes
policy.request.tenantId
policy.request.clientId
policy.request.ip
policy.request.resource
policy.request.action
policy.request.context
now() // returns current ISO timestamp

// Return one of:
// true | undefined
// false
// "error message"
// { allow: false, message: "error message" }`}
        </pre>
      </div>

      <PolicyDecisionSimulator />

      <div className="space-y-4">
        {sortedPolicies.map((policy: any) => {
          const localState = assignmentTarget[policy.id] ?? {
            scopeType: 'global' as ScopeType,
            scopeId: '',
            config: exampleConfigs[policy.key] ?? '{}'
          }

          const editState = policyEditState[policy.id] ?? {
            category: (policy.category ?? 'authentication') as PolicyCategory,
            stageBindings: (policy.stageBindings ?? []) as AuthStageType[],
            javascriptCode: policy.javascriptCode ?? ''
          }

          return (
            <div key={policy.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{policy.name}</h3>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{policy.key}</span>
                <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700">{policy.category ?? 'authentication'}</span>
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

              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</p>
                <select
                  className="rounded border px-3 py-2 text-sm"
                  value={editState.category}
                  onChange={(e) => setPolicyEditState((prev) => ({
                    ...prev,
                    [policy.id]: { ...editState, category: e.target.value as PolicyCategory }
                  }))}
                >
                  <option value="authentication">authentication</option>
                  <option value="authorization">authorization</option>
                </select>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stage Bindings</p>
                {editState.category === 'authentication' ? (
                  <div className="flex flex-wrap gap-2">
                    {AUTH_STAGES.map((stage) => {
                      const active = editState.stageBindings.includes(stage)
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setPolicyEditState((prev) => ({
                            ...prev,
                            [policy.id]: {
                              ...editState,
                              stageBindings: active
                                ? editState.stageBindings.filter((s) => s !== stage)
                                : [...editState.stageBindings, stage]
                            }
                          }))}
                          className={`rounded px-2 py-1 text-xs font-mono transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          {stage}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Authorization policies do not use stage bindings.</p>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">JavaScript Validator</p>
                <PolicyCodeEditor
                  value={editState.javascriptCode}
                  placeholder={defaultJsTemplate}
                  height={260}
                  onChange={(next) => setPolicyEditState((prev) => ({
                    ...prev,
                    [policy.id]: { ...editState, javascriptCode: next }
                  }))}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={async () => {
                      await updatePolicy.mutateAsync({
                        id: policy.id,
                        category: editState.category,
                        stageBindings: editState.category === 'authorization' ? [] : editState.stageBindings,
                        javascriptCode: editState.javascriptCode.trim() || null
                      })
                    }}
                  >
                    Save Definition
                  </button>
                </div>
              </div>

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
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Authorization Decision History</h2>
            <p className="mt-1 text-sm text-slate-600">View recent policy evaluation decisions for audit and debugging purposes.</p>
          </div>

          {decisionsLoading ? (
            <div className="text-center text-slate-500 py-8">Loading decisions...</div>
          ) : decisions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              <p>No authorization decisions recorded yet.</p>
              <p className="mt-1 text-sm">Run policy evaluations or access protected resources to generate decision logs.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Timestamp</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Subject</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Resource</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Decision</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Policy Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {decisions.map((decision: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {new Date(decision.evaluatedAt ?? decision.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{decision.userId?.slice(0, 12)}…</td>
                      <td className="px-4 py-3 truncate text-slate-700">{decision.resource || '—'}</td>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-2 py-1 rounded text-xs">{decision.action}</code></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          decision.decision === 'allow' || decision.allowed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {decision.decision === 'allow' || decision.allowed ? 'ALLOW' : 'DENY'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{decision.policyId || decision.policyKey || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
