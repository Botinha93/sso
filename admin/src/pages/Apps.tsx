import { Boxes, ExternalLink, Globe, Pencil, Plus, RefreshCw, Trash2, Users, Shield, Key, Server } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
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

  type AnyItem = { id: string; name?: string; email?: string; appId?: string; appIds?: string[] }

  const getItems = (): AnyItem[] => {
    if (tab === 'clients') return (clients as AnyItem[])
    if (tab === 'users') return (users as AnyItem[])
    if (tab === 'groups') return (groups as AnyItem[])
    return (roles as AnyItem[])
  }

  const toggleAssign = async (item: AnyItem) => {
    const currentAppIds = item.appIds ?? (item.appId ? [item.appId] : [])
    const nextAppIds = currentAppIds.includes(appId)
      ? currentAppIds.filter((id) => id !== appId)
      : [...currentAppIds, appId]

    if (tab === 'clients') await updateClient.mutateAsync({ id: item.id, appId: item.appId === appId ? undefined : appId })
    else if (tab === 'users') await updateUser.mutateAsync({ id: item.id, appIds: nextAppIds })
    else if (tab === 'groups') await updateGroup.mutateAsync({ id: item.id, appIds: nextAppIds })
    else await updateRole.mutateAsync({ id: item.id, appId: item.appId === appId ? undefined : appId })
  }

  const items = getItems()
  const assignedIds = new Set(items.filter((item) => (item.appIds ?? (item.appId ? [item.appId] : [])).includes(appId)).map((item) => item.id))

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-slate-100 pb-3">
        {tabs.map(t => (
          <Button
            key={t.key}
            onClick={() => setTab(t.key)}
            variant={tab === t.key ? 'primary' : 'ghost'}
            size="sm"
            className={`h-7 px-3 text-xs ${tab === t.key ? '' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            {t.icon}{t.label}
          </Button>
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
                className="h-4 w-4 rounded border-slate-300 text-slate-900 accent-sky-600"
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
  const { data: apps = [], isLoading, isFetching, refetch } = useApps()
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')

  const openCreate = () => {
    setFormData(EMPTY_FORM)
    setSelectedImageFile(null)
    setCreateFormError('')
    setCreateOpen(true)
  }

  const openEdit = (app: AppItem) => {
    setAppToEdit(app)
    setFormData({ name: app.name, description: app.description, icon: app.icon ?? '', imageUrl: app.imageUrl ?? '', url: app.url ?? '', resources: app.resources ?? [] })
    setSelectedImageFile(null)
    setEditFormError('')
    setEditTab('details')
    setEditOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name) return

    setCreateFormError('')
    try {
      const created = await createApp.mutateAsync({
        name: formData.name,
        description: formData.description,
        icon: formData.icon || undefined,
        imageUrl: formData.imageUrl || undefined,
        url: formData.url || undefined,
        resources: formData.resources,
      }) as AppItem

      if (selectedImageFile && created?.id) {
        await uploadAppImage.mutateAsync({ appId: created.id, file: selectedImageFile })
      }

      setCreateOpen(false)
      setSelectedImageFile(null)
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create app')
    }
  }

  const handleUpdate = async () => {
    if (!appToEdit || !formData.name) return

    setEditFormError('')
    try {
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
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update app')
    }
  }

  const confirmDelete = async () => {
    if (!appToDelete) return
    await deleteApp.mutateAsync(appToDelete.id)
    setAppToDelete(null)
  }

  const renderAppForm = () => (
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
          <Input
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
        <Input
          type="url"
          value={formData.imageUrl}
          onChange={e => setFormData(p => ({ ...p, imageUrl: e.target.value }))}
          className={fieldCls}
          placeholder="/media/defaults/app/grid.svg"
        />
      </div>

      <div>
        <label className={labelCls}>Upload Image</label>
        <Input
          type="file"
          accept="image/*"
          className={`${fieldCls} pt-1.5`}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return

            if (appToEdit) {
                try {
                  const result = await uploadAppImage.mutateAsync({ appId: appToEdit.id, file }) as { imageUrl?: string }
                  if (result?.imageUrl) {
                    setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }))
                  }
                  setEditFormError('')
                } catch (error) {
                  setEditFormError(error instanceof Error ? error.message : 'Failed to upload app image')
                }
                return
            }

            setSelectedImageFile(file)
          }}
        />
        {!appToEdit && selectedImageFile ? (
          <p className="mt-1 text-xs text-slate-500">Selected: <span className="font-mono">{selectedImageFile.name}</span>. The image will upload automatically when you create the app.</p>
        ) : null}
      </div>

      <div>
        <label className={labelCls}>Default Images</label>
        <div className="flex flex-wrap gap-2">
          {((defaultAppImages as any)?.items ?? []).map((item: any) => (
            <Button
              key={item.key}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, imageUrl: item.url }))}
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 p-0 hover:ring-2 hover:ring-slate-300"
              title={item.label}
            >
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
            </Button>
          ))}
          <Button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
            variant="secondary"
            size="sm"
            className="h-10"
          >
            clear image
          </Button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Emoji Suggestions</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_SUGGESTIONS.map(emoji => (
            <Button
              key={emoji}
              type="button"
              onClick={() => setFormData(p => ({ ...p, icon: p.icon === emoji ? '' : emoji }))}
              variant={formData.icon === emoji ? 'primary' : 'ghost'}
              size="icon"
              className={`w-8 h-8 rounded-lg text-base ${formData.icon === emoji ? '' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              {emoji}
            </Button>
          ))}
          {formData.icon && !EMOJI_SUGGESTIONS.includes(formData.icon) && (
            <Input
              type="text"
              value={formData.icon}
              onChange={e => setFormData(p => ({ ...p, icon: e.target.value.slice(0, 4) }))}
              className="w-20 h-8 rounded-lg border border-slate-200 px-2 text-sm text-center"
              placeholder="custom"
            />
          )}
          <Button
            type="button"
            onClick={() => setFormData(p => ({ ...p, icon: '' }))}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-400 hover:text-slate-700"
          >
            clear
          </Button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <Input
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
          <Input
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
              <Input
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
              <Button
                type="button"
                onClick={() => setFormData(p => ({ ...p, resources: p.resources.filter((_, j) => j !== i) }))}
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() => setFormData(p => ({ ...p, resources: [...p.resources, ''] }))}
            variant="outline"
            size="sm"
            className="h-8 border-dashed text-xs text-slate-500 hover:border-slate-500 hover:text-slate-700"
          >
            + Add Resource
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Management Units"
        title="Apps"
        action={
          <Button
            onClick={openCreate}
            variant="primary"
            className="h-9 rounded-lg"
          >
            <Plus size={14} />
            New App
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Apps</h4>
          <Button onClick={() => refetch()} disabled={isFetching} variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-900">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : (apps as AppItem[]).length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No apps created yet"
            description="Create an app to group users, clients and roles."
            action={<Button onClick={openCreate} variant="primary" size="sm" className="h-8 rounded-lg">New App</Button>}
          />
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
                  <Button
                    onClick={() => openEdit(app)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700"
                    title="Edit app"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    onClick={() => setAppToDelete(app)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete app"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create App">
        <div className="space-y-4">
          {renderAppForm()}
          {createFormError && <p className="text-xs text-red-600">{createFormError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => { setCreateOpen(false); setSelectedImageFile(null) }} variant="secondary" className="h-9 rounded-lg">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createApp.isPending || uploadAppImage.isPending || !formData.name}
              variant="primary"
              className="h-9 rounded-lg"
            >
              {createApp.isPending || uploadAppImage.isPending ? 'Creating...' : 'Create App'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal with tabs */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setAppToEdit(null) }} title={`Edit App${appToEdit ? `: ${appToEdit.name}` : ''}`}>
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-slate-100 pb-3">
            <Button
              onClick={() => setEditTab('details')}
              variant={editTab === 'details' ? 'primary' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-xs ${editTab === 'details' ? '' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              Details
            </Button>
            <Button
              onClick={() => setEditTab('components')}
              variant={editTab === 'components' ? 'primary' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-xs ${editTab === 'components' ? '' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              Components
            </Button>
          </div>

          {editTab === 'details' ? (
            <div className="space-y-4">
              {renderAppForm()}
              {editFormError && <p className="text-xs text-red-600">{editFormError}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <Button onClick={() => { setEditOpen(false); setAppToEdit(null) }} variant="secondary" className="h-9 rounded-lg">Cancel</Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateApp.isPending || !formData.name}
                  variant="primary"
                  className="h-9 rounded-lg"
                >
                  {updateApp.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {appToEdit && <ComponentsManager appId={appToEdit.id} />}
              <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                <Button onClick={() => { setEditOpen(false); setAppToEdit(null) }} variant="secondary" className="h-9 rounded-lg">Close</Button>
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
