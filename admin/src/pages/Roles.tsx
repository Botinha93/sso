import { ChevronRight, Plus, Shield, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ActionIcon, Badge, Box, Button, Group, NativeSelect, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core'
import { CheckboxMatrix, PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import BulkActionsBar, { SelectionCheckbox } from '../components/BulkActionsBar'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, useApps, useClients } from '../hooks/useApi'
import React from 'react';

const monoInput = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }

// Built-in system resources
const SYSTEM_RESOURCES = [
  { key: 'users', label: 'Users' },
  { key: 'groups', label: 'Groups' },
  { key: 'roles', label: 'Roles' },
  { key: 'clients', label: 'OAuth Clients' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'apps', label: 'Apps' },
  { key: 'audit_log', label: 'Audit Log' },
  { key: 'consents', label: 'Consents' },
  { key: 'federation_providers', label: 'Federation Providers' },
  { key: 'authentication_flows', label: 'Auth Flows' },
  { key: 'policies', label: 'Policies' },
  { key: 'events', label: 'Events & Hooks' },
  { key: 'administration', label: 'Administration' },
]

const ACTIONS = ['view', 'add', 'change', 'delete', 'disable'] as const
type Action = typeof ACTIONS[number]

function permKey(resource: string, action: Action) {
  return `${resource}:${action}`
}

function normalizePermissionPrefix(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueNonEmpty(values: Array<string | undefined>) {
  const out: string[] = []
  for (const value of values) {
    const normalized = String(value ?? '').trim()
    if (!normalized || out.includes(normalized)) continue
    out.push(normalized)
  }
  return out
}

function PermissionMatrix({ permissions, onChange, appResources }: {
  permissions: string[]
  onChange: (p: string[]) => void
  appResources: Array<{ appId: string; appName: string; appSlug?: string; resource: string }>
}) {
  const set = new Set(permissions)

  const hasResourceAction = (resourceKeys: string[], action: Action) =>
    resourceKeys.some(resourceKey => set.has(permKey(resourceKey, action)))

  // Combine system resources with app-specific ones.
  // App resource permission key format can be either "{appId}:{resource}:{action}"
  // or legacy "{appSlug}:{resource}:{action}" (for bootstrap-seeded roles).
  const sections: Array<{ key: string; label: string; rows: Array<{ key: string; label: string; keyVariants: string[] }> }> = [
    {
      key: '__system__',
      label: 'System',
      rows: SYSTEM_RESOURCES.map(resource => ({ key: `system:${resource.key}`, label: resource.label, keyVariants: [resource.key] })),
    },
  ]
  for (const ar of appResources) {
    let section = sections.find(s => s.key === ar.appId)
    if (!section) {
      section = { key: ar.appId, label: ar.appName, rows: [] }
      sections.push(section)
    }
    const rowKey = `app:${ar.appId}:${ar.resource}`
    if (section.rows.some(row => row.key === rowKey)) continue
    section.rows.push({
      key: rowKey,
      label: ar.resource,
      keyVariants: uniqueNonEmpty([
        `${ar.appId}:${ar.resource}`,
        ar.appSlug ? `${ar.appSlug}:${ar.resource}` : undefined,
        `${normalizePermissionPrefix(ar.appName)}:${ar.resource}`,
      ]),
    })
  }

  // Each matrix cell maps to a resource (with all of its permission-key variants) and an action.
  // A cell is checked when any variant grants the action; checking adds the primary variant,
  // unchecking removes every variant.
  const cellKey = (rowKey: string, action: string) => `${rowKey}::${action}`
  const cells = new Map<string, { keyVariants: string[]; action: Action }>()
  for (const section of sections) {
    for (const row of section.rows) {
      for (const action of ACTIONS) cells.set(cellKey(row.key, action), { keyVariants: row.keyVariants, action })
    }
  }
  const value = Array.from(cells.entries())
    .filter(([, cell]) => hasResourceAction(cell.keyVariants, cell.action))
    .map(([key]) => key)

  const handleChange = (nextValue: string[]) => {
    const prevChecked = new Set(value)
    const nextChecked = new Set(nextValue)
    const next = new Set(set)
    cells.forEach((cell, key) => {
      if (prevChecked.has(key) && !nextChecked.has(key)) {
        cell.keyVariants.forEach(resourceKey => next.delete(permKey(resourceKey, cell.action)))
      } else if (!prevChecked.has(key) && nextChecked.has(key) && cell.keyVariants[0]) {
        next.add(permKey(cell.keyVariants[0], cell.action))
      }
    })
    onChange(Array.from(next))
  }

  return (
    <Stack gap="xs">
      <CheckboxMatrix
        columns={ACTIONS.map(action => ({ key: action, label: action }))}
        sections={sections.map(section => ({
          key: section.key,
          label: section.label,
          rows: section.rows.map(row => ({ key: row.key, label: row.label })),
        }))}
        value={value}
        onChange={handleChange}
        getCellKey={cellKey}
        rowHeader="Resource"
        rowHeaderWidth={180}
        style={{ border: '1px solid var(--nx-color-border)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
      />
      {appResources.length === 0 && (
        <Text size="xs" c="dimmed" fs="italic" ta="center">
          No app resources defined. Add resources to an app to see them here.
        </Text>
      )}
    </Stack>
  )
}

const EMPTY_FORM = { appId: '', name: '', description: '', scope: 'platform' as 'platform' | 'tenant', permissions: [] as string[] }

const Roles = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editRole, setEditRole] = useState<any | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null)
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: roles = [], isLoading, isFetching, refetch } = useRoles(debouncedSearch)
  const { data: apps = [] } = useApps()
  const { data: clients = [] } = useClients()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const appNameById = new Map((apps as any[]).map((app: any) => [app.id, app.name]))
  const appSlugById = new Map((apps as any[]).map((app: any) => [app.id, String(app.slug ?? app.clientId ?? '').trim()]))
  const filteredRoles = (roles as any[]).filter((role) => appFilterId === 'all'
    ? true
    : appFilterId === 'none'
      ? !role.appId
      : role.appId === appFilterId)

  const filteredRoleIds = useMemo(() => filteredRoles.map((role: any) => role.id), [filteredRoles])
  const selectedFilteredCount = useMemo(
    () => filteredRoleIds.reduce((count, id) => (selectedRoleIds.includes(id) ? count + 1 : count), 0),
    [filteredRoleIds, selectedRoleIds]
  )
  const allFilteredSelected = filteredRoleIds.length > 0 && selectedFilteredCount === filteredRoleIds.length
  const someFilteredSelected = selectedFilteredCount > 0 && !allFilteredSelected

  useEffect(() => {
    setSelectedRoleIds((prev) => {
      const valid = new Set((roles as any[]).map((role: any) => role.id))
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [roles])

  const toggleSelectRole = (roleId: string) => {
    setSelectedRoleIds((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId])
  }

  const toggleSelectAllFiltered = () => {
    if (filteredRoleIds.length === 0) return
    if (allFilteredSelected) {
      setSelectedRoleIds((prev) => prev.filter((id) => !filteredRoleIds.includes(id)))
      return
    }
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredRoleIds) next.add(id)
      return Array.from(next)
    })
  }

  const clearSelection = () => setSelectedRoleIds([])

  const handleBulkDelete = async () => {
    if (selectedRoleIds.length === 0) return
    setBulkError('')
    setBulkPending(true)
    try {
      const ids = [...selectedRoleIds]
      const results = await Promise.allSettled(ids.map((id) => deleteRole.mutateAsync(id)))
      const succeeded = ids.filter((_, idx) => results[idx].status === 'fulfilled')
      const failures = results
        .map((result, idx) => ({ result, id: ids[idx] }))
        .filter(({ result }) => result.status === 'rejected') as Array<{ result: PromiseRejectedResult; id: string }>
      setSelectedRoleIds((prev) => prev.filter((id) => !succeeded.includes(id)))
      if (failures.length > 0) {
        const message = failures[0].result.reason instanceof Error ? failures[0].result.reason.message : 'Unknown error'
        setBulkError(`Failed to delete ${failures.length} of ${ids.length} role${ids.length === 1 ? '' : 's'}: ${message}`)
        return
      }
      setBulkDeleteOpen(false)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk delete failed')
    } finally {
      setBulkPending(false)
    }
  }

  // Flatten all app-scoped resources for the matrix.
  // Client resources inherit their app scope and should render under that app section.
  const appResources = (apps as any[]).flatMap((a: any) =>
    (a.resources ?? []).map((r: string) => ({ appId: a.id, appName: a.name, appSlug: String(a.slug ?? a.clientId ?? '').trim() || undefined, resource: r }))
  ).concat(
    (clients as any[]).flatMap((c: any) => {
      if (!c.appId) return []
      return (c.resources ?? []).map((r: string) => ({
        appId: c.appId,
        appName: appNameById.get(c.appId) ?? c.name,
        appSlug: appSlugById.get(c.appId) || undefined,
        resource: r,
      }))
    })
  )

  async function handleCreate() {
    if (!formData.name || !formData.permissions.length) return

    setCreateFormError('')
    try {
      await createRole.mutateAsync(formData)
        setCreateModalOpen(false)
        setFormData({ ...EMPTY_FORM })
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create role')
    }
  }

  function openEdit(role: any) {
    setEditFormError('')
    setEditRole(role)
    setFormData({ appId: role.appId ?? '', name: role.name, description: role.description, scope: role.scope, permissions: role.permissions ?? [] })
  }

  async function handleUpdate() {
    if (!editRole || !formData.name) return

    setEditFormError('')
    const payload: any = { id: editRole.id, ...formData }
    if (payload.permissions && payload.permissions.length === 0) delete payload.permissions
    try {
      await updateRole.mutateAsync(payload)
      setEditRole(null)
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  function confirmDeleteRole() {
    if (!roleToDelete) return
    deleteRole.mutate(roleToDelete.id, { onSuccess: () => setRoleToDelete(null) })
  }

  const activePermCount = (role: any) => (role.permissions ?? []).length

  const appSelectData = [
    { value: '', label: 'No app' },
    ...(apps as any[]).map((app: any) => ({ value: app.id, label: app.name })),
  ]
  const scopeSelectData = [
    { value: 'platform', label: 'Platform' },
    { value: 'tenant', label: 'Tenant' },
  ]

  const renderRoleFields = (mode: 'create' | 'edit') => (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NativeSelect
          label="App"
          value={formData.appId}
          onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, appId: value })) }}
          data={appSelectData}
        />
        <TextInput
          label="Role name"
          value={formData.name}
          onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, name: value })) }}
          styles={monoInput}
          placeholder={mode === 'create' ? 'application_user' : undefined}
        />
        <NativeSelect
          label="Scope"
          value={formData.scope}
          onChange={e => { const value = e.currentTarget.value as any; setFormData(p => ({ ...p, scope: value })) }}
          data={scopeSelectData}
        />
      </SimpleGrid>
      <TextInput
        label="Description"
        value={formData.description}
        onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, description: value })) }}
        placeholder={mode === 'create' ? 'Role description' : undefined}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Permissions{' '}
          {mode === 'create' && (
            <Text span size="xs" c="dimmed" fw={400}>(click header to toggle column, resource name to toggle row)</Text>
          )}
        </Text>
        <PermissionMatrix permissions={formData.permissions} onChange={perms => setFormData(p => ({ ...p, permissions: perms }))} appResources={appResources} />
      </Stack>
    </>
  )

  return (
    <Box>
      <PageHeader
        eyebrow="Access Control"
        title="Roles & Permissions"
        actions={
          <Button
            onClick={() => { setCreateFormError(''); setFormData({ ...EMPTY_FORM }); setCreateModalOpen(true) }}
            leftSection={<Plus size={16} />}
          >
            New role
          </Button>
        }
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search roles by name or description…" maw={360} w="100%" />
          <NativeSelect
            label="Filter by app"
            value={appFilterId}
            onChange={(e) => setAppFilterId(e.currentTarget.value)}
            data={[
              { value: 'all', label: 'All Apps' },
              { value: 'none', label: 'Unassigned' },
              ...(apps as any[]).map((app: any) => ({ value: app.id, label: app.name })),
            ]}
            w="100%"
            maw={320}
          />
        </Group>

        <SectionCard
          flush
          title="All roles"
          actions={<RefreshButton size="xs" onRefresh={() => refetch()} loading={isFetching} lastUpdated={null} />}
        >
          <BulkActionsBar
            count={selectedRoleIds.length}
            noun="role"
            onClear={clearSelection}
          >
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<Trash2 size={14} />}
              onClick={() => { setBulkError(''); setBulkDeleteOpen(true) }}
              disabled={bulkPending}
            >
              Delete selected
            </Button>
          </BulkActionsBar>
          {isLoading ? (
            <TableSkeleton rows={4} columns={['avatar', 'pill', 'pill', 'number', 'action']} />
          ) : filteredRoles.length === 0 ? (
            <EmptyState icon={Shield} title="No roles yet" description="Create a role to define a set of permissions." />
          ) : (
            <Table.ScrollContainer minWidth={760} type="native">
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={44}>
                      <SelectionCheckbox
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        disabled={filteredRoles.length === 0}
                        title={allFilteredSelected ? 'Deselect all' : 'Select all visible'}
                        aria-label={allFilteredSelected ? 'Deselect all' : 'Select all visible'}
                      />
                    </Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>App</Table.Th>
                    <Table.Th>Scope</Table.Th>
                    <Table.Th>Permissions</Table.Th>
                    <Table.Th w={96} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredRoles.map((role: any) => {
                    const isSelected = selectedRoleIds.includes(role.id)
                    return (
                      <Table.Tr key={role.id} bg={isSelected ? 'var(--nx-color-accent-soft)' : undefined}>
                        <Table.Td>
                          <SelectionCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelectRole(role.id)}
                            aria-label={`Select role ${role.name}`}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <ThemeIcon variant="light" color="gray" size={32} radius="md">
                              <Shield size={16} />
                            </ThemeIcon>
                            <Box miw={0}>
                              <Text size="sm" fw={500} truncate>{role.name}</Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>{role.description || 'No description'}</Text>
                            </Box>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={role.appId ? 'blue' : 'gray'}>
                            {role.appId ? appNameById.get(role.appId) ?? 'App' : 'No App'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="default">{role.scope}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" className="nx-tabular">
                            {activePermCount(role)} permission{activePermCount(role) !== 1 ? 's' : ''}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => openEdit(role)}
                              title="Edit permissions"
                              aria-label={`Edit permissions for ${role.name}`}
                            >
                              <ChevronRight size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setRoleToDelete(role)}
                              title="Delete role"
                              aria-label={`Delete role ${role.name}`}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
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
      </Stack>

      {/* Create modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Role">
        <Stack gap="md">
          {renderRoleFields('create')}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setCreateModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name || !formData.permissions.length}
              loading={createRole.isPending}
            >
              Create role
            </Button>
          </Group>
          {createFormError && <Text size="xs" c="red">{createFormError}</Text>}
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editRole} onClose={() => setEditRole(null)} title={`Edit Role: ${editRole?.name ?? ''}`}>
        <Stack gap="md">
          {renderRoleFields('edit')}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setEditRole(null)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name}
              loading={updateRole.isPending}
            >
              Save changes
            </Button>
          </Group>
          {editFormError && <Text size="xs" c="red">{editFormError}</Text>}
        </Stack>
      </Modal>

      <ConfirmDialog
        isOpen={!!roleToDelete}
        title="Delete Role"
        message={`Delete role "${roleToDelete?.name ?? ''}"?`}
        confirmLabel="Delete Role"
        pending={deleteRole.isPending}
        onConfirm={confirmDeleteRole}
        onCancel={() => setRoleToDelete(null)}
      />

      <Modal isOpen={bulkDeleteOpen} onClose={() => !bulkPending && setBulkDeleteOpen(false)} title="Delete Selected Roles" size="md">
        <Stack gap="md">
          <Text size="sm">
            Permanently delete <Text span fw={600}>{selectedRoleIds.length}</Text> role{selectedRoleIds.length === 1 ? '' : 's'}? This action cannot be undone.
          </Text>
          {bulkError && <Text size="xs" c="red">{bulkError}</Text>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setBulkDeleteOpen(false)} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleBulkDelete}
              disabled={selectedRoleIds.length === 0}
              loading={bulkPending}
            >
              {`Delete ${selectedRoleIds.length} Role${selectedRoleIds.length === 1 ? '' : 's'}`}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}

export default Roles
