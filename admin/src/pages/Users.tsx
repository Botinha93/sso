import { KeyRound, Link2, Pencil, Plus, Shield, Trash2, UserCheck, UserX, Users as UsersIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Group,
  Input,
  NativeSelect,
  Paper,
  PasswordInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import ImageField from '../components/ImageField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { imageFieldForCreate, imageFieldForUpdate, resolveMediaSrc } from '../lib/media'
import { toDateInputValue } from '../lib/utils'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
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
  appId?: string
  appIds?: string[]
}

interface AppItem {
  id: string
  name: string
}

interface RoleItem {
  id: string
  name: string
  appId?: string
}

const resolveGroupAppIds = (group: GroupItem) => group.appIds ?? (group.appId ? [group.appId] : [])

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



const defaultValueForAttribute = (type?: AttributeType) => {
  if (type === 'boolean') return 'false'
  return ''
}

const SYSTEM_MANAGED_ATTRIBUTE_KEYS = new Set(['password_changed_at'])


const AttributeValueField = ({
  attribute,
  value,
  onChange,
  readOnly = false,
}: {
  attribute?: UserAttributeDefinition
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}) => {
  if (attribute?.type === 'boolean') {
    return (
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={readOnly}
        data={['false', 'true']}
      />
    )
  }

  if (attribute?.type === 'date') {
    return <TextInput type="date" value={toDateInputValue(value)} onChange={(e) => onChange(e.currentTarget.value)} disabled={readOnly} />
  }

  if (attribute?.type === 'json') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={readOnly}
        autosize
        minRows={3}
        ff="monospace"
        placeholder='{"key":"value"}'
      />
    )
  }

  return (
    <TextInput
      type={attribute?.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      disabled={readOnly}
      placeholder={attribute?.description || attribute?.name || 'Value'}
    />
  )
}

/** Bordered, scrollable list of checkboxes (apps, groups, roles pickers). */
const CheckList = ({ children }: { children: React.ReactNode }) => (
  <Paper withBorder radius="md">
    <ScrollArea.Autosize mah={160} type="auto">
      <Stack gap={2} p={6}>
        {children}
      </Stack>
    </ScrollArea.Autosize>
  </Paper>
)

const CheckListItem = ({
  checked,
  onChange,
  label,
  badge,
}: {
  checked: boolean
  onChange: () => void
  label: React.ReactNode
  badge?: React.ReactNode
}) => (
  <Group gap="xs" wrap="nowrap" px={6} py={4} className="nx-hover" style={{ borderRadius: 'var(--mantine-radius-sm)' }}>
    <Checkbox
      size="sm"
      checked={checked}
      onChange={onChange}
      label={label}
      style={{ flex: 1, minWidth: 0 }}
      styles={{ labelWrapper: { minWidth: 0 }, label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
    />
    {badge}
  </Group>
)

const CheckListEmpty = ({ children }: { children: React.ReactNode }) => (
  <Text size="xs" c="dimmed" px={6} py={4}>{children}</Text>
)

const AttributeEditorCard = ({
  name,
  attrKey,
  removable,
  onRemove,
  children,
}: {
  name: string
  attrKey: string
  removable: boolean
  onRemove: () => void
  children: React.ReactNode
}) => (
  <Paper withBorder radius="md" p="sm">
    <Group justify="space-between" gap="xs" mb="xs" wrap="nowrap">
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} truncate>{name}</Text>
        <Text size="xs" c="dimmed" ff="monospace" truncate>{attrKey}</Text>
      </Box>
      {removable ? (
        <Tooltip label="Remove attribute">
          <ActionIcon type="button" variant="subtle" color="red" size="sm" onClick={onRemove} aria-label="Remove attribute">
            <X size={14} />
          </ActionIcon>
        </Tooltip>
      ) : null}
    </Group>
    {children}
  </Paper>
)

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
  const [editGroupSearch, setEditGroupSearch] = useState('')
  const [editGroupAppFilter, setEditGroupAppFilter] = useState('all')
  const [editRoleSearch, setEditRoleSearch] = useState('')
  const [editRoleAppFilter, setEditRoleAppFilter] = useState('all')
  const createInitials = `${formData.givenName?.[0] ?? ''}${formData.familyName?.[0] ?? ''}`.toUpperCase()
    || formData.username?.slice(0, 2).toUpperCase()
    || 'AB'
  const editInitials = `${editFormData.givenName?.[0] ?? ''}${editFormData.familyName?.[0] ?? ''}`.toUpperCase()
    || editFormData.username?.slice(0, 2).toUpperCase()
    || 'AB'
  const { data: createDefaultAvatars } = useDefaultUserAvatars(createInitials)
  const { data: editDefaultAvatars } = useDefaultUserAvatars(editInitials)

  const appNameById = useMemo(
    () => new Map((apps as AppItem[]).map((a) => [a.id, a.name])),
    [apps]
  )
  const enabledAttributeDefinitions = (attributeDefinitions as UserAttributeDefinition[]).filter((attribute) => attribute.enabled)
  const attributeByKey = new Map(enabledAttributeDefinitions.map((attribute) => [attribute.key, attribute]))
  const filteredUsers = (users as User[] | undefined)?.filter((user) => {
    const userAppIds = user.appIds ?? (user.appId ? [user.appId] : [])
    const appMatches = appFilterId === 'all' ? true : appFilterId === 'none' ? userAppIds.length === 0 : userAppIds.includes(appFilterId)
    return appMatches
  })

  const groupOptions = groups as GroupItem[]
  const roleOptions = roles as RoleItem[]

  const filteredEditGroups = useMemo(() => {
    const term = editGroupSearch.trim().toLowerCase()
    return groupOptions.filter((group) => {
      const groupAppIds = resolveGroupAppIds(group)
      if (editGroupAppFilter === 'none' && groupAppIds.length > 0) return false
      if (editGroupAppFilter !== 'all' && editGroupAppFilter !== 'none' && !groupAppIds.includes(editGroupAppFilter)) return false
      if (!term) return true
      const appNames = groupAppIds.map((id) => (appNameById.get(id) ?? '').toLowerCase()).join(' ')
      return group.name.toLowerCase().includes(term) || appNames.includes(term)
    })
  }, [groupOptions, editGroupSearch, editGroupAppFilter, appNameById])

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
        customAttributes: Object.fromEntries(
          Object.entries(formData.customAttributes).filter(([key]) => !SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(key))
        ),
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
      customAttributes: Object.fromEntries(
        Object.entries(user.directCustomAttributes ?? {}).map(([key, value]) => [
          key,
          attributeByKey.get(key)?.type === 'date' ? toDateInputValue(value) : value
        ])
      ),
      groupIds: currentGroupIds,
      roleIds: user.directRoleIds ?? []
    })
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
    setEditGroupSearch('')
    setEditGroupAppFilter('all')
    setEditRoleSearch('')
    setEditRoleAppFilter('all')
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
        customAttributes: Object.fromEntries(
          Object.entries(editFormData.customAttributes).filter(([key]) => !SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(key))
        ),
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


  const appFilterData = [
    { value: 'all', label: 'All Apps' },
    { value: 'none', label: 'Unassigned' },
    ...(apps as AppItem[]).map((app) => ({ value: app.id, label: app.name })),
  ]
  const editAppFilterData = [
    { value: 'all', label: 'All Apps' },
    { value: 'none', label: 'No App' },
    ...(apps as AppItem[]).map((app) => ({ value: app.id, label: app.name })),
  ]
  const openCreate = () => { setFormData(defaultForm()); setCreateModalOpen(true) }
  const pluralUsers = (count: number) => `user${count === 1 ? '' : 's'}`

  return (
    <>
      <PageHeader
        eyebrow="Identity Directory"
        title="User Management"
        description="Human user accounts only. Machine-to-machine identities are managed under Service Identities and are excluded from this list and from GET /api/admin/users unless includeServiceUsers=true."
        actions={
          <Button onClick={openCreate} leftSection={<Plus size={16} />}>
            New User
          </Button>
        }
      />

      <SectionCard
        flush
        title="All Users"
        actions={<RefreshButton variant="icon" loading={isFetching} onRefresh={() => refetch()} lastUpdated={null} />}
      >
        <Group
          justify="space-between"
          gap="sm"
          px="md"
          py="sm"
          wrap="wrap"
          style={{ borderBottom: '1px solid var(--nx-color-border)' }}
        >
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search users by name, email, username…"
            w={{ base: '100%', xs: 320 }}
            maw={360}
          />
          <Select
            aria-label="Filter by App"
            value={appFilterId}
            onChange={(value) => setAppFilterId(value ?? 'all')}
            data={appFilterData}
            allowDeselect={false}
            searchable
            w={{ base: '100%', xs: 240 }}
          />
        </Group>

        <BulkActionsBar
          count={selectedUserIds.length}
          noun="user"
          onClear={clearUserSelection}
        >
          <Button
            variant="default"
            size="xs"
            leftSection={<UserCheck size={14} />}
            onClick={() => { setBulkError(''); setBulkActiveAction('activate') }}
            disabled={bulkPending}
          >
            Activate
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<UserX size={14} />}
            onClick={() => { setBulkError(''); setBulkActiveAction('deactivate') }}
            disabled={bulkPending}
          >
            Deactivate
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<Link2 size={14} />}
            onClick={() => { setBulkError(''); setBulkGroupAction('add'); setBulkGroupId('') }}
            disabled={bulkPending}
          >
            Add to Group
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<X size={14} />}
            onClick={() => { setBulkError(''); setBulkGroupAction('remove'); setBulkGroupId('') }}
            disabled={bulkPending}
          >
            Remove from Group
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<Shield size={14} />}
            onClick={() => { setBulkError(''); setBulkRoleAction('add'); setBulkRoleId('') }}
            disabled={bulkPending}
          >
            Assign Role
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<X size={14} />}
            onClick={() => { setBulkError(''); setBulkRoleAction('remove'); setBulkRoleId('') }}
            disabled={bulkPending}
          >
            Remove Role
          </Button>
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<Trash2 size={14} />}
            onClick={() => { setBulkError(''); setBulkDeleteOpen(true) }}
            disabled={bulkPending}
          >
            Delete Selected
          </Button>
        </BulkActionsBar>

        {isLoading ? (
          <TableSkeleton rows={6} columns={['avatar', 'pill', 'pill', 'pill', 'pill', 'action']} p="md" />
        ) : !filteredUsers?.length ? (
          <EmptyState
            icon={UsersIcon}
            title="No users registered"
            description="Create the first user to get started."
            action={<Button size="xs" onClick={openCreate}>New User</Button>}
          />
        ) : (
          <Table.ScrollContainer minWidth={1080}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={44}>
                    <SelectionCheckbox
                      checked={allFilteredUsersSelected}
                      indeterminate={someFilteredUsersSelected}
                      onChange={toggleSelectAllFilteredUsers}
                      disabled={!filteredUsers?.length}
                      title={allFilteredUsersSelected ? 'Deselect all' : 'Select all visible'}
                      aria-label={allFilteredUsersSelected ? 'Deselect all' : 'Select all visible'}
                    />
                  </Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Apps</Table.Th>
                  <Table.Th>Roles & attributes</Table.Th>
                  <Table.Th>Groups</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={150} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.map((user: User) => {
                  const isSelected = selectedUserIds.includes(user.id)
                  const assignedAppIds = user.appIds ?? (user.appId ? [user.appId] : [])
                  const availableGroups = (groups as GroupItem[]).filter((group) => !(user.groups ?? []).includes(group.name))
                  return (
                    <Table.Tr key={user.id} bg={isSelected ? 'var(--nx-color-accent-soft)' : undefined} style={{ verticalAlign: 'top' }}>
                      <Table.Td>
                        <Box pt={8}>
                          <SelectionCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelectUser(user.id)}
                            aria-label={`Select user ${user.email}`}
                          />
                        </Box>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar src={resolveMediaSrc(user.avatarUrl)} size={32} radius="xl" color="gray">
                            {(user.givenName?.[0] ?? '').toUpperCase()}{(user.familyName?.[0] ?? '').toUpperCase()}
                          </Avatar>
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>{user.givenName} {user.familyName}</Text>
                            <Text size="xs" c="dimmed" truncate>{user.email} · @{user.username}</Text>
                          </Box>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {assignedAppIds.length === 0 ? (
                            <Badge variant="light">No Apps</Badge>
                          ) : (
                            assignedAppIds.map((assignedAppId) => {
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
                                <Badge key={assignedAppId} variant="light" tt="none">
                                  {appNameById.get(assignedAppId) ?? 'App'}
                                  {suffix}
                                </Badge>
                              )
                            })
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          {user.roles.length > 0 ? (
                            <Group gap={4}>
                              {user.roles.map(r => (
                                <Badge key={r} variant="light" color="gray" tt="none">{r}</Badge>
                              ))}
                            </Group>
                          ) : null}
                          {user.customAttributes && Object.keys(user.customAttributes).length > 0 ? (
                            <Group gap={4}>
                              {Object.entries(user.customAttributes).map(([key, value]) => (
                                <Badge key={key} variant="light" color="yellow" tt="none" ff="monospace">
                                  {attributeByKey.get(key)?.name ?? key}: {value}
                                  {user.inheritedCustomAttributes?.[key] === value && !user.directCustomAttributes?.[key] ? ' via group' : ''}
                                </Badge>
                              ))}
                            </Group>
                          ) : null}
                          {user.roles.length === 0 && !(user.customAttributes && Object.keys(user.customAttributes).length > 0) ? (
                            <Text size="xs" c="dimmed">—</Text>
                          ) : null}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6}>
                          {(user.groups ?? []).length > 0 ? (
                            <Group gap={4}>
                              {(user.groups ?? []).map((groupName) => (
                                <Badge
                                  key={groupName}
                                  variant="light"
                                  color="blue"
                                  tt="none"
                                  pr={2}
                                  rightSection={
                                    <CloseButton
                                      size="xs"
                                      iconSize={11}
                                      onClick={() => {
                                        const group = (groups as GroupItem[]).find((g) => g.name === groupName)
                                        if (!group) return
                                        removeUserGroup.mutate({ userId: user.id, groupId: group.id })
                                      }}
                                      title="Remove from group"
                                      aria-label={`Remove from group ${groupName}`}
                                    />
                                  }
                                >
                                  {groupName}
                                </Badge>
                              ))}
                            </Group>
                          ) : null}
                          <Group gap={6} wrap="nowrap">
                            <Select
                              size="xs"
                              placeholder="Assign group..."
                              aria-label="Assign group"
                              value={groupPickerByUser[user.id] || null}
                              onChange={(value) => setGroupPickerByUser((prev) => ({ ...prev, [user.id]: value ?? '' }))}
                              data={availableGroups.map((group) => ({ value: group.id, label: group.name }))}
                              searchable
                              clearable
                              w={170}
                            />
                            <Button
                              variant="default"
                              size="xs"
                              leftSection={<Link2 size={12} />}
                              disabled={!groupPickerByUser[user.id] || assignUserGroup.isPending}
                              onClick={() => assignUserGroup.mutate({ userId: user.id, groupId: groupPickerByUser[user.id] })}
                            >
                              Add
                            </Button>
                          </Group>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {user.active ? (
                          <Badge variant="light" color="green">Active</Badge>
                        ) : (
                          <Badge variant="light" color="red">Inactive</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Reset password">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => handleOpenReset(user)}
                              disabled={resetUserPassword.isPending}
                              aria-label="Reset password"
                            >
                              <KeyRound size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit user">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => handleEdit(user)}
                              disabled={updateUser.isPending}
                              aria-label="Edit user"
                            >
                              <Pencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={user.active ? 'Deactivate' : 'Activate'}>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => handleToggleActive(user)}
                              disabled={updateUser.isPending}
                              aria-label={user.active ? 'Deactivate' : 'Activate'}
                            >
                              {user.active ? <UserCheck size={16} /> : <UserX size={16} />}
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete user">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDelete(user.id, user.email)}
                              disabled={deleteUser.isPending}
                              aria-label="Delete user"
                            >
                              <Trash2 size={16} />
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

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New User">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Input.Wrapper label="Apps" style={{ gridRow: 'span 2' }}>
              <CheckList>
                {(apps as AppItem[]).length === 0 && <CheckListEmpty>No apps available</CheckListEmpty>}
                {(apps as AppItem[]).map((app) => (
                  <CheckListItem
                    key={app.id}
                    checked={formData.appIds.includes(app.id)}
                    onChange={() => toggleAppId(app.id, 'create')}
                    label={app.name}
                  />
                ))}
              </CheckList>
            </Input.Wrapper>
            <TextInput label="First Name" value={formData.givenName} onChange={e => { const v = e.currentTarget.value; setFormData(f => ({ ...f, givenName: v })) }} placeholder="Jane" />
            <TextInput label="Last Name" value={formData.familyName} onChange={e => { const v = e.currentTarget.value; setFormData(f => ({ ...f, familyName: v })) }} placeholder="Doe" />
          </SimpleGrid>
          <TextInput label="Email Address" type="email" value={formData.email} onChange={e => { const v = e.currentTarget.value; setFormData(f => ({ ...f, email: v })) }} placeholder="jane@example.com" />
          <TextInput label="Username" value={formData.username} onChange={e => { const v = e.currentTarget.value; setFormData(f => ({ ...f, username: v })) }} ff="monospace" placeholder="janedoe" />
          <PasswordInput label="Password" value={formData.password} onChange={e => { const v = e.currentTarget.value; setFormData(f => ({ ...f, password: v })) }} placeholder="Min 8 characters" />
          <ImageField
            label="Profile Picture"
            value={formData.avatarUrl}
            onChange={(avatarUrl) => setFormData((f) => ({ ...f, avatarUrl }))}
            urlPlaceholder="/media/defaults/user/initials.svg or https://…"
            defaultImages={(createDefaultAvatars as any)?.items ?? []}
            onUpload={async (file) => setFormData((f) => ({ ...f, avatarFile: file }))}
            uploadHint={formData.avatarFile ? `Selected: ${(formData as any).avatarFile.name}. Uploads when the user is created.` : undefined}
          />
          <Input.Wrapper label="Custom Attributes" error={createFormError || undefined}>
            <Stack gap="xs">
              {Object.entries(formData.customAttributes).length === 0 ? (
                <Text size="xs" c="dimmed">No attributes selected</Text>
              ) : (
                Object.entries(formData.customAttributes).map(([key, value]) => {
                  const attribute = attributeByKey.get(key)
                  const systemManaged = SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(key)
                  return (
                    <AttributeEditorCard
                      key={key}
                      name={attribute?.name ?? key}
                      attrKey={key}
                      removable={!systemManaged}
                      onRemove={() => removeAttribute('create', key)}
                    >
                      <AttributeValueField
                        attribute={attribute}
                        value={value}
                        readOnly={systemManaged}
                        onChange={(nextValue) => updateAttributeValue('create', key, nextValue)}
                      />
                    </AttributeEditorCard>
                  )
                })
              )}
              <Group gap="xs" wrap="nowrap">
                <Select
                  aria-label="Add attribute"
                  placeholder="Add attribute..."
                  value={attributePicker.create || null}
                  onChange={(value) => setAttributePicker((prev) => ({ ...prev, create: value ?? '' }))}
                  data={enabledAttributeDefinitions
                    .filter((attribute) => !(attribute.key in formData.customAttributes) && !SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(attribute.key))
                    .map((attribute) => ({ value: attribute.key, label: attribute.name }))}
                  searchable
                  clearable
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  onClick={() => addAttribute('create')}
                  disabled={!attributePicker.create}
                  variant="default"
                >
                  Add
                </Button>
              </Group>
            </Stack>
          </Input.Wrapper>
          <Input.Wrapper label="Groups">
            <CheckList>
              {(groups as GroupItem[]).length === 0 && <CheckListEmpty>No groups available</CheckListEmpty>}
              {(groups as GroupItem[]).map((group) => (
                <CheckListItem
                  key={group.id}
                  checked={formData.groupIds.includes(group.id)}
                  onChange={() => toggleCreateGroup(group.id)}
                  label={group.name}
                />
              ))}
            </CheckList>
          </Input.Wrapper>
          <Input.Wrapper label="Roles">
            <CheckList>
              {(roles as RoleItem[]).length === 0 && <CheckListEmpty>No roles available</CheckListEmpty>}
              {(roles as RoleItem[]).map((role) => (
                <CheckListItem
                  key={role.id}
                  checked={formData.roleIds.includes(role.id)}
                  onChange={() => toggleCreateRole(role.id)}
                  label={role.name}
                />
              ))}
            </CheckList>
          </Input.Wrapper>
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setCreateModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createUser.isPending}
              disabled={!formData.email || !formData.username || !formData.password}
            >
              Create User
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit User${userToEdit ? `: ${userToEdit.email}` : ''}`}>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Stack gap="xs" style={{ gridRow: 'span 2' }}>
              <Input.Wrapper label="Direct Apps">
                <CheckList>
                  {(apps as AppItem[]).length === 0 && <CheckListEmpty>No apps available</CheckListEmpty>}
                  {(apps as AppItem[]).map((app) => (
                    <CheckListItem
                      key={app.id}
                      checked={editFormData.appIds.includes(app.id)}
                      onChange={() => toggleAppId(app.id, 'edit')}
                      label={app.name}
                    />
                  ))}
                </CheckList>
              </Input.Wrapper>
              {userToEdit && (userToEdit.inheritedAppIds ?? []).length > 0 && (
                <Paper withBorder radius="md" p="sm" style={{ borderStyle: 'dashed' }}>
                  <Text size="xs" fw={600} c="dimmed" mb="xs">Inherited Apps</Text>
                  <Stack gap={6}>
                    {(userToEdit.inheritedAppIds ?? []).map((appId) => {
                      const sourceGroupNames = Array.from(
                        new Set(
                          (userToEdit.inheritedAppSources ?? [])
                            .filter((source) => source.appId === appId)
                            .map((source) => source.groupName)
                        )
                      )
                      return (
                        <Group key={appId} gap={6}>
                          <Text size="xs" fw={500}>{appNameById.get(appId) ?? appId}</Text>
                          <Text size="xs" c="dimmed">from</Text>
                          {sourceGroupNames.length === 0 ? (
                            <Badge variant="light" color="blue" size="sm" tt="none">group</Badge>
                          ) : (
                            sourceGroupNames.map((groupName) => (
                              <Badge key={groupName} variant="light" color="blue" size="sm" tt="none">{groupName}</Badge>
                            ))
                          )}
                        </Group>
                      )
                    })}
                  </Stack>
                  <Text size="xs" c="dimmed" mt="xs">Inherited apps cannot be removed here. Remove the user from the source group or unassign the app from that group instead.</Text>
                </Paper>
              )}
            </Stack>
            <TextInput label="First Name" value={editFormData.givenName} onChange={e => { const v = e.currentTarget.value; setEditFormData(f => ({ ...f, givenName: v })) }} placeholder="Jane" />
            <TextInput label="Last Name" value={editFormData.familyName} onChange={e => { const v = e.currentTarget.value; setEditFormData(f => ({ ...f, familyName: v })) }} placeholder="Doe" />
          </SimpleGrid>
          <TextInput label="Email Address" type="email" value={editFormData.email} onChange={e => { const v = e.currentTarget.value; setEditFormData(f => ({ ...f, email: v })) }} placeholder="jane@example.com" />
          <TextInput label="Username" value={editFormData.username} onChange={e => { const v = e.currentTarget.value; setEditFormData(f => ({ ...f, username: v })) }} ff="monospace" placeholder="janedoe" />
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
          <Input.Wrapper label="Direct Custom Attributes" error={editFormError || undefined}>
            <Stack gap="xs">
              {Object.entries(editFormData.customAttributes).length === 0 ? (
                <Text size="xs" c="dimmed">No direct attributes selected</Text>
              ) : (
                Object.entries(editFormData.customAttributes).map(([key, value]) => {
                  const attribute = attributeByKey.get(key)
                  const systemManaged = SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(key)
                  return (
                    <AttributeEditorCard
                      key={key}
                      name={attribute?.name ?? key}
                      attrKey={key}
                      removable={!systemManaged}
                      onRemove={() => removeAttribute('edit', key)}
                    >
                      <AttributeValueField
                        attribute={attribute}
                        value={value}
                        readOnly={systemManaged}
                        onChange={(nextValue) => updateAttributeValue('edit', key, nextValue)}
                      />
                      {systemManaged ? (
                        <Text size="xs" c="dimmed" mt={4}>Updated automatically from the server when the password changes.</Text>
                      ) : null}
                    </AttributeEditorCard>
                  )
                })
              )}
              <Group gap="xs" wrap="nowrap">
                <Select
                  aria-label="Add attribute"
                  placeholder="Add attribute..."
                  value={attributePicker.edit || null}
                  onChange={(value) => setAttributePicker((prev) => ({ ...prev, edit: value ?? '' }))}
                  data={enabledAttributeDefinitions
                    .filter((attribute) => !(attribute.key in editFormData.customAttributes) && !SYSTEM_MANAGED_ATTRIBUTE_KEYS.has(attribute.key))
                    .map((attribute) => ({ value: attribute.key, label: attribute.name }))}
                  searchable
                  clearable
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  onClick={() => addAttribute('edit')}
                  disabled={!attributePicker.edit}
                  variant="default"
                >
                  Add
                </Button>
              </Group>
              {userToEdit && userToEdit.inheritedCustomAttributes && Object.keys(userToEdit.inheritedCustomAttributes).length > 0 && (
                <Paper withBorder radius="md" p="sm" style={{ borderStyle: 'dashed' }}>
                  <Text size="xs" fw={600} c="dimmed" mb="xs">Inherited From Groups</Text>
                  <Stack gap={4}>
                    {Object.entries(userToEdit.inheritedCustomAttributes).map(([key, value]) => (
                      <Text key={key} size="xs" c="dimmed">
                        <Text span size="xs" fw={500} c="var(--mantine-color-text)">{attributeByKey.get(key)?.name ?? key}</Text>: {value}
                      </Text>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Input.Wrapper>
          <Input.Wrapper label="Groups">
            <Stack gap="xs">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Search Groups"
                  size="xs"
                  value={editGroupSearch}
                  onChange={(e) => setEditGroupSearch(e.currentTarget.value)}
                  placeholder="Search by group or app name…"
                />
                <Select
                  label="Filter by App"
                  size="xs"
                  value={editGroupAppFilter}
                  onChange={(value) => setEditGroupAppFilter(value ?? 'all')}
                  data={editAppFilterData}
                  allowDeselect={false}
                  searchable
                />
              </SimpleGrid>
              <Text size="xs" c="dimmed">
                {groupOptions.length === 0
                  ? 'No groups available'
                  : filteredEditGroups.length === 0
                    ? 'No matching groups'
                    : `Showing ${filteredEditGroups.length} of ${groupOptions.length} groups · ${editFormData.groupIds.length} selected`}
              </Text>
              <CheckList>
                {groupOptions.length === 0 ? (
                  <CheckListEmpty>No groups available</CheckListEmpty>
                ) : filteredEditGroups.length === 0 ? (
                  <CheckListEmpty>No groups match the current filters</CheckListEmpty>
                ) : (
                  filteredEditGroups.map((group) => {
                    const groupAppIds = resolveGroupAppIds(group)
                    const appLabel = groupAppIds.length === 0
                      ? 'No App'
                      : groupAppIds.map((id) => appNameById.get(id) ?? id).join(', ')
                    return (
                      <CheckListItem
                        key={group.id}
                        checked={editFormData.groupIds.includes(group.id)}
                        onChange={() => toggleEditGroup(group.id)}
                        label={group.name}
                        badge={
                          <Badge variant="light" color={groupAppIds.length > 0 ? undefined : 'gray'} size="sm" tt="none" maw={200}>
                            {appLabel}
                          </Badge>
                        }
                      />
                    )
                  })
                )}
              </CheckList>
            </Stack>
          </Input.Wrapper>
          <Input.Wrapper label="Roles">
            <Stack gap="xs">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Search Roles"
                  size="xs"
                  value={editRoleSearch}
                  onChange={(e) => setEditRoleSearch(e.currentTarget.value)}
                  placeholder="Search by role or app name…"
                />
                <Select
                  label="Filter by App"
                  size="xs"
                  value={editRoleAppFilter}
                  onChange={(value) => setEditRoleAppFilter(value ?? 'all')}
                  data={editAppFilterData}
                  allowDeselect={false}
                  searchable
                />
              </SimpleGrid>
              <Text size="xs" c="dimmed">
                {roleOptions.length === 0
                  ? 'No roles available'
                  : filteredEditRoles.length === 0
                    ? 'No matching roles'
                    : `Showing ${filteredEditRoles.length} of ${roleOptions.length} roles · ${editFormData.roleIds.length} selected`}
              </Text>
              <CheckList>
                {roleOptions.length === 0 ? (
                  <CheckListEmpty>No roles available</CheckListEmpty>
                ) : filteredEditRoles.length === 0 ? (
                  <CheckListEmpty>No roles match the current filters</CheckListEmpty>
                ) : (
                  filteredEditRoles.map((role) => {
                    const appName = role.appId ? appNameById.get(role.appId) : null
                    return (
                      <CheckListItem
                        key={role.id}
                        checked={editFormData.roleIds.includes(role.id)}
                        onChange={() => toggleEditRole(role.id)}
                        label={role.name}
                        badge={
                          <Badge variant="light" color={appName ? undefined : 'gray'} size="sm" tt="none" maw={200}>
                            {appName ?? 'No App'}
                          </Badge>
                        }
                      />
                    )
                  })
                )}
              </CheckList>
            </Stack>
          </Input.Wrapper>
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setEditModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              loading={updateUser.isPending}
              disabled={!editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title={`Reset Password${userToReset ? `: ${userToReset.email}` : ''}`}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Set a new password for this user. Existing sessions for this user will be revoked immediately.
          </Text>
          <PasswordInput
            label="New Password"
            value={resetFormData.password}
            onChange={(e) => { const v = e.currentTarget.value; setResetFormData((f) => ({ ...f, password: v })) }}
            placeholder="Min 8 characters"
          />
          <PasswordInput
            label="Confirm Password"
            value={resetFormData.confirmPassword}
            onChange={(e) => { const v = e.currentTarget.value; setResetFormData((f) => ({ ...f, confirmPassword: v })) }}
            placeholder="Repeat new password"
          />
          {resetFormError && <Alert color="red" variant="light">{resetFormError}</Alert>}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setResetModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              loading={resetUserPassword.isPending}
              disabled={!resetFormData.password || !resetFormData.confirmPassword}
            >
              Reset Password
            </Button>
          </Group>
        </Stack>
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
        <Stack gap="md">
          <Text size="sm">
            Permanently delete <Text span fw={600}>{selectedUserIds.length}</Text> {pluralUsers(selectedUserIds.length)}? This action cannot be undone.
          </Text>
          {bulkError && <Alert color="red" variant="light">{bulkError}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button color="red" onClick={handleBulkDeleteUsers} loading={bulkPending} disabled={selectedUserIds.length === 0}>
              {`Delete ${selectedUserIds.length} User${selectedUserIds.length === 1 ? '' : 's'}`}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        isOpen={bulkActiveAction !== null}
        onClose={closeBulkModals}
        title={bulkActiveAction === 'activate' ? 'Activate Selected Users' : 'Deactivate Selected Users'}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            {bulkActiveAction === 'activate' ? 'Activate' : 'Deactivate'} the {selectedUserIds.length} selected {pluralUsers(selectedUserIds.length)}?
            {bulkActiveAction === 'deactivate' && ' Existing sessions for these users will continue until expiry but new sign-ins will be blocked.'}
          </Text>
          {bulkError && <Alert color="red" variant="light">{bulkError}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSetActive}
              loading={bulkPending}
              disabled={selectedUserIds.length === 0}
            >
              {bulkActiveAction === 'activate' ? 'Activate Users' : 'Deactivate Users'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        isOpen={bulkGroupAction !== null}
        onClose={closeBulkModals}
        title={bulkGroupAction === 'add' ? 'Add Selected Users to Group' : 'Remove Selected Users from Group'}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {bulkGroupAction === 'add' ? 'Assign' : 'Remove'} the {selectedUserIds.length} selected {pluralUsers(selectedUserIds.length)} {bulkGroupAction === 'add' ? 'to' : 'from'} a group.
          </Text>
          <Select
            label="Group"
            placeholder="Select a group…"
            value={bulkGroupId || null}
            onChange={(value) => setBulkGroupId(value ?? '')}
            data={(groups as GroupItem[]).map((group) => ({ value: group.id, label: group.name }))}
            searchable
          />
          {bulkError && <Alert color="red" variant="light">{bulkError}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkGroup}
              loading={bulkPending}
              disabled={!bulkGroupId}
            >
              {bulkGroupAction === 'add' ? 'Add to Group' : 'Remove from Group'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        isOpen={bulkRoleAction !== null}
        onClose={closeBulkModals}
        title={bulkRoleAction === 'add' ? 'Assign Role to Selected Users' : 'Remove Role from Selected Users'}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {bulkRoleAction === 'add' ? 'Assign' : 'Remove'} a role {bulkRoleAction === 'add' ? 'to' : 'from'} the {selectedUserIds.length} selected {pluralUsers(selectedUserIds.length)}. Only direct role assignments are affected; roles inherited via groups are not changed.
          </Text>
          <Select
            label="Role"
            placeholder="Select a role…"
            value={bulkRoleId || null}
            onChange={(value) => setBulkRoleId(value ?? '')}
            data={(roles as RoleItem[]).map((role) => ({ value: role.id, label: role.name }))}
            searchable
          />
          {bulkError && <Alert color="red" variant="light">{bulkError}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeBulkModals} disabled={bulkPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkRole}
              loading={bulkPending}
              disabled={!bulkRoleId}
            >
              {bulkRoleAction === 'add' ? 'Assign Role' : 'Remove Role'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

export default Users
