import { Check, ClipboardList, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import React from 'react';
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
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data, isLoading, isFetching, refetch } = useAuthenticationFlows(debouncedSearch)
  const createFlow = useCreateAuthenticationFlow()
  const updateFlow = useUpdateAuthenticationFlow()
  const deleteFlow = useDeleteAuthenticationFlow()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<AuthenticationFlow | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(blankForm)
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')

  const flows = useMemo(() => (data ?? []) as AuthenticationFlow[], [data])

  const stagePayload = (stages: StageType[]) => stages.map((stage, index) => ({ type: stage, required: true, order: index + 1 }))

  const openCreate = () => {
    setForm(blankForm)
    setCreateFormError('')
    setCreateOpen(true)
  }

  const openEdit = (flow: AuthenticationFlow) => {
    setEditFormError('')
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

    setCreateFormError('')
    try {
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
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create authentication flow')
    }
  }

  const onEdit = async () => {
    if (!editingId || !form.name || !form.description || form.stages.length === 0) {
      return
    }

    setEditFormError('')
    try {
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
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update authentication flow')
    }
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
          <Button variant="primary" onClick={openCreate}>
            <Plus size={14} />
            New Flow
          </Button>
        }
      />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search authentication flows…" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Configured Authentication Flows</h4>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
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
                    <StatusBadge tone="neutral" className="uppercase tracking-wider">{flow.designation}</StatusBadge>
                    {flow.enabled && (
                      <StatusBadge tone="success">
                        <Check size={10} /> Active
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{flow.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {flow.grantTypes.map((grantType) => (
                      <StatusBadge key={`${flow.id}-grant-${grantType}`} tone="accent" mono>
                        {grantType}
                      </StatusBadge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...flow.stages]
                      .sort((a, b) => a.order - b.order)
                      .map((stage) => (
                        <StatusBadge key={`${flow.id}-${stage.type}`} tone="neutral" mono>
                          {stage.order}. {stage.type}
                        </StatusBadge>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(flow)}
                    title="Edit flow"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-red-50 hover:text-red-600"
                    onClick={() => onDelete(flow)}
                    disabled={deleteFlow.isPending}
                    title="Delete flow"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={createFlow.isPending}
          submitLabel={createFlow.isPending ? 'Creating...' : 'Create Flow'}
          onSubmit={onCreate}
          error={createFormError}
        />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={updateFlow.isPending}
          submitLabel={updateFlow.isPending ? 'Saving...' : 'Save Changes'}
          onSubmit={onEdit}
          error={editFormError}
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
  error,
}: {
  form: typeof blankForm
  setForm: Dispatch<SetStateAction<typeof blankForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
  error?: string
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
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <label className={labelCls}>Flow Name</label>
        <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="High assurance login" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Federation + consent + optional MFA" />
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
                    <Button variant="outline" size="sm" onClick={() => moveStage(option.value, -1)}>Up</Button>
                    <Button variant="outline" size="sm" onClick={() => moveStage(option.value, 1)}>Down</Button>
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
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={pending || !form.name || !form.description || form.stages.length === 0 || form.grantTypes.length === 0}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export default AuthenticationFlows
