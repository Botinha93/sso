import { Check, ClipboardList, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useAuthenticationFlows,
  useCreateAuthenticationFlow,
  useDeleteAuthenticationFlow,
  useUpdateAuthenticationFlow,
} from '../hooks/useApi'

type StageType =
  | 'password'
  | 'federation'
  | 'consent'
  | 'mfa_totp'
  | 'mfa_webauthn'
  | 'risk_check'
  | 'identification'
  | 'email_verification'
  | 'captcha'
  | 'prompt'
  | 'user_write'
  | 'user_login'
  | 'user_logout'
type GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token' | 'password' | 'device_code' | 'token_exchange' | 'jwt_bearer' | 'saml2_bearer' | 'ciba'
type FlowDesignation = 'authentication' | 'authorization' | 'enrollment' | 'invalidation' | 'recovery' | 'stage_configuration' | 'unenrollment'

interface AuthenticationStage {
  type: StageType
  required: boolean
  order: number
}

interface AuthenticationFlow {
  id: string
  name: string
  description: string
  designation: FlowDesignation
  enabled: boolean
  grantTypes: GrantType[]
  stages: AuthenticationStage[]
}

const DESIGNATION_OPTIONS: Array<{ value: FlowDesignation; label: string }> = [
  { value: 'authentication', label: 'Authentication' },
  { value: 'authorization', label: 'Authorization' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'invalidation', label: 'Invalidation' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'stage_configuration', label: 'Stage Configuration' },
  { value: 'unenrollment', label: 'Unenrollment' },
]

const GRANT_OPTIONS: Array<{ value: GrantType; label: string }> = [
  { value: 'authorization_code', label: 'Authorization Code' },
  { value: 'client_credentials', label: 'Client Credentials' },
  { value: 'refresh_token', label: 'Refresh Token' },
  { value: 'password', label: 'Password' },
  { value: 'device_code', label: 'Device Code' },
  { value: 'token_exchange', label: 'Token Exchange (RFC 8693)' },
  { value: 'jwt_bearer', label: 'JWT Bearer Assertion' },
  { value: 'saml2_bearer', label: 'SAML 2.0 Bearer Assertion' },
  { value: 'ciba', label: 'CIBA (Backchannel Authentication)' },
]

const STAGE_OPTIONS: Array<{ value: StageType; label: string }> = [
  { value: 'password', label: 'Password' },
  { value: 'federation', label: 'Federation' },
  { value: 'consent', label: 'Consent' },
  { value: 'mfa_totp', label: 'MFA (TOTP)' },
  { value: 'mfa_webauthn', label: 'MFA (WebAuthn / Passkey)' },
  { value: 'risk_check', label: 'Risk Check' },
  { value: 'identification', label: 'Identification' },
  { value: 'email_verification', label: 'Email Verification' },
  { value: 'captcha', label: 'Captcha' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'user_write', label: 'User Write' },
  { value: 'user_login', label: 'User Login' },
  { value: 'user_logout', label: 'User Logout' },
]

const blankForm = {
  name: '',
  description: '',
  designation: 'authentication' as FlowDesignation,
  enabled: false,
  grantTypes: ['authorization_code', 'refresh_token'] as GrantType[],
  stages: ['password', 'federation', 'consent'] as StageType[],
}

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const AuthenticationFlows = () => {
  const { data, isLoading, refetch } = useAuthenticationFlows()
  const createFlow = useCreateAuthenticationFlow()
  const updateFlow = useUpdateAuthenticationFlow()
  const deleteFlow = useDeleteAuthenticationFlow()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<AuthenticationFlow | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(blankForm)

  const flows = useMemo(() => (data ?? []) as AuthenticationFlow[], [data])

  const stagePayload = (stages: StageType[]) => stages.map((stage, index) => ({ type: stage, required: true, order: index + 1 }))

  const openCreate = () => {
    setForm(blankForm)
    setCreateOpen(true)
  }

  const openEdit = (flow: AuthenticationFlow) => {
    setEditingId(flow.id)
    setForm({
      name: flow.name,
      description: flow.description,
      designation: flow.designation,
      enabled: flow.enabled,
      grantTypes: flow.grantTypes ?? ['authorization_code'],
      stages: [...flow.stages].sort((a, b) => a.order - b.order).map((stage) => stage.type),
    })
    setEditOpen(true)
  }

  const onCreate = async () => {
    if (!form.name || !form.description || form.stages.length === 0) {
      return
    }

    await createFlow.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim(),
      designation: form.designation,
      enabled: form.enabled,
      grantTypes: form.grantTypes,
      stages: stagePayload(form.stages),
    })

    setCreateOpen(false)
    setForm(blankForm)
  }

  const onEdit = async () => {
    if (!editingId || !form.name || !form.description || form.stages.length === 0) {
      return
    }

    await updateFlow.mutateAsync({
      id: editingId,
      name: form.name.trim(),
      description: form.description.trim(),
      designation: form.designation,
      enabled: form.enabled,
      grantTypes: form.grantTypes,
      stages: stagePayload(form.stages),
    })

    setEditOpen(false)
    setEditingId('')
    setForm(blankForm)
  }

  const onDelete = (flow: AuthenticationFlow) => {
    setFlowToDelete(flow)
  }

  const confirmDeleteFlow = () => {
    if (!flowToDelete) return
    deleteFlow.mutate(flowToDelete.id, { onSuccess: () => setFlowToDelete(null) })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Authentication"
        title="Flows & Stages"
        action={
          <button
            onClick={openCreate}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            New Flow
          </button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Configured Authentication Flows</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : flows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No authentication flows configured"
            description="Create a flow to define how users authenticate."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {flows.map((flow) => (
              <div key={flow.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                      <ClipboardList size={14} className="text-slate-500" />
                    </div>
                    <h5 className="text-sm font-medium text-slate-900">{flow.name}</h5>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider">{flow.designation}</span>
                    {flow.enabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-100 inline-flex items-center gap-1">
                        <Check size={10} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{flow.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {flow.grantTypes.map((grantType) => (
                      <span key={`${flow.id}-grant-${grantType}`} className="text-xs px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100 font-mono">
                        {grantType}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...flow.stages]
                      .sort((a, b) => a.order - b.order)
                      .map((stage) => (
                        <span key={`${flow.id}-${stage.type}`} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {stage.order}. {stage.type}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(flow)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Edit flow"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(flow)}
                    disabled={deleteFlow.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    title="Delete flow"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={createFlow.isPending}
          submitLabel={createFlow.isPending ? 'Creating...' : 'Create Flow'}
          onSubmit={onCreate}
        />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={updateFlow.isPending}
          submitLabel={updateFlow.isPending ? 'Saving...' : 'Save Changes'}
          onSubmit={onEdit}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!flowToDelete}
        title="Delete Authentication Flow"
        message={`Delete flow "${flowToDelete?.name ?? ''}"?`}
        confirmLabel="Delete Flow"
        pending={deleteFlow.isPending}
        onConfirm={confirmDeleteFlow}
        onCancel={() => setFlowToDelete(null)}
      />
    </div>
  )
}

function FlowForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  pending,
}: {
  form: typeof blankForm
  setForm: Dispatch<SetStateAction<typeof blankForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
}) {
  const toggleStage = (stageType: StageType) => {
    setForm((prev) => {
      if (prev.stages.includes(stageType)) {
        return { ...prev, stages: prev.stages.filter((stage) => stage !== stageType) }
      }
      return { ...prev, stages: [...prev.stages, stageType] }
    })
  }

  const toggleGrant = (grantType: GrantType) => {
    setForm((prev) => {
      if (prev.grantTypes.includes(grantType)) {
        return { ...prev, grantTypes: prev.grantTypes.filter((grant) => grant !== grantType) }
      }
      return { ...prev, grantTypes: [...prev.grantTypes, grantType] }
    })
  }

  const moveStage = (stageType: StageType, direction: -1 | 1) => {
    setForm((prev) => {
      const currentIndex = prev.stages.indexOf(stageType)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.stages.length) {
        return prev
      }
      const nextStages = [...prev.stages]
      const [stage] = nextStages.splice(currentIndex, 1)
      nextStages.splice(nextIndex, 0, stage)
      return { ...prev, stages: nextStages }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Flow Name</label>
        <input className={fieldCls} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="High assurance login" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <input className={fieldCls} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Federation + consent + optional MFA" />
      </div>
      <div>
        <label className={labelCls}>Designation</label>
        <select className={fieldCls} value={form.designation} onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value as FlowDesignation }))}>
          {DESIGNATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Grant Types</label>
        <div className="space-y-2 rounded-lg border border-slate-200 p-2 flex flex-col gap-5">
          {GRANT_OPTIONS.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-1 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.grantTypes.includes(option.value)}
                onChange={() => toggleGrant(option.value)}
                className="rounded border-slate-300"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Stages</label>
        <div className="space-y-2 rounded-lg border border-slate-200 p-2">
          {STAGE_OPTIONS.map((option) => {
            const enabled = form.stages.includes(option.value)
            const order = form.stages.indexOf(option.value)

            return (
              <div key={option.value} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleStage(option.value)}
                    className="rounded border-slate-300"
                  />
                  {option.label}
                </label>
                {enabled ? (
                  <div className="inline-flex items-center gap-1">
                    <span className="text-xs text-slate-500 font-mono">#{order + 1}</span>
                    <button type="button" onClick={() => moveStage(option.value, -1)} className="h-6 px-2 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-100">Up</button>
                    <button type="button" onClick={() => moveStage(option.value, 1)} className="h-6 px-2 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-100">Down</button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Disabled</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-slate-300"
          checked={form.enabled}
          onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
        />
        Set as active authentication flow
      </label>

      <div className="flex justify-end">
        <button onClick={onSubmit} disabled={pending || !form.name || !form.description || form.stages.length === 0 || form.grantTypes.length === 0} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

export default AuthenticationFlows
