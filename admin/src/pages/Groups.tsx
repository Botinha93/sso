import { Link2, Pencil, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useAssignRoleToGroup,
  useCreateGroup,
  useDeleteGroup,
  useApps,
  useGroups,
  useRemoveRoleFromGroup,
  useUpdateGroup,
  useUserAttributes,
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
  const [rolePickerByGroup, setRolePickerByGroup] = useState<Record<string, string>>({})
  const [attributePicker, setAttributePicker] = useState<{ create: string; edit: string }>({ create: '', edit: '' })

  const { data: groups = [], isLoading, refetch } = useGroups()
  const { data: apps = [] } = useApps()
  const { data: roles = [] } = useRoles()
  const { data: attributeDefinitions = [] } = useUserAttributes()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()
  const updateGroup = useUpdateGroup()
  const assignRole = useAssignRoleToGroup()
  const removeRole = useRemoveRoleFromGroup()

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
  }

  const onDeleteGroup = (group: GroupItem) => {
    setGroupToDelete(group)
  }

  const onEditGroup = (group: GroupItem) => {
    setGroupToEdit(group)
    setEditGroupName(group.name)
    setEditGroupDescription(group.description)
    setEditGroupAppIds(group.appIds ?? ((group as any).appId ? [(group as any).appId] : []))
    setEditGroupCustomAttributes(group.customAttributes ?? {})
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
    setEditModalOpen(true)
  }

  const onSaveGroupEdit = async () => {
    if (!groupToEdit || !editGroupName || !editGroupDescription) return
    await updateGroup.mutateAsync({
      id: groupToEdit.id,
      appIds: editGroupAppIds,
      name: editGroupName,
      description: editGroupDescription,
      customAttributes: editGroupCustomAttributes
    })
    setEditModalOpen(false)
    setGroupToEdit(null)
    setAttributePicker((prev) => ({ ...prev, edit: '' }))
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

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="User Groups"
        action={
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-sky-500 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            New Group
          </button>
        }
      />

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
          <h4 className="text-sm font-semibold text-slate-700">All Groups</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            title="No groups created"
            description="Create a group to assign users, roles and attributes in bulk."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGroups.map((group) => {
              const availableRoles = roleOptions.filter((role) => !group.roleIds.includes(role.id))
              const pickerValue = rolePickerByGroup[group.id] ?? availableRoles[0]?.id ?? ''
              return (
                <div key={group.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Users size={14} className="text-slate-500" />
                        </div>
                        <h5 className="text-sm font-medium text-slate-900">{group.name}</h5>
                        {(group.appIds ?? (group.appId ? [group.appId] : [])).length === 0 ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            No Apps
                          </span>
                        ) : (
                          (group.appIds ?? (group.appId ? [group.appId] : [])).map((assignedAppId) => (
                            <span key={assignedAppId} className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {appNameById.get(assignedAppId) ?? 'App'}
                            </span>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{group.description}</p>
                      {group.customAttributes && Object.keys(group.customAttributes).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(group.customAttributes).map(([key, value]) => (
                            <span key={key} className="text-xs px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-mono">
                              {attributeByKey.get(key)?.name ?? key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.roleIds.length === 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-500">No roles</span>
                        )}
                        {group.roleIds.map((roleId) => (
                          <span key={roleId} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-600">
                            {roleNameById.get(roleId) ?? roleId}
                            <button
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => removeRole.mutate({ groupId: group.id, roleId })}
                              title="Remove role"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 max-w-md">
                        <select
                          className={fieldCls}
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
                        </select>
                        <button
                          className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          disabled={!pickerValue || assignRole.isPending}
                          onClick={() => onAttachRole(group)}
                        >
                          <span className="inline-flex items-center gap-1"><Link2 size={12} />Attach</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditGroup(group)}
                        disabled={updateGroup.isPending}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        title="Edit group"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteGroup(group)}
                        disabled={deleteGroup.isPending}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Group">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Apps</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(apps as AppItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No apps available</p>}
              {(apps as AppItem[]).map((app) => (
                <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupAppIds.includes(app.id)}
                    onChange={() => toggleGroupAppId(app.id, 'create')}
                    className="rounded border-slate-300"
                  />
                  {app.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className={fieldCls}
              placeholder="Support Team"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className={fieldCls}
              placeholder="Handles user onboarding and support escalations"
            />
          </div>
          <div>
            <label className={labelCls}>Inherited User Attributes</label>
            <div className="space-y-2">
              {Object.entries(groupCustomAttributes).length === 0 ? (
                <p className="text-xs text-slate-400">No group attributes selected</p>
              ) : (
                Object.entries(groupCustomAttributes).map(([key, value]) => {
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
                    .filter((attribute) => !(attribute.key in groupCustomAttributes))
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
          </div>
          <div>
            <label className={labelCls}>Initial Roles</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-44 overflow-auto space-y-1">
              {roleOptions.length === 0 && <p className="text-xs text-slate-400 px-1 py-1">Create roles first</p>}
              {roleOptions.map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleCreateRole(role.id)}
                    className="rounded border-slate-300"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onCreateGroup}
              disabled={createGroup.isPending || !groupName || !groupDescription}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {createGroup.isPending ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Group${groupToEdit ? `: ${groupToEdit.name}` : ''}`}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Apps</label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
              {(apps as AppItem[]).length === 0 && <p className="text-xs text-slate-400 px-1 py-1">No apps available</p>}
              {(apps as AppItem[]).map((app) => (
                <label key={app.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editGroupAppIds.includes(app.id)}
                    onChange={() => toggleGroupAppId(app.id, 'edit')}
                    className="rounded border-slate-300"
                  />
                  {app.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Group Name</label>
            <input
              type="text"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className={fieldCls}
              placeholder="Support Team"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              value={editGroupDescription}
              onChange={(e) => setEditGroupDescription(e.target.value)}
              className={fieldCls}
              placeholder="Handles user onboarding and support escalations"
            />
          </div>
          <div>
            <label className={labelCls}>Inherited User Attributes</label>
            <div className="space-y-2">
              {Object.entries(editGroupCustomAttributes).length === 0 ? (
                <p className="text-xs text-slate-400">No group attributes selected</p>
              ) : (
                Object.entries(editGroupCustomAttributes).map(([key, value]) => {
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
                    .filter((attribute) => !(attribute.key in editGroupCustomAttributes))
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
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setEditModalOpen(false)}
              className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSaveGroupEdit}
              disabled={updateGroup.isPending || !editGroupName || !editGroupDescription}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {updateGroup.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
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
    </div>
  )
}

export default Groups
