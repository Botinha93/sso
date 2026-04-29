import { ChevronRight, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
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

function PermissionMatrix({ permissions, onChange, appResources }: {
  permissions: string[]
  onChange: (p: string[]) => void
  appResources: Array<{ appId: string; appName: string; resource: string }>
}) {
  const set = new Set(permissions)

  // Combine system resources with app-specific ones
  const allResources = [
    ...SYSTEM_RESOURCES,
    ...appResources.map(ar => ({
      key: `app:${ar.appId}:${ar.resource}`,
      label: ar.resource,
      appName: ar.appName,
      isAppResource: true
    }))
  ]

  function toggle(key: string) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(Array.from(next))
  }

  function toggleRow(resource: string) {
    const keys = ACTIONS.map(a => permKey(resource, a))
    const allChecked = keys.every(k => set.has(k))
    const next = new Set(set)
    if (allChecked) keys.forEach(k => next.delete(k))
    else keys.forEach(k => next.add(k))
    onChange(Array.from(next))
  }

  function toggleCol(action: Action) {
    const keys = allResources.map(r => permKey(r.key, action))
    const allChecked = keys.every(k => set.has(k))
    const next = new Set(set)
    if (allChecked) keys.forEach(k => next.delete(k))
    else keys.forEach(k => next.add(k))
    onChange(Array.from(next))
  }

  // Group app resources by appId
  const uniqueApps = Array.from(new Set(appResources.map(ar => ar.appId)))

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
          {SYSTEM_RESOURCES.map((resource, i) => {
            const rowKeys = ACTIONS.map(a => permKey(resource.key, a))
            const allChecked = rowKeys.every(k => set.has(k))
            return (
              <tr key={resource.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td
                  className="px-3 py-2 font-medium text-slate-700 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleRow(resource.key)}
                  title="Click to toggle all"
                >
                  <span className={allChecked ? 'text-slate-900 font-semibold' : ''}>{resource.label}</span>
                </td>
                {ACTIONS.map(action => {
                  const key = permKey(resource.key, action)
                  const checked = set.has(key)
                  return (
                    <td key={action} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0">
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* App-specific resources grouped by app */}
          {uniqueApps.map(appId => {
            const appName = appResources.find(ar => ar.appId === appId)?.appName ?? appId
            const appRows = appResources.filter(ar => ar.appId === appId)
            return [
              <tr key={`section-${appId}`}>
                <td colSpan={ACTIONS.length + 1} className="px-3 py-1.5 bg-violet-50 text-[10px] font-bold uppercase tracking-widest text-violet-600 border-b border-violet-100">
                  {appName}
                </td>
              </tr>,
              ...appRows.map((ar, i) => {
                const rkey = `app:${ar.appId}:${ar.resource}`
                const rowKeys = ACTIONS.map(a => permKey(rkey, a))
                const allChecked = rowKeys.every(k => set.has(k))
                return (
                  <tr key={rkey} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/30'}>
                    <td
                      className="px-3 py-2 font-medium text-slate-700 border-r border-slate-200 cursor-pointer select-none hover:bg-violet-50 transition-colors pl-5"
                      onClick={() => toggleRow(rkey)}
                      title="Click to toggle all"
                    >
                      <span className={allChecked ? 'text-slate-900 font-semibold' : ''}>{ar.resource}</span>
                    </td>
                    {ACTIONS.map(action => {
                      const key = permKey(rkey, action)
                      const checked = set.has(key)
                      return (
                        <td key={action} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0">
                          <input type="checkbox" checked={checked} onChange={() => toggle(key)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
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
  const { data: roles = [], isLoading, isFetching, refetch } = useRoles()
  const { data: apps = [] } = useApps()
  const { data: clients = [] } = useClients()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const appNameById = new Map((apps as any[]).map((app: any) => [app.id, app.name]))
  const filteredRoles = (roles as any[]).filter((role) => appFilterId === 'all'
    ? true
    : appFilterId === 'none'
      ? !role.appId
      : role.appId === appFilterId)

  // Flatten all app resources for the matrix
  const appResources = (apps as any[]).flatMap((a: any) =>
    (a.resources ?? []).map((r: string) => ({ appId: a.id, appName: a.name, resource: r }))
  ).concat(
    (clients as any[]).flatMap((c: any) =>
      (c.resources ?? []).map((r: string) => ({ clientId: c.id, clientName: c.name, resource: r }))
    )
  )

  function handleCreate() {
    if (!formData.name || !formData.permissions.length) return
    createRole.mutate(formData, {
      onSuccess: () => {
        setCreateModalOpen(false)
        setFormData({ ...EMPTY_FORM })
      }
    })
  }

  function openEdit(role: any) {
    setEditRole(role)
    setFormData({ appId: role.appId ?? '', name: role.name, description: role.description, scope: role.scope, permissions: role.permissions ?? [] })
  }

  function handleUpdate() {
    if (!editRole || !formData.name) return
    const payload: any = { id: editRole.id, ...formData }
    if (payload.permissions && payload.permissions.length === 0) delete payload.permissions
    updateRole.mutate(payload, {
      onSuccess: () => setEditRole(null)
    })
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
          <button
            onClick={() => { setFormData({ ...EMPTY_FORM }); setCreateModalOpen(true) }}
            className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-sky-500 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            New Role
          </button>
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Roles</h4>
          <button onClick={() => refetch()} disabled={isFetching} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
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
                <button
                  onClick={() => openEdit(role)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit permissions"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setRoleToDelete(role)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="application_user" />
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
            <input type="text" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className={fieldCls} placeholder="Role description" />
          </div>
          <div>
            <label className={labelCls}>Permissions <span className="text-slate-400 normal-case font-normal">(click header to toggle column, resource name to toggle row)</span></label>
            <PermissionMatrix permissions={formData.permissions} onChange={perms => setFormData(p => ({ ...p, permissions: perms }))} appResources={appResources} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setCreateModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createRole.isPending || !formData.name || !formData.permissions.length}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {createRole.isPending ? 'Creating…' : 'Create Role'}
            </button>
          </div>
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
              <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`${fieldCls} font-mono`} />
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
            <input type="text" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Permissions</label>
            <PermissionMatrix permissions={formData.permissions} onChange={perms => setFormData(p => ({ ...p, permissions: perms }))} appResources={appResources} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setEditRole(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updateRole.isPending || !formData.name}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {updateRole.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
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
