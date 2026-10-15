import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  CopyField,
  PageHeader,
  RefreshButton,
  SecretReveal,
  SectionCard,
  StatusBadge,
  TableSkeleton,
} from '@nexus/design'
import { Plus, Trash2, Key, RotateCw, Pencil, Bot } from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import {
  useServiceIdentities,
  useCreateServiceIdentity,
  useUpdateServiceIdentity,
  useDeleteServiceIdentity,
  useScopes,
  useRoles,
  useGroups,
  useServiceIdentity,
  useServiceIdentityUsage,
  useIssueServiceIdentityCredential,
  useRotateServiceIdentityCredential,
  useRevokeServiceIdentityCredential,
  type ServiceIdentityDto,
  type ServiceIdentityCredentialDto
} from '../hooks/useApi'

const defaultForm = () => ({
  name: '',
  description: '',
  status: 'active' as ServiceIdentityDto['status'],
  allowedScopes: [] as string[],
  roleIds: [] as string[],
  groupIds: [] as string[],
  allowedAudiences: ''
})

type IdentityForm = ReturnType<typeof defaultForm>

interface NewSecretInfo {
  clientId: string
  plainClientSecret: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const statusBadge = (status: ServiceIdentityDto['status']) => {
  const tones: Record<ServiceIdentityDto['status'], 'success' | 'neutral' | 'danger'> = {
    active: 'success',
    inactive: 'neutral',
    suspended: 'danger'
  }

  return (
    <StatusBadge status={tones[status]}>
      {status}
    </StatusBadge>
  )
}

function parseCommaSeparated(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function toggleScopeSelection(scopes: string[], scopeName: string) {
  return scopes.includes(scopeName)
    ? scopes.filter((scope) => scope !== scopeName)
    : [...scopes, scopeName]
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="sm" fw={500} mb={4}>
      {children}
    </Text>
  )
}

/** Scrollable bordered checkbox list used for scopes / roles / groups. */
function CheckboxListBox({
  label,
  emptyText,
  items,
  mono,
}: {
  label: string
  emptyText: string
  items: { key: string; label: string; checked: boolean; onToggle: () => void }[]
  mono?: boolean
}) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <Paper withBorder radius="sm" bg="var(--nx-color-surface-sunken)">
        <ScrollArea.Autosize mah={140} type="auto">
          <Stack gap={6} p="xs">
            {items.length === 0 && <Text size="xs" c="dimmed">{emptyText}</Text>}
            {items.map((item) => (
              <Checkbox
                key={item.key}
                size="xs"
                checked={item.checked}
                onChange={item.onToggle}
                label={mono ? <Text span size="xs" ff="monospace">{item.label}</Text> : item.label}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Paper>
    </Box>
  )
}

function IdentityFormFields({
  form,
  setForm,
  scopes,
  roles,
  groups,
}: {
  form: IdentityForm
  setForm: React.Dispatch<React.SetStateAction<IdentityForm>>
  scopes: any[]
  roles: any[]
  groups: any[]
}) {
  return (
    <>
      <TextInput
        label="Name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="reporting-worker"
      />
      <TextInput
        label="Description"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Machine identity for scheduled reporting jobs"
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Box>
          <NativeSelect
            label="Status"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as ServiceIdentityDto['status'] }))}
            data={STATUS_OPTIONS}
          />
        </Box>
        <CheckboxListBox
          label="Token Scopes"
          emptyText="No scopes defined."
          mono
          items={scopes.map((scope: any) => ({
            key: scope.id,
            label: scope.name,
            checked: form.allowedScopes.includes(scope.name),
            onToggle: () => setForm((f) => ({ ...f, allowedScopes: toggleScopeSelection(f.allowedScopes, scope.name) })),
          }))}
        />
      </SimpleGrid>
      <TextInput
        label="Token Audiences"
        value={form.allowedAudiences}
        onChange={e => setForm(f => ({ ...f, allowedAudiences: e.target.value }))}
        placeholder="api.example.com, jobs.internal"
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <CheckboxListBox
          label="Direct Roles"
          emptyText="No roles defined."
          items={roles.map((role: any) => ({
            key: role.id,
            label: role.name,
            checked: form.roleIds.includes(role.id),
            onToggle: () => setForm((f) => ({ ...f, roleIds: toggleSelection(f.roleIds, role.id) })),
          }))}
        />
        <CheckboxListBox
          label="Groups"
          emptyText="No groups defined."
          items={groups.map((group: any) => ({
            key: group.id,
            label: group.name,
            checked: form.groupIds.includes(group.id),
            onToggle: () => setForm((f) => ({ ...f, groupIds: toggleSelection(f.groupIds, group.id) })),
          }))}
        />
      </SimpleGrid>
    </>
  )
}

const CredentialsPanel = ({
  identity,
}: {
  identity: ServiceIdentityDto
}) => {
  const { data, refetch } = useServiceIdentity(identity.id)
  const { data: usageData, isFetching: isUsageRefreshing, refetch: refetchUsage } = useServiceIdentityUsage(identity.id)
  const issueCredential = useIssueServiceIdentityCredential()
  const rotateCredential = useRotateServiceIdentityCredential()
  const revokeCredential = useRevokeServiceIdentityCredential()
  const [expiresInDays, setExpiresInDays] = useState<string>('365')
  const [newSecret, setNewSecret] = useState<NewSecretInfo | null>(null)
  const [credentialToRevoke, setCredentialToRevoke] = useState<string | null>(null)

  const si = data ?? identity
  const usage = usageData?.data ?? []

  const refreshAll = async () => {
    await refetch()
    await refetchUsage()
  }

  const handleIssueCredential = async () => {
    const result = await issueCredential.mutateAsync({
      id: si.id,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined
    })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    await refreshAll()
  }

  const handleRotate = async (credentialId: string) => {
    const result = await rotateCredential.mutateAsync({ id: si.id, credentialId })
    setNewSecret({ clientId: result.credential.clientId, plainClientSecret: result.plainClientSecret })
    await refreshAll()
  }

  const handleRevoke = async () => {
    if (!credentialToRevoke) return
    await revokeCredential.mutateAsync({ id: si.id, credentialId: credentialToRevoke })
    setCredentialToRevoke(null)
    await refreshAll()
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Box>
          <FieldLabel>Status</FieldLabel>
          <Group h={36} align="center">{statusBadge(si.status)}</Group>
        </Box>
        <CopyField label="Identity ID" value={si.id} />
      </SimpleGrid>

      {newSecret && (
        <SecretReveal
          title="Save this OAuth client secret. It is shown only once."
          message={null}
          items={[
            { label: 'Client ID', value: newSecret.clientId },
            { label: 'Client Secret', value: newSecret.plainClientSecret, secret: true },
          ]}
          onAcknowledge={() => setNewSecret(null)}
          acknowledgeLabel="Dismiss"
        />
      )}

      <Box>
        <Group justify="space-between" align="flex-end" mb="sm" gap="sm">
          <Box>
            <Title order={4} size="h6">OAuth Client Credentials</Title>
            <Text size="xs" c="dimmed" mt={2}>Use these with /oauth/token and grant_type=client_credentials.</Text>
          </Box>
          <Group gap="xs" wrap="nowrap">
            <NumberInput
              aria-label="Expires (days)"
              size="xs"
              w={130}
              min={1}
              max={3650}
              value={expiresInDays}
              onChange={(value) => setExpiresInDays(String(value))}
              placeholder="Expires (days)"
            />
            <Button
              onClick={handleIssueCredential}
              loading={issueCredential.isPending}
              size="xs"
              leftSection={<Key size={14} />}
            >
              Issue Client Secret
            </Button>
          </Group>
        </Group>

        {(si.credentials ?? []).length === 0 ? (
          <Paper withBorder radius="md" p="lg">
            <Text size="sm" c="dimmed" ta="center">No credentials yet</Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {(si.credentials ?? []).map((cred: ServiceIdentityCredentialDto) => {
              const isRevoked = !!cred.revokedAt
              const isExpired = cred.expiresAt ? new Date(cred.expiresAt) < new Date() : false
              const status = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active'

              return (
                <Paper key={cred.id} withBorder radius="md" px="sm" py="xs">
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Box miw={0} style={{ flex: 1 }}>
                      <Text size="xs" ff="monospace" truncate>{cred.clientId}</Text>
                      <Group gap="sm" mt={2} wrap="wrap">
                        <Text size="xs" fw={500} c={status === 'active' ? 'green' : 'red'}>{status}</Text>
                        {cred.expiresAt && <Text size="xs" c="dimmed">Expires {new Date(cred.expiresAt).toLocaleDateString()}</Text>}
                        {cred.lastUsedAt && <Text size="xs" c="dimmed">Last used {new Date(cred.lastUsedAt).toLocaleString()}</Text>}
                      </Group>
                    </Box>
                    {!isRevoked && (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Rotate credential">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => handleRotate(cred.id)}
                            title="Rotate credential"
                            aria-label="Rotate credential"
                          >
                            <RotateCw size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Revoke credential">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setCredentialToRevoke(cred.id)}
                            title="Revoke credential"
                            aria-label="Revoke credential"
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        )}
      </Box>

      <Box>
        <Group justify="space-between" mb="sm">
          <Title order={4} size="h6">Credential Usage Telemetry</Title>
          <RefreshButton
            size="xs"
            onRefresh={() => refetchUsage()}
            loading={isUsageRefreshing}
            lastUpdated={null}
          />
        </Group>
        {usage.length === 0 ? (
          <Text size="sm" c="dimmed">No usage telemetry available yet.</Text>
        ) : (
          <Paper withBorder radius="md">
            {usage.map((entry, idx) => (
              <Group
                key={entry.credentialId}
                justify="space-between"
                px="sm"
                py="xs"
                style={idx > 0 ? { borderTop: '1px solid var(--nx-color-border)' } : undefined}
              >
                <Box>
                  <Text size="xs" ff="monospace">{entry.clientId}</Text>
                  <Text size="xs" c="dimmed">{entry.lastUsedAt ? `Last used ${new Date(entry.lastUsedAt).toLocaleString()}` : 'Never used'}</Text>
                </Box>
                <StatusBadge status={entry.status === 'active' ? 'success' : entry.status === 'expired' ? 'warning' : 'danger'}>{entry.status}</StatusBadge>
              </Group>
            ))}
          </Paper>
        )}
      </Box>

      <ConfirmDialog
        isOpen={!!credentialToRevoke}
        title="Revoke Credential"
        message="This will permanently revoke the credential. Any service using it will lose access immediately."
        variant="danger"
        pending={revokeCredential.isPending}
        onConfirm={handleRevoke}
        onCancel={() => setCredentialToRevoke(null)}
      />
    </Stack>
  )
}

const ServiceIdentities = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [identityToEdit, setIdentityToEdit] = useState<ServiceIdentityDto | null>(null)
  const [identityToManage, setIdentityToManage] = useState<ServiceIdentityDto | null>(null)
  const [identityToDelete, setIdentityToDelete] = useState<ServiceIdentityDto | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceIdentityDto['status']>('all')
  const [formData, setFormData] = useState(defaultForm)
  const [editFormData, setEditFormData] = useState(defaultForm)
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')

  const { data, isLoading, isFetching, refetch } = useServiceIdentities()
  const { data: scopes = [] } = useScopes()
  const { data: roles = [] } = useRoles()
  const { data: groups = [] } = useGroups()
  const createIdentity = useCreateServiceIdentity()
  const updateIdentity = useUpdateServiceIdentity()
  const deleteIdentity = useDeleteServiceIdentity()

  const identities: ServiceIdentityDto[] = (data as any)?.data ?? []
  const filteredIdentities = identities.filter((identity) => statusFilter === 'all' ? true : identity.status === statusFilter)

  useEffect(() => {
    if (!identityToEdit) return
    setEditFormData({
      name: identityToEdit.name,
      description: identityToEdit.description ?? '',
      status: identityToEdit.status,
      allowedScopes: [...identityToEdit.allowedScopes],
      roleIds: [...(identityToEdit.roleIds ?? [])],
      groupIds: [...(identityToEdit.groupIds ?? [])],
      allowedAudiences: identityToEdit.allowedAudiences.join(', ')
    })
  }, [identityToEdit])

  const handleCreate = async () => {
    if (!formData.name) return

    setCreateFormError('')
    try {
      await createIdentity.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status,
        allowedScopes: formData.allowedScopes,
        roleIds: formData.roleIds,
        groupIds: formData.groupIds,
        allowedAudiences: parseCommaSeparated(formData.allowedAudiences)
      })
      setCreateModalOpen(false)
      setFormData(defaultForm())
      refetch()
    } catch (error) {
      setCreateFormError(error instanceof Error ? error.message : 'Failed to create service identity')
    }
  }

  const handleEdit = (identity: ServiceIdentityDto) => {
    setEditFormError('')
    setIdentityToEdit(identity)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!identityToEdit || !editFormData.name) return

    setEditFormError('')
    try {
      await updateIdentity.mutateAsync({
        id: identityToEdit.id,
        data: {
          name: editFormData.name,
          description: editFormData.description || undefined,
          status: editFormData.status,
          allowedScopes: editFormData.allowedScopes,
          roleIds: editFormData.roleIds,
          groupIds: editFormData.groupIds,
          allowedAudiences: parseCommaSeparated(editFormData.allowedAudiences)
        }
      })
      setEditModalOpen(false)
      setIdentityToEdit(null)
      setEditFormData(defaultForm())
      refetch()
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : 'Failed to update service identity')
    }
  }

  const handleDelete = async () => {
    if (!identityToDelete) return
    await deleteIdentity.mutateAsync(identityToDelete.id)
    setIdentityToDelete(null)
    refetch()
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Machine Directory"
        title="Service Identities"
        description="M2M / workload accounts. These are not shown in the Users directory by default; list them here via GET /api/admin/service-identities, or pass includeServiceUsers=true on GET /api/admin/users when a combined listing is required."
        actions={
          <Button
            onClick={() => { setCreateFormError(''); setFormData(defaultForm()); setCreateModalOpen(true) }}
            leftSection={<Plus size={16} />}
          >
            New Identity
          </Button>
        }
      />

      <NativeSelect
        label="Filter by Status"
        maw={360}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as 'all' | ServiceIdentityDto['status'])}
        data={[{ value: 'all', label: 'All Identities' }, ...STATUS_OPTIONS]}
      />

      <SectionCard
        flush
        title="All Service Identities"
        actions={
          <RefreshButton
            size="xs"
            onRefresh={() => refetch()}
            loading={isFetching}
            lastUpdated={null}
          />
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredIdentities.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No service identities registered"
            description="Create a machine identity, then issue an OAuth client ID and secret for client-credentials tokens."
          />
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Identity</Table.Th>
                  <Table.Th>Access</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredIdentities.map((identity) => (
                  <Table.Tr key={identity.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Group gap="xs" wrap="wrap">
                          <Text size="sm" fw={500}>{identity.name}</Text>
                          {statusBadge(identity.status)}
                        </Group>
                        <Text size="xs" c="dimmed">{identity.description || 'No description'}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {identity.allowedScopes.length > 0 && (
                          <Group gap={4} wrap="wrap">
                            {identity.allowedScopes.map((scope) => (
                              <Badge key={scope} color="gray" variant="light" size="sm" tt="none">{scope}</Badge>
                            ))}
                          </Group>
                        )}
                        {identity.allowedAudiences.length > 0 && (
                          <Group gap={4} wrap="wrap">
                            {identity.allowedAudiences.map((audience) => (
                              <Badge key={audience} color="blue" variant="light" size="sm" tt="none">{audience}</Badge>
                            ))}
                          </Group>
                        )}
                        {!!identity.roleIds?.length && (
                          <Text size="xs" c="dimmed">Direct roles: {identity.roleIds.length}</Text>
                        )}
                        {!!identity.groupIds?.length && (
                          <Text size="xs" c="dimmed">Group memberships: {identity.groupIds.length}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" ff="monospace">Created {new Date(identity.createdAt).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button
                          onClick={() => {
                            setIdentityToManage(identity)
                            setManageModalOpen(true)
                          }}
                          variant="default"
                          size="xs"
                        >
                          Manage Credentials
                        </Button>
                        <Tooltip label="Edit identity">
                          <ActionIcon
                            onClick={() => handleEdit(identity)}
                            disabled={updateIdentity.isPending}
                            variant="subtle"
                            color="gray"
                            title="Edit identity"
                            aria-label="Edit identity"
                          >
                            <Pencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete identity">
                          <ActionIcon
                            onClick={() => setIdentityToDelete(identity)}
                            disabled={deleteIdentity.isPending}
                            variant="subtle"
                            color="red"
                            title="Delete identity"
                            aria-label="Delete identity"
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <Modal isOpen={createModalOpen} onClose={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} title="Create Service Identity">
        <Stack gap="md">
          <IdentityFormFields
            form={formData}
            setForm={setFormData}
            scopes={scopes as any[]}
            roles={roles as any[]}
            groups={groups as any[]}
          />
          {createFormError && <Alert color="red" variant="light">{createFormError}</Alert>}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => { setCreateModalOpen(false); setFormData(defaultForm()) }} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name}
              loading={createIdentity.isPending}
            >
              Create Identity
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setIdentityToEdit(null) }} title={`Edit Service Identity${identityToEdit ? `: ${identityToEdit.name}` : ''}`}>
        <Stack gap="md">
          <IdentityFormFields
            form={editFormData}
            setForm={setEditFormData}
            scopes={scopes as any[]}
            roles={roles as any[]}
            groups={groups as any[]}
          />
          {editFormError && <Alert color="red" variant="light">{editFormError}</Alert>}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={() => { setEditModalOpen(false); setIdentityToEdit(null) }} variant="default">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editFormData.name}
              loading={updateIdentity.isPending}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal isOpen={manageModalOpen} onClose={() => { setManageModalOpen(false); setIdentityToManage(null) }} title={`Manage Credentials${identityToManage ? `: ${identityToManage.name}` : ''}`} size="lg">
        {identityToManage && <CredentialsPanel identity={identityToManage} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!identityToDelete}
        title="Delete Service Identity"
        message={`Delete service identity "${identityToDelete?.name ?? ''}"? This will permanently revoke all associated credentials.`}
        variant="danger"
        pending={deleteIdentity.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIdentityToDelete(null)}
      />
    </Stack>
  )
}

export default ServiceIdentities
