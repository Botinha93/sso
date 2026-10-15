import { Link2, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Group,
  NativeSelect,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { toDateInputValue } from '../lib/utils'
import BulkActionsBar, { SelectionCheckbox } from '../components/BulkActionsBar'
import React from 'react';

import {
  useAssignRoleToGroup,
  useAssignUserToGroup,
  useCreateGroup,
  useDeleteGroup,
  useApps,
  useGroups,
  useGroupUsers,
  useRemoveRoleFromGroup,
  useRemoveUserFromGroup,
  useUpdateGroup,
  useUserAttributes,
  useUsers,
  useRoles
} from '../hooks/useApi'

interface GroupItem {
  id: string
  appId?: string
  appIds?: string[]
  customAttributes?: Record<string, string>
  name: string
  description: string
  roleIds: string[]
  roles: string[]
  createdAt: string
}

interface RoleItem {
  id: string
  name: string
  appId?: string
}

interface UserItem {
  id: string
  email: string
  username: string
  givenName: string
  familyName: string
  isServiceUser?: boolean
  active?: boolean
}

interface AppItem {
  id: string
  name: string
}

type AttributeType = 'text' | 'number' | 'boolean' | 'date' | 'json'

interface UserAttributeDefinition {
  id: string
  key: string
  name: string
  description: string
  type: AttributeType
  enabled: boolean
}

const defaultValueForAttribute = (type?: AttributeType) => {
  if (type === 'boolean') return 'false'
  return ''
}

const AttributeValueField = ({
  attribute,
  value,
  onChange,
}: {
  attribute?: UserAttributeDefinition
  value: string
  onChange: (value: string) => void
}) => {
  if (attribute?.type === 'boolean') {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.currentTarget.value)} data={['false', 'true']} />
    )
  }

  if (attribute?.type === 'date') {
    return <TextInput type="date" value={toDateInputValue(value)} onChange={(e) => onChange(e.currentTarget.value)} />
  }

  if (attribute?.type === 'json') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        autosize
        minRows={3}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        placeholder='{"key":"value"}'
      />
    )
  }

  return (
    <TextInput
      type={attribute?.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={attribute?.description || attribute?.name || 'Value'}
    />
  )
}

/** Bordered, scrollable list used for checkbox pickers and member lists inside modals. */
const PickerList = ({ mah, children }: { mah: number; children: React.ReactNode }) => (
  <Paper withBorder radius="md" p={4}>
    <ScrollArea.Autosize mah={mah} type="auto" offsetScrollbars>
      <Stack gap={2}>{children}</Stack>
    </ScrollArea.Autosize>
  </Paper>
)

const PickerRow = ({ children }: { children: React.ReactNode }) => (
  <Box px="xs" py={6} className="nx-hover" style={{ borderRadius: 'var(--mantine-radius-sm)' }}>
    {children}
  </Box>
)

const Groups = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<GroupItem | null>(null)
  const [groupToEdit, setGroupToEdit] = useState<GroupItem | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupAppIds, setGroupAppIds] = useState<string[]>([])
  const [groupCustomAttributes, setGroupCustomAttributes] = useState<Record<string, string>>({})
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupDescription, setEditGroupDescription] = useState('')
  const [editGroupAppIds, setEditGroupAppIds] = useState<string[]>([])
  const [editGroupCustomAttributes, setEditGroupCustomAttributes] = useState<Record<string, string>>({})
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [editSelectedRoleIds, setEditSelectedRoleIds] = useState<string[]>([])
  const [rolePickerByGroup, setRolePickerByGroup] = useState<Record<string, string>>({})
  const [attributePicker, setAttributePicker] = useState<{ create: string; edit: string }>({ create: '', edit: '' })
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')
  const [editActiveTab, setEditActiveTab] = useState<'details' | 'roles' | 'users'>('details')
  const [editRoleSearch, setEditRoleSearch] = useState('')
  const [editRoleAppFilter, setEditRoleAppFilter] = useState<string>('all')
  const [editUserSearch, setEditUserSearch] = useState('')
  const [userToAddId, setUserToAddId] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkRoleAction, setBulkRoleAction] = useState<null | 'assign' | 'remove'>(null)
  const [bulkRoleId, setBulkRoleId] = useState('')
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: groups = [], isLoading, isFetching, refetch } = useGroups(debouncedSearch)
  const { data: apps = [] } = useApps()
  const { data: roles = [] } = useRoles()
  const { data: attributeDefinitions = [] } = useUserAttributes()
  const { data: allUsers = [] } = useUsers()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()
  const updateGroup = useUpdateGroup()
  const assignRole = useAssignRoleToGroup()
  const removeRole = useRemoveRoleFromGroup()
  const assignUser = useAssignUserToGroup()
  const removeUser = useRemoveUserFromGroup()

  const {
    data: groupUsersData,
    isLoading: groupUsersLoading,
    isFetching: groupUsersFetching
  } = useGroupUsers(editModalOpen && groupToEdit ? groupToEdit.id : undefined)
  const groupUsers = groupUsersData?.users ?? []

  const roleOptions = roles as RoleItem[]
  const appNameById = new Map((apps as AppItem[]).map((a) => [a.id, a.name]))
  const enabledAttributeDefinitions = (attributeDefinitions as UserAttributeDefinition[]).filter((attribute) => attribute.enabled)
  const attributeByKey = new Map(enabledAttributeDefinitions.map((attribute) => [attribute.key, attribute]))
  const filteredGroups = (groups as GroupItem[]).filter((group) => appFilterId === 'all'
    ? true
    : appFilterId === 'none'
      ? (group.appIds ?? (group.appId ? [group.appId] : [])).length === 0
      : (group.appIds ?? (group.appId ? [group.appId] : [])).includes(appFilterId))
  const roleNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const role of roleOptions) {
      map.set(role.id, role.name)
    }
    return map
  }, [roleOptions])

  const filteredEditRoles = useMemo(() => {
    const term = editRoleSearch.trim().toLowerCase()
    return roleOptions.filter((role) => {
      if (editRoleAppFilter === 'none' && role.appId) return false
      if (editRoleAppFilter !== 'all' && editRoleAppFilter !== 'none' && role.appId !== editRoleAppFilter) return false
      if (!term) return true
      const appName = role.appId ? (appNameById.get(role.appId) ?? '').toLowerCase() : ''
      return role.name.toLowerCase().includes(term) || appName.includes(term)
    })
  }, [roleOptions, editRoleSearch, editRoleAppFilter, appNameById])

  const filteredEditRoleIds = useMemo(() => filteredEditRoles.map((role) => role.id), [filteredEditRoles])
  const filteredEditRoleSelectedCount = filteredEditRoleIds.reduce(
    (count, id) => (editSelectedRoleIds.includes(id) ? count + 1 : count),
    0
  )
  const allFilteredEditRolesSelected = filteredEditRoles.length > 0 && filteredEditRoleSelectedCount === filteredEditRoles.length
  const noneFilteredEditRolesSelected = filteredEditRoleSelectedCount === 0

  const selectAllFilteredEditRoles = () => {
    if (filteredEditRoles.length === 0) return
    setEditSelectedRoleIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredEditRoleIds) next.add(id)
      return Array.from(next)
    })
  }

  const deselectAllFilteredEditRoles = () => {
    if (filteredEditRoles.length === 0) return
    setEditSelectedRoleIds((prev) => prev.filter((id) => !filteredEditRoleIds.includes(id)))
  }

  const groupUserIdSet = useMemo(() => new Set(groupUsers.map((user) => user.id)), [groupUsers])

  const filteredGroupUsers = useMemo(() => {
    const term = editUserSearch.trim().toLowerCase()
    if (!term) return groupUsers
    return groupUsers.filter((user) =>
      user.email.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term) ||
      `${user.givenName} ${user.familyName}`.toLowerCase().includes(term)
    )
  }, [groupUsers, editUserSearch])

  const availableUsersToAdd = useMemo(
    () => (allUsers as UserItem[]).filter((user) => !groupUserIdSet.has(user.id)),
    [allUsers, groupUserIdSet]
  )

  const filteredGroupIds = useMemo(() => filteredGroups.map((group) => group.id), [filteredGroups])
  const selectedFilteredGroupCount = useMemo(
    () => filteredGroupIds.reduce((count, id) => (selectedGroupIds.includes(id) ? count + 1 : count), 0),
    [filteredGroupIds, selectedGroupIds]
  )
  const allFilteredGroupsSelected = filteredGroupIds.length > 0 && selectedFilteredGroupCount === filteredGroupIds.length
  const someFilteredGroupsSelected = selectedFilteredGroupCount > 0 && !allFilteredGroupsSelected
  const selectedGroups = useMemo(
    () => (groups as GroupItem[]).filter((group) => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds]
  )

  useEffect(() => {
    setSelectedGroupIds((prev) => {
      const valid = new Set((groups as GroupItem[]).map((group) => group.id))
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [groups])

  const toggleSelectGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId])
  }

  const toggleSelectAllFilteredGroups = () => {
    if (filteredGroupIds.length === 0) return
    if (allFilteredGroupsSelected) {
      setSelectedGroupIds((prev) => prev.filter((id) => !filteredGroupIds.includes(id)))
      return
    }
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredGroupIds) next.add(id)
      return Array.from(next)
    })
  }

  const clearGroupSelection = () => setSelectedGroupIds([])

  const openBulkRoleModal = (action: 'assign' | 'remove') => {
    setBulkError('')
    setBulkRoleAction(action)
    setBulkRoleId('')
  }

  const closeBulkRoleModal = () => {
    if (bulkPending) return
    setBulkRoleAction(null)
    setBulkRoleId('')
    setBulkError('')
  }

  const handleBulkDeleteGroups = async () => {
    if (selectedGroupIds.length === 0) return
    setBulkError('')
    setBulkPending(true)
    try {
      const ids = [...selectedGroupIds]
      const results = await Promise.allSettled(ids.map((id) => deleteGroup.mutateAsync(id)))
      const succeeded = ids.filter((_, idx) => results[idx].status === 'fulfilled')
      const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
      setSelectedGroupIds((prev) => prev.filter((id) => !succeeded.includes(id)))
      if (failures.length > 0) {
        const message = failures[0].reason instanceof Error ? failures[0].reason.message : 'Unknown error'
        setBulkError(`Failed to delete ${failures.length} of ${ids.length} group${ids.length === 1 ? '' : 's'}: ${message}`)
        return
      }
      setBulkDeleteOpen(false)
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk delete failed')
    } finally {
      setBulkPending(false)
    }
  }

  const handleBulkRoleApply = async () => {
    if (!bulkRoleAction || !bulkRoleId || selectedGroupIds.length === 0) return
    setBulkError('')
    setBulkPending(true)
    try {
      const targets = selectedGroups.filter((group) => {
        const has = (group.roleIds ?? []).includes(bulkRoleId)
        return bulkRoleAction === 'assign' ? !has : has
      })
      if (targets.length === 0) {
        const verb = bulkRoleAction === 'assign' ? 'already have' : 'do not have'
        setBulkError(`Selected groups ${verb} this role.`)
        return
      }
      const mutate = bulkRoleAction === 'assign' ? assignRole : removeRole
      const results = await Promise.allSettled(
        targets.map((group) => mutate.mutateAsync({ groupId: group.id, roleId: bulkRoleId }))
      )
      const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        const message = failures[0].reason instanceof Error ? failures[0].reason.message : 'Unknown error'
        setBulkError(`${failures.length} of ${targets.length} update${targets.length === 1 ? '' : 's'} failed: ${message}`)
        return
      }
      setBulkRoleAction(null)
      setBulkRoleId('')
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk role update failed')
    } finally {
      setBulkPending(false)
    }
  }

  const resetModal = () => {
    setGroupName('')
    setGroupDescription('')
    setGroupAppIds([])
    setGroupCustomAttributes({})
    setSelectedRoleIds([])
  }

  const toggleGroupAppId = (appId: string, target: 'create' | 'edit') => {
    const update = (current: string[]) => current.includes(appId)
      ? current.filter((id) => id !== appId)
      : [...current, appId]

    if (target === 'create') {
      setGroupAppIds((prev) => update(prev))
      return
    }

    setEditGroupAppIds((prev) => update(prev))
  }

  const toggleCreateRole = (roleId: string) => {
    setSelectedRoleIds((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId])
  }

  const toggleEditRole = (roleId: string) => {
    setEditSelectedRoleIds((prev) => prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId])
  }

  const addAttribute = (target: 'create' | 'edit') => {
    const key = attributePicker[target]
    if (!key) return

    if (target === 'create') {
      setGroupCustomAttributes((prev) => ({
        ...prev,
        [key]: defaultValueForAttribute(attributeByKey.get(key)?.type)
      }))
      setAttributePicker((prev) => ({ ...prev, create: '' }))
      return
    }

    setEditGroupCustomAttributes((prev) => ({
      ...prev,
      [key]: defaultValueForAttribute(attributeByKey.get(key)?.type)
    }))
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
  }

  const removeAttribute = (target: 'create' | 'edit', key: string) => {
    if (target === 'create') {
      setGroupCustomAttributes((prev) => Object.fromEntries(Object.entries(prev).filter(([attributeKey]) => attributeKey !== key)))
      return
    }

    setEditGroupCustomAttributes((prev) => Object.fromEntries(Object.entries(prev).filter(([attributeKey]) => attributeKey !== key)))
  }

  const updateAttributeValue = (target: 'create' | 'edit', key: string, value: string) => {
    if (target === 'create') {
      setGroupCustomAttributes((prev) => ({ ...prev, [key]: value }))
      return
    }

    setEditGroupCustomAttributes((prev) => ({ ...prev, [key]: value }))
  }

  const onCreateGroup = async () => {
    if (!groupName || !groupDescription) return

    setCreateFormError('')
    try {
      await createGroup.mutateAsync({
        appIds: groupAppIds,
        name: groupName,
        description: groupDescription,
        customAttributes: groupCustomAttributes,
        roleIds: selectedRoleIds
      })
      setCreateModalOpen(false)
      setAttributePicker((prev) => ({ ...prev, create: '' }))
      resetModal()
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create group')
    }
  }

  const onDeleteGroup = (group: GroupItem) => {
    setGroupToDelete(group)
  }

  const onEditGroup = (group: GroupItem) => {
    setEditFormError('')
    setGroupToEdit(group)
    setEditGroupName(group.name)
    setEditGroupDescription(group.description)
    setEditGroupAppIds(group.appIds ?? ((group as any).appId ? [(group as any).appId] : []))
    setEditGroupCustomAttributes(
      Object.fromEntries(
        Object.entries(group.customAttributes ?? {}).map(([key, value]) => [
          key,
          attributeByKey.get(key)?.type === 'date' ? toDateInputValue(value) : value
        ])
      )
    )
    setEditSelectedRoleIds(group.roleIds ?? [])
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
    setEditActiveTab('details')
    setEditRoleSearch('')
    setEditRoleAppFilter('all')
    setEditUserSearch('')
    setUserToAddId('')
    setEditModalOpen(true)
  }

  const onSaveGroupEdit = async () => {
    if (!groupToEdit || !editGroupName || !editGroupDescription) return

    setEditFormError('')
    try {
      await updateGroup.mutateAsync({
        id: groupToEdit.id,
        appIds: editGroupAppIds,
        name: editGroupName,
        description: editGroupDescription,
        customAttributes: editGroupCustomAttributes
      })
      const originalRoleIds = groupToEdit.roleIds ?? []
      const toAdd = editSelectedRoleIds.filter(id => !originalRoleIds.includes(id))
      const toRemove = originalRoleIds.filter(id => !editSelectedRoleIds.includes(id))
      await Promise.all([
        ...toAdd.map(roleId => assignRole.mutateAsync({ groupId: groupToEdit.id, roleId })),
        ...toRemove.map(roleId => removeRole.mutateAsync({ groupId: groupToEdit.id, roleId }))
      ])
      setEditModalOpen(false)
      setGroupToEdit(null)
      setAttributePicker((prev) => ({ ...prev, edit: '' }))
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update group')
    }
  }

  const confirmDeleteGroup = () => {
    if (!groupToDelete) return
    deleteGroup.mutate(groupToDelete.id, { onSuccess: () => setGroupToDelete(null) })
  }

  const onAttachRole = (group: GroupItem) => {
    const roleId = rolePickerByGroup[group.id]
    if (!roleId) return
    assignRole.mutate({ groupId: group.id, roleId })
  }

  const onAddUserToGroup = () => {
    if (!groupToEdit || !userToAddId) return
    setEditFormError('')
    assignUser.mutate(
      { userId: userToAddId, groupId: groupToEdit.id },
      {
        onSuccess: () => setUserToAddId(''),
        onError: (error) => setEditFormError(error instanceof Error ? error.message : 'Failed to add user')
      }
    )
  }

  const onRemoveUserFromGroup = (userId: string) => {
    if (!groupToEdit) return
    setEditFormError('')
    removeUser.mutate(
      { userId, groupId: groupToEdit.id },
      {
        onError: (error) => setEditFormError(error instanceof Error ? error.message : 'Failed to remove user')
      }
    )
  }

  const groupAppIdsOf = (group: GroupItem) => group.appIds ?? (group.appId ? [group.appId] : [])

  const renderAppPicker = (target: 'create' | 'edit') => {
    const selected = target === 'create' ? groupAppIds : editGroupAppIds
    return (
      <Stack gap={4}>
        <Text size="sm" fw={500}>Apps</Text>
        <PickerList mah={160}>
          {(apps as AppItem[]).length === 0 && <Text size="xs" c="dimmed" px="xs" py={4}>No apps available</Text>}
          {(apps as AppItem[]).map((app) => (
            <PickerRow key={app.id}>
              <Checkbox
                size="sm"
                label={app.name}
                checked={selected.includes(app.id)}
                onChange={() => toggleGroupAppId(app.id, target)}
              />
            </PickerRow>
          ))}
        </PickerList>
      </Stack>
    )
  }

  const renderAttributeEditor = (target: 'create' | 'edit') => {
    const attributes = target === 'create' ? groupCustomAttributes : editGroupCustomAttributes
    return (
      <Stack gap={4}>
        <Text size="sm" fw={500}>Inherited user attributes</Text>
        <Stack gap="xs">
          {Object.entries(attributes).length === 0 ? (
            <Text size="xs" c="dimmed">No group attributes selected</Text>
          ) : (
            Object.entries(attributes).map(([key, value]) => {
              const attribute = attributeByKey.get(key)
              return (
                <Paper key={key} withBorder radius="md" p="sm">
                  <Group justify="space-between" gap="xs" mb="xs" wrap="nowrap">
                    <Box miw={0}>
                      <Text size="sm" fw={500} truncate>{attribute?.name ?? key}</Text>
                      <Text size="xs" c="dimmed" ff="monospace" truncate>{key}</Text>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeAttribute(target, key)}
                      title="Remove attribute"
                      aria-label="Remove attribute"
                    >
                      <X size={14} />
                    </ActionIcon>
                  </Group>
                  <AttributeValueField
                    attribute={attribute}
                    value={value}
                    onChange={(nextValue) => updateAttributeValue(target, key, nextValue)}
                  />
                </Paper>
              )
            })
          )}
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <NativeSelect
              style={{ flex: 1 }}
              aria-label="Add attribute"
              value={attributePicker[target]}
              onChange={(e) => { const value = e.currentTarget.value; setAttributePicker((prev) => ({ ...prev, [target]: value })) }}
              data={[
                { value: '', label: 'Add attribute...' },
                ...enabledAttributeDefinitions
                  .filter((attribute) => !(attribute.key in attributes) && attribute.key !== 'password_changed_at')
                  .map((attribute) => ({ value: attribute.key, label: attribute.name })),
              ]}
            />
            <Button
              variant="default"
              onClick={() => addAttribute(target)}
              disabled={!attributePicker[target]}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Stack>
    )
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Access Control"
        title="User Groups"
        actions={
          <Button leftSection={<Plus size={16} />} onClick={() => { setCreateFormError(''); setCreateModalOpen(true) }}>
            New group
          </Button>
        }
      />

      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search groups by name or description…" maw={360} w="100%" />
          <NativeSelect
            label="Filter by app"
            value={appFilterId}
            onChange={(e) => setAppFilterId(e.currentTarget.value)}
            data={[
              { value: 'all', label: 'All Apps' },
              { value: 'none', label: 'Unassigned' },
              ...(apps as AppItem[]).map((app) => ({ value: app.id, label: app.name })),
            ]}
            w="100%"
            maw={320}
          />
        </Group>

        <SectionCard
          flush
          title="All groups"
          actions={<RefreshButton size="xs" onRefresh={() => refetch()} loading={isFetching} lastUpdated={null} />}
        >
          <BulkActionsBar
            count={selectedGroupIds.length}
            noun="group"
            onClear={clearGroupSelection}
          >
            <Button
              variant="default"
              size="xs"
              leftSection={<Link2 size={14} />}
              onClick={() => openBulkRoleModal('assign')}
              disabled={bulkPending}
            >
              Assign role
            </Button>
            <Button
              variant="default"
              size="xs"
              leftSection={<X size={14} />}
              onClick={() => openBulkRoleModal('remove')}
              disabled={bulkPending}
            >
              Remove role
            </Button>
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
            <TableSkeleton rows={5} columns={['avatar', 'text', 'action']} />
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No groups created"
              description="Create a group to assign users, roles and attributes in bulk."
            />
          ) : (
            <Table.ScrollContainer minWidth={860} type="native">
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={44}>
                      <SelectionCheckbox
                        checked={allFilteredGroupsSelected}
                        indeterminate={someFilteredGroupsSelected}
                        onChange={toggleSelectAllFilteredGroups}
                        disabled={filteredGroups.length === 0}
                        title={allFilteredGroupsSelected ? 'Deselect all' : 'Select all visible'}
                        aria-label={allFilteredGroupsSelected ? 'Deselect all' : 'Select all visible'}
                      />
                    </Table.Th>
                    <Table.Th>Group</Table.Th>
                    <Table.Th>Roles</Table.Th>
                    <Table.Th w={96} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredGroups.map((group) => {
                    const availableRoles = roleOptions.filter((role) => !group.roleIds.includes(role.id))
                    const pickerValue = rolePickerByGroup[group.id] ?? availableRoles[0]?.id ?? ''
                    const isSelected = selectedGroupIds.includes(group.id)
                    const assignedAppIds = groupAppIdsOf(group)
                    return (
                      <Table.Tr key={group.id} bg={isSelected ? 'var(--nx-color-accent-soft)' : undefined} style={{ verticalAlign: 'top' }}>
                        <Table.Td>
                          <Box pt={8}>
                            <SelectionCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelectGroup(group.id)}
                              aria-label={`Select group ${group.name}`}
                            />
                          </Box>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap" align="flex-start">
                            <ThemeIcon variant="light" color="gray" size={32} radius="md">
                              <Users size={16} />
                            </ThemeIcon>
                            <Stack gap={6} miw={0}>
                              <Group gap={6} wrap="wrap">
                                <Text size="sm" fw={500}>{group.name}</Text>
                                {assignedAppIds.length === 0 ? (
                                  <Badge variant="light" color="blue">No Apps</Badge>
                                ) : (
                                  assignedAppIds.map((assignedAppId) => (
                                    <Badge key={assignedAppId} variant="light" color="blue">
                                      {appNameById.get(assignedAppId) ?? 'App'}
                                    </Badge>
                                  ))
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">{group.description}</Text>
                              {group.customAttributes && Object.keys(group.customAttributes).length > 0 && (
                                <Group gap={6} wrap="wrap">
                                  {Object.entries(group.customAttributes).map(([key, value]) => (
                                    <Badge key={key} variant="light" color="yellow" tt="none" ff="monospace">
                                      {attributeByKey.get(key)?.name ?? key}: {value}
                                    </Badge>
                                  ))}
                                </Group>
                              )}
                            </Stack>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap="xs">
                            <Group gap={6} wrap="wrap">
                              {group.roleIds.length === 0 && (
                                <Badge variant="default" tt="none">No roles</Badge>
                              )}
                              {group.roleIds.map((roleId) => (
                                <Badge
                                  key={roleId}
                                  variant="default"
                                  tt="none"
                                  pr={2}
                                  rightSection={
                                    <CloseButton
                                      size="xs"
                                      iconSize={11}
                                      onClick={() => removeRole.mutate({ groupId: group.id, roleId })}
                                      title="Remove role"
                                      aria-label="Remove role"
                                    />
                                  }
                                >
                                  {roleNameById.get(roleId) ?? roleId}
                                </Badge>
                              ))}
                            </Group>
                            <Group gap="xs" wrap="nowrap" maw={420}>
                              <NativeSelect
                                size="xs"
                                style={{ flex: 1 }}
                                aria-label={`Role to attach to ${group.name}`}
                                value={pickerValue}
                                onChange={(e) => { const value = e.currentTarget.value; setRolePickerByGroup((prev) => ({ ...prev, [group.id]: value })) }}
                                data={availableRoles.length === 0
                                  ? [{ value: '', label: 'No remaining roles' }]
                                  : availableRoles.map((role) => ({ value: role.id, label: role.name }))}
                              />
                              <Button
                                variant="default"
                                size="xs"
                                leftSection={<Link2 size={14} />}
                                disabled={!pickerValue || assignRole.isPending}
                                onClick={() => onAttachRole(group)}
                              >
                                Attach
                              </Button>
                            </Group>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => onEditGroup(group)}
                              disabled={updateGroup.isPending}
                              title="Edit group"
                              aria-label="Edit group"
                            >
                              <Pencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => onDeleteGroup(group)}
                              disabled={deleteGroup.isPending}
                              title="Delete group"
                              aria-label="Delete group"
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

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Group">
        <Stack gap="md">
          {renderAppPicker('create')}
          <TextInput
            label="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.currentTarget.value)}
            placeholder="Support Team"
          />
          <TextInput
            label="Description"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.currentTarget.value)}
            placeholder="Handles user onboarding and support escalations"
          />
          {renderAttributeEditor('create')}
          <Stack gap={4}>
            <Text size="sm" fw={500}>Initial roles</Text>
            <PickerList mah={176}>
              {roleOptions.length === 0 && <Text size="xs" c="dimmed" px="xs" py={4}>Create roles first</Text>}
              {roleOptions.map((role) => (
                <PickerRow key={role.id}>
                  <Checkbox
                    size="sm"
                    label={role.name}
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleCreateRole(role.id)}
                  />
                </PickerRow>
              ))}
            </PickerList>
          </Stack>
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onCreateGroup}
              disabled={!groupName || !groupDescription}
              loading={createGroup.isPending}
            >
              Create group
            </Button>
          </Group>
          {createFormError && <Text size="xs" c="red">{createFormError}</Text>}
        </Stack>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Group${groupToEdit ? `: ${groupToEdit.name}` : ''}`}>
        <Stack gap="md">
          <Tabs value={editActiveTab} onChange={(value) => value && setEditActiveTab(value as 'details' | 'roles' | 'users')}>
            <Tabs.List>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="roles">{`Roles (${editSelectedRoleIds.length})`}</Tabs.Tab>
              <Tabs.Tab value="users">{`Users (${groupUsers.length})`}</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {editActiveTab === 'details' ? (
            <Stack gap="md">
              {renderAppPicker('edit')}
              <TextInput
                label="Group name"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.currentTarget.value)}
                placeholder="Support Team"
              />
              <TextInput
                label="Description"
                value={editGroupDescription}
                onChange={(e) => setEditGroupDescription(e.currentTarget.value)}
                placeholder="Handles user onboarding and support escalations"
              />
              {renderAttributeEditor('edit')}
            </Stack>
          ) : editActiveTab === 'roles' ? (
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Search roles"
                  value={editRoleSearch}
                  onChange={(e) => setEditRoleSearch(e.currentTarget.value)}
                  placeholder="Search by role or app name…"
                />
                <NativeSelect
                  label="Filter by app"
                  value={editRoleAppFilter}
                  onChange={(e) => setEditRoleAppFilter(e.currentTarget.value)}
                  data={[
                    { value: 'all', label: 'All Apps' },
                    { value: 'none', label: 'No App' },
                    ...(apps as AppItem[]).map((app) => ({ value: app.id, label: app.name })),
                  ]}
                />
              </SimpleGrid>

              <Group justify="space-between" gap="xs" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {filteredEditRoles.length === 0
                    ? 'No matching roles'
                    : `Showing ${filteredEditRoles.length} of ${roleOptions.length} roles · ${filteredEditRoleSelectedCount} selected`}
                </Text>
                <Group gap="xs">
                  <Button
                    variant="default"
                    size="xs"
                    onClick={selectAllFilteredEditRoles}
                    disabled={filteredEditRoles.length === 0 || allFilteredEditRolesSelected}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={deselectAllFilteredEditRoles}
                    disabled={filteredEditRoles.length === 0 || noneFilteredEditRolesSelected}
                  >
                    Deselect all
                  </Button>
                </Group>
              </Group>

              <PickerList mah={320}>
                {roleOptions.length === 0 ? (
                  <Text size="xs" c="dimmed" px="xs" py={4}>Create roles first</Text>
                ) : filteredEditRoles.length === 0 ? (
                  <Text size="xs" c="dimmed" px="xs" py={4}>No roles match the current filters</Text>
                ) : (
                  filteredEditRoles.map((role) => {
                    const appName = role.appId ? appNameById.get(role.appId) : null
                    return (
                      <PickerRow key={role.id}>
                        <Group gap="xs" wrap="nowrap" justify="space-between">
                          <Checkbox
                            size="sm"
                            label={role.name}
                            checked={editSelectedRoleIds.includes(role.id)}
                            onChange={() => toggleEditRole(role.id)}
                            miw={0}
                            styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
                          />
                          <Badge variant="light" color={appName ? 'blue' : 'gray'} style={{ flexShrink: 0 }}>
                            {appName ?? 'No App'}
                          </Badge>
                        </Group>
                      </PickerRow>
                    )
                  })
                )}
              </PickerList>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <NativeSelect
                  label="Add user"
                  style={{ flex: 1 }}
                  value={userToAddId}
                  onChange={(e) => setUserToAddId(e.currentTarget.value)}
                  data={availableUsersToAdd.length === 0
                    ? [{ value: '', label: 'No users available' }]
                    : [
                        { value: '', label: 'Select a user…' },
                        ...availableUsersToAdd.map((user) => ({
                          value: user.id,
                          label: `${user.givenName} ${user.familyName} · ${user.email}`,
                        })),
                      ]}
                />
                <Button
                  variant="default"
                  leftSection={<Plus size={14} />}
                  onClick={onAddUserToGroup}
                  disabled={!userToAddId || assignUser.isPending}
                >
                  Add
                </Button>
              </Group>

              <TextInput
                label="Search members"
                value={editUserSearch}
                onChange={(e) => setEditUserSearch(e.currentTarget.value)}
                placeholder="Search by name, email or username…"
              />

              <Text size="xs" c="dimmed">
                {groupUsersLoading
                  ? 'Loading members…'
                  : groupUsers.length === 0
                    ? 'No users in this group yet'
                    : `${filteredGroupUsers.length} of ${groupUsers.length} member${groupUsers.length === 1 ? '' : 's'}${groupUsersFetching ? ' · refreshing…' : ''}`}
              </Text>

              <PickerList mah={320}>
                {groupUsersLoading ? (
                  <Text size="xs" c="dimmed" px="xs" py={4}>Loading…</Text>
                ) : groupUsers.length === 0 ? (
                  <Text size="xs" c="dimmed" px="xs" py={4}>Use the selector above to add the first member.</Text>
                ) : filteredGroupUsers.length === 0 ? (
                  <Text size="xs" c="dimmed" px="xs" py={4}>No members match your search.</Text>
                ) : (
                  filteredGroupUsers.map((user) => (
                    <PickerRow key={user.id}>
                      <Group gap="xs" wrap="nowrap">
                        <Box miw={0} style={{ flex: 1 }}>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" fw={500} truncate>
                              {user.givenName} {user.familyName}
                            </Text>
                            {user.isServiceUser && <Badge variant="light" color="blue">Service</Badge>}
                            {user.active === false && <Badge variant="light" color="red">Inactive</Badge>}
                          </Group>
                          <Text size="xs" c="dimmed" truncate>{user.email} · @{user.username}</Text>
                        </Box>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => onRemoveUserFromGroup(user.id)}
                          disabled={removeUser.isPending}
                          title="Remove from group"
                          aria-label="Remove from group"
                        >
                          <X size={16} />
                        </ActionIcon>
                      </Group>
                    </PickerRow>
                  ))
                )}
              </PickerList>
            </Stack>
          )}

          <Group justify="flex-end" gap="xs" pt="sm" style={{ borderTop: '1px solid var(--nx-color-border)' }}>
            <Button variant="default" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSaveGroupEdit}
              disabled={!editGroupName || !editGroupDescription}
              loading={updateGroup.isPending}
            >
              Save changes
            </Button>
          </Group>
          {editFormError && <Text size="xs" c="red">{editFormError}</Text>}
        </Stack>
      </Modal>

      <ConfirmDialog
        isOpen={!!groupToDelete}
        title="Delete Group"
        message={`Delete group "${groupToDelete?.name ?? ''}"?`}
        confirmLabel="Delete Group"
        pending={deleteGroup.isPending}
        onConfirm={confirmDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />

      <Modal isOpen={bulkDeleteOpen} onClose={() => !bulkPending && setBulkDeleteOpen(false)} title="Delete Selected Groups" size="md">
        <Stack gap="md">
          <Text size="sm">
            Permanently delete <Text span fw={600}>{selectedGroupIds.length}</Text> group{selectedGroupIds.length === 1 ? '' : 's'}? Users and role assignments tied to these groups will be removed.
          </Text>
          {bulkError && <Text size="xs" c="red">{bulkError}</Text>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setBulkDeleteOpen(false)} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleBulkDeleteGroups}
              disabled={selectedGroupIds.length === 0}
              loading={bulkPending}
            >
              {`Delete ${selectedGroupIds.length} Group${selectedGroupIds.length === 1 ? '' : 's'}`}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        isOpen={bulkRoleAction !== null}
        onClose={closeBulkRoleModal}
        title={bulkRoleAction === 'assign' ? 'Assign Role to Selected Groups' : 'Remove Role from Selected Groups'}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {bulkRoleAction === 'assign' ? 'Assign' : 'Remove'} a role {bulkRoleAction === 'assign' ? 'to' : 'from'} the {selectedGroupIds.length} selected group{selectedGroupIds.length === 1 ? '' : 's'}.
          </Text>
          <NativeSelect
            label="Role"
            value={bulkRoleId}
            onChange={(e) => setBulkRoleId(e.currentTarget.value)}
            data={[
              { value: '', label: 'Select a role…' },
              ...roleOptions.map((role) => ({
                value: role.id,
                label: `${role.name}${role.appId ? ` (${appNameById.get(role.appId) ?? 'App'})` : ''}`,
              })),
            ]}
          />
          {bulkError && <Text size="xs" c="red">{bulkError}</Text>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeBulkRoleModal} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkRoleApply}
              disabled={!bulkRoleId}
              loading={bulkPending}
            >
              {bulkRoleAction === 'assign' ? 'Assign role' : 'Remove role'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}

export default Groups
