import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Select from '../components/ui/Select'
import { Pencil, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useEffect, useMemo, useState } from 'react'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import BulkActionsBar, { SelectionCheckbox } from '../components/BulkActionsBar'
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
  showOnPortal: boolean
  userEditable: boolean
}

type ToggleField = 'enabled' | 'showOnPortal' | 'userEditable'

const TYPE_OPTIONS: AttributeType[] = ['text', 'number', 'boolean', 'date', 'json']

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

const defaultForm = {
  key: '',
  name: '',
  description: '',
  type: 'text' as AttributeType,
  enabled: true,
  showOnPortal: false,
  userEditable: false,
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const attributes = useMemo(() => (data ?? []) as UserAttribute[], [data])
  const attributeIds = useMemo(() => attributes.map((attribute) => attribute.id), [attributes])
  const selectedCount = useMemo(
    () => attributeIds.reduce((count, id) => (selectedIds.includes(id) ? count + 1 : count), 0),
    [attributeIds, selectedIds]
  )
  const allSelected = attributeIds.length > 0 && selectedCount === attributeIds.length
  const someSelected = selectedCount > 0 && !allSelected

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(attributeIds)
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [attributeIds])

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
      showOnPortal: attribute.showOnPortal,
      userEditable: attribute.userEditable,
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
      showOnPortal: form.showOnPortal,
      userEditable: form.userEditable,
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
      showOnPortal: form.showOnPortal,
      userEditable: form.userEditable,
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

  const toggleField = (attribute: UserAttribute, field: ToggleField) => {
    updateAttribute.mutate({ id: attribute.id, [field]: !attribute[field] })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (attributeIds.length === 0) return
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !attributeIds.includes(id)))
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of attributeIds) next.add(id)
      return Array.from(next)
    })
  }

  const clearSelection = () => {
    setSelectedIds([])
    setBulkError('')
  }

  const runBulkToggle = async (field: ToggleField, value: boolean) => {
    if (selectedIds.length === 0) return
    setBulkError('')
    setBulkPending(true)
    try {
      const ids = [...selectedIds]
      const targets = attributes.filter((attribute) => ids.includes(attribute.id) && attribute[field] !== value)
      if (targets.length === 0) {
        setBulkError(`Selected attributes already have that setting.`)
        return
      }
      const results = await Promise.allSettled(
        targets.map((attribute) => updateAttribute.mutateAsync({ id: attribute.id, [field]: value }))
      )
      const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        const message = failures[0].reason instanceof Error ? failures[0].reason.message : 'Unknown error'
        setBulkError(`${failures.length} of ${targets.length} update${targets.length === 1 ? '' : 's'} failed: ${message}`)
        return
      }
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk update failed')
    } finally {
      setBulkPending(false)
    }
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

      <Table className="overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <SelectionCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleSelectAll}
              disabled={attributes.length === 0}
              title={allSelected ? 'Deselect all' : 'Select all visible'}
            />
            <h4 className="text-sm font-semibold text-foreground">Attribute Definitions</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>

        <BulkActionsBar
          count={selectedIds.length}
          noun="attribute"
          onClear={clearSelection}
        >
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('enabled', true)}>
            <ToggleRight size={12} />
            Global On
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('enabled', false)}>
            <ToggleLeft size={12} />
            Global Off
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('showOnPortal', true)}>
            <ToggleRight size={12} />
            Portal Visible
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('showOnPortal', false)}>
            <ToggleLeft size={12} />
            Portal Hidden
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('userEditable', true)}>
            <ToggleRight size={12} />
            User Editable
          </Button>
          <Button variant="secondary" size="sm" disabled={bulkPending} onClick={() => void runBulkToggle('userEditable', false)}>
            <ToggleLeft size={12} />
            Read Only
          </Button>
        </BulkActionsBar>

        {bulkError && (
          <div className="px-5 py-2.5 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">
            {bulkError}
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : attributes.length === 0 ? (
          <EmptyState
            title="No custom user attributes defined"
            description="Define custom profile attributes to extend user data."
          />
        ) : (
          <TableBody className="divide-y divide-border">
            {attributes.map((attribute) => {
              const isSelected = selectedIds.includes(attribute.id)
              return (
                <TableRow
                  key={attribute.id}
                  className={`px-5 py-4 hover:bg-muted/50 transition-colors ${isSelected ? 'bg-sky-50/40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <SelectionCheckbox
                        className="mt-1"
                        checked={isSelected}
                        onChange={() => toggleSelect(attribute.id)}
                        aria-label={`Select attribute ${attribute.name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h5 className="text-sm font-medium text-foreground">{attribute.name}</h5>
                          <StatusBadge tone="neutral" mono>{attribute.key}</StatusBadge>
                          <StatusBadge tone="accent" mono>{attribute.type}</StatusBadge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleField(attribute, 'enabled')}
                            title="Toggle globally for all users"
                          >
                            {attribute.enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                            {attribute.enabled ? 'Global On' : 'Global Off'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleField(attribute, 'showOnPortal')}
                            title="Toggle visibility on the user portal"
                          >
                            {attribute.showOnPortal ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                            {attribute.showOnPortal ? 'Portal Visible' : 'Portal Hidden'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleField(attribute, 'userEditable')}
                            title="Toggle whether portal users can edit this value"
                          >
                            {attribute.userEditable ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                            {attribute.userEditable ? 'User Editable' : 'Read Only'}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{attribute.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Attribute values are assigned from the Users and Groups pages.
                        </p>
                      </div>
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
                        className="hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => onDelete(attribute)}
                        disabled={deleteAttribute.isPending}
                        title="Delete attribute"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </TableRow>
              )
            })}
          </TableBody>
        )}
      </Table>

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
          <Select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AttributeType }))}>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
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
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input type="checkbox" className="rounded border-border" checked={form.enabled} onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
        Enabled for all users
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input type="checkbox" className="rounded border-border" checked={form.showOnPortal} onChange={(e) => setForm((prev) => ({ ...prev, showOnPortal: e.target.checked }))} />
        Show on portal
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input type="checkbox" className="rounded border-border" checked={form.userEditable} onChange={(e) => setForm((prev) => ({ ...prev, userEditable: e.target.checked }))} />
        Editable by users
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
