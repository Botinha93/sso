import Textarea from '../components/ui/Textarea'
import Select from '../components/ui/Select'
import { Link2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useEffect, useMemo, useState } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import { toDateInputValue } from '../lib/utils'
import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
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

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

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
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="false">false</option>
        <option value="true">true</option>
      </Select>
    )
  }

  if (attribute?.type === 'date') {
    return <Input type="date" value={toDateInputValue(value)} onChange={(e) => onChange(e.target.value)} />
  }

  if (attribute?.type === 'json') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-[88px] font-mono"
        placeholder='{"key":"value"}'
      />
    )
  }

  return (
    <Input
      type={attribute?.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={attribute?.description || attribute?.name || 'Value'}
    />
  )
}

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

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="User Groups"
        action={
          <Button variant="primary" onClick={() => { setCreateFormError(''); setCreateModalOpen(true) }}>
            <Plus size={14} />
            New Group
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search groups by name or description…" />
        <div className="max-w-sm w-full">
          <label className={labelCls}>Filter by App</label>
          <Select value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
            <option value="all">All Apps</option>
            <option value="none">Unassigned</option>
            {(apps as AppItem[]).map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <Table>
        <TableHeaderRow>
          <div className="flex items-center gap-3">
            <SelectionCheckbox
              checked={allFilteredGroupsSelected}
              indeterminate={someFilteredGroupsSelected}
              onChange={toggleSelectAllFilteredGroups}
              disabled={filteredGroups.length === 0}
              title={allFilteredGroupsSelected ? 'Deselect all' : 'Select all visible'}
            />
            <h4 className="text-sm font-semibold text-foreground">All Groups</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>
        <BulkActionsBar
          count={selectedGroupIds.length}
          noun="group"
          onClear={clearGroupSelection}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => openBulkRoleModal('assign')}
            disabled={bulkPending}
          >
            <Link2 size={12} />
            Assign Role
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openBulkRoleModal('remove')}
            disabled={bulkPending}
          >
            <X size={12} />
            Remove Role
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => { setBulkError(''); setBulkDeleteOpen(true) }}
            disabled={bulkPending}
          >
            <Trash2 size={12} />
            Delete Selected
          </Button>
        </BulkActionsBar>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            title="No groups created"
            description="Create a group to assign users, roles and attributes in bulk."
          />
        ) : (
          <TableBody>
            {filteredGroups.map((group) => {
              const availableRoles = roleOptions.filter((role) => !group.roleIds.includes(role.id))
              const pickerValue = rolePickerByGroup[group.id] ?? availableRoles[0]?.id ?? ''
              const isSelected = selectedGroupIds.includes(group.id)
              return (
                <TableRow key={group.id} selected={isSelected} layout="block">
                  <div className="flex w-full items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="pt-1.5">
                        <SelectionCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelectGroup(group.id)}
                          aria-label={`Select group ${group.name}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                          <Users size={14} className="text-muted-foreground" />
                        </div>
                        <h5 className="text-sm font-medium text-foreground">{group.name}</h5>
                        {(group.appIds ?? (group.appId ? [group.appId] : [])).length === 0 ? (
                          <StatusBadge tone="accent">
                            No Apps
                          </StatusBadge>
                        ) : (
                          (group.appIds ?? (group.appId ? [group.appId] : [])).map((assignedAppId) => (
                            <StatusBadge key={assignedAppId} tone="accent">
                              {appNameById.get(assignedAppId) ?? 'App'}
                            </StatusBadge>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                      {group.customAttributes && Object.keys(group.customAttributes).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(group.customAttributes).map(([key, value]) => (
                            <StatusBadge key={key} tone="warning" mono>
                              {attributeByKey.get(key)?.name ?? key}: {value}
                            </StatusBadge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.roleIds.length === 0 && (
                          <StatusBadge tone="neutral">No roles</StatusBadge>
                        )}
                        {group.roleIds.map((roleId) => (
                          <StatusBadge key={roleId} tone="neutral">
                            {roleNameById.get(roleId) ?? roleId}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 text-muted-foreground hover:text-rose-600"
                              onClick={() => removeRole.mutate({ groupId: group.id, roleId })}
                              title="Remove role"
                            >
                              <X size={11} />
                            </Button>
                          </StatusBadge>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 max-w-md">
                        <Select
                          value={pickerValue}
                          onChange={(e) => setRolePickerByGroup((prev) => ({ ...prev, [group.id]: e.target.value }))}
                        >
                          {availableRoles.length === 0 ? (
                            <option value="">No remaining roles</option>
                          ) : (
                            availableRoles.map((role) => (
                              <option key={role.id} value={role.id}>{role.name}</option>
                            ))
                          )}
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!pickerValue || assignRole.isPending}
                          onClick={() => onAttachRole(group)}
                        >
                          <Link2 size={12} />Attach
                        </Button>
                      </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditGroup(group)}
                        disabled={updateGroup.isPending}
                        title="Edit group"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => onDeleteGroup(group)}
                        disabled={deleteGroup.isPending}
                        title="Delete group"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </TableRow>
              )
            })}
          </TableBody>
        )}
      </Table>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Group">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Apps</label>
            <div className="border border-border rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(apps as AppItem[]).length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">No apps available</p>}
              {(apps as AppItem[]).map((app) => (
                <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupAppIds.includes(app.id)}
                    onChange={() => toggleGroupAppId(app.id, 'create')}
                    className="rounded border-border"
                  />
                  {app.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Group Name</label>
            <Input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Support Team"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <Input
              type="text"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Handles user onboarding and support escalations"
            />
          </div>
          <div>
            <label className={labelCls}>Inherited User Attributes</label>
            <div className="space-y-2">
              {Object.entries(groupCustomAttributes).length === 0 ? (
                <p className="text-xs text-muted-foreground">No group attributes selected</p>
              ) : (
                Object.entries(groupCustomAttributes).map(([key, value]) => {
                  const attribute = attributeByKey.get(key)
                  return (
                    <div key={key} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{attribute?.name ?? key}</p>
                          <p className="text-xs text-muted-foreground font-mono">{key}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => removeAttribute('create', key)}
                          title="Remove attribute"
                        >
                          <X size={12} />
                        </Button>
                      </div>
                      <AttributeValueField
                        attribute={attribute}
                        value={value}
                        onChange={(nextValue) => updateAttributeValue('create', key, nextValue)}
                      />
                    </div>
                  )
                })
              )}
              <div className="flex items-center gap-2">
                <Select
                  value={attributePicker.create}
                  onChange={(e) => setAttributePicker((prev) => ({ ...prev, create: e.target.value }))}
                >
                  <option value="">Add attribute...</option>
                  {enabledAttributeDefinitions
                    .filter((attribute) => !(attribute.key in groupCustomAttributes) && attribute.key !== 'password_changed_at')
                    .map((attribute) => (
                      <option key={attribute.id} value={attribute.key}>{attribute.name}</option>
                    ))}
                </Select>
                <Button
                  variant="outline"
                  onClick={() => addAttribute('create')}
                  disabled={!attributePicker.create}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Initial Roles</label>
            <div className="border border-border rounded-lg p-2 max-h-44 overflow-auto space-y-1">
              {roleOptions.length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">Create roles first</p>}
              {roleOptions.map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleCreateRole(role.id)}
                    className="rounded border-border"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onCreateGroup}
              disabled={createGroup.isPending || !groupName || !groupDescription}
            >
              {createGroup.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
          {createFormError && <p className="text-xs text-rose-600">{createFormError}</p>}
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Group${groupToEdit ? `: ${groupToEdit.name}` : ''}`}>
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-border -mt-2">
            {([
              { key: 'details', label: 'Details' },
              { key: 'roles', label: `Roles (${editSelectedRoleIds.length})` },
              { key: 'users', label: `Users (${groupUsers.length})` }
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setEditActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editActiveTab === tab.key
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {editActiveTab === 'details' ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Apps</label>
                <div className="border border-border rounded-lg p-2 max-h-40 overflow-auto space-y-1">
                  {(apps as AppItem[]).length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">No apps available</p>}
                  {(apps as AppItem[]).map((app) => (
                    <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editGroupAppIds.includes(app.id)}
                        onChange={() => toggleGroupAppId(app.id, 'edit')}
                        className="rounded border-border"
                      />
                      {app.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Group Name</label>
                <Input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="Support Team"
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <Input
                  type="text"
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                  placeholder="Handles user onboarding and support escalations"
                />
              </div>
              <div>
                <label className={labelCls}>Inherited User Attributes</label>
                <div className="space-y-2">
                  {Object.entries(editGroupCustomAttributes).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No group attributes selected</p>
                  ) : (
                    Object.entries(editGroupCustomAttributes).map(([key, value]) => {
                      const attribute = attributeByKey.get(key)
                      return (
                        <div key={key} className="rounded-lg border border-border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{attribute?.name ?? key}</p>
                              <p className="text-xs text-muted-foreground font-mono">{key}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => removeAttribute('edit', key)}
                              title="Remove attribute"
                            >
                              <X size={12} />
                            </Button>
                          </div>
                          <AttributeValueField
                            attribute={attribute}
                            value={value}
                            onChange={(nextValue) => updateAttributeValue('edit', key, nextValue)}
                          />
                        </div>
                      )
                    })
                  )}
                  <div className="flex items-center gap-2">
                    <Select
                      value={attributePicker.edit}
                      onChange={(e) => setAttributePicker((prev) => ({ ...prev, edit: e.target.value }))}
                    >
                      <option value="">Add attribute...</option>
                      {enabledAttributeDefinitions
                        .filter((attribute) => !(attribute.key in editGroupCustomAttributes) && attribute.key !== 'password_changed_at')
                        .map((attribute) => (
                          <option key={attribute.id} value={attribute.key}>{attribute.name}</option>
                        ))}
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => addAttribute('edit')}
                      disabled={!attributePicker.edit}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : editActiveTab === 'roles' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Search Roles</label>
                  <Input
                    type="text"
                    value={editRoleSearch}
                    onChange={(e) => setEditRoleSearch(e.target.value)}
                    placeholder="Search by role or app name…"
                  />
                </div>
                <div>
                  <label className={labelCls}>Filter by App</label>
                  <Select
                    value={editRoleAppFilter}
                    onChange={(e) => setEditRoleAppFilter(e.target.value)}
                  >
                    <option value="all">All Apps</option>
                    <option value="none">No App</option>
                    {(apps as AppItem[]).map((app) => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {filteredEditRoles.length === 0
                    ? 'No matching roles'
                    : `Showing ${filteredEditRoles.length} of ${roleOptions.length} roles · ${filteredEditRoleSelectedCount} selected`}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllFilteredEditRoles}
                    disabled={filteredEditRoles.length === 0 || allFilteredEditRolesSelected}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllFilteredEditRoles}
                    disabled={filteredEditRoles.length === 0 || noneFilteredEditRolesSelected}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-lg p-2 max-h-80 overflow-auto space-y-1">
                {roleOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">Create roles first</p>
                ) : filteredEditRoles.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">No roles match the current filters</p>
                ) : (
                  filteredEditRoles.map((role) => {
                    const appName = role.appId ? appNameById.get(role.appId) : null
                    return (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm text-foreground cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editSelectedRoleIds.includes(role.id)}
                          onChange={() => toggleEditRole(role.id)}
                          className="rounded border-border"
                        />
                        <span className="flex-1 min-w-0 truncate">{role.name}</span>
                        <StatusBadge tone={appName ? 'accent' : 'neutral'}>
                          {appName ?? 'No App'}
                        </StatusBadge>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Add User</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={userToAddId}
                    onChange={(e) => setUserToAddId(e.target.value)}
                  >
                    {availableUsersToAdd.length === 0 ? (
                      <option value="">No users available</option>
                    ) : (
                      <>
                        <option value="">Select a user…</option>
                        {availableUsersToAdd.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.givenName} {user.familyName} · {user.email}
                          </option>
                        ))}
                      </>
                    )}
                  </Select>
                  <Button
                    variant="outline"
                    onClick={onAddUserToGroup}
                    disabled={!userToAddId || assignUser.isPending}
                  >
                    <Plus size={12} />Add
                  </Button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Search Members</label>
                <Input
                  type="text"
                  value={editUserSearch}
                  onChange={(e) => setEditUserSearch(e.target.value)}
                  placeholder="Search by name, email or username…"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {groupUsersLoading
                  ? 'Loading members…'
                  : groupUsers.length === 0
                    ? 'No users in this group yet'
                    : `${filteredGroupUsers.length} of ${groupUsers.length} member${groupUsers.length === 1 ? '' : 's'}${groupUsersFetching ? ' · refreshing…' : ''}`}
              </p>

              <div className="border border-border rounded-lg p-2 max-h-80 overflow-auto space-y-1">
                {groupUsersLoading ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">Loading…</p>
                ) : groupUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">Use the selector above to add the first member.</p>
                ) : filteredGroupUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">No members match your search.</p>
                ) : (
                  filteredGroupUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user.givenName} {user.familyName}
                          </p>
                          {user.isServiceUser && <StatusBadge tone="accent">Service</StatusBadge>}
                          {user.active === false && <StatusBadge tone="danger">Inactive</StatusBadge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email} · @{user.username}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => onRemoveUserFromGroup(user.id)}
                        disabled={removeUser.isPending}
                        title="Remove from group"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSaveGroupEdit}
              disabled={updateGroup.isPending || !editGroupName || !editGroupDescription}
            >
              {updateGroup.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
          {editFormError && <p className="text-xs text-rose-600">{editFormError}</p>}
        </div>
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
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Permanently delete <span className="font-semibold">{selectedGroupIds.length}</span> group{selectedGroupIds.length === 1 ? '' : 's'}? Users and role assignments tied to these groups will be removed.
          </p>
          {bulkError && <p className="text-xs text-rose-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkDeleteOpen(false)} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDeleteGroups}
              disabled={bulkPending || selectedGroupIds.length === 0}
            >
              {bulkPending ? 'Deleting…' : `Delete ${selectedGroupIds.length} Group${selectedGroupIds.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bulkRoleAction !== null}
        onClose={closeBulkRoleModal}
        title={bulkRoleAction === 'assign' ? 'Assign Role to Selected Groups' : 'Remove Role from Selected Groups'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {bulkRoleAction === 'assign' ? 'Assign' : 'Remove'} a role {bulkRoleAction === 'assign' ? 'to' : 'from'} the {selectedGroupIds.length} selected group{selectedGroupIds.length === 1 ? '' : 's'}.
          </p>
          <div>
            <label className={labelCls}>Role</label>
            <Select
              value={bulkRoleId}
              onChange={(e) => setBulkRoleId(e.target.value)}
            >
              <option value="">Select a role…</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}{role.appId ? ` (${appNameById.get(role.appId) ?? 'App'})` : ''}
                </option>
              ))}
            </Select>
          </div>
          {bulkError && <p className="text-xs text-rose-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkRoleModal} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkRoleApply}
              disabled={bulkPending || !bulkRoleId}
            >
              {bulkPending ? 'Applying…' : bulkRoleAction === 'assign' ? 'Assign Role' : 'Remove Role'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Groups
