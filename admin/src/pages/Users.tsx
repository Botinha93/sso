import { KeyRound, Link2, Pencil, Plus, RefreshCw, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  useGroups,
  useAssignUserToGroup,
  useRemoveUserFromGroup
} from '../hooks/useApi'

interface User {
  id: string
  email: string
  username: string
  givenName: string
  familyName: string
  customAttributes?: Record<string, string>
  active: boolean
  roles: string[]
  groups?: string[]
  createdAt: string
}

interface GroupItem {
  id: string
  name: string
}

const defaultForm = () => ({
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  password: '',
  customAttributesJson: '{}',
  groupIds: [] as string[]
})

const defaultEditForm = () => ({
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  customAttributesJson: '{}'
})

const defaultResetForm = () => ({
  password: '',
  confirmPassword: ''
})

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Users = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [userToReset, setUserToReset] = useState<User | null>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null)
  const { data: users, isLoading, refetch } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetUserPassword = useResetUserPassword()
  const { data: groups = [] } = useGroups()
  const assignUserGroup = useAssignUserToGroup()
  const removeUserGroup = useRemoveUserFromGroup()
  const [groupPickerByUser, setGroupPickerByUser] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState(defaultForm)
  const [editFormData, setEditFormData] = useState(defaultEditForm)
  const [resetFormData, setResetFormData] = useState(defaultResetForm)
  const [createFormError, setCreateFormError] = useState<string>('')
  const [editFormError, setEditFormError] = useState<string>('')
  const [resetFormError, setResetFormError] = useState<string>('')

  const handleCreate = async () => {
    if (!formData.email || !formData.username || !formData.password) return

    let parsedAttributes: Record<string, string> = {}
    try {
      const raw = JSON.parse(formData.customAttributesJson || '{}') as Record<string, unknown>
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
          parsedAttributes[key] = value
        }
      }
    } catch {
      setCreateFormError('Custom attributes must be valid JSON object')
      return
    }

    setCreateFormError('')

    await createUser.mutateAsync({
      email: formData.email,
      username: formData.username,
      givenName: formData.givenName,
      familyName: formData.familyName,
      password: formData.password,
      customAttributes: parsedAttributes,
      roleIds: [],
      groupIds: formData.groupIds
    })
    setCreateModalOpen(false)
    setFormData(defaultForm())
  }

  const handleToggleActive = (user: User) => {
    updateUser.mutate({ id: user.id, active: !user.active })
  }

  const handleEdit = (user: User) => {
    setUserToEdit(user)
    setEditFormError('')
    setEditFormData({
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      customAttributesJson: JSON.stringify(user.customAttributes ?? {}, null, 2)
    })
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!userToEdit) return
    if (!editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName) return

    let parsedAttributes: Record<string, string> = {}
    try {
      const raw = JSON.parse(editFormData.customAttributesJson || '{}') as Record<string, unknown>
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
          parsedAttributes[key] = value
        }
      }
    } catch {
      setEditFormError('Custom attributes must be valid JSON object')
      return
    }

    setEditFormError('')
    await updateUser.mutateAsync({
      id: userToEdit.id,
      email: editFormData.email,
      username: editFormData.username,
      givenName: editFormData.givenName,
      familyName: editFormData.familyName,
      customAttributes: parsedAttributes
    })
    setEditModalOpen(false)
    setUserToEdit(null)
    setEditFormData(defaultEditForm())
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Identity Directory</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
        </div>
        <button
          onClick={() => { setFormData(defaultForm()); setCreateModalOpen(true) }}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={14} />
          New User
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Users</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading users…</div>
        ) : !users?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No users registered</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user: User) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{user.givenName} {user.familyName}</p>
                    {!user.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{user.email} · @{user.username}</p>
                  {user.roles.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map(r => (
                        <span key={r} className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">{r}</span>
                      ))}
                    </div>
                  )}
                  {user.customAttributes && Object.keys(user.customAttributes).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(user.customAttributes).map(([key, value]) => (
                        <span key={key} className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-mono">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {(user.groups ?? []).map((groupName) => (
                      <span key={groupName} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                        {groupName}
                        <button
                          className="text-sky-500 hover:text-red-600"
                          onClick={() => {
                            const group = (groups as GroupItem[]).find((g) => g.name === groupName)
                            if (!group) return
                            removeUserGroup.mutate({ userId: user.id, groupId: group.id })
                          }}
                          title="Remove from group"
                        >
                          <X size={11} />
                        </button>
                      </span>
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
                    <button
                      className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      disabled={!groupPickerByUser[user.id] || assignUserGroup.isPending}
                      onClick={() => assignUserGroup.mutate({ userId: user.id, groupId: groupPickerByUser[user.id] })}
                    >
                      <span className="inline-flex items-center gap-1"><Link2 size={11} />Add</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenReset(user)}
                    disabled={resetUserPassword.isPending}
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-700 transition-colors"
                    title="Reset password"
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    onClick={() => handleEdit(user)}
                    disabled={updateUser.isPending}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Edit user"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={updateUser.isPending}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title={user.active ? 'Deactivate' : 'Activate'}
                  >
                    {user.active ? <UserCheck size={14} /> : <UserX size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.email)}
                    disabled={deleteUser.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete user"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New User">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name</label>
              <input type="text" value={formData.givenName} onChange={e => setFormData(f => ({ ...f, givenName: e.target.value }))} className={fieldCls} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" value={formData.familyName} onChange={e => setFormData(f => ({ ...f, familyName: e.target.value }))} className={fieldCls} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} className={fieldCls} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="janedoe" />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input type="password" value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} className={fieldCls} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className={labelCls}>Custom Attributes (JSON)</label>
            <textarea
              value={formData.customAttributesJson}
              onChange={e => setFormData(f => ({ ...f, customAttributesJson: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[88px] font-mono"
              placeholder='{"department":"engineering","region":"eu-west"}'
            />
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
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setCreateModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createUser.isPending || !formData.email || !formData.username || !formData.password}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {createUser.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit User${userToEdit ? `: ${userToEdit.email}` : ''}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name</label>
              <input type="text" value={editFormData.givenName} onChange={e => setEditFormData(f => ({ ...f, givenName: e.target.value }))} className={fieldCls} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" value={editFormData.familyName} onChange={e => setEditFormData(f => ({ ...f, familyName: e.target.value }))} className={fieldCls} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={editFormData.email} onChange={e => setEditFormData(f => ({ ...f, email: e.target.value }))} className={fieldCls} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={editFormData.username} onChange={e => setEditFormData(f => ({ ...f, username: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="janedoe" />
          </div>
          <div>
            <label className={labelCls}>Custom Attributes (JSON)</label>
            <textarea
              value={editFormData.customAttributesJson}
              onChange={e => setEditFormData(f => ({ ...f, customAttributesJson: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[88px] font-mono"
              placeholder='{"department":"engineering","region":"eu-west"}'
            />
            {editFormError && <p className="mt-1 text-xs text-red-600">{editFormError}</p>}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setEditModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={updateUser.isPending || !editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? 'Saving…' : 'Save Changes'}
            </button>
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
            <input
              type="password"
              value={resetFormData.password}
              onChange={(e) => setResetFormData((f) => ({ ...f, password: e.target.value }))}
              className={fieldCls}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className={labelCls}>Confirm Password</label>
            <input
              type="password"
              value={resetFormData.confirmPassword}
              onChange={(e) => setResetFormData((f) => ({ ...f, confirmPassword: e.target.value }))}
              className={fieldCls}
              placeholder="Repeat new password"
            />
          </div>
          {resetFormError && <p className="text-xs text-red-600">{resetFormError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setResetModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resetUserPassword.isPending || !resetFormData.password || !resetFormData.confirmPassword}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {resetUserPassword.isPending ? 'Resetting…' : 'Reset Password'}
            </button>
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
    </div>
  )
}

export default Users
