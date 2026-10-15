import { Building2, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActionIcon, Box, Button, Checkbox, Group, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import Modal from '../components/Modal'
import { useCreateTenant, useTenants, useUpdateTenant } from '../hooks/useApi'
import React from 'react';

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
    <Box>
      <PageHeader
        eyebrow="Multi-Tenancy"
        title="Organizations"
        actions={
          <Button
            onClick={() => { setCreateFormError(''); setCreateModalOpen(true) }}
            leftSection={<Plus size={16} />}
          >
            New tenant
          </Button>
        }
      />

      <Stack gap="md">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search tenants by name or slug…" maw={360} />

        <SectionCard
          flush
          title="All tenants"
          actions={<RefreshButton size="xs" onRefresh={() => refetch()} loading={isFetching} lastUpdated={null} />}
        >
          {isLoading ? (
            <TableSkeleton rows={3} columns={['avatar', 'text', 'action']} />
          ) : tenants.length === 0 ? (
            <EmptyState icon={Building2} title="No organizations yet" description="Create a tenant to enable multi-tenancy." />
          ) : (
            <Table.ScrollContainer minWidth={480} type="native">
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organization</Table.Th>
                    <Table.Th>Slug</Table.Th>
                    <Table.Th w={64} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tenants.map((tenant: any) => (
                    <Table.Tr key={tenant.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon variant="light" color="gray" size={32} radius="md">
                            <Building2 size={16} />
                          </ThemeIcon>
                          <Text size="sm" fw={500} truncate>{tenant.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" ff="monospace">{tenant.slug}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => openEditTenant(tenant)}
                            disabled={updateTenant.isPending}
                            title="Edit tenant"
                            aria-label="Edit tenant"
                          >
                            <Pencil size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SectionCard>
      </Stack>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Tenant">
        <Stack gap="md">
          <TextInput
            label="Organization name"
            value={formData.name}
            onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, name: value })) }}
            placeholder="Acme Corp"
          />
          <TextInput
            label="Identifier slug"
            value={formData.slug}
            onChange={e => { const value = e.currentTarget.value; setFormData(p => ({ ...p, slug: value })) }}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
            placeholder="acme-corp"
          />
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setCreateModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name || !formData.slug}
              loading={createTenant.isPending}
            >
              Create tenant
            </Button>
          </Group>
          {createFormError && <Text size="xs" c="red">{createFormError}</Text>}
        </Stack>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Tenant${tenantToEdit ? `: ${tenantToEdit.name}` : ''}`}>
        <Stack gap="md">
          <TextInput
            label="Organization name"
            value={editFormData.name}
            onChange={e => { const value = e.currentTarget.value; setEditFormData(p => ({ ...p, name: value })) }}
            placeholder="Acme Corp"
          />
          <TextInput
            label="Identifier slug"
            value={editFormData.slug}
            onChange={e => { const value = e.currentTarget.value; setEditFormData(p => ({ ...p, slug: value })) }}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
            placeholder="acme-corp"
          />
          <Checkbox
            label="Tenant is active"
            checked={editFormData.active}
            onChange={e => { const checked = e.currentTarget.checked; setEditFormData(p => ({ ...p, active: checked })) }}
          />
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => setEditModalOpen(false)} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editFormData.name || !editFormData.slug}
              loading={updateTenant.isPending}
            >
              Save changes
            </Button>
          </Group>
          {editFormError && <Text size="xs" c="red">{editFormError}</Text>}
        </Stack>
      </Modal>
    </Box>
  )
}

export default Tenants
