import { ChevronRight, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, useApps, useClients } from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

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

  const toggleResourceAction = (resourceKeys: string[], action: Action) => {
    const next = new Set(set)
    const keys = resourceKeys.map(resourceKey => permKey(resourceKey, action))
    const checked = keys.some(key => next.has(key))
    if (checked) {
      keys.forEach(key => next.delete(key))
    } else if (resourceKeys[0]) {
      next.add(permKey(resourceKeys[0], action))
    }
    onChange(Array.from(next))
  }

  // Combine system resources with app-specific ones.
  // App resource permission key format can be either "{appId}:{resource}:{action}"
  // or legacy "{appSlug}:{resource}:{action}" (for bootstrap-seeded roles).
  const allResources = [
    ...SYSTEM_RESOURCES.map(resource => ({
      keyVariants: [resource.key],
      label: resource.label,
      groupKey: '__system__',
      groupLabel: 'System',
      isSystem: true,
    })),
    ...appResources.map(ar => ({
      keyVariants: uniqueNonEmpty([
        `${ar.appId}:${ar.resource}`,
        ar.appSlug ? `${ar.appSlug}:${ar.resource}` : undefined,
        `${normalizePermissionPrefix(ar.appName)}:${ar.resource}`,
      ]),
      label: ar.resource,
      groupKey: ar.appId,
      groupLabel: ar.appName,
      isSystem: false,
    }))
  ]

  function toggleRow(resourceKeys: string[]) {
    const allChecked = ACTIONS.every(action => hasResourceAction(resourceKeys, action))
    const next = new Set(set)
    if (allChecked) {
      ACTIONS.forEach(action => resourceKeys.forEach(resourceKey => next.delete(permKey(resourceKey, action))))
    } else if (resourceKeys[0]) {
      ACTIONS.forEach(action => {
        if (!hasResourceAction(resourceKeys, action)) {
          next.add(permKey(resourceKeys[0], action))
        }
      })
    }
    onChange(Array.from(next))
  }

  function toggleCol(action: Action) {
    const allChecked = allResources.every(resource => hasResourceAction(resource.keyVariants, action))
    const next = new Set(set)
    if (allChecked) {
      allResources.forEach(resource => resource.keyVariants.forEach(resourceKey => next.delete(permKey(resourceKey, action))))
    } else {
      allResources.forEach(resource => {
        if (!hasResourceAction(resource.keyVariants, action) && resource.keyVariants[0]) {
          next.add(permKey(resource.keyVariants[0], action))
        }
      })
    }
    onChange(Array.from(next))
  }

  // Group app resources by appId
  const uniqueApps = Array.from(new Set(allResources.filter(r => !r.isSystem).map(r => r.groupKey)))

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left px-3 py-2 font-semibold text-slate-600 border-r border-slate-200 min-w-[160px]">Resource</th>
            {ACTIONS.map(action => (
              <th key={action} className="px-3 py-2 font-semibold text-slate-600 border-r border-slate-200 last:border-r-0 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleCol(action)}>
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* System resources */}
          <tr>
            <td colSpan={ACTIONS.length + 1} className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
              System
            </td>
          </tr>
          {allResources.filter(r => r.isSystem).map((resource, i) => {
            const allChecked = ACTIONS.every(action => hasResourceAction(resource.keyVariants, action))
            return (
              <tr key={resource.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td
                  className="px-3 py-2 font-medium text-slate-700 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleRow(resource.keyVariants)}
                  title="Click to toggle all"
                >
                  <span className={allChecked ? 'text-slate-900 font-semibold' : ''}>{resource.label}</span>
                </td>
                {ACTIONS.map(action => {
                  const checked = hasResourceAction(resource.keyVariants, action)
                  return (
                    <td key={action} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0">
                      <input type="checkbox" checked={checked} onChange={() => toggleResourceAction(resource.keyVariants, action)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* App-specific resources grouped by app */}
          {uniqueApps.map(appId => {
            const appRows = allResources.filter(r => !r.isSystem && r.groupKey === appId)
            const appName = appRows[0]?.groupLabel ?? appId
            return [
              <tr key={`section-${appId}`}>
                <td colSpan={ACTIONS.length + 1} className="px-3 py-1.5 bg-violet-50 text-[10px] font-bold uppercase tracking-widest text-violet-600 border-b border-violet-100">
                  {appName}
                </td>
              </tr>,
              ...appRows.map((ar, i) => {
                const allChecked = ACTIONS.every(action => hasResourceAction(ar.keyVariants, action))
                return (
                  <tr key={`${appId}:${ar.label}`} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/30'}>
                    <td
                      className="px-3 py-2 font-medium text-slate-700 border-r border-slate-200 cursor-pointer select-none hover:bg-violet-50 transition-colors pl-5"
                      onClick={() => toggleRow(ar.keyVariants)}
                      title="Click to toggle all"
                    >
                      <span className={allChecked ? 'text-slate-900 font-semibold' : ''}>{ar.label}</span>
                    </td>
                    {ACTIONS.map(action => {
                      const checked = hasResourceAction(ar.keyVariants, action)
                      return (
                        <td key={action} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0">
                          <input type="checkbox" checked={checked} onChange={() => toggleResourceAction(ar.keyVariants, action)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            ]
          })}

          {appResources.length === 0 && (
            <tr>
              <td colSpan={ACTIONS.length + 1} className="px-3 py-2 text-xs text-slate-400 italic text-center border-t border-slate-100">
                No app resources defined. Add resources to an app to see them here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
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
  const { data: roles = [], isLoading, isFetching, refetch } = useRoles()
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

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="Roles & Permissions"
        action={
          <Button
            onClick={() => { setCreateFormError(''); setFormData({ ...EMPTY_FORM }); setCreateModalOpen(true) }}
            variant="primary"
            className="h-9 rounded-lg"
          >
            <Plus size={14} />
            New Role
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <label className={labelCls}>Filter by App</label>
        <select className={fieldCls} value={appFilterId} onChange={(e) => setAppFilterId(e.target.value)}>
          <option value="all">All Apps</option>
          <option value="none">Unassigned</option>
          {(apps as any[]).map((app: any) => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Roles</h4>
          <Button onClick={() => refetch()} disabled={isFetching} variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-900">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading && <TableSkeleton rows={4} />}
          {!isLoading && filteredRoles.length === 0 && <EmptyState title="No roles yet" description="Create a role to define a set of permissions." />}
          {filteredRoles.map((role: any) => (
            <div key={role.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium text-slate-900">{role.name}</h5>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">{role.appId ? appNameById.get(role.appId) ?? 'App' : 'No App'}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">{role.scope}</span>
                  </div>
                  <p className="text-xs text-slate-500">{role.description || 'No description'} · <span className="font-medium text-slate-600">{activePermCount(role)} permission{activePermCount(role) !== 1 ? 's' : ''}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  onClick={() => openEdit(role)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100"
                  title="Edit permissions"
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  onClick={() => setRoleToDelete(role)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Create modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Role">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>App</label>
              <select value={formData.appId} onChange={e => setFormData(p => ({ ...p, appId: e.target.value }))} className={fieldCls}>
                <option value="">No app</option>
                {(apps as any[]).map((app: any) => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Role Name</label>
              <Input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="application_user" />
            </div>
            <div>
              <label className={labelCls}>Scope</label>
              <select value={formData.scope} onChange={e => setFormData(p => ({ ...p, scope: e.target.value as any }))} className={fieldCls}>
                <option value="platform">Platform</option>
                <option value="tenant">Tenant</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <Input type="text" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className={fieldCls} placeholder="Role description" />
          </div>
          <div>
            <label className={labelCls}>Permissions <span className="text-slate-400 normal-case font-normal">(click header to toggle column, resource name to toggle row)</span></label>
            <PermissionMatrix permissions={formData.permissions} onChange={perms => setFormData(p => ({ ...p, permissions: perms }))} appResources={appResources} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setCreateModalOpen(false)} variant="secondary" className="h-9 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createRole.isPending || !formData.name || !formData.permissions.length}
              variant="primary"
              className="h-9 rounded-lg"
            >
              {createRole.isPending ? 'Creating…' : 'Create Role'}
            </Button>
          </div>
          {createFormError && <p className="text-xs text-red-600">{createFormError}</p>}
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editRole} onClose={() => setEditRole(null)} title={`Edit Role: ${editRole?.name ?? ''}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>App</label>
              <select value={formData.appId} onChange={e => setFormData(p => ({ ...p, appId: e.target.value }))} className={fieldCls}>
                <option value="">No app</option>
                {(apps as any[]).map((app: any) => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Role Name</label>
              <Input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`${fieldCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Scope</label>
              <select value={formData.scope} onChange={e => setFormData(p => ({ ...p, scope: e.target.value as any }))} className={fieldCls}>
                <option value="platform">Platform</option>
                <option value="tenant">Tenant</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <Input type="text" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Permissions</label>
            <PermissionMatrix permissions={formData.permissions} onChange={perms => setFormData(p => ({ ...p, permissions: perms }))} appResources={appResources} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setEditRole(null)} variant="secondary" className="h-9 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateRole.isPending || !formData.name}
              variant="primary"
              className="h-9 rounded-lg"
            >
              {updateRole.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
          {editFormError && <p className="text-xs text-red-600">{editFormError}</p>}
        </div>
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
    </div>
  )
}

export default Roles
