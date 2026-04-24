import { Boxes, ExternalLink, Globe, Pencil, Plus, RefreshCw, Trash2, Users, Shield, Key, Server } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import {
  useApps, useCreateApp, useDeleteApp, useUpdateApp,
  useUploadAppImage, useDefaultAppImages,
  useUsers, useUpdateUser,
  useGroups, useUpdateGroup,
  useRoles, useUpdateRole,
  useClients, useUpdateClient,
} from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const EMOJI_SUGGESTIONS = ['🚀', '🔐', '📦', '🛡️', '⚙️', '🌐', '📊', '💼', '🔧', '🎯', '📱', '🖥️', '🤖', '🔑', '💡']

interface AppItem {
  id: string
  name: string
  description: string
  icon?: string
  imageUrl?: string
  url?: string
  resources: string[]
  createdAt: string
}

const EMPTY_FORM = { name: '', description: '', icon: '', imageUrl: '', url: '', resources: [] as string[] }

type ComponentTab = 'clients' | 'users' | 'groups' | 'roles'

interface ComponentsManagerProps {
  appId: string
}

const ComponentsManager = ({ appId }: ComponentsManagerProps) => {
  const [tab, setTab] = useState<ComponentTab>('clients')
  const { data: clients = [] } = useClients()
  const { data: users = [] } = useUsers()
  const { data: groups = [] } = useGroups()
  const { data: roles = [] } = useRoles()
  const updateClient = useUpdateClient()
  const updateUser = useUpdateUser()
  const updateGroup = useUpdateGroup()
  const updateRole = useUpdateRole()

  const tabs: { key: ComponentTab; label: string; icon: React.ReactNode }[] = [
    { key: 'clients', label: 'Clients', icon: <Server size={13} /> },
    { key: 'users', label: 'Users', icon: <Users size={13} /> },
    { key: 'groups', label: 'Groups', icon: <Shield size={13} /> },
    { key: 'roles', label: 'Roles', icon: <Key size={13} /> },
  ]

  type AnyItem = { id: string; name?: string; email?: string; appId?: string }

  const getItems = (): AnyItem[] => {
    if (tab === 'clients') return (clients as AnyItem[])
    if (tab === 'users') return (users as AnyItem[])
    if (tab === 'groups') return (groups as AnyItem[])
    return (roles as AnyItem[])
  }

  const toggleAssign = async (item: AnyItem) => {
    const newAppId = item.appId === appId ? undefined : appId
    if (tab === 'clients') await updateClient.mutateAsync({ id: item.id, appId: newAppId })
    else if (tab === 'users') await updateUser.mutateAsync({ id: item.id, appId: newAppId })
    else if (tab === 'groups') await updateGroup.mutateAsync({ id: item.id, appId: newAppId })
    else await updateRole.mutateAsync({ id: item.id, appId: newAppId })
  }

  const items = getItems()
  const assignedIds = new Set(items.filter(i => i.appId === appId).map(i => i.id))

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-slate-100 pb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-7 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No {tab} found</p>
        ) : items.map((item) => {
          const assigned = assignedIds.has(item.id)
          const label = (item as any).username || item.email || item.name || item.id
          return (
            <label
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${assigned ? 'bg-slate-900/5 hover:bg-slate-900/10' : 'hover:bg-slate-50'}`}
            >
              <input
                type="checkbox"
                checked={assigned}
                onChange={() => toggleAssign(item)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 accent-slate-900"
              />
              <span className="text-sm text-slate-800 flex-1">{label}</span>
              {assigned && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">assigned</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

const Apps = () => {
  const { data: apps = [], isLoading, refetch } = useApps()
  const createApp = useCreateApp()
  const updateApp = useUpdateApp()
  const deleteApp = useDeleteApp()
  const uploadAppImage = useUploadAppImage()
  const { data: defaultAppImages } = useDefaultAppImages()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState<'details' | 'components'>('details')
  const [appToEdit, setAppToEdit] = useState<AppItem | null>(null)
  const [appToDelete, setAppToDelete] = useState<AppItem | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const openCreate = () => {
    setFormData(EMPTY_FORM)
    setCreateOpen(true)
  }

  const openEdit = (app: AppItem) => {
    setAppToEdit(app)
    setFormData({ name: app.name, description: app.description, icon: app.icon ?? '', imageUrl: app.imageUrl ?? '', url: app.url ?? '', resources: app.resources ?? [] })
    setEditTab('details')
    setEditOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name) return
    await createApp.mutateAsync({
      name: formData.name,
      description: formData.description,
      icon: formData.icon || undefined,
      imageUrl: formData.imageUrl || undefined,
      url: formData.url || undefined,
      resources: formData.resources,
    })
    setCreateOpen(false)
  }

  const handleUpdate = async () => {
    if (!appToEdit || !formData.name) return
    await updateApp.mutateAsync({
      id: appToEdit.id,
      name: formData.name,
      description: formData.description,
      icon: formData.icon || undefined,
      imageUrl: formData.imageUrl || undefined,
      url: formData.url || null,
      resources: formData.resources,
    })
    setEditOpen(false)
    setAppToEdit(null)
  }

  const confirmDelete = async () => {
    if (!appToDelete) return
    await deleteApp.mutateAsync(appToDelete.id)
    setAppToDelete(null)
  }

  const AppForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-[80px_1fr] gap-3 items-end">
        <div>
          <label className={labelCls}>Preview</label>
          <div
            className="h-12 w-full rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-2xl cursor-text hover:border-slate-400 transition-colors"
            title="Click emoji suggestions to pick"
          >
            {formData.imageUrl ? <img src={formData.imageUrl} alt="app" className="h-full w-full object-cover rounded-xl" /> : (formData.icon || <Boxes size={20} className="text-slate-300" />)}
          </div>
        </div>
        <div>
          <label className={labelCls}>App Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            className={fieldCls}
            placeholder="Internal Portal"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Image URL (optional)</label>
        <input
          type="url"
          value={formData.imageUrl}
          onChange={e => setFormData(p => ({ ...p, imageUrl: e.target.value }))}
          className={fieldCls}
          placeholder="/media/defaults/app/grid.svg"
        />
      </div>

      {appToEdit && (
        <div>
          <label className={labelCls}>Upload Image</label>
          <input
            type="file"
            accept="image/*"
            className={`${fieldCls} pt-1.5`}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file || !appToEdit) return
              const result = await uploadAppImage.mutateAsync({ appId: appToEdit.id, file }) as { imageUrl?: string }
              if (result?.imageUrl) {
                setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }))
              }
            }}
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Default Images</label>
        <div className="flex flex-wrap gap-2">
          {((defaultAppImages as any)?.items ?? []).map((item: any) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, imageUrl: item.url }))}
              className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-slate-300"
              title={item.label}
            >
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
            className="h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
          >
            clear image
          </button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Emoji Suggestions</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_SUGGESTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => setFormData(p => ({ ...p, icon: p.icon === emoji ? '' : emoji }))}
              className={`w-8 h-8 rounded-lg text-base transition-colors hover:bg-slate-100 ${formData.icon === emoji ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}
            >
              {emoji}
            </button>
          ))}
          {formData.icon && !EMOJI_SUGGESTIONS.includes(formData.icon) && (
            <input
              type="text"
              value={formData.icon}
              onChange={e => setFormData(p => ({ ...p, icon: e.target.value.slice(0, 4) }))}
              className="w-20 h-8 rounded-lg border border-slate-200 px-2 text-sm text-center"
              placeholder="custom"
            />
          )}
          <button
            type="button"
            onClick={() => setFormData(p => ({ ...p, icon: '' }))}
            className="h-8 px-2 rounded-lg text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            clear
          </button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          className={fieldCls}
          placeholder="Identity assets for internal portal"
        />
      </div>

      <div>
        <label className={labelCls}>App URL</label>
        <div className="relative">
          <Globe size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="url"
            value={formData.url}
            onChange={e => setFormData(p => ({ ...p, url: e.target.value }))}
            className={`${fieldCls} pl-8`}
            placeholder="https://portal.example.com"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Resources <span className="text-slate-400 normal-case font-normal">(used for role permission scoping)</span></label>
        <div className="space-y-1.5">
          {formData.resources.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={r}
                onChange={e => {
                  const next = [...formData.resources]
                  next[i] = e.target.value
                  setFormData(p => ({ ...p, resources: next }))
                }}
                className={fieldCls}
                placeholder="resource_name"
              />
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, resources: p.resources.filter((_, j) => j !== i) }))}
                className="h-9 px-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData(p => ({ ...p, resources: [...p.resources, ''] }))}
            className="h-8 px-3 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-500 hover:text-slate-700 transition-colors"
          >
            + Add Resource
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Management Units</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Apps</h2>
        </div>
        <button
          onClick={openCreate}
          className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={14} />
          New App
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Apps</h4>
          <button onClick={() => refetch()} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading apps...</div>
        ) : (apps as AppItem[]).length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No apps created yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(apps as AppItem[]).map((app) => (
              <div key={app.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                      {app.imageUrl ? <img src={app.imageUrl} alt={app.name} className="h-full w-full rounded-xl object-cover" /> : (app.icon ? app.icon : <Boxes size={16} className="text-slate-400" />)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-medium text-slate-900">{app.name}</h5>
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-700 transition-colors" title={app.url}>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      {app.description && <p className="text-xs text-slate-500 truncate">{app.description}</p>}
                    </div>
                  </div>
                  {(app.resources?.length ?? 0) > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 ml-10">
                      {app.resources.length} resource{app.resources.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(app)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Edit app"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setAppToDelete(app)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete app"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create App">
        <div className="space-y-4">
          <AppForm />
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setCreateOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={createApp.isPending || !formData.name}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {createApp.isPending ? 'Creating...' : 'Create App'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal with tabs */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setAppToEdit(null) }} title={`Edit App${appToEdit ? `: ${appToEdit.name}` : ''}`}>
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-slate-100 pb-3">
            <button
              onClick={() => setEditTab('details')}
              className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors ${editTab === 'details' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              Details
            </button>
            <button
              onClick={() => setEditTab('components')}
              className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors ${editTab === 'components' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              Components
            </button>
          </div>

          {editTab === 'details' ? (
            <div className="space-y-4">
              <AppForm />
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setEditOpen(false); setAppToEdit(null) }} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  onClick={handleUpdate}
                  disabled={updateApp.isPending || !formData.name}
                  className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {updateApp.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {appToEdit && <ComponentsManager appId={appToEdit.id} />}
              <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                <button onClick={() => { setEditOpen(false); setAppToEdit(null) }} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Close</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!appToDelete}
        title="Delete App"
        message={`Delete app "${appToDelete?.name ?? ''}"? Linked records will keep their IDs but app grouping will be removed if you reassign them.`}
        confirmLabel="Delete App"
        pending={deleteApp.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setAppToDelete(null)}
      />
    </div>
  )
}

export default Apps
