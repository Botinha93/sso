import { ActionIcon, Alert, Badge, Button, Group, Select, Stack, Table, Text, TextInput, Textarea, Tooltip } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Play, Settings2, GitMerge, Activity } from 'lucide-react'
import { PageHeader, RefreshButton, SectionCard, StatusBadge, TableSkeleton } from '@nexus/design'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import {
  useConnectors,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTriggerConnectorSync,
  type ConnectorDto,
} from '../hooks/useApi'

type SchedulePreset = 'none' | 'every_15m' | 'hourly' | 'daily_02_00' | 'weekly_mon_02_00' | 'custom_existing'

const scheduleFromPreset = (preset: Exclude<SchedulePreset, 'custom_existing'>): string => {
  if (preset === 'none') return ''
  if (preset === 'every_15m') return '*/15 * * * *'
  if (preset === 'hourly') return '0 * * * *'
  if (preset === 'daily_02_00') return '0 2 * * *'
  return '0 2 * * 1'
}

const presetFromSchedule = (schedule?: string | null): SchedulePreset => {
  const value = (schedule ?? '').trim()
  if (!value) return 'none'
  if (value === '*/15 * * * *') return 'every_15m'
  if (value === '0 * * * *') return 'hourly'
  if (value === '0 2 * * *') return 'daily_02_00'
  if (value === '0 2 * * 1') return 'weekly_mon_02_00'
  return 'custom_existing'
}

const ConnectorStatusBadge = ({ status }: { status: ConnectorDto['status'] }) => {
  const toneByStatus: Record<string, 'success' | 'neutral' | 'danger'> = {
    active: 'success',
    inactive: 'neutral',
    error: 'danger'
  }
  return (
    <StatusBadge status={toneByStatus[status] ?? 'neutral'}>
      {status}
    </StatusBadge>
  )
}

const defaultConnectorForm = () => ({
  name: '',
  type: 'scim' as ConnectorDto['type'],
  schedulePreset: 'none' as SchedulePreset,
  schedule: '',
  config: '{}'
})

export default function Connectors() {
  const { data, isLoading, isFetching, refetch } = useConnectors()
  const createConnector = useCreateConnector()
  const updateConnector = useUpdateConnector()
  const deleteConnector = useDeleteConnector()
  const triggerSync = useTriggerConnectorSync()

  const [showCreate, setShowCreate] = useState(false)
  const [editConnector, setEditConnector] = useState<ConnectorDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectorDto | null>(null)
  const [form, setForm] = useState(defaultConnectorForm())
  const [formError, setFormError] = useState<string | null>(null)

  const connectors = data?.data ?? []

  const openCreate = () => {
    setForm(defaultConnectorForm())
    setFormError(null)
    setShowCreate(true)
  }

  const openEdit = (c: ConnectorDto) => {
    setForm({
      name: c.name,
      type: c.type,
      schedulePreset: presetFromSchedule(c.schedule),
      schedule: c.schedule ?? '',
      config: JSON.stringify(c.config, null, 2)
    })
    setFormError(null)
    setEditConnector(c)
  }

  const resolveSchedule = () => {
    if (form.schedulePreset === 'custom_existing') {
      return form.schedule
    }
    return scheduleFromPreset(form.schedulePreset)
  }

  const handleCreate = async () => {
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    setFormError(null)
    const schedule = resolveSchedule()
    try {
      await createConnector.mutateAsync({ name: form.name, type: form.type, config, schedule: schedule || undefined })
      setShowCreate(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create connector')
    }
  }

  const handleSave = async () => {
    if (!editConnector) return
    let config: Record<string, unknown> = {}
    try { config = JSON.parse(form.config || '{}') } catch {
      setFormError('Config must be valid JSON')
      return
    }
    setFormError(null)
    const schedule = resolveSchedule()
    try {
      await updateConnector.mutateAsync({ id: editConnector.id, data: { name: form.name, type: form.type, config, schedule: schedule || undefined } })
      setEditConnector(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update connector')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteConnector.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleSync = async (id: string) => {
    await triggerSync.mutateAsync(id)
  }

  // Rendered as a plain function (not a nested component) so inputs keep focus while typing.
  const renderConnectorForm = ({ onSubmit, isLoading }: { onSubmit: () => void; isLoading: boolean }) => (
    <Stack gap="md">
      {formError && <Alert color="red" variant="light">{formError}</Alert>}
      <TextInput
        label="Name"
        placeholder="My Connector"
        value={form.name}
        onChange={(e) => { const value = e.currentTarget.value; setForm((f) => ({ ...f, name: value })) }}
      />
      <Select
        label="Type"
        value={form.type}
        allowDeselect={false}
        onChange={(value) => { if (value) setForm((f) => ({ ...f, type: value as ConnectorDto['type'] })) }}
        data={(['ldap', 'scim', 'csv', 'sql', 'custom'] as const).map((t) => ({ value: t, label: t.toUpperCase() }))}
      />
      <Stack gap={6}>
        <Select
          label="Sync Schedule (optional)"
          description="Automatic sync cadence is selected as a policy option; cron syntax is handled internally."
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={form.schedulePreset}
          allowDeselect={false}
          onChange={(value) => { if (value) setForm((f) => ({ ...f, schedulePreset: value as SchedulePreset })) }}
          data={[
            { value: 'none', label: 'Manual only (no automatic sync)' },
            { value: 'every_15m', label: 'Every 15 minutes' },
            { value: 'hourly', label: 'Every hour' },
            { value: 'daily_02_00', label: 'Daily at 02:00' },
            { value: 'weekly_mon_02_00', label: 'Weekly on Monday at 02:00' },
            ...(form.schedulePreset === 'custom_existing' ? [{ value: 'custom_existing', label: 'Keep existing custom schedule' }] : []),
          ]}
        />
        {form.schedulePreset === 'custom_existing' ? (
          <Text size="xs" c="yellow.7">
            This connector currently uses a custom legacy schedule. Choose another option to replace it.
          </Text>
        ) : null}
      </Stack>
      <Textarea
        label="Config (JSON)"
        autosize
        minRows={5}
        maxRows={16}
        ff="monospace"
        styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
        value={form.config}
        onChange={(e) => { const value = e.currentTarget.value; setForm((f) => ({ ...f, config: value })) }}
      />
      <Group justify="flex-end" gap="xs" pt="xs">
        <Button variant="default" onClick={() => { setShowCreate(false); setEditConnector(null) }}>Cancel</Button>
        <Button onClick={onSubmit} loading={isLoading}>
          Save
        </Button>
      </Group>
    </Stack>
  )

  return (
    <>
      <PageHeader
        eyebrow="Data Sync"
        title="Connectors"
        description="Manage external identity sources and sync execution."
        actions={
          <Group gap="xs">
            <RefreshButton variant="icon" onRefresh={() => refetch()} loading={isFetching} lastUpdated={null} />
            <Button component={Link} to="/metrics" variant="default" leftSection={<Activity size={16} />}>
              View Auth Metrics
            </Button>
            <Button onClick={openCreate} leftSection={<Plus size={16} />}>
              New Connector
            </Button>
          </Group>
        }
      />

      <SectionCard flush>
        {isLoading ? (
          <TableSkeleton rows={4} columns={['text', 'pill', 'pill', 'mono', 'text', 'action']} />
        ) : !connectors.length ? (
          <EmptyState
            icon={GitMerge}
            title="No connectors yet"
            description="Create a connector to sync users from an external source."
            action={<Button size="xs" onClick={openCreate} leftSection={<Plus size={14} />}>New Connector</Button>}
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  {['Name', 'Type', 'Status', 'Schedule', 'Last Sync', 'Actions'].map((h) => (
                    <Table.Th key={h}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {connectors.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text size="sm" fw={500}>{c.name}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="default" radius="sm">{c.type.toUpperCase()}</Badge>
                    </Table.Td>
                    <Table.Td><ConnectorStatusBadge status={c.status} /></Table.Td>
                    <Table.Td><Text size="xs" ff="monospace" c="dimmed">{c.schedule ?? '—'}</Text></Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" className="nx-tabular">
                        {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button
                          variant="subtle"
                          color="green"
                          size="xs"
                          leftSection={<Play size={14} />}
                          onClick={() => handleSync(c.id)}
                          disabled={triggerSync.isPending}
                          title="Trigger sync"
                        >
                          Sync
                        </Button>
                        <Button
                          component={Link}
                          to={`/connectors/${c.id}`}
                          variant="subtle"
                          color="gray"
                          size="xs"
                          title="View connector details"
                        >
                          Details
                        </Button>
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(c)} aria-label="Edit" title="Edit">
                            <Settings2 size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(c)} aria-label="Delete" title="Delete">
                            <Trash2 size={14} />
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

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Connector">
        {renderConnectorForm({ onSubmit: handleCreate, isLoading: createConnector.isPending })}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editConnector} onClose={() => setEditConnector(null)} title="Edit Connector">
        {renderConnectorForm({ onSubmit: handleSave, isLoading: updateConnector.isPending })}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Connector"
        message={`Are you sure you want to delete connector "${deleteTarget?.name}"? This will also remove all runs and mappings.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  )
}
