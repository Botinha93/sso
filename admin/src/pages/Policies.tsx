import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { PageHeader, PageHeaderSkeleton, TableSkeleton } from '../components/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import CodeBlock from '../components/ui/CodeBlock'
import Input from '../components/ui/Input'
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

type PolicyTab = 'definitions' | 'configuration' | 'decisions'

type ConfigFieldKind = 'boolean' | 'number' | 'string' | 'string_array' | 'number_array' | 'json'

type AssignmentDraft = {
  scopeType: ScopeType
  scopeId: string
  config: Record<string, unknown>
  rawConfig: string
  rawMode: boolean
}

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

function parseExampleConfig(policyKey: string) {
  try {
    return JSON.parse(exampleConfigs[policyKey] ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function createAssignmentDraft(policyKey: string): AssignmentDraft {
  const config = parseExampleConfig(policyKey)
  return {
    scopeType: 'global',
    scopeId: '',
    config,
    rawConfig: JSON.stringify(config, null, 2),
    rawMode: false,
  }
}

function inferFieldKind(value: unknown): ConfigFieldKind {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number') ? 'number_array' : 'string_array'
  }
  return 'json'
}

function humanizeFieldName(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config)
  if (entries.length === 0) return 'No configuration'
  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
      if (typeof value === 'object' && value !== null) return `${key}: ${JSON.stringify(value)}`
      return `${key}: ${String(value)}`
    })
    .join(' | ')
}

function AssignmentConfigEditor({
  draft,
  policyKey,
  onDraftChange,
}: {
  draft: AssignmentDraft
  policyKey: string
  onDraftChange: (next: AssignmentDraft) => void
}) {
  const fieldEntries = Object.entries(draft.config)

  const updateConfigValue = (key: string, value: unknown) => {
    const nextConfig = { ...draft.config, [key]: value }
    onDraftChange({
      ...draft,
      config: nextConfig,
      rawConfig: JSON.stringify(nextConfig, null, 2),
    })
  }

  const setRawConfig = (rawConfig: string) => {
    onDraftChange({ ...draft, rawConfig })
  }

  const applyRawConfig = () => {
    const parsed = JSON.parse(draft.rawConfig || '{}') as Record<string, unknown>
    onDraftChange({
      ...draft,
      config: parsed,
      rawConfig: JSON.stringify(parsed, null, 2),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Where It Applies</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Scope Type</label>
            <select
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={draft.scopeType}
              onChange={(e) => onDraftChange({
                ...draft,
                scopeType: e.target.value as ScopeType,
                scopeId: e.target.value === 'global' ? '' : draft.scopeId,
              })}
            >
              <option value="global">global</option>
              <option value="tenant">tenant</option>
              <option value="group">group</option>
              <option value="user">user</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Scope ID</label>
            <Input
              placeholder={draft.scopeType === 'global' ? 'Not required for global scope' : `Enter ${draft.scopeType} id`}
              value={draft.scopeId}
              disabled={draft.scopeType === 'global'}
              onChange={(e) => onDraftChange({ ...draft, scopeId: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Configuration</p>
            <p className="mt-1 text-xs text-slate-500">
              Fields are generated from the default config shape for <span className="font-mono">{policyKey}</span>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDraftChange({ ...draft, rawMode: !draft.rawMode })}
          >
            {draft.rawMode ? 'Use Generated Fields' : 'Edit Raw JSON'}
          </Button>
        </div>

        {draft.rawMode ? (
          <div className="space-y-2">
            <textarea
              className="min-h-[180px] w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs outline-none"
              value={draft.rawConfig}
              onChange={(e) => setRawConfig(e.target.value)}
              placeholder="{}"
            />
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={applyRawConfig}>
                Apply JSON
              </Button>
            </div>
          </div>
        ) : fieldEntries.length === 0 ? (
          <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            This policy has no default config fields yet. Use raw JSON mode if you want to store custom configuration.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {fieldEntries.map(([key, value]) => {
              const fieldKind = inferFieldKind(value)

              if (fieldKind === 'boolean') {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{humanizeFieldName(key)}</label>
                    <select
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      value={String(Boolean(value))}
                      onChange={(e) => updateConfigValue(key, e.target.value === 'true')}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                )
              }

              if (fieldKind === 'number') {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{humanizeFieldName(key)}</label>
                    <Input
                      type="number"
                      value={String(value)}
                      onChange={(e) => updateConfigValue(key, Number(e.target.value))}
                    />
                  </div>
                )
              }

              if (fieldKind === 'string') {
                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{humanizeFieldName(key)}</label>
                    <Input
                      type="text"
                      value={String(value)}
                      onChange={(e) => updateConfigValue(key, e.target.value)}
                    />
                  </div>
                )
              }

              if (fieldKind === 'string_array' || fieldKind === 'number_array') {
                const current = Array.isArray(value) ? value.join(', ') : ''
                return (
                  <div key={key} className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">{humanizeFieldName(key)}</label>
                    <Input
                      type="text"
                      value={current}
                      onChange={(e) => {
                        const items = e.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean)
                        updateConfigValue(
                          key,
                          fieldKind === 'number_array' ? items.map((item) => Number(item)) : items
                        )
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">Use comma-separated values.</p>
                  </div>
                )
              }

              return (
                <div key={key} className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">{humanizeFieldName(key)}</label>
                  <textarea
                    className="min-h-[110px] w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs outline-none"
                    value={JSON.stringify(value ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        updateConfigValue(key, JSON.parse(e.target.value))
                      } catch {
                        onDraftChange({
                          ...draft,
                          config: draft.config,
                          rawConfig: JSON.stringify({ ...draft.config, [key]: e.target.value }, null, 2),
                        })
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
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

  const [activeTab, setActiveTab] = useState<PolicyTab>('definitions')
  const [newPolicy, setNewPolicy] = useState({
    key: '',
    name: '',
    description: '',
    category: 'authentication' as PolicyCategory,
    stageBindings: [] as AuthStageType[],
    javascriptCode: '',
    enabled: true
  })
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({})
  const [policyEditState, setPolicyEditState] = useState<Record<string, { category: PolicyCategory; stageBindings: AuthStageType[]; javascriptCode: string }>>({})

  const sortedPolicies = useMemo(() => [...policies].sort((a: any, b: any) => a.key.localeCompare(b.key)), [policies])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton blocks={1} />
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Policies"
        description="Define policy behavior in JavaScript, then manage where each policy applies and its configuration separately."
      />

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'definitions', label: 'Definitions' },
          { key: 'configuration', label: 'Configuration' },
          { key: 'decisions', label: 'Decision History' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as PolicyTab)}
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

      {activeTab === 'definitions' ? (
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Create Policy Definition</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input placeholder="key" value={newPolicy.key} onChange={(e) => setNewPolicy((v) => ({ ...v, key: e.target.value }))} />
              <Input placeholder="name" value={newPolicy.name} onChange={(e) => setNewPolicy((v) => ({ ...v, name: e.target.value }))} />
              <Input placeholder="description" value={newPolicy.description} onChange={(e) => setNewPolicy((v) => ({ ...v, description: e.target.value }))} />
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
                        className={`rounded px-2 py-1 text-xs font-mono transition-colors ${active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {stage}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Authorization policies do not use stage bindings.</p>
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
              <Button
                variant="primary"
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
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">JavaScript Policy Interface</h2>
            <p className="mt-1 text-sm text-slate-600">Available objects/functions in server-side policy scripts:</p>
            <CodeBlock
              className="mt-3 text-xs"
              language="javascript"
              code={`policy.key
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
            />
          </Card>

          <PolicyDecisionSimulator />

          <div className="space-y-4">
            {sortedPolicies.map((policy: any) => {
              const editState = policyEditState[policy.id] ?? {
                category: (policy.category ?? 'authentication') as PolicyCategory,
                stageBindings: (policy.stageBindings ?? []) as AuthStageType[],
                javascriptCode: policy.javascriptCode ?? ''
              }

              return (
                <Card key={policy.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{policy.name}</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{policy.key}</span>
                    <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700">{policy.category ?? 'authentication'}</span>
                    <Button
                      variant={policy.enabled ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => updatePolicy.mutate({ id: policy.id, enabled: !policy.enabled })}
                    >
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="ml-auto"
                      onClick={() => deletePolicy.mutate(policy.id)}
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{policy.description}</p>

                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</p>
                    <select
                      className="rounded border px-3 py-2 text-sm"
                      value={editState.category}
                      onChange={(e) => setPolicyEditState((prev) => ({
                        ...prev,
                        [policy.id]: {
                          ...editState,
                          category: e.target.value as PolicyCategory,
                          stageBindings: e.target.value === 'authorization' ? [] : editState.stageBindings
                        }
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
                              className={`rounded px-2 py-1 text-xs font-mono transition-colors ${active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
                      <Button
                        variant="primary"
                        size="sm"
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
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : activeTab === 'configuration' ? (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-base font-semibold text-slate-900">Policy Configuration</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose where a policy applies first, then fill in the generated configuration fields derived from its default JSON structure.
            </p>
          </Card>

          {sortedPolicies.map((policy: any) => {
            const draft = assignmentDrafts[policy.id] ?? createAssignmentDraft(policy.key)

            return (
              <Card key={policy.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{policy.name}</h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{policy.key}</span>
                  <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700">{policy.category ?? 'authentication'}</span>
                  <span className={`rounded px-2 py-1 text-xs ${policy.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {policy.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{policy.description}</p>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <AssignmentConfigEditor
                    draft={draft}
                    policyKey={policy.key}
                    onDraftChange={(next) => setAssignmentDrafts((prev) => ({ ...prev, [policy.id]: next }))}
                  />
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={async () => {
                        await setAssignment.mutateAsync({
                          id: policy.id,
                          scopeType: draft.scopeType,
                          scopeId: draft.scopeType === 'global' ? undefined : draft.scopeId,
                          enabled: true,
                          config: draft.rawMode ? JSON.parse(draft.rawConfig || '{}') : draft.config
                        })
                      }}
                    >
                      Upsert Assignment
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Existing Assignments</p>
                  {(policy.assignments ?? []).length === 0 ? (
                    <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      No assignments configured yet.
                    </div>
                  ) : (
                    (policy.assignments ?? []).map((assignment: any) => (
                      <div key={assignment.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">{assignment.scopeType}</span>
                        <span className="font-mono text-slate-500">{assignment.scopeId || 'global'}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{summarizeConfig(assignment.config ?? {})}</span>
                      <Button
                          variant="danger"
                          size="sm"
                          className="ml-auto"
                          onClick={() => removeAssignment.mutate({
                            id: policy.id,
                            scopeType: assignment.scopeType,
                            scopeId: assignment.scopeType === 'global' ? undefined : assignment.scopeId
                          })}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-base font-semibold text-slate-900">Authorization Decision History</h2>
            <p className="mt-1 text-sm text-slate-600">View recent policy evaluation decisions for audit and debugging purposes.</p>
          </Card>

          {decisionsLoading ? (
            <TableSkeleton rows={4} />
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
                            <StatusBadge tone={decision.decision === 'allow' || decision.allowed ? 'success' : 'danger'}>
                              {decision.decision === 'allow' || decision.allowed ? 'ALLOW' : 'DENY'}
                            </StatusBadge>
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
