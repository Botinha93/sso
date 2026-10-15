import { ActionIcon, Alert, Badge, Box, Button, Checkbox, Group, NativeSelect, Paper, Stack, Table, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core'
import { Check, ChevronDown, ChevronUp, ClipboardList, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
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
    <Stack gap="lg">
      <PageHeader
        eyebrow="Authentication"
        title="Flows & Stages"
        actions={
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            New flow
          </Button>
        }
      />

      <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search authentication flows…" maw={360} />

      <SectionCard
        flush
        title="Configured authentication flows"
        actions={
          <Button variant="subtle" size="xs" leftSection={<RefreshCw size={14} />} onClick={() => refetch()} loading={isFetching} disabled={isFetching}>
            Refresh
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : flows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No authentication flows configured"
            description="Create a flow to define how users authenticate."
          />
        ) : (
          <Table.ScrollContainer minWidth={560} mb={0}>
            <Table verticalSpacing="md" highlightOnHover>
              <Table.Tbody>
                {flows.map((flow) => (
                  <Table.Tr key={flow.id}>
                    <Table.Td pl="lg">
                      <Group gap="xs" mb={4} wrap="wrap">
                        <ThemeIcon size={28} radius="md" variant="light" color="gray">
                          <ClipboardList size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>{flow.name}</Text>
                        <Badge size="sm" variant="light" color="gray">{flow.designation}</Badge>
                        {flow.enabled && (
                          <Badge size="sm" variant="light" color="green" leftSection={<Check size={10} />}>
                            Active
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" mb="xs">{flow.description}</Text>
                      <Group gap={4} mb={6}>
                        {flow.grantTypes.map((grantType) => (
                          <Badge key={`${flow.id}-grant-${grantType}`} size="sm" variant="light" color="blue" tt="none" ff="monospace" fw={500}>
                            {grantType}
                          </Badge>
                        ))}
                      </Group>
                      <Group gap={4}>
                        {[...flow.stages]
                          .sort((a, b) => a.order - b.order)
                          .map((stage) => (
                            <Badge key={`${flow.id}-${stage.type}`} size="sm" variant="light" color="gray" tt="none" ff="monospace" fw={500}>
                              {stage.order}. {stage.type}
                            </Badge>
                          ))}
                      </Group>
                    </Table.Td>
                    <Table.Td pr="lg" w={1} style={{ verticalAlign: 'top' }}>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Edit flow">
                          <ActionIcon variant="subtle" color="gray" aria-label="Edit flow" onClick={() => openEdit(flow)}>
                            <Pencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete flow">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Delete flow"
                            onClick={() => onDelete(flow)}
                            disabled={deleteFlow.isPending}
                          >
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={createFlow.isPending}
          submitLabel="Create flow"
          onSubmit={onCreate}
          error={createFormError}
        />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Authentication Flow">
        <FlowForm
          form={form}
          setForm={setForm}
          pending={updateFlow.isPending}
          submitLabel="Save changes"
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
    </Stack>
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
    <Stack gap="md">
      {error && <Alert color="red" variant="light">{error}</Alert>}
      <TextInput
        label="Flow name"
        value={form.name}
        onChange={(e) => { const value = e.currentTarget.value; setForm((prev) => ({ ...prev, name: value })) }}
        placeholder="High assurance login"
      />
      <TextInput
        label="Description"
        value={form.description}
        onChange={(e) => { const value = e.currentTarget.value; setForm((prev) => ({ ...prev, description: value })) }}
        placeholder="Federation + consent + optional MFA"
      />
      <NativeSelect
        label="Designation"
        value={form.designation}
        onChange={(e) => { const value = e.currentTarget.value as FlowDesignation; setForm((prev) => ({ ...prev, designation: value })) }}
        data={DESIGNATION_OPTIONS}
      />
      <Box>
        <Text size="sm" fw={500} mb={6}>Grant types</Text>
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            {GRANT_OPTIONS.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={form.grantTypes.includes(option.value)}
                onChange={() => toggleGrant(option.value)}
              />
            ))}
          </Stack>
        </Paper>
      </Box>
      <Box>
        <Text size="sm" fw={500} mb={6}>Stages</Text>
        <Paper withBorder radius="md" p={4}>
          <Stack gap={0}>
            {STAGE_OPTIONS.map((option) => {
              const enabled = form.stages.includes(option.value)
              const order = form.stages.indexOf(option.value)

              return (
                <Group key={option.value} justify="space-between" wrap="nowrap" px="xs" py={6} mih={40}>
                  <Checkbox
                    label={option.label}
                    checked={enabled}
                    onChange={() => toggleStage(option.value)}
                  />
                  {enabled ? (
                    <Group gap={4} wrap="nowrap">
                      <Text size="xs" c="dimmed" ff="monospace" mr={4}>#{order + 1}</Text>
                      <ActionIcon variant="default" size="sm" aria-label={`Move ${option.label} up`} onClick={() => moveStage(option.value, -1)}>
                        <ChevronUp size={14} />
                      </ActionIcon>
                      <ActionIcon variant="default" size="sm" aria-label={`Move ${option.label} down`} onClick={() => moveStage(option.value, 1)}>
                        <ChevronDown size={14} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">Disabled</Text>
                  )}
                </Group>
              )
            })}
          </Stack>
        </Paper>
      </Box>

      <Checkbox
        label="Set as active authentication flow"
        checked={form.enabled}
        onChange={(e) => { const checked = e.currentTarget.checked; setForm((prev) => ({ ...prev, enabled: checked })) }}
      />

      <Group justify="flex-end">
        <Button
          onClick={onSubmit}
          loading={pending}
          disabled={pending || !form.name || !form.description || form.stages.length === 0 || form.grantTypes.length === 0}
        >
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  )
}

export default AuthenticationFlows
