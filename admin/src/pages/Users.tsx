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
  useApps,
  useGroups,
  useUserAttributes,
  useAssignUserToGroup,
  useRemoveUserFromGroup
} from '../hooks/useApi'

interface User {
  id: string
  appId?: string
  appIds?: string[]
  directAppIds?: string[]
  inheritedAppIds?: string[]
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
  groups?: string[]
  createdAt: string
}

interface GroupItem {
  id: string
  name: string
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

const defaultForm = () => ({
  appIds: [] as string[],
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  password: '',
  customAttributes: {} as Record<string, string>,
  groupIds: [] as string[]
})

const defaultEditForm = () => ({
  appIds: [] as string[],
  email: '',
  username: '',
  givenName: '',
  familyName: '',
  customAttributes: {} as Record<string, string>
})

const defaultResetForm = () => ({
  password: '',
  confirmPassword: ''
})

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
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
    return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls} />
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
    <input
      type={attribute?.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={fieldCls}
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
  const { data: users, isLoading, refetch } = useUsers()
  const { data: apps = [] } = useApps()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetUserPassword = useResetUserPassword()
  const { data: groups = [] } = useGroups()
  const { data: attributeDefinitions = [] } = useUserAttributes()
  const assignUserGroup = useAssignUserToGroup()
  const removeUserGroup = useRemoveUserFromGroup()
  const [groupPickerByUser, setGroupPickerByUser] = useState<Record<string, string>>({})
  const [attributePicker, setAttributePicker] = useState<{ create: string; edit: string }>({ create: '', edit: '' })
  const [formData, setFormData] = useState(defaultForm)
  const [editFormData, setEditFormData] = useState(defaultEditForm)
  const [resetFormData, setResetFormData] = useState(defaultResetForm)
  const [createFormError, setCreateFormError] = useState<string>('')
  const [editFormError, setEditFormError] = useState<string>('')
  const [resetFormError, setResetFormError] = useState<string>('')
  const [appFilterId, setAppFilterId] = useState<string>('all')

  const appNameById = new Map((apps as AppItem[]).map((a) => [a.id, a.name]))
  const enabledAttributeDefinitions = (attributeDefinitions as UserAttributeDefinition[]).filter((attribute) => attribute.enabled)
  const attributeByKey = new Map(enabledAttributeDefinitions.map((attribute) => [attribute.key, attribute]))
  const filteredUsers = (users as User[] | undefined)?.filter((user) => {
    const userAppIds = user.appIds ?? (user.appId ? [user.appId] : [])
    const appMatches = appFilterId === 'all' ? true : appFilterId === 'none' ? userAppIds.length === 0 : userAppIds.includes(appFilterId)
    return appMatches && !user.isServiceUser
  })

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

    await createUser.mutateAsync({
      appIds: formData.appIds,
      isServiceUser: false,
      email: formData.email,
      username: formData.username,
      givenName: formData.givenName,
      familyName: formData.familyName,
      password: formData.password,
      customAttributes: formData.customAttributes,
      roleIds: [],
      groupIds: formData.groupIds
    })
    setCreateModalOpen(false)
    setAttributePicker((prev) => ({ ...prev, create: '' }))
    setFormData(defaultForm())
  }

  const handleToggleActive = (user: User) => {
    updateUser.mutate({ id: user.id, active: !user.active })
  }

  const handleEdit = (user: User) => {
    setUserToEdit(user)
    setEditFormError('')
    setEditFormData({
      appIds: user.directAppIds ?? user.appIds ?? (user.appId ? [user.appId] : []),
      isServiceUser: Boolean(user.isServiceUser),
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      customAttributes: user.directCustomAttributes ?? {}
    })
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!userToEdit) return
    if (!editFormData.email || !editFormData.username || !editFormData.givenName || !editFormData.familyName) return

    setEditFormError('')
    await updateUser.mutateAsync({
      id: userToEdit.id,
      appIds: editFormData.appIds,
      isServiceUser: false,
      email: editFormData.email,
      username: editFormData.username,
      givenName: editFormData.givenName,
      familyName: editFormData.familyName,
      customAttributes: editFormData.customAttributes
    })
    setEditModalOpen(false)
    setUserToEdit(null)
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
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

      <div className="mb-4 max-w-sm">
        <label className={labelCls}>Filter by App</label>
        <select className={fieldCls} value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
          <option value="all">All Apps</option>
          <option value="none">Unassigned</option>
          {(apps as AppItem[]).map((app) => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
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
        ) : !filteredUsers?.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">No users registered</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user: User) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{user.givenName} {user.familyName}</p>
                    {(user.appIds ?? (user.appId ? [user.appId] : [])).length === 0 ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        No Apps
                      </span>
                    ) : (
                      (user.appIds ?? (user.appId ? [user.appId] : [])).map((assignedAppId) => (
                        <span key={assignedAppId} className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {appNameById.get(assignedAppId) ?? 'App'}
                          {(user.inheritedAppIds ?? []).includes(assignedAppId) && !(user.directAppIds ?? []).includes(assignedAppId) ? ' via group' : ''}
                        </span>
                      ))
                    )}

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
                          {attributeByKey.get(key)?.name ?? key}: {value}
                          {user.inheritedCustomAttributes?.[key] === value && !user.directCustomAttributes?.[key] ? ' via group' : ''}
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
                        <button
                          type="button"
                          onClick={() => removeAttribute('create', key)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove attribute"
                        >
                          <X size={12} />
                        </button>
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
                <button
                  type="button"
                  onClick={() => addAttribute('create')}
                  disabled={!attributePicker.create}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add
                </button>
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
                <p className="mt-2 text-xs text-slate-500">
                  Inherited from groups: {(userToEdit.inheritedAppIds ?? []).map((appId) => appNameById.get(appId) ?? appId).join(', ')}
                </p>
              )}
            </div>
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
                        <button
                          type="button"
                          onClick={() => removeAttribute('edit', key)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove attribute"
                        >
                          <X size={12} />
                        </button>
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
                <button
                  type="button"
                  onClick={() => addAttribute('edit')}
                  disabled={!attributePicker.edit}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add
                </button>
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
