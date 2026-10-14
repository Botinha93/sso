import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { Building2, Pencil, Plus, RefreshCw } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useState } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import Modal from '../components/Modal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useCreateTenant, useTenants, useUpdateTenant } from '../hooks/useApi'
import React from 'react';

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

const Tenants = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [tenantToEdit, setTenantToEdit] = useState<{ id: string; name: string; slug: string; active: boolean } | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [editFormData, setEditFormData] = useState({ name: '', slug: '', active: true })
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: tenants = [], isLoading, isFetching, refetch } = useTenants(debouncedSearch)
  const createTenant = useCreateTenant()
  const updateTenant = useUpdateTenant()

  async function handleCreate() {
    if (!formData.name || !formData.slug) return

    setCreateFormError('')
    try {
      await createTenant.mutateAsync(formData)
        setCreateModalOpen(false)
        setFormData({ name: '', slug: '' })
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create tenant')
    }
  }

  function openEditTenant(tenant: { id: string; name: string; slug: string; active: boolean }) {
    setEditFormError('')
    setTenantToEdit(tenant)
    setEditFormData({ name: tenant.name, slug: tenant.slug, active: tenant.active })
    setEditModalOpen(true)
  }

  async function handleSaveEdit() {
    if (!tenantToEdit || !editFormData.name || !editFormData.slug) return

    setEditFormError('')
    try {
      await updateTenant.mutateAsync({
        id: tenantToEdit.id,
        name: editFormData.name,
        slug: editFormData.slug,
        active: editFormData.active
      })
        setEditModalOpen(false)
        setTenantToEdit(null)
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update tenant')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Multi-Tenancy"
        title="Organizations"
        action={
          <Button
            onClick={() => { setCreateFormError(''); setCreateModalOpen(true) }}
            variant="primary"
            className="h-9 rounded-lg"
          >
            <Plus size={14} />
            New Tenant
          </Button>
        }
      />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search tenants by name or slug…" />
      </div>

      <Table>
        <TableHeaderRow>
          <h4 className="text-sm font-semibold text-foreground">All Tenants</h4>
          <Button onClick={() => refetch()} disabled={isFetching} variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>
        <TableBody>
          {isLoading && <TableSkeleton rows={3} />}
          {!isLoading && tenants.length === 0 && <EmptyState title="No organizations yet" description="Create a tenant to enable multi-tenancy." />}
          {tenants.map((tenant: any) => (
            <TableRow key={tenant.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-muted-foreground" />
                </div>
                <div>
                  <h5 className="text-sm font-medium text-foreground">{tenant.name}</h5>
                  <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                </div>
              </div>
              <Button
                onClick={() => openEditTenant(tenant)}
                disabled={updateTenant.isPending}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Edit tenant"
              >
                <Pencil size={14} />
              </Button>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Tenant">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Organization Name</label>
            <Input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
          </div>
          <div>
            <label className={labelCls}>Identifier Slug</label>
            <Input type="text" value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} className="font-mono" placeholder="acme-corp" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setCreateModalOpen(false)} variant="secondary" className="h-9 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createTenant.isPending || !formData.name || !formData.slug}
              variant="primary"
              className="h-9 rounded-lg"
            >
              {createTenant.isPending ? 'Creating…' : 'Create Tenant'}
            </Button>
          </div>
          {createFormError && <p className="text-xs text-rose-600">{createFormError}</p>}
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Tenant${tenantToEdit ? `: ${tenantToEdit.name}` : ''}`}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Organization Name</label>
            <Input type="text" value={editFormData.name} onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
          </div>
          <div>
            <label className={labelCls}>Identifier Slug</label>
            <Input type="text" value={editFormData.slug} onChange={e => setEditFormData(p => ({ ...p, slug: e.target.value }))} className="font-mono" placeholder="acme-corp" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={editFormData.active}
              onChange={e => setEditFormData(p => ({ ...p, active: e.target.checked }))}
              className="rounded border-border"
            />
            Tenant is active
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={() => setEditModalOpen(false)} variant="secondary" className="h-9 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateTenant.isPending || !editFormData.name || !editFormData.slug}
              variant="primary"
              className="h-9 rounded-lg"
            >
              {updateTenant.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
          {editFormError && <p className="text-xs text-rose-600">{editFormError}</p>}
        </div>
      </Modal>
    </div>
  )
}

export default Tenants