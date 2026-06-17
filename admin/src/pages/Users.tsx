import { KeyRound, Link2, Pencil, Plus, RefreshCw, Shield, Trash2, UserCheck, UserX, Users as UsersIcon, X } from 'lucide-react'
import { EmptyState, PageHeader, TableSkeleton } from '../components/PageHeader'
import { useEffect, useMemo, useState } from 'react'
import ImageField from '../components/ImageField'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { imageFieldForCreate, imageFieldForUpdate, resolveMediaSrc } from '../lib/media'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Button from '../components/ui/Button'
import Input, { inputBaseClassName } from '../components/ui/Input'
import Card from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import BulkActionsBar, { SelectionCheckbox } from '../components/BulkActionsBar'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  useApps,
  useGroups,
  useRoles,
  useUserAttributes,
  useAssignUserToGroup,
  useRemoveUserFromGroup,
  useUploadUserAvatar,
  useDefaultUserAvatars,
} from '../hooks/useApi'
import React from 'react';

interface AppInheritanceSource {
  appId: string
  groupId: string
  groupName: string
}

interface User {
  id: string
  appId?: string
  appIds?: string[]
  directAppIds?: string[]
  inheritedAppIds?: string[]
  inheritedAppSources?: AppInheritanceSource[]
  directCustomAttributes?: Record<string, string>
  inheritedCustomAttributes?: Record<string, string>
  isServiceUser?: boolean
  email: string
  username: string
  givenName: string
  familyName: string
  customAttributes?: Record<string, string>
  active: boolean
  roles: string[]
  directRoleIds?: string[]
  groups?: string[]
  createdAt: string
  avatarUrl?: string
}

interface GroupItem {
  id: string
  name: string
}

interface AppItem {
  id: string
  name: string
}

interface RoleItem {
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

const defaultForm = () => ({
  appIds: [] as string[],
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  password: '',
  avatarUrl: '',
  avatarFile: undefined as File | undefined,
  customAttributes: {} as Record<string, string>,
  groupIds: [] as string[],
  roleIds: [] as string[]
})

const defaultEditForm = () => ({
  appIds: [] as string[],
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  avatarUrl: '',
  customAttributes: {} as Record<string, string>,
  groupIds: [] as string[],
  roleIds: [] as string[]
})

const defaultResetForm = () => ({
  password: '',
  confirmPassword: ''
})

const fieldCls = inputBaseClassName
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

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
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    )
  }

  if (attribute?.type === 'date') {
    return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  }

  if (attribute?.type === 'json') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[88px] font-mono"
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

const Users = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [userToReset, setUserToReset] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: users, isLoading, isFetching, refetch } = useUsers(debouncedSearch)
  const { data: apps = [] } = useApps()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetUserPassword = useResetUserPassword()
  const { data: groups = [] } = useGroups()
  const { data: roles = [] } = useRoles()
  const { data: attributeDefinitions = [] } = useUserAttributes()
  const assignUserGroup = useAssignUserToGroup()
  const removeUserGroup = useRemoveUserFromGroup()
  const uploadUserAvatar = useUploadUserAvatar()
  const [groupPickerByUser, setGroupPickerByUser] = useState<Record<string, string>>({})
  const [attributePicker, setAttributePicker] = useState<{ create: string; edit: string }>({ create: '', edit: '' })
  const [formData, setFormData] = useState(defaultForm)
  const [editFormData, setEditFormData] = useState(defaultEditForm)
  const [resetFormData, setResetFormData] = useState(defaultResetForm)
  const [createFormError, setCreateFormError] = useState<string>('')
  const [editFormError, setEditFormError] = useState<string>('')
  const [resetFormError, setResetFormError] = useState<string>('')
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const createInitials = `${formData.givenName?.[0] ?? ''}${formData.familyName?.[0] ?? ''}`.toUpperCase()
    || formData.username?.slice(0, 2).toUpperCase()
    || 'AB'
  const editInitials = `${editFormData.givenName?.[0] ?? ''}${editFormData.familyName?.[0] ?? ''}`.toUpperCase()
    || editFormData.username?.slice(0, 2).toUpperCase()
    || 'AB'
  const { data: createDefaultAvatars } = useDefaultUserAvatars(createInitials)
  const { data: editDefaultAvatars } = useDefaultUserAvatars(editInitials)

  const appNameById = new Map((apps as AppItem[]).map((a) => [a.id, a.name]))
  const enabledAttributeDefinitions = (attributeDefinitions as UserAttributeDefinition[]).filter((attribute) => attribute.enabled)
  const attributeByKey = new Map(enabledAttributeDefinitions.map((attribute) => [attribute.key, attribute]))
  const filteredUsers = (users as User[] | undefined)?.filter((user) => {
    const userAppIds = user.appIds ?? (user.appId ? [user.appId] : [])
    const appMatches = appFilterId === 'all' ? true : appFilterId === 'none' ? userAppIds.length === 0 : userAppIds.includes(appFilterId)
    return appMatches && !user.isServiceUser
  })

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkActiveAction, setBulkActiveAction] = useState<null | 'activate' | 'deactivate'>(null)
  const [bulkGroupAction, setBulkGroupAction] = useState<null | 'add' | 'remove'>(null)
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkRoleAction, setBulkRoleAction] = useState<null | 'add' | 'remove'>(null)
  const [bulkRoleId, setBulkRoleId] = useState('')
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const filteredUserIds = useMemo(() => (filteredUsers ?? []).map((user) => user.id), [filteredUsers])
  const selectedFilteredUserCount = useMemo(
    () => filteredUserIds.reduce((count, id) => (selectedUserIds.includes(id) ? count + 1 : count), 0),
    [filteredUserIds, selectedUserIds]
  )
  const allFilteredUsersSelected = filteredUserIds.length > 0 && selectedFilteredUserCount === filteredUserIds.length
  const someFilteredUsersSelected = selectedFilteredUserCount > 0 && !allFilteredUsersSelected
  const selectedUsers = useMemo(
    () => ((users as User[] | undefined) ?? []).filter((user) => selectedUserIds.includes(user.id)),
    [users, selectedUserIds]
  )

  useEffect(() => {
    setSelectedUserIds((prev) => {
      const valid = new Set(((users as User[] | undefined) ?? []).map((user) => user.id))
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [users])

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId])
  }

  const toggleSelectAllFilteredUsers = () => {
    if (filteredUserIds.length === 0) return
    if (allFilteredUsersSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !filteredUserIds.includes(id)))
      return
    }
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredUserIds) next.add(id)
      return Array.from(next)
    })
  }

  const clearUserSelection = () => setSelectedUserIds([])

  const closeBulkModals = () => {
    if (bulkPending) return
    setBulkDeleteOpen(false)
    setBulkActiveAction(null)
    setBulkGroupAction(null)
    setBulkRoleAction(null)
    setBulkGroupId('')
    setBulkRoleId('')
    setBulkError('')
  }

  const runBulk = async <T,>(
    items: T[],
    mutator: (item: T) => Promise<unknown>,
    onSuccessIds?: (succeeded: T[]) => void
  ) => {
    setBulkError('')
    setBulkPending(true)
    try {
      const results = await Promise.allSettled(items.map((item) => mutator(item)))
      const succeeded: T[] = []
      const failures: PromiseRejectedResult[] = []
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') succeeded.push(items[idx])
        else failures.push(result)
      })
      onSuccessIds?.(succeeded)
      if (failures.length > 0) {
        const message = failures[0].reason instanceof Error ? failures[0].reason.message : 'Unknown error'
        setBulkError(`${failures.length} of ${items.length} update${items.length === 1 ? '' : 's'} failed: ${message}`)
        return false
      }
      return true
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk action failed')
      return false
    } finally {
      setBulkPending(false)
    }
  }

  const handleBulkDeleteUsers = async () => {
    if (selectedUserIds.length === 0) return
    const ids = [...selectedUserIds]
    const ok = await runBulk(ids, (id) => deleteUser.mutateAsync(id), (succeeded) => {
      setSelectedUserIds((prev) => prev.filter((id) => !succeeded.includes(id)))
    })
    if (ok) setBulkDeleteOpen(false)
  }

  const handleBulkSetActive = async () => {
    if (!bulkActiveAction || selectedUserIds.length === 0) return
    const desired = bulkActiveAction === 'activate'
    const targets = selectedUsers.filter((user) => user.active !== desired)
    if (targets.length === 0) {
      setBulkError(`Selected users are already ${desired ? 'active' : 'inactive'}.`)
      return
    }
    const ok = await runBulk(targets, (user) => updateUser.mutateAsync({ id: user.id, active: desired }))
    if (ok) setBulkActiveAction(null)
  }

  const handleBulkGroup = async () => {
    if (!bulkGroupAction || !bulkGroupId || selectedUserIds.length === 0) return
    const group = (groups as GroupItem[]).find((g) => g.id === bulkGroupId)
    if (!group) return
    const targets = selectedUsers.filter((user) => {
      const inGroup = (user.groups ?? []).includes(group.name)
      return bulkGroupAction === 'add' ? !inGroup : inGroup
    })
    if (targets.length === 0) {
      const phrase = bulkGroupAction === 'add' ? 'already in' : 'not in'
      setBulkError(`Selected users are ${phrase} this group.`)
      return
    }
    const mutate = bulkGroupAction === 'add' ? assignUserGroup : removeUserGroup
    const ok = await runBulk(targets, (user) => mutate.mutateAsync({ userId: user.id, groupId: group.id }))
    if (ok) { setBulkGroupAction(null); setBulkGroupId('') }
  }

  const handleBulkRole = async () => {
    if (!bulkRoleAction || !bulkRoleId || selectedUserIds.length === 0) return
    const targets = selectedUsers.filter((user) => {
      const current = user.directRoleIds ?? []
      const has = current.includes(bulkRoleId)
      return bulkRoleAction === 'add' ? !has : has
    })
    if (targets.length === 0) {
      const phrase = bulkRoleAction === 'add' ? 'already have' : 'do not have'
      setBulkError(`Selected users ${phrase} this role.`)
      return
    }
    const ok = await runBulk(targets, (user) => {
      const current = user.directRoleIds ?? []
      const nextRoleIds = bulkRoleAction === 'add'
        ? Array.from(new Set([...current, bulkRoleId]))
        : current.filter((id) => id !== bulkRoleId)
      return updateUser.mutateAsync({ id: user.id, roleIds: nextRoleIds })
    })
    if (ok) { setBulkRoleAction(null); setBulkRoleId('') }
  }

  const toggleAppId = (appId: string, target: 'create' | 'edit') => {
    if (target === 'create') {
      setFormData((prev) => ({
        ...prev,
        appIds: prev.appIds.includes(appId)
          ? prev.appIds.filter((id) => id !== appId)
          : [...prev.appIds, appId]
      }))
      return
    }

    setEditFormData((prev) => ({
      ...prev,
      appIds: prev.appIds.includes(appId)
        ? prev.appIds.filter((id) => id !== appId)
        : [...prev.appIds, appId]
    }))
  }

  const addAttribute = (target: 'create' | 'edit') => {
    const key = attributePicker[target]
    if (!key) return

    if (target === 'create') {
      setFormData((prev) => ({
        ...prev,
        customAttributes: {
          ...prev.customAttributes,
          [key]: defaultValueForAttribute(attributeByKey.get(key)?.type)
        }
      }))
      setAttributePicker((prev) => ({ ...prev, create: '' }))
      return
    }

    setEditFormData((prev) => ({
      ...prev,
      customAttributes: {
        ...prev.customAttributes,
        [key]: defaultValueForAttribute(attributeByKey.get(key)?.type)
      }
    }))
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
  }

  const removeAttribute = (target: 'create' | 'edit', key: string) => {
    if (target === 'create') {
      setFormData((prev) => ({
        ...prev,
        customAttributes: Object.fromEntries(Object.entries(prev.customAttributes).filter(([attributeKey]) => attributeKey !== key))
      }))
      return
    }

    setEditFormData((prev) => ({
      ...prev,
      customAttributes: Object.fromEntries(Object.entries(prev.customAttributes).filter(([attributeKey]) => attributeKey !== key))
    }))
  }

  const updateAttributeValue = (target: 'create' | 'edit', key: string, value: string) => {
    if (target === 'create') {
      setFormData((prev) => ({
        ...prev,
        customAttributes: {
          ...prev.customAttributes,
          [key]: value
        }
      }))
      return
    }

    setEditFormData((prev) => ({
      ...prev,
      customAttributes: {
        ...prev.customAttributes,
        [key]: value
      }
    }))
  }

  const handleCreate = async () => {
    if (!formData.email || !formData.username || !formData.password) return

    setCreateFormError('')

    try {
      const created = await createUser.mutateAsync({
        appIds: formData.appIds,
        isServiceUser: false,
        avatarUrl: imageFieldForCreate(formData.avatarUrl),
        email: formData.email,
        username: formData.username,
        givenName: formData.givenName,
        familyName: formData.familyName,
        password: formData.password,
        customAttributes: formData.customAttributes,
        roleIds: formData.roleIds,
        groupIds: formData.groupIds
      })
      const avatarFile = (formData as any).avatarFile as File | undefined
      if (avatarFile && created?.id) {
        await uploadUserAvatar.mutateAsync({ userId: created.id, file: avatarFile })
      }
      setCreateModalOpen(false)
      setAttributePicker((prev) => ({ ...prev, create: '' }))
      setFormData(defaultForm())
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create user')
    }
  }

  const handleToggleActive = (user: User) => {
    updateUser.mutate({ id: user.id, active: !user.active })
  }

  const handleEdit = (user: User) => {
    setUserToEdit(user)
    setEditFormError('')
    const currentGroupIds = (user.groups ?? [])
      .map(groupName => (groups as GroupItem[]).find(g => g.name === groupName)?.id)
      .filter((id): id is string => Boolean(id))
    setEditFormData({
      appIds: user.directAppIds ?? user.appIds ?? (user.appId ? [user.appId] : []),
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      avatarUrl: user.avatarUrl ?? '',
      customAttributes: user.directCustomAttributes ?? {},
      groupIds: currentGroupIds,
      roleIds: user.directRoleIds ?? []
    })
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!userToEdit) return
    if (!editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName) return

    setEditFormError('')
    try {
      await updateUser.mutateAsync({
        id: userToEdit.id,
        appIds: editFormData.appIds,
        isServiceUser: false,
        email: editFormData.email,
        username: editFormData.username,
        givenName: editFormData.givenName,
        familyName: editFormData.familyName,
        avatarUrl: imageFieldForUpdate(editFormData.avatarUrl),
        customAttributes: editFormData.customAttributes,
        roleIds: editFormData.roleIds
      })
      const originalGroupIds = (userToEdit.groups ?? [])
        .map(groupName => (groups as GroupItem[]).find(g => g.name === groupName)?.id)
        .filter((id): id is string => Boolean(id))
      const toAdd = editFormData.groupIds.filter(id => !originalGroupIds.includes(id))
      const toRemove = originalGroupIds.filter(id => !editFormData.groupIds.includes(id))
      await Promise.all([
        ...toAdd.map(groupId => assignUserGroup.mutateAsync({ userId: userToEdit.id, groupId })),
        ...toRemove.map(groupId => removeUserGroup.mutateAsync({ userId: userToEdit.id, groupId }))
      ])
      setEditModalOpen(false)
      setUserToEdit(null)
      setAttributePicker((prev) => ({ ...prev, edit: '' }))
      setEditFormData(defaultEditForm())
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update user')
    }
  }

  const handleDelete = (id: string, email: string) => {
    setUserToDelete({ id, email })
  }

  const handleOpenReset = (user: User) => {
    setUserToReset(user)
    setResetFormData(defaultResetForm())
    setResetFormError('')
    setResetModalOpen(true)
  }

  const handleResetPassword = async () => {
    if (!userToReset) return

    if (!resetFormData.password || !resetFormData.confirmPassword) {
      setResetFormError('Enter and confirm the new password')
      return
    }
    if (resetFormData.password.length < 8) {
      setResetFormError('Password must be at least 8 characters')
      return
    }
    if (resetFormData.password !== resetFormData.confirmPassword) {
      setResetFormError('Passwords do not match')
      return
    }

    try {
      await resetUserPassword.mutateAsync({ id: userToReset.id, password: resetFormData.password })
      setResetModalOpen(false)
      setUserToReset(null)
      setResetFormData(defaultResetForm())
      setResetFormError('')
    } catch (error) {
      setResetFormError(error instanceof Error ? error.message : 'Failed to reset password')
    }
  }

  const confirmDeleteUser = () => {
    if (!userToDelete) return
    deleteUser.mutate(userToDelete.id, { onSuccess: () => setUserToDelete(null) })
  }

  const toggleCreateGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId]
    }))
  }

  const toggleEditGroup = (groupId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId]
    }))
  }

  const toggleCreateRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId]
    }))
  }

  const toggleEditRole = (roleId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId]
    }))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Identity Directory"
        title="User Management"
        action={
          <Button
            onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true) }}
            variant="primary"
          >
            <Plus size={14} />
            New User
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search users by name, email, username…" />
        <div className="max-w-sm w-full">
          <label className={labelCls}>Filter by App</label>
          <select className={fieldCls} value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
            <option value="all">All Apps</option>
            <option value="none">Unassigned</option>
            {(apps as AppItem[]).map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <SelectionCheckbox
              checked={allFilteredUsersSelected}
              indeterminate={someFilteredUsersSelected}
              onChange={toggleSelectAllFilteredUsers}
              disabled={!filteredUsers?.length}
              title={allFilteredUsersSelected ? 'Deselect all' : 'Select all visible'}
            />
            <h4 className="text-sm font-semibold text-slate-700">All Users</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
        <BulkActionsBar
          count={selectedUserIds.length}
          noun="user"
          onClear={clearUserSelection}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkActiveAction('activate') }}
            disabled={bulkPending}
          >
            <UserCheck size={12} />
            Activate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkActiveAction('deactivate') }}
            disabled={bulkPending}
          >
            <UserX size={12} />
            Deactivate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkGroupAction('add'); setBulkGroupId('') }}
            disabled={bulkPending}
          >
            <Link2 size={12} />
            Add to Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkGroupAction('remove'); setBulkGroupId('') }}
            disabled={bulkPending}
          >
            <X size={12} />
            Remove from Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkRoleAction('add'); setBulkRoleId('') }}
            disabled={bulkPending}
          >
            <Shield size={12} />
            Assign Role
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkError(''); setBulkRoleAction('remove'); setBulkRoleId('') }}
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
          <TableSkeleton rows={6} />
        ) : !filteredUsers?.length ? (
          <EmptyState icon={UsersIcon} title="No users registered" description="Create the first user to get started." action={<Button size="sm" variant="primary" onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true) }}>New User</Button>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user: User) => {
              const isSelected = selectedUserIds.includes(user.id)
              return (
              <div key={user.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors gap-4 ${isSelected ? 'bg-sky-50/40' : ''}`}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-1.5">
                    <SelectionCheckbox
                      checked={isSelected}
                      onChange={() => toggleSelectUser(user.id)}
                      aria-label={`Select user ${user.email}`}
                    />
                  </div>
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-semibold text-slate-600 mt-0.5">
                    {(user.givenName?.[0] ?? '').toUpperCase()}{(user.familyName?.[0] ?? '').toUpperCase()}
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{user.givenName} {user.familyName}</p>
                    {(user.appIds ?? (user.appId ? [user.appId] : [])).length === 0 ? (
                      <StatusBadge tone="accent">
                        No Apps
                      </StatusBadge>
                    ) : (
                      (user.appIds ?? (user.appId ? [user.appId] : [])).map((assignedAppId) => {
                        const directAppIds = user.directAppIds ?? []
                        const inheritedAppIds = user.inheritedAppIds ?? []
                        const isDirect = directAppIds.includes(assignedAppId)
                        const isInherited = inheritedAppIds.includes(assignedAppId)
                        const sourceGroupNames = (user.inheritedAppSources ?? [])
                          .filter((source) => source.appId === assignedAppId)
                          .map((source) => source.groupName)
                        const suffix = !isDirect && isInherited
                          ? sourceGroupNames.length > 0
                            ? ` via ${sourceGroupNames.join(', ')}`
                            : ' via group'
                          : ''
                        return (
                          <StatusBadge key={assignedAppId} tone="accent">
                            {appNameById.get(assignedAppId) ?? 'App'}
                            {suffix}
                          </StatusBadge>
                        )
                      })
                    )}

                    {!user.active && (
                      <StatusBadge tone="danger">Inactive</StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{user.email} · @{user.username}</p>
                  {user.roles.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map(r => (
                        <StatusBadge key={r} tone="neutral">{r}</StatusBadge>
                      ))}
                    </div>
                  )}
                  {user.customAttributes && Object.keys(user.customAttributes).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(user.customAttributes).map(([key, value]) => (
                        <StatusBadge key={key} tone="warning" mono>
                          {attributeByKey.get(key)?.name ?? key}: {value}
                          {user.inheritedCustomAttributes?.[key] === value && !user.directCustomAttributes?.[key] ? ' via group' : ''}
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {(user.groups ?? []).map((groupName) => (
                      <StatusBadge key={groupName} tone="info">
                        {groupName}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-sky-500 hover:text-red-600"
                          onClick={() => {
                            const group = (groups as GroupItem[]).find((g) => g.name === groupName)
                            if (!group) return
                            removeUserGroup.mutate({ userId: user.id, groupId: group.id })
                          }}
                          title="Remove from group"
                        >
                          <X size={11} />
                        </Button>
                      </StatusBadge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 max-w-sm">
                    <select
                      className={`${fieldCls} h-8`}
                      value={groupPickerByUser[user.id] ?? ''}
                      onChange={(e) => setGroupPickerByUser((prev) => ({ ...prev, [user.id]: e.target.value }))}
                    >
                      <option value="">Assign group...</option>
                      {(groups as GroupItem[])
                        .filter((group) => !(user.groups ?? []).includes(group.name))
                        .map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!groupPickerByUser[user.id] || assignUserGroup.isPending}
                      onClick={() => assignUserGroup.mutate({ userId: user.id, groupId: groupPickerByUser[user.id] })}
                    >
                      <span className="inline-flex items-center gap-1"><Link2 size={11} />Add</span>
                    </Button>
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-amber-50 hover:text-amber-700"
                    onClick={() => handleOpenReset(user)}
                    disabled={resetUserPassword.isPending}
                    title="Reset password"
                  >
                    <KeyRound size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(user)}
                    disabled={updateUser.isPending}
                    title="Edit user"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(user)}
                    disabled={updateUser.isPending}
                    title={user.active ? 'Deactivate' : 'Activate'}
                  >
                    {user.active ? <UserCheck size={14} /> : <UserX size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDelete(user.id, user.email)}
                    disabled={deleteUser.isPending}
                    title="Delete user"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New User">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Apps</label>
              <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
                {(apps as AppItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No apps available</p>}
                {(apps as AppItem[]).map((app) => (
                  <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.appIds.includes(app.id)}
                      onChange={() => toggleAppId(app.id, 'create')}
                      className="rounded border-slate-300"
                    />
                    {app.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>First Name</label>
              <Input type="text" value={formData.givenName} onChange={e => setFormData(f => ({ ...f, givenName: e.target.value }))} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <Input type="text" value={formData.familyName} onChange={e => setFormData(f => ({ ...f, familyName: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <Input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <Input type="text" value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className="font-mono" placeholder="janedoe" />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <Input type="password" value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
          </div>
          <ImageField
            label="Profile Picture"
            value={formData.avatarUrl}
            onChange={(avatarUrl) => setFormData((f) => ({ ...f, avatarUrl }))}
            urlPlaceholder="/media/defaults/user/initials.svg or https://…"
            defaultImages={(createDefaultAvatars as any)?.items ?? []}
            onUpload={async (file) => setFormData((f) => ({ ...f, avatarFile: file }))}
            uploadHint={formData.avatarFile ? `Selected: ${(formData as any).avatarFile.name}. Uploads when the user is created.` : undefined}
          />
          <div>
            <label className={labelCls}>Custom Attributes</label>
            <div className="space-y-2">
              {Object.entries(formData.customAttributes).length === 0 ? (
                <p className="text-xs text-slate-400">No attributes selected</p>
              ) : (
                Object.entries(formData.customAttributes).map(([key, value]) => {
                  const attribute = attributeByKey.get(key)
                  return (
                    <div key={key} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{attribute?.name ?? key}</p>
                          <p className="text-xs text-slate-500 font-mono">{key}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="hover:bg-red-50 hover:text-red-600"
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
                <select
                  value={attributePicker.create}
                  onChange={(e) => setAttributePicker((prev) => ({ ...prev, create: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Add attribute...</option>
                  {enabledAttributeDefinitions
                    .filter((attribute) => !(attribute.key in formData.customAttributes))
                    .map((attribute) => (
                      <option key={attribute.id} value={attribute.key}>{attribute.name}</option>
                    ))}
                </select>
                <Button
                  type="button"
                  onClick={() => addAttribute('create')}
                  disabled={!attributePicker.create}
                  size="md"
                  variant="secondary"
                >
                  Add
                </Button>
              </div>
            </div>
            {createFormError && <p className="mt-1 text-xs text-red-600">{createFormError}</p>}
          </div>
          <div>
            <label className={labelCls}>Groups</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(groups as GroupItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No groups available</p>}
              {(groups as GroupItem[]).map((group) => (
                <label key={group.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.groupIds.includes(group.id)}
                    onChange={() => toggleCreateGroup(group.id)}
                    className="rounded border-slate-300"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Roles</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(roles as RoleItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No roles available</p>}
              {(roles as RoleItem[]).map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.roleIds.includes(role.id)}
                    onChange={() => toggleCreateRole(role.id)}
                    className="rounded border-slate-300"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setCreateModalOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createUser.isPending || !formData.email || !formData.username || !formData.password}
              variant="primary"
            >
              {createUser.isPending ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit User${userToEdit ? `: ${userToEdit.email}` : ''}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Direct Apps</label>
              <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
                {(apps as AppItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No apps available</p>}
                {(apps as AppItem[]).map((app) => (
                  <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.appIds.includes(app.id)}
                      onChange={() => toggleAppId(app.id, 'edit')}
                      className="rounded border-slate-300"
                    />
                    {app.name}
                  </label>
                ))}
              </div>
              {userToEdit && (userToEdit.inheritedAppIds ?? []).length > 0 && (
                <div className="mt-2 rounded-lg border border-dashed border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Inherited Apps</p>
                  <div className="space-y-1.5">
                    {(userToEdit.inheritedAppIds ?? []).map((appId) => {
                      const sourceGroupNames = Array.from(
                        new Set(
                          (userToEdit.inheritedAppSources ?? [])
                            .filter((source) => source.appId === appId)
                            .map((source) => source.groupName)
                        )
                      )
                      return (
                        <div key={appId} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                          <span className="font-medium text-slate-900">{appNameById.get(appId) ?? appId}</span>
                          <span className="text-slate-400">from</span>
                          {sourceGroupNames.length === 0 ? (
                            <StatusBadge tone="info">group</StatusBadge>
                          ) : (
                            sourceGroupNames.map((groupName) => (
                              <StatusBadge key={groupName} tone="info">{groupName}</StatusBadge>
                            ))
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Inherited apps cannot be removed here. Remove the user from the source group or unassign the app from that group instead.</p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>First Name</label>
              <Input type="text" value={editFormData.givenName} onChange={e => setEditFormData(f => ({ ...f, givenName: e.target.value }))} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <Input type="text" value={editFormData.familyName} onChange={e => setEditFormData(f => ({ ...f, familyName: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <Input type="email" value={editFormData.email} onChange={e => setEditFormData(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <Input type="text" value={editFormData.username} onChange={e => setEditFormData(f => ({ ...f, username: e.target.value }))} className="font-mono" placeholder="janedoe" />
          </div>
          {userToEdit ? (
            <ImageField
              label="Profile Picture"
              value={editFormData.avatarUrl}
              onChange={(avatarUrl) => setEditFormData((f) => ({ ...f, avatarUrl }))}
              urlPlaceholder="/media/defaults/user/initials.svg or https://…"
              defaultImages={(editDefaultAvatars as any)?.items ?? []}
              uploadPending={uploadUserAvatar.isPending}
              onUpload={async (file) => {
                try {
                  const result = await uploadUserAvatar.mutateAsync({ userId: userToEdit.id, file }) as { avatarUrl?: string }
                  if (result?.avatarUrl) {
                    setEditFormData((prev) => ({ ...prev, avatarUrl: result.avatarUrl ?? '' }))
                  }
                  setEditFormError('')
                } catch (error) {
                  setEditFormError(error instanceof Error ? error.message : 'Failed to upload avatar')
                }
              }}
            />
          ) : null}
          <div>
            <label className={labelCls}>Direct Custom Attributes</label>
            <div className="space-y-2">
              {Object.entries(editFormData.customAttributes).length === 0 ? (
                <p className="text-xs text-slate-400">No direct attributes selected</p>
              ) : (
                Object.entries(editFormData.customAttributes).map(([key, value]) => {
                  const attribute = attributeByKey.get(key)
                  return (
                    <div key={key} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{attribute?.name ?? key}</p>
                          <p className="text-xs text-slate-500 font-mono">{key}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="hover:bg-red-50 hover:text-red-600"
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
                <select
                  value={attributePicker.edit}
                  onChange={(e) => setAttributePicker((prev) => ({ ...prev, edit: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Add attribute...</option>
                  {enabledAttributeDefinitions
                    .filter((attribute) => !(attribute.key in editFormData.customAttributes))
                    .map((attribute) => (
                      <option key={attribute.id} value={attribute.key}>{attribute.name}</option>
                    ))}
                </select>
                <Button
                  type="button"
                  onClick={() => addAttribute('edit')}
                  disabled={!attributePicker.edit}
                  variant="secondary"
                >
                  Add
                </Button>
              </div>
              {userToEdit && userToEdit.inheritedCustomAttributes && Object.keys(userToEdit.inheritedCustomAttributes).length > 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Inherited From Groups</p>
                  <div className="space-y-1">
                    {Object.entries(userToEdit.inheritedCustomAttributes).map(([key, value]) => (
                      <div key={key} className="text-xs text-slate-600">
                        <span className="font-medium text-slate-900">{attributeByKey.get(key)?.name ?? key}</span>: {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {editFormError && <p className="mt-1 text-xs text-red-600">{editFormError}</p>}
          </div>
          <div>
            <label className={labelCls}>Groups</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(groups as GroupItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No groups available</p>}
              {(groups as GroupItem[]).map((group) => (
                <label key={group.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.groupIds.includes(group.id)}
                    onChange={() => toggleEditGroup(group.id)}
                    className="rounded border-slate-300"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Roles</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(roles as RoleItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No roles available</p>}
              {(roles as RoleItem[]).map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.roleIds.includes(role.id)}
                    onChange={() => toggleEditRole(role.id)}
                    className="rounded border-slate-300"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setEditModalOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateUser.isPending || !editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName}
              variant="primary"
            >
              {updateUser.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title={`Reset Password${userToReset ? `: ${userToReset.email}` : ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Set a new password for this user. Existing sessions for this user will be revoked immediately.
          </p>
          <div>
            <label className={labelCls}>New Password</label>
            <Input
              type="password"
              value={resetFormData.password}
              onChange={(e) => setResetFormData((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className={labelCls}>Confirm Password</label>
            <Input
              type="password"
              value={resetFormData.confirmPassword}
              onChange={(e) => setResetFormData((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Repeat new password"
            />
          </div>
          {resetFormError && <p className="text-xs text-red-600">{resetFormError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setResetModalOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetUserPassword.isPending || !resetFormData.password || !resetFormData.confirmPassword}
              variant="primary"
            >
              {resetUserPassword.isPending ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!userToDelete}
        title="Delete User"
        message={`Delete user "${userToDelete?.email ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete User"
        pending={deleteUser.isPending}
        onConfirm={confirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      <Modal isOpen={bulkDeleteOpen} onClose={closeBulkModals} title="Delete Selected Users" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Permanently delete <span className="font-semibold">{selectedUserIds.length}</span> user{selectedUserIds.length === 1 ? '' : 's'}? This action cannot be undone.
          </p>
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleBulkDeleteUsers} disabled={bulkPending || selectedUserIds.length === 0}>
              {bulkPending ? 'Deleting…' : `Delete ${selectedUserIds.length} User${selectedUserIds.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bulkActiveAction !== null}
        onClose={closeBulkModals}
        title={bulkActiveAction === 'activate' ? 'Activate Selected Users' : 'Deactivate Selected Users'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {bulkActiveAction === 'activate' ? 'Activate' : 'Deactivate'} the {selectedUserIds.length} selected user{selectedUserIds.length === 1 ? '' : 's'}?
            {bulkActiveAction === 'deactivate' && ' Existing sessions for these users will continue until expiry but new sign-ins will be blocked.'}
          </p>
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkSetActive}
              disabled={bulkPending || selectedUserIds.length === 0}
            >
              {bulkPending ? 'Applying…' : bulkActiveAction === 'activate' ? 'Activate Users' : 'Deactivate Users'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bulkGroupAction !== null}
        onClose={closeBulkModals}
        title={bulkGroupAction === 'add' ? 'Add Selected Users to Group' : 'Remove Selected Users from Group'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {bulkGroupAction === 'add' ? 'Assign' : 'Remove'} the {selectedUserIds.length} selected user{selectedUserIds.length === 1 ? '' : 's'} {bulkGroupAction === 'add' ? 'to' : 'from'} a group.
          </p>
          <div>
            <label className={labelCls}>Group</label>
            <select
              className={fieldCls}
              value={bulkGroupId}
              onChange={(e) => setBulkGroupId(e.target.value)}
            >
              <option value="">Select a group…</option>
              {(groups as GroupItem[]).map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkGroup}
              disabled={bulkPending || !bulkGroupId}
            >
              {bulkPending ? 'Applying…' : bulkGroupAction === 'add' ? 'Add to Group' : 'Remove from Group'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bulkRoleAction !== null}
        onClose={closeBulkModals}
        title={bulkRoleAction === 'add' ? 'Assign Role to Selected Users' : 'Remove Role from Selected Users'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {bulkRoleAction === 'add' ? 'Assign' : 'Remove'} a role {bulkRoleAction === 'add' ? 'to' : 'from'} the {selectedUserIds.length} selected user{selectedUserIds.length === 1 ? '' : 's'}. Only direct role assignments are affected; roles inherited via groups are not changed.
          </p>
          <div>
            <label className={labelCls}>Role</label>
            <select
              className={fieldCls}
              value={bulkRoleId}
              onChange={(e) => setBulkRoleId(e.target.value)}
            >
              <option value="">Select a role…</option>
              {(roles as RoleItem[]).map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkRole}
              disabled={bulkPending || !bulkRoleId}
            >
              {bulkPending ? 'Applying…' : bulkRoleAction === 'add' ? 'Assign Role' : 'Remove Role'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Users
