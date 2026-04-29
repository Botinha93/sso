import { Building2, Pencil, Plus, RefreshCw } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useCreateTenant, useTenants, useUpdateTenant } from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Tenants = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [tenantToEdit, setTenantToEdit] = useState<{ id: string; name: string; slug: string; active: boolean } | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [editFormData, setEditFormData] = useState({ name: '', slug: '', active: true })
  const { data: tenants = [], isLoading, isFetching, refetch } = useTenants()
  const createTenant = useCreateTenant()
  const updateTenant = useUpdateTenant()

  function handleCreate() {
    if (!formData.name || !formData.slug) return
    createTenant.mutate(formData, {
      onSuccess: () => {
        setCreateModalOpen(false)
        setFormData({ name: '', slug: '' })
      }
    })
  }

  function openEditTenant(tenant: { id: string; name: string; slug: string; active: boolean }) {
    setTenantToEdit(tenant)
    setEditFormData({ name: tenant.name, slug: tenant.slug, active: tenant.active })
    setEditModalOpen(true)
  }

  function handleSaveEdit() {
    if (!tenantToEdit || !editFormData.name || !editFormData.slug) return
    updateTenant.mutate({
      id: tenantToEdit.id,
      name: editFormData.name,
      slug: editFormData.slug,
      active: editFormData.active
    }, {
      onSuccess: () => {
        setEditModalOpen(false)
        setTenantToEdit(null)
      }
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Multi-Tenancy"
        title="Organizations"
        action={
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-sky-500 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            New Tenant
          </button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">All Tenants</h4>
          <button onClick={() => refetch()} disabled={isFetching} className="text-xs text-slate-500 flex items-center gap-1.5 hover:text-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading && <TableSkeleton rows={3} />}
          {!isLoading && tenants.length === 0 && <EmptyState title="No organizations yet" description="Create a tenant to enable multi-tenancy." />}
          {tenants.map((tenant: any) => (
            <div key={tenant.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-slate-500" />
                </div>
                <div>
                  <h5 className="text-sm font-medium text-slate-900">{tenant.name}</h5>
                  <p className="text-xs text-slate-500 font-mono">{tenant.slug}</p>
                </div>
              </div>
              <button
                onClick={() => openEditTenant(tenant)}
                disabled={updateTenant.isPending}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Edit tenant"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Tenant">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Organization Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={fieldCls} placeholder="Acme Corp" />
          </div>
          <div>
            <label className={labelCls}>Identifier Slug</label>
            <input type="text" value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="acme-corp" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setCreateModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createTenant.isPending || !formData.name || !formData.slug}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {createTenant.isPending ? 'Creating…' : 'Create Tenant'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Tenant${tenantToEdit ? `: ${tenantToEdit.name}` : ''}`}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Organization Name</label>
            <input type="text" value={editFormData.name} onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))} className={fieldCls} placeholder="Acme Corp" />
          </div>
          <div>
            <label className={labelCls}>Identifier Slug</label>
            <input type="text" value={editFormData.slug} onChange={e => setEditFormData(p => ({ ...p, slug: e.target.value }))} className={`${fieldCls} font-mono`} placeholder="acme-corp" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editFormData.active}
              onChange={e => setEditFormData(p => ({ ...p, active: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Tenant is active
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setEditModalOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={updateTenant.isPending || !editFormData.name || !editFormData.slug}
              className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {updateTenant.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Tenants