import { Pencil, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Fingerprint } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useMemo, useState } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import React from 'react';
import {
  useCreateUserAttribute,
  useDeleteUserAttribute,
  useUpdateUserAttribute,
  useUserAttributes,
} from '../hooks/useApi'

type AttributeType = 'text' | 'number' | 'boolean' | 'date' | 'json'

interface UserAttribute {
  id: string
  key: string
  name: string
  description: string
  type: AttributeType
  enabled: boolean
}

const TYPE_OPTIONS: AttributeType[] = ['text', 'number', 'boolean', 'date', 'json']

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const defaultForm = {
  key: '',
  name: '',
  description: '',
  type: 'text' as AttributeType,
  enabled: true,
}

const UserAttributes = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data, isLoading, isFetching, refetch } = useUserAttributes(debouncedSearch)

  const createAttribute = useCreateUserAttribute()
  const updateAttribute = useUpdateUserAttribute()
  const deleteAttribute = useDeleteUserAttribute()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<UserAttribute | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(defaultForm)

  const attributes = useMemo(() => (data ?? []) as UserAttribute[], [data])

  const openCreate = () => {
    setForm(defaultForm)
    setCreateOpen(true)
  }

  const openEdit = (attribute: UserAttribute) => {
    setEditingId(attribute.id)
    setForm({
      key: attribute.key,
      name: attribute.name,
      description: attribute.description,
      type: attribute.type,
      enabled: attribute.enabled,
    })
    setEditOpen(true)
  }

  const onCreate = async () => {
    if (!form.key || !form.name || !form.description) return

    await createAttribute.mutateAsync({
      key: form.key,
      name: form.name,
      description: form.description,
      type: form.type,
      enabled: form.enabled,
    })

    setCreateOpen(false)
    setForm(defaultForm)
  }

  const onEdit = async () => {
    if (!editingId || !form.key || !form.name || !form.description) return

    await updateAttribute.mutateAsync({
      id: editingId,
      key: form.key,
      name: form.name,
      description: form.description,
      type: form.type,
      enabled: form.enabled,
    })

    setEditOpen(false)
    setEditingId('')
    setForm(defaultForm)
  }

  const onDelete = (attribute: UserAttribute) => {
    setAttributeToDelete(attribute)
  }

  const confirmDeleteAttribute = () => {
    if (!attributeToDelete) return
    deleteAttribute.mutate(attributeToDelete.id, { onSuccess: () => setAttributeToDelete(null) })
  }

  const toggleGlobalEnabled = (attribute: UserAttribute) => {
    updateAttribute.mutate({ id: attribute.id, enabled: !attribute.enabled })
  }

  return (
    <div>
      <PageHeader
        eyebrow="User Profile Schema"
        title="User Attributes"
        action={
          <Button variant="primary" onClick={openCreate}>
            <Plus size={14} />
            New Attribute
          </Button>
        }
      />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search attribute definitions…" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="text-sm font-semibold text-slate-700">Attribute Definitions</h4>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : attributes.length === 0 ? (
          <EmptyState
            title="No custom user attributes defined"
            description="Define custom profile attributes to extend user data."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {attributes.map((attribute) => {
              return (
                <div key={attribute.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-medium text-slate-900">{attribute.name}</h5>
                        <StatusBadge tone="neutral" mono>{attribute.key}</StatusBadge>
                        <StatusBadge tone="accent" mono>{attribute.type}</StatusBadge>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleGlobalEnabled(attribute)}
                          title="Toggle globally for all users"
                        >
                          {attribute.enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          {attribute.enabled ? 'Global On' : 'Global Off'}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">{attribute.description}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Attribute values are assigned from the Users and Groups pages.
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(attribute)}
                        title="Edit attribute"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-red-50 hover:text-red-600"
                        onClick={() => onDelete(attribute)}
                        disabled={deleteAttribute.isPending}
                        title="Delete attribute"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}      
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create User Attribute">
        <AttributeForm
          form={form}
          setForm={setForm}
          onSubmit={onCreate}
          submitLabel={createAttribute.isPending ? 'Creating...' : 'Create Attribute'}
          pending={createAttribute.isPending}
        />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit User Attribute">
        <AttributeForm
          form={form}
          setForm={setForm}
          onSubmit={onEdit}
          submitLabel={updateAttribute.isPending ? 'Saving...' : 'Save Changes'}
          pending={updateAttribute.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!attributeToDelete}
        title="Delete User Attribute"
        message={`Delete attribute "${attributeToDelete?.name ?? ''}"?`}
        confirmLabel="Delete Attribute"
        pending={deleteAttribute.isPending}
        onConfirm={confirmDeleteAttribute}
        onCancel={() => setAttributeToDelete(null)}
      />
    </div>
  )
}

function AttributeForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  pending,
}: {
  form: typeof defaultForm
  setForm: React.Dispatch<React.SetStateAction<typeof defaultForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Attribute Key</label>
          <Input className="font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="department" />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={fieldCls} value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AttributeType }))}>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Display Name</label>
        <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Department" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Business unit for user segmentation" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
        Enabled for all users
      </label>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onSubmit} disabled={pending || !form.key || !form.name || !form.description}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export default UserAttributes
