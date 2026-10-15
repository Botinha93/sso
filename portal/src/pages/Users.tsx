import { Alert, Badge, Box, Button, Center, Checkbox, Group, Loader, NativeSelect, Paper, PasswordInput, ScrollArea, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { PageHeader, SearchInput, SectionCard } from '@nexus/design'
import { Trash2, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { PortalUser } from '../hooks'
import {
  usePortalCreateManagedUser,
  usePortalDeleteManagedUser,
  usePortalGroups,
  usePortalManagedUsers,
  usePortalRoles,
  usePortalUpdateManagedUser,
} from '../hooks'
import PortalShell from '../components/PortalShell'
import { useI18n } from '../i18n'

interface Props {
  currentUser: PortalUser
}

type CreateForm = {
  email: string
  username: string
  givenName: string
  familyName: string
  password: string
  roleIds: string[]
  groupIds: string[]
}

const emptyForm: CreateForm = {
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  password: '',
  roleIds: [],
  groupIds: []
}

export default function Users({ currentUser }: Props) {
  const { t } = useI18n()
  const canEditUsers = useMemo(() => {
    const permissions = currentUser.permissions ?? []
    return permissions.includes('*:*') || permissions.includes('users:edit') || permissions.includes('users:create')
  }, [currentUser.permissions])

  const [createForm, setCreateForm] = useState<CreateForm>(emptyForm)
  const [createError, setCreateError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const { data: users = [], isLoading, error } = usePortalManagedUsers(deferredSearch.trim())
  const { data: roles = [] } = usePortalRoles()
  const { data: groups = [] } = usePortalGroups()
  const createUser = usePortalCreateManagedUser()
  const updateUser = usePortalUpdateManagedUser()
  const deleteUser = usePortalDeleteManagedUser()
  const [roleFilterId, setRoleFilterId] = useState('')
  const [groupFilterId, setGroupFilterId] = useState('')

  const groupNameById = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups])

  const filteredUsers = useMemo(() => {
    const groupNameForFilter = groupFilterId ? groupNameById.get(groupFilterId) : undefined

    return users.filter((user) => {
      const matchesRole =
        !roleFilterId ||
        Boolean(user.directRoleIds?.includes(roleFilterId))

      const matchesGroup =
        !groupFilterId ||
        (groupNameForFilter ? Boolean(user.groups?.includes(groupNameForFilter)) : false)

      return matchesRole && matchesGroup
    })
  }, [groupFilterId, groupNameById, roleFilterId, users])

  const handleCreate = async () => {
    setCreateError('')
    if (!createForm.email || !createForm.username || !createForm.givenName || !createForm.familyName || !createForm.password) {
      setCreateError(t('users.errors.requiredFields'))
      return
    }

    try {
      await createUser.mutateAsync(createForm)
      setCreateForm(emptyForm)
    } catch (err: any) {
      setCreateError(err?.message ?? t('users.errors.createFailed'))
    }
  }

  return (
    <PortalShell user={currentUser}>
      <PageHeader mb={0} title={t('users.title')} icon={<UsersIcon size={20} />} />

      {canEditUsers && (
        <SectionCard
          title={t('users.createUser')}
          icon={<UserPlus size={16} />}
          footer={
            <Button onClick={handleCreate} loading={createUser.isPending}>
              {t('users.create')}
            </Button>
          }
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
              <TextInput label={t('users.email')} value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.currentTarget.value }))} />
              <TextInput label={t('users.username')} value={createForm.username} onChange={(e) => setCreateForm((p) => ({ ...p, username: e.currentTarget.value }))} />
              <TextInput label={t('users.firstName')} value={createForm.givenName} onChange={(e) => setCreateForm((p) => ({ ...p, givenName: e.currentTarget.value }))} />
              <TextInput label={t('users.lastName')} value={createForm.familyName} onChange={(e) => setCreateForm((p) => ({ ...p, familyName: e.currentTarget.value }))} />
              <PasswordInput
                label={t('users.temporaryPassword')}
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.currentTarget.value }))}
                style={{ gridColumn: '1 / -1' }}
              />
              <CheckboxList
                label={t('users.directRoles')}
                items={roles}
                value={createForm.roleIds}
                onChange={(roleIds) => setCreateForm((prev) => ({ ...prev, roleIds }))}
              />
              <CheckboxList
                label={t('users.groups')}
                items={groups}
                value={createForm.groupIds}
                onChange={(groupIds) => setCreateForm((prev) => ({ ...prev, groupIds }))}
              />
            </SimpleGrid>

            {createError ? <Alert color="red">{createError}</Alert> : null}
          </Stack>
        </SectionCard>
      )}

      <SectionCard>
        <Stack gap="md">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <SearchInput
              label={t('users.search')}
              placeholder={t('users.searchPlaceholder')}
              value={searchTerm}
              onChange={setSearchTerm}
              style={{ flex: 1, minWidth: 200 }}
            />
            <NativeSelect
              label={t('users.role')}
              w={{ base: '100%', sm: 208 }}
              value={roleFilterId}
              onChange={(e) => setRoleFilterId(e.currentTarget.value)}
              data={[{ value: '', label: t('users.allRoles') }, ...roles.map((role) => ({ value: role.id, label: role.name }))]}
            />
            <NativeSelect
              label={t('users.group')}
              w={{ base: '100%', sm: 208 }}
              value={groupFilterId}
              onChange={(e) => setGroupFilterId(e.currentTarget.value)}
              data={[{ value: '', label: t('users.allGroups') }, ...groups.map((group) => ({ value: group.id, label: group.name }))]}
            />
            <Button
              variant="default"
              w={{ base: '100%', sm: 'auto' }}
              onClick={() => {
                setSearchTerm('')
                setRoleFilterId('')
                setGroupFilterId('')
              }}
            >
              {t('users.clearFilters')}
            </Button>
          </Group>

          {isLoading ? (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          ) : error ? (
            <Alert color="red">{t('users.errors.loadFailed')}</Alert>
          ) : filteredUsers.length === 0 ? (
            <Paper withBorder p="xl" ta="center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
              <Text size="sm" c="dimmed">{t('users.noUsersFound')}</Text>
            </Paper>
          ) : (
            <Stack gap="sm">
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  roles={roles}
                  groups={groups}
                  canEditUsers={canEditUsers}
                  onToggleActive={async (active) => updateUser.mutateAsync({ id: user.id, active })}
                  onSaveAssignments={async (roleIds, groupIds) => updateUser.mutateAsync({ id: user.id, roleIds, groupIds })}
                  onDelete={async () => {
                    if (!confirm(t('users.deleteConfirm', { username: user.username }))) return
                    await deleteUser.mutateAsync(user.id)
                  }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </SectionCard>
    </PortalShell>
  )
}

function CheckboxList({
  label,
  items,
  value,
  onChange,
  size = 'sm',
  mah = 160,
}: {
  label: string
  items: Array<{ id: string; name: string }>
  value: string[]
  onChange: (value: string[]) => void
  size?: 'xs' | 'sm'
  mah?: number
}) {
  return (
    <Checkbox.Group label={label} value={value} onChange={onChange} size={size}>
      <Paper withBorder radius="md" mt={6}>
        <ScrollArea.Autosize mah={mah} p="xs">
          <Stack gap={6}>
            {items.map((item) => (
              <Checkbox key={item.id} value={item.id} label={item.name} size={size} />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Paper>
    </Checkbox.Group>
  )
}

function UserRow({
  user,
  roles,
  groups,
  canEditUsers,
  onToggleActive,
  onSaveAssignments,
  onDelete,
}: {
  user: {
    id: string
    email: string
    username: string
    givenName: string
    familyName: string
    active: boolean
    directRoleIds?: string[]
    groups?: string[]
  }
  roles: Array<{ id: string; name: string }>
  groups: Array<{ id: string; name: string }>
  canEditUsers: boolean
  onToggleActive: (active: boolean) => Promise<unknown>
  onSaveAssignments: (roleIds: string[], groupIds: string[]) => Promise<unknown>
  onDelete: () => Promise<void>
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initialRoleIds = user.directRoleIds ?? []
  const initialGroupIds = (user.groups ?? [])
    .map((groupName) => groups.find((group) => group.name === groupName)?.id)
    .filter((id): id is string => Boolean(id))
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialRoleIds)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialGroupIds)

  useEffect(() => {
    setSelectedRoleIds(initialRoleIds)
    setSelectedGroupIds(initialGroupIds)
  }, [user.directRoleIds, user.groups, groups])

  const handleToggle = async () => {
    setError('')
    setBusy(true)
    try {
      await onToggleActive(!user.active)
    } catch (err: any) {
      setError(err?.message ?? t('users.errors.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setError('')
    setBusy(true)
    try {
      await onDelete()
    } catch (err: any) {
      setError(err?.message ?? t('users.errors.deleteFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAssignments = async () => {
    setError('')
    setBusy(true)
    try {
      await onSaveAssignments(selectedRoleIds, selectedGroupIds)
    } catch (err: any) {
      setError(err?.message ?? t('users.errors.assignmentsFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
        <Box miw={0}>
          <Text size="sm" fw={600}>{user.givenName} {user.familyName}</Text>
          <Text size="xs" c="dimmed">{user.username} · {user.email}</Text>
          <Text size="xs" c="dimmed" ff="monospace" mt={4}>{user.id}</Text>
        </Box>
        <Group gap="xs" wrap="nowrap">
          <Badge color={user.active ? 'green' : 'gray'}>
            {user.active ? t('users.active') : t('users.inactive')}
          </Badge>
          {canEditUsers ? (
            <>
              <Button size="xs" variant="default" onClick={handleToggle} disabled={busy}>
                {user.active ? t('users.disable') : t('users.enable')}
              </Button>
              <Button size="xs" color="red" onClick={handleDelete} disabled={busy} leftSection={<Trash2 size={14} />}>
                {t('users.delete')}
              </Button>
            </>
          ) : null}
        </Group>
      </Group>
      {canEditUsers ? (
        <Stack gap="sm" mt="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <CheckboxList
              label={t('users.directRoles')}
              items={roles}
              value={selectedRoleIds}
              onChange={setSelectedRoleIds}
              size="xs"
              mah={144}
            />
            <CheckboxList
              label={t('users.groups')}
              items={groups}
              value={selectedGroupIds}
              onChange={setSelectedGroupIds}
              size="xs"
              mah={144}
            />
          </SimpleGrid>
          <Group>
            <Button size="xs" variant="default" onClick={handleSaveAssignments} disabled={busy}>
              {t('users.saveAssignments')}
            </Button>
          </Group>
        </Stack>
      ) : null}
      {error ? <Text size="xs" c="red" mt="xs">{error}</Text> : null}
    </Paper>
  )
}
