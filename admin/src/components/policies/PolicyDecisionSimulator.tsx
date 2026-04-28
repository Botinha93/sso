import { useState } from 'react'
import {
  useAuthorizationCheck,
  useEvaluatePolicyDecision,
  usePolicyDecisions,
  useUsers,
} from '../../hooks/useApi'
import { DECISION_STRATEGIES, type PolicyDecisionStrategy } from './policy-config'

export function PolicyDecisionSimulator() {
  const { data: users = [] } = useUsers()
  const { data: history = [] } = usePolicyDecisions(20)
  const evaluatePolicyDecision = useEvaluatePolicyDecision()
  const authorizationCheck = useAuthorizationCheck()

  const [simulationInput, setSimulationInput] = useState({
    userId: '',
    resource: 'finance:invoice:123',
    action: 'write',
    decisionStrategy: 'deny_overrides' as PolicyDecisionStrategy,
    tenantId: '',
    clientId: 'sso-admin-ui',
    ip: '127.0.0.1',
    context: '{"department":"finance"}'
  })
  const [simulationResult, setSimulationResult] = useState<any | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)
  const [runMode, setRunMode] = useState<'evaluate' | 'check'>('evaluate')

  const isRunning = evaluatePolicyDecision.isPending || authorizationCheck.isPending

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Decision Simulator</h2>
      <p className="text-sm text-slate-600">
        Simulate authorization policy outcomes using unbound policies (those with no stage bindings).
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-xs font-medium ${runMode === 'evaluate' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          onClick={() => setRunMode('evaluate')}
        >
          Policies Evaluate
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-xs font-medium ${runMode === 'check' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          onClick={() => setRunMode('check')}
        >
          Authorization Check
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          className="rounded border px-3 py-2"
          value={simulationInput.userId}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, userId: e.target.value }))}
        >
          <option value="">Select user</option>
          {users.map((user: any) => (
            <option key={user.id} value={user.id}>
              {user.email} ({user.id})
            </option>
          ))}
        </select>
        <input
          className="rounded border px-3 py-2"
          placeholder="resource"
          value={simulationInput.resource}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, resource: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="action"
          value={simulationInput.action}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, action: e.target.value }))}
        />
        <select
          className="rounded border px-3 py-2"
          value={simulationInput.decisionStrategy}
          onChange={(e) => setSimulationInput((prev) => ({
            ...prev,
            decisionStrategy: e.target.value as PolicyDecisionStrategy
          }))}
        >
          {DECISION_STRATEGIES.map((strategy) => (
            <option key={strategy} value={strategy}>{strategy}</option>
          ))}
        </select>
        <input
          className="rounded border px-3 py-2"
          placeholder="tenantId (optional)"
          value={simulationInput.tenantId}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, tenantId: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="clientId (optional)"
          value={simulationInput.clientId}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, clientId: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="ip (optional)"
          value={simulationInput.ip}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, ip: e.target.value }))}
        />
      </div>

      <textarea
        className="min-h-[110px] w-full rounded border px-3 py-2 font-mono text-xs"
        placeholder='context json e.g. {"department":"finance"}'
        value={simulationInput.context}
        onChange={(e) => setSimulationInput((prev) => ({ ...prev, context: e.target.value }))}
      />
      <p className="text-xs text-slate-500">
        Tip: assignment config supports <span className="font-mono">effect</span>, <span className="font-mono">priority</span>, <span className="font-mono">resourcePattern</span>, and <span className="font-mono">actionPattern</span>.
      </p>

      <div className="flex justify-end">
        <button
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={isRunning}
          onClick={async () => {
            setSimulationError(null)
            setSimulationResult(null)

            let parsedContext: Record<string, unknown> = {}
            try {
              parsedContext = simulationInput.context.trim() ? JSON.parse(simulationInput.context) : {}
            } catch {
              setSimulationError('Context must be valid JSON')
              return
            }

            try {
              const payload = {
                userId: simulationInput.userId,
                resource: simulationInput.resource,
                action: simulationInput.action,
                decisionStrategy: simulationInput.decisionStrategy,
                tenantId: simulationInput.tenantId || undefined,
                clientId: simulationInput.clientId || undefined,
                ip: simulationInput.ip || undefined,
                context: parsedContext
              }

              const result = runMode === 'check'
                ? await authorizationCheck.mutateAsync(payload)
                : await evaluatePolicyDecision.mutateAsync(payload)
              setSimulationResult(result)
            } catch (err) {
              setSimulationError(err instanceof Error ? err.message : 'Simulation failed')
            }
          }}
        >
          {isRunning ? 'Evaluating...' : runMode === 'check' ? 'Run Check' : 'Evaluate'}
        </button>
      </div>

      {simulationError ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {simulationError}
        </div>
      ) : null}

      {simulationResult ? (
        <div className="space-y-3">
          <div className={`rounded px-3 py-2 text-sm font-medium ${simulationResult.allow ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            Decision: {simulationResult.allow ? 'ALLOW' : 'DENY'}
          </div>
          <div className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Strategy: {String(simulationResult.decisionStrategy ?? simulationInput.decisionStrategy)}
          </div>
          <div className="space-y-2">
            {(simulationResult.decisions ?? []).map((decision: any) => (
              <div key={decision.policyId} className="rounded border border-slate-200 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700">{decision.key}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    {String(decision.effect ?? 'deny')}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    p={String(decision.priority ?? 0)}
                  </span>
                  <span className={`rounded px-2 py-0.5 ${decision.applied ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    {decision.applied ? 'applied' : 'not_applied'}
                  </span>
                  <span className={`rounded px-2 py-0.5 ${decision.allow ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {decision.allow ? 'allow' : 'deny'}
                  </span>
                </div>
                {decision.message ? <p className="mt-1 text-rose-700">{decision.message}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent Decisions</h3>
        {(history as any[]).slice(0, 10).map((item: any) => (
          <div key={item.id} className="rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 ${item.allow ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {item.allow ? 'allow' : 'deny'}
              </span>
              <span className="font-mono">{String(item.action ?? '')}</span>
              <span className="font-mono text-slate-500">{String(item.resource ?? '')}</span>
            </div>
            {Array.isArray(item.deniedBy) && item.deniedBy.length > 0 ? (
              <p className="mt-1 text-rose-700">Denied by: {item.deniedBy.join(', ')}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
