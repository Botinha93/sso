import { Pencil, Plus, ToggleLeft, ToggleRight, Trash2, UserCog } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import BulkActionsBar, { SelectionCheckbox } from '../components/BulkActionsBar'
import {
  useCreateUserAttribute,
  useDeleteUserAttribute,
  useUpdateUserAttribute,
  useUserAttributes,
} from '../hooks/useApi'

type AttributeType = 'text' | 'number' | 'boolean' | 'date' | 'json'

interface UserAttribute {
  id: string
  key: string
  name: string
  description: string
  type: AttributeType
  enabled: boolean
  showOnPortal: boolean
  userEditable: boolean
}

type ToggleField = 'enabled' | 'showOnPortal' | 'userEditable'

const TYPE_OPTIONS: AttributeType[] = ['text', 'number', 'boolean', 'date', 'json']

const defaultForm = {
  key: '',
  name: '',
  description: '',
  type: 'text' as AttributeType,
  enabled: true,
  showOnPortal: false,
  userEditable: false,
}

const UserAttributes = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data, isLoading, isFetching, refetch } = useUserAttributes(debouncedSearch)

  const createAttribute = useCreateUserAttribute()
  const updateAttribute = useUpdateUserAttribute()
  const deleteAttribute = useDeleteUserAttribute()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<UserAttribute | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(defaultForm)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const attributes = useMemo(() => (data ?? []) as UserAttribute[], [data])
  const attributeIds = useMemo(() => attributes.map((attribute) => attribute.id), [attributes])
  const selectedCount = useMemo(
    () => attributeIds.reduce((count, id) => (selectedIds.includes(id) ? count + 1 : count), 0),
    [attributeIds, selectedIds]
  )
  const allSelected = attributeIds.length > 0 && selectedCount === attributeIds.length
  const someSelected = selectedCount > 0 && !allSelected

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(attributeIds)
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [attributeIds])

  const openCreate = () => {
    setForm(defaultForm)
    setCreateOpen(true)
  }

  const openEdit = (attribute: UserAttribute) => {
    setEditingId(attribute.id)
    setForm({
      key: attribute.key,
      name: attribute.name,
      description: attribute.description,
      type: attribute.type,
      enabled: attribute.enabled,
      showOnPortal: attribute.showOnPortal,
      userEditable: attribute.userEditable,
    })
    setEditOpen(true)
  }

  const onCreate = async () => {
    if (!form.key || !form.name || !form.description) return

    await createAttribute.mutateAsync({
      key: form.key,
      name: form.name,
      description: form.description,
      type: form.type,
      enabled: form.enabled,
      showOnPortal: form.showOnPortal,
      userEditable: form.userEditable,
    })

    setCreateOpen(false)
    setForm(defaultForm)
  }

  const onEdit = async () => {
    if (!editingId || !form.key || !form.name || !form.description) return

    await updateAttribute.mutateAsync({
      id: editingId,
      key: form.key,
      name: form.name,
      description: form.description,
      type: form.type,
      enabled: form.enabled,
      showOnPortal: form.showOnPortal,
      userEditable: form.userEditable,
    })

    setEditOpen(false)
    setEditingId('')
    setForm(defaultForm)
  }

  const onDelete = (attribute: UserAttribute) => {
    setAttributeToDelete(attribute)
  }

  const confirmDeleteAttribute = () => {
    if (!attributeToDelete) return
    deleteAttribute.mutate(attributeToDelete.id, { onSuccess: () => setAttributeToDelete(null) })
  }

  const toggleField = (attribute: UserAttribute, field: ToggleField) => {
    updateAttribute.mutate({ id: attribute.id, [field]: !attribute[field] })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (attributeIds.length === 0) return
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !attributeIds.includes(id)))
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of attributeIds) next.add(id)
      return Array.from(next)
    })
  }

  const clearSelection = () => {
    setSelectedIds([])
    setBulkError('')
  }

  const runBulkToggle = async (field: ToggleField, value: boolean) => {
    if (selectedIds.length === 0) return
    setBulkError('')
    setBulkPending(true)
    try {
      const ids = [...selectedIds]
      const targets = attributes.filter((attribute) => ids.includes(attribute.id) && attribute[field] !== value)
      if (targets.length === 0) {
        setBulkError(`Selected attributes already have that setting.`)
        return
      }
      const results = await Promise.allSettled(
        targets.map((attribute) => updateAttribute.mutateAsync({ id: attribute.id, [field]: value }))
      )
      const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        const message = failures[0].reason instanceof Error ? failures[0].reason.message : 'Unknown error'
        setBulkError(`${failures.length} of ${targets.length} update${targets.length === 1 ? '' : 's'} failed: ${message}`)
        return
      }
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk update failed')
    } finally {
      setBulkPending(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="User Profile Schema"
        title="User Attributes"
        actions={
          <Button onClick={openCreate} leftSection={<Plus size={16} />}>
            New Attribute
          </Button>
        }
      />

      <SearchInput maw={360} value={searchInput} onChange={setSearchInput} placeholder="Search attribute definitions…" />

      <SectionCard
        flush
        title="Attribute Definitions"
        description="Attribute values are assigned from the Users and Groups pages."
        actions={
          <RefreshButton size="xs" onRefresh={() => refetch()} loading={isFetching} lastUpdated={null} />
        }
      >
        <BulkActionsBar
          count={selectedIds.length}
          noun="attribute"
          onClear={clearSelection}
        >
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleRight size={14} />} onClick={() => void runBulkToggle('enabled', true)}>
            Global On
          </Button>
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleLeft size={14} />} onClick={() => void runBulkToggle('enabled', false)}>
            Global Off
          </Button>
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleRight size={14} />} onClick={() => void runBulkToggle('showOnPortal', true)}>
            Portal Visible
          </Button>
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleLeft size={14} />} onClick={() => void runBulkToggle('showOnPortal', false)}>
            Portal Hidden
          </Button>
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleRight size={14} />} onClick={() => void runBulkToggle('userEditable', true)}>
            User Editable
          </Button>
          <Button variant="default" size="xs" disabled={bulkPending} leftSection={<ToggleLeft size={14} />} onClick={() => void runBulkToggle('userEditable', false)}>
            Read Only
          </Button>
        </BulkActionsBar>

        {bulkError && (
          <Alert color="red" variant="light" radius={0} py="xs">
            <Text size="xs">{bulkError}</Text>
          </Alert>
        )}

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : attributes.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No custom user attributes defined"
            description="Define custom profile attributes to extend user data."
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <SelectionCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                      disabled={attributes.length === 0}
                      title={allSelected ? 'Deselect all' : 'Select all visible'}
                      aria-label={allSelected ? 'Deselect all' : 'Select all visible'}
                    />
                  </Table.Th>
                  <Table.Th>Attribute</Table.Th>
                  <Table.Th>Settings</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attributes.map((attribute) => {
                  const isSelected = selectedIds.includes(attribute.id)
                  return (
                    <Table.Tr
                      key={attribute.id}
                      bg={isSelected ? 'var(--nx-color-accent-soft)' : undefined}
                    >
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <SelectionCheckbox
                          mt={2}
                          checked={isSelected}
                          onChange={() => toggleSelect(attribute.id)}
                          aria-label={`Select attribute ${attribute.name}`}
                        />
                      </Table.Td>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <Group gap="xs" wrap="wrap" mb={4}>
                          <Text size="sm" fw={500}>{attribute.name}</Text>
                          <Badge color="gray" variant="light" size="sm" ff="monospace" tt="none">{attribute.key}</Badge>
                          <Badge color="blue" variant="light" size="sm" ff="monospace" tt="none">{attribute.type}</Badge>
                        </Group>
                        <Text size="xs" c="dimmed">{attribute.description}</Text>
                      </Table.Td>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <Stack gap={6}>
                          <Switch
                            size="xs"
                            checked={attribute.enabled}
                            onChange={() => toggleField(attribute, 'enabled')}
                            title="Toggle globally for all users"
                            label={attribute.enabled ? 'Global On' : 'Global Off'}
                          />
                          <Switch
                            size="xs"
                            checked={attribute.showOnPortal}
                            onChange={() => toggleField(attribute, 'showOnPortal')}
                            title="Toggle visibility on the user portal"
                            label={attribute.showOnPortal ? 'Portal Visible' : 'Portal Hidden'}
                          />
                          <Switch
                            size="xs"
                            checked={attribute.userEditable}
                            onChange={() => toggleField(attribute, 'userEditable')}
                            title="Toggle whether portal users can edit this value"
                            label={attribute.userEditable ? 'User Editable' : 'Read Only'}
                          />
                        </Stack>
                      </Table.Td>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Edit attribute">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => openEdit(attribute)}
                              title="Edit attribute"
                              aria-label="Edit attribute"
                            >
                              <Pencil size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete attribute">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => onDelete(attribute)}
                              disabled={deleteAttribute.isPending}
                              title="Delete attribute"
                              aria-label="Delete attribute"
                            >
                              <Trash2 size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create User Attribute" size="md">
        <AttributeForm
          form={form}
          setForm={setForm}
          onSubmit={onCreate}
          submitLabel={createAttribute.isPending ? 'Creating...' : 'Create Attribute'}
          pending={createAttribute.isPending}
        />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit User Attribute" size="md">
        <AttributeForm
          form={form}
          setForm={setForm}
          onSubmit={onEdit}
          submitLabel={updateAttribute.isPending ? 'Saving...' : 'Save Changes'}
          pending={updateAttribute.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!attributeToDelete}
        title="Delete User Attribute"
        message={`Delete attribute "${attributeToDelete?.name ?? ''}"?`}
        confirmLabel="Delete Attribute"
        variant="danger"
        pending={deleteAttribute.isPending}
        onConfirm={confirmDeleteAttribute}
        onCancel={() => setAttributeToDelete(null)}
      />
    </Stack>
  )
}

function AttributeForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  pending,
}: {
  form: typeof defaultForm
  setForm: React.Dispatch<React.SetStateAction<typeof defaultForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
}) {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput
          label="Attribute Key"
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          value={form.key}
          onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
          placeholder="department"
        />
        <NativeSelect
          label="Type"
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AttributeType }))}
          data={TYPE_OPTIONS}
        />
      </SimpleGrid>
      <TextInput label="Display Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Department" />
      <TextInput label="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Business unit for user segmentation" />
      <Stack gap="xs">
        <Checkbox label="Enabled for all users" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.currentTarget.checked }))} />
        <Checkbox label="Show on portal" checked={form.showOnPortal} onChange={(e) => setForm((prev) => ({ ...prev, showOnPortal: e.currentTarget.checked }))} />
        <Checkbox label="Editable by users" checked={form.userEditable} onChange={(e) => setForm((prev) => ({ ...prev, userEditable: e.currentTarget.checked }))} />
      </Stack>
      <Group justify="flex-end">
        <Button onClick={onSubmit} loading={pending} disabled={!form.key || !form.name || !form.description}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  )
}

export default UserAttributes
