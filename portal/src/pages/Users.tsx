import { ArrowLeft, Loader2, Trash2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
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
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

interface Props {
  currentUser: PortalUser
}

const fieldCls = 'h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

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
      setCreateError('Please fill all required fields.')
      return
    }

    try {
      await createUser.mutateAsync(createForm)
      setCreateForm(emptyForm)
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create user')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft size={15} />
            Back to apps
          </Link>
          <h1 className="text-sm font-semibold text-slate-900">User Management</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {canEditUsers && (
          <Card className="rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-slate-600" />
              <h2 className="text-sm font-semibold text-slate-900">Create user</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Email</label>
                <Input className={fieldCls} value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <Input className={fieldCls} value={createForm.username} onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>First name</label>
                <Input className={fieldCls} value={createForm.givenName} onChange={(e) => setCreateForm((p) => ({ ...p, givenName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Last name</label>
                <Input className={fieldCls} value={createForm.familyName} onChange={(e) => setCreateForm((p) => ({ ...p, familyName: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Temporary password</label>
                <Input type="password" className={fieldCls} value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Direct roles</label>
                <div className="rounded-xl border border-slate-200 p-2 max-h-40 overflow-auto space-y-1">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={createForm.roleIds.includes(role.id)}
                        onChange={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            roleIds: prev.roleIds.includes(role.id)
                              ? prev.roleIds.filter((id) => id !== role.id)
                              : [...prev.roleIds, role.id]
                          }))
                        }
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Groups</label>
                <div className="rounded-xl border border-slate-200 p-2 max-h-40 overflow-auto space-y-1">
                  {groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={createForm.groupIds.includes(group.id)}
                        onChange={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            groupIds: prev.groupIds.includes(group.id)
                              ? prev.groupIds.filter((id) => id !== group.id)
                              : [...prev.groupIds, group.id]
                          }))
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {createError ? <p className="text-sm text-rose-600">{createError}</p> : null}

            <div>
              <Button onClick={handleCreate} disabled={createUser.isPending}>
                {createUser.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Create user
              </Button>
            </div>
          </Card>
        )}

        <Card className="rounded-2xl p-5">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end">
            <div className="flex-1 min-w-0">
              <label className={labelCls}>Search</label>
              <Input
                className={fieldCls}
                placeholder="username or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="sm:w-52">
              <label className={labelCls}>Role</label>
              <select className={fieldCls} value={roleFilterId} onChange={(e) => setRoleFilterId(e.target.value)}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-52">
              <label className={labelCls}>Group</label>
              <select className={fieldCls} value={groupFilterId} onChange={(e) => setGroupFilterId(e.target.value)}>
                <option value="">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSearchTerm('')
                  setRoleFilterId('')
                  setGroupFilterId('')
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-6 flex items-center justify-center text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-rose-600">Failed to load users.</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : (
            <div className="space-y-3">
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
                    if (!confirm(`Delete user ${user.username}?`)) return
                    await deleteUser.mutateAsync(user.id)
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
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
  }
  roles: Array<{ id: string; name: string }>
  groups: Array<{ id: string; name: string }>
  canEditUsers: boolean
  onToggleActive: (active: boolean) => Promise<unknown>
  onSaveAssignments: (roleIds: string[], groupIds: string[]) => Promise<unknown>
  onDelete: () => Promise<void>
}) {
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
      setError(err?.message ?? 'Failed to update user')
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
      setError(err?.message ?? 'Failed to delete user')
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
      setError(err?.message ?? 'Failed to update assignments')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{user.givenName} {user.familyName}</p>
          <p className="text-xs text-slate-500">{user.username} · {user.email}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">{user.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${user.active ? 'text-emerald-700' : 'text-slate-500'}`}>
            {user.active ? 'Active' : 'Inactive'}
          </span>
          {canEditUsers ? (
            <>
              <Button size="sm" variant="outline" onClick={handleToggle} disabled={busy}>
                {user.active ? 'Disable' : 'Enable'}
              </Button>
              <Button size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
                <Trash2 size={13} />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {canEditUsers ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Direct roles</p>
            <div className="rounded-lg border border-slate-200 p-2 max-h-36 overflow-auto space-y-1">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() =>
                      setSelectedRoleIds((prev) =>
                        prev.includes(role.id) ? prev.filter((id) => id !== role.id) : [...prev, role.id]
                      )
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Groups</p>
            <div className="rounded-lg border border-slate-200 p-2 max-h-36 overflow-auto space-y-1">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() =>
                      setSelectedGroupIds((prev) =>
                        prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                      )
                    }
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" variant="secondary" onClick={handleSaveAssignments} disabled={busy}>
              Save role/group assignments
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
