import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  CopyButton,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { Plus, Trash2, Shield, ChevronRight, X, Pencil, Copy, Check, KeyRound } from 'lucide-react'
import { CopyField, PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import { useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useScopes, useCreateScope, useDeleteScope, useAuthenticationFlows, useApps } from '../hooks/useApi'
import { DEFAULT_CLIENT_SCOPES, SCOPE_CLAIM_MAP } from '../constants/oidc-scopes'

interface OAuthClient {
  id: string
  appId?: string
  name: string
  secretPreview: string
  redirectUris: string[]
  allowedScopes: string[]
  grants: string[]
  requirePkce: boolean
  resources: string[]
  resourceMetadata?: Record<string, { label: string; description: string }>
  flowIds: string[]
  accessTokenTtlSeconds?: number | null
  refreshTokenTtlSeconds?: number | null
  createdAt: string
}

type GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token' | 'password' | 'device_code' | 'token_exchange' | 'jwt_bearer' | 'saml2_bearer' | 'ciba'

const GRANT_OPTIONS: Array<{ value: GrantType; label: string }> = [
  { value: 'authorization_code', label: 'Authorization Code' },
  { value: 'refresh_token', label: 'Refresh Token' },
  { value: 'client_credentials', label: 'Client Credentials' },
  { value: 'password', label: 'Password' },
  { value: 'device_code', label: 'Device Code' },
  { value: 'token_exchange', label: 'Token Exchange (RFC 8693)' },
  { value: 'jwt_bearer', label: 'JWT Bearer Assertion' },
  { value: 'saml2_bearer', label: 'SAML 2.0 Bearer Assertion' },
  { value: 'ciba', label: 'CIBA (Backchannel Authentication)' },
]

const generateClientSecret = () => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const defaultForm = () => ({
  appId: '',
  id: '',
  name: '',
  secret: generateClientSecret(),
  redirectUris: '',
  allowedScopes: [...DEFAULT_CLIENT_SCOPES] as string[],
  grants: ['authorization_code', 'refresh_token'] as GrantType[],
  requirePkce: false,
  flowIds: [] as string[],
  accessTokenTtlSeconds: '' as number | '',
  refreshTokenTtlSeconds: '' as number | ''
})

const formFromClient = (client: OAuthClient) => ({
  appId: client.appId ?? '',
  id: client.id,
  name: client.name,
  secret: '',
  redirectUris: client.redirectUris.join('\n'),
  allowedScopes: [...client.allowedScopes],
  grants: [...client.grants] as GrantType[],
  requirePkce: client.requirePkce,
  flowIds: [...(client.flowIds ?? [])],
  accessTokenTtlSeconds: (client.accessTokenTtlSeconds ?? '') as number | '',
  refreshTokenTtlSeconds: (client.refreshTokenTtlSeconds ?? '') as number | ''
})

const Clients = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<OAuthClient | null>(null)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [resourcesClient, setResourcesClient] = useState<OAuthClient | null>(null)
  const [newResource, setNewResource] = useState('')
  const [newScopeName, setNewScopeName] = useState('')
  const [newScopeDescription, setNewScopeDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [appFilterId, setAppFilterId] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: clients, isLoading, isFetching, refetch } = useClients(debouncedSearch)
  const { data: apps = [] } = useApps()
  const { data: scopes = [] } = useScopes()
  const { data: flows = [] } = useAuthenticationFlows()
  const createClient = useCreateClient()
  const createScope = useCreateScope()
  const deleteScope = useDeleteScope()
  const deleteClient = useDeleteClient()
  const updateClient = useUpdateClient()
  const [formData, setFormData] = useState(defaultForm)
  const appNameById = new Map((apps as any[]).map((app: any) => [app.id, app.name]))
  const filteredClients = (clients as OAuthClient[] | undefined)?.filter((client) => appFilterId === 'all'
    ? true
    : appFilterId === 'none'
      ? !client.appId
      : client.appId === appFilterId)

  const handleCreate = async () => {
    if (!formData.id || !formData.name || !formData.secret) return

    setFormError('')
    try {
      await createClient.mutateAsync({
        appId: formData.appId || undefined,
        id: formData.id,
        name: formData.name,
        secret: formData.secret,
        redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
        allowedScopes: formData.allowedScopes,
        grants: formData.grants,
        requirePkce: formData.requirePkce,
        flowIds: formData.flowIds,
        accessTokenTtlSeconds: formData.accessTokenTtlSeconds === '' ? undefined : Number(formData.accessTokenTtlSeconds),
        refreshTokenTtlSeconds: formData.refreshTokenTtlSeconds === '' ? undefined : Number(formData.refreshTokenTtlSeconds)
      })
      setCreateModalOpen(false)
      setFormData(defaultForm())
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create client')
    }
  }

  const handleDelete = (id: string) => {
    setClientToDelete(id)
  }

  const handleEdit = (client: OAuthClient) => {
    setFormError('')
    setFormData(formFromClient(client))
    setEditClient(client)
  }

  const closeClientModal = () => {
    setFormError('')
    setCreateModalOpen(false)
    setEditClient(null)
    setFormData(defaultForm())
  }

  const confirmDeleteClient = () => {
    if (!clientToDelete) return
    deleteClient.mutate(clientToDelete, { onSuccess: () => setClientToDelete(null) })
  }

  const handleAddResource = () => {
    const resource = newResource.trim()
    if (!resource || !resourcesClient) return
    const current: string[] = resourcesClient.resources ?? []
    if (current.includes(resource)) return
    const updated = [...current, resource]
    updateClient.mutate(
      { id: resourcesClient.id, resources: updated },
      { onSuccess: () => { setResourcesClient(c => c ? { ...c, resources: updated } : null); setNewResource('') } }
    )
  }

  const handleRemoveResource = (resource: string) => {
    if (!resourcesClient) return
    const updated = (resourcesClient.resources ?? []).filter(r => r !== resource)
    const resourceMetadata = { ...(resourcesClient.resourceMetadata ?? {}) }
    delete resourceMetadata[resource]
    updateClient.mutate(
      { id: resourcesClient.id, resources: updated, resourceMetadata },
      { onSuccess: () => setResourcesClient(c => c ? { ...c, resources: updated, resourceMetadata } : null) }
    )
  }

  const saveResourceMetadata = (resource: string, field: 'label' | 'description', value: string) => {
    if (!resourcesClient) return
    const resourceMetadata = { ...(resourcesClient.resourceMetadata ?? {}) }
    const current = resourceMetadata[resource] ?? { label: '', description: '' }
    resourceMetadata[resource] = { ...current, [field]: value }
    setResourcesClient(c => c ? { ...c, resourceMetadata } : null)
    updateClient.mutate({ id: resourcesClient.id, resourceMetadata })
  }

  const toggleScope = (scopeName: string) => {
    setFormData(f => {
      const has = f.allowedScopes.includes(scopeName)
      return {
        ...f,
        allowedScopes: has ? f.allowedScopes.filter(s => s !== scopeName) : [...f.allowedScopes, scopeName]
      }
    })
  }

  const handleCreateScope = async () => {
    if (!newScopeName.trim()) return

    setFormError('')
    try {
      await createScope.mutateAsync({ name: newScopeName.trim(), description: newScopeDescription.trim() })
      setFormData(f => ({ ...f, allowedScopes: f.allowedScopes.includes(newScopeName.trim()) ? f.allowedScopes : [...f.allowedScopes, newScopeName.trim()] }))
      setNewScopeName('')
      setNewScopeDescription('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create scope')
    }
  }

  const handleDeleteScope = async (scope: { id: string; name: string }) => {
    if (!window.confirm(`Delete scope "${scope.name}"?`)) return

    setFormError('')
    try {
      await deleteScope.mutateAsync(scope.id)
      setFormData((f) => ({ ...f, allowedScopes: f.allowedScopes.filter((s) => s !== scope.name) }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete scope')
    }
  }

  const toggleFlow = (flowId: string) => {
    setFormData(f => {
      const has = f.flowIds.includes(flowId)
      return {
        ...f,
        flowIds: has ? f.flowIds.filter(id => id !== flowId) : [...f.flowIds, flowId]
      }
    })
  }

  const toggleGrant = (grant: GrantType) => {
    setFormData(f => {
      const has = f.grants.includes(grant)
      return {
        ...f,
        grants: has ? f.grants.filter(item => item !== grant) : [...f.grants, grant]
      }
    })
  }

  const handleUpdate = async () => {
    if (!editClient || !formData.name || formData.allowedScopes.length === 0 || formData.grants.length === 0) return

    setFormError('')
    try {
      await updateClient.mutateAsync({
        id: editClient.id,
        appId: formData.appId || undefined,
        name: formData.name,
        secret: formData.secret.trim() ? formData.secret : undefined,
        redirectUris: formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean),
        allowedScopes: formData.allowedScopes,
        grants: formData.grants,
        requirePkce: formData.requirePkce,
        flowIds: formData.flowIds,
        accessTokenTtlSeconds: formData.accessTokenTtlSeconds === '' ? null : Number(formData.accessTokenTtlSeconds),
        refreshTokenTtlSeconds: formData.refreshTokenTtlSeconds === '' ? null : Number(formData.refreshTokenTtlSeconds)
      })
      closeClientModal()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update client')
    }
  }

  const appOptions = (apps as any[]).map((app: any) => ({ value: String(app.id), label: String(app.name) }))
  const redirectUriList = formData.redirectUris.split('\n').map(s => s.trim()).filter(Boolean)

  return (
    <>
      <PageHeader
        eyebrow="OAuth Clients"
        title="Registered Applications"
        actions={
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => { setFormError(''); setFormData(defaultForm()); setCreateModalOpen(true); setEditClient(null) }}
          >
            New Client
          </Button>
        }
      />

      <Group justify="space-between" align="flex-end" gap="sm">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search clients by id or name…" maw={360} w="100%" />
        <Select
          label="Filter by App"
          value={appFilterId}
          onChange={(value) => setAppFilterId(value ?? 'all')}
          allowDeselect={false}
          data={[
            { value: 'all', label: 'All Apps' },
            { value: 'none', label: 'Unassigned' },
            ...appOptions,
          ]}
          w={280}
        />
      </Group>

      <SectionCard
        title="All Clients"
        flush
        actions={<RefreshButton onRefresh={() => refetch()} loading={isFetching} size="xs" lastUpdated={null} />}
      >
        {isLoading ? (
          <TableSkeleton rows={5} columns={['text', 'pill', 'mono', 'action']} />
        ) : !filteredClients?.length ? (
          <EmptyState
            icon={KeyRound}
            title="No clients registered"
            description="Register an OAuth client to start authorizing applications."
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Grants</Table.Th>
                  <Table.Th>Redirect URIs</Table.Th>
                  <Table.Th w={120} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredClients.map((client: OAuthClient) => (
                  <Table.Tr key={client.id}>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={6} wrap="wrap">
                          <Text size="sm" fw={500}>{client.name}</Text>
                          <Badge variant="light" color={client.appId ? 'blue' : 'gray'}>
                            {client.appId ? appNameById.get(client.appId) ?? 'App' : 'No App'}
                          </Badge>
                          {client.requirePkce && (
                            <Badge variant="light" color="cyan" leftSection={<Shield size={10} />}>PKCE</Badge>
                          )}
                          {(client.resources?.length ?? 0) > 0 && (
                            <Badge variant="light" color="violet">
                              {client.resources.length} resource{client.resources.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {(client.flowIds?.length ?? 0) > 0 && (
                            <Badge variant="light" color="green">
                              {client.flowIds.length} flow{client.flowIds.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </Group>
                        <CopyField variant="inline" value={client.id} copyLabel="Copy client ID" />
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="wrap">
                        {client.grants.map(g => (
                          <Badge key={g} variant="default" ff="monospace" tt="none" fw={500}>{g}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td maw={280}>
                      <Text size="xs" c="dimmed" truncate title={client.redirectUris.join(', ')}>
                        {client.redirectUris.join(', ') || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit client">
                          <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(client)} aria-label="Edit client" title="Edit client">
                            <Pencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Manage resources">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => { setResourcesClient(client); setNewResource('') }}
                            aria-label="Manage resources"
                            title="Manage resources"
                          >
                            <ChevronRight size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete client">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(client.id)}
                            disabled={deleteClient.isPending}
                            aria-label="Delete client"
                            title="Delete client"
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

      <Modal isOpen={createModalOpen || !!editClient} onClose={closeClientModal} title={editClient ? `Edit OAuth Client: ${editClient.name}` : 'Create OAuth Client'} size="lg">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="App"
              value={formData.appId}
              onChange={(value) => setFormData(f => ({ ...f, appId: value ?? '' }))}
              allowDeselect={false}
              data={[{ value: '', label: 'No app' }, ...appOptions]}
            />
            <TextInput
              label="Client ID"
              value={formData.id}
              onChange={e => { const value = e.currentTarget.value; setFormData(f => ({ ...f, id: value })) }}
              disabled={!!editClient}
              ff="monospace"
              placeholder="my-app"
            />
          </SimpleGrid>
          <TextInput
            label={editClient ? 'Rotate Client Secret' : 'Client Secret'}
            description={!editClient ? 'A strong secret is generated automatically for new confidential clients.' : undefined}
            value={formData.secret}
            onChange={e => { const value = e.currentTarget.value; setFormData(f => ({ ...f, secret: value })) }}
            ff="monospace"
            placeholder={editClient ? 'Leave blank to keep current secret' : 'Auto-generated secret'}
            rightSectionWidth={formData.secret ? 36 : undefined}
            rightSection={formData.secret ? (
              <CopyButton value={formData.secret} timeout={1500}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy'}>
                    <ActionIcon variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy} aria-label="Copy client secret">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            ) : null}
            inputContainer={(children) => (
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Box flex={1}>{children}</Box>
                {!editClient ? (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setFormData((f) => ({ ...f, secret: generateClientSecret() }))}
                  >
                    Regenerate
                  </Button>
                ) : null}
              </Group>
            )}
          />
          <TextInput
            label="Client Name"
            value={formData.name}
            onChange={e => { const value = e.currentTarget.value; setFormData(f => ({ ...f, name: value })) }}
            placeholder="My Application"
          />
          <TagsInput
            label="Redirect URIs"
            description="Press Enter after each URI."
            value={redirectUriList}
            onChange={(values) => setFormData(f => ({ ...f, redirectUris: values.join('\n') }))}
            splitChars={[' ', '\n']}
            acceptValueOnBlur
            placeholder={redirectUriList.length ? undefined : 'https://app.example.com/callback'}
            styles={{ pillsList: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Stack gap={6}>
              <Box>
                <Text size="sm" fw={500}>Allowed Scopes</Text>
                <Text size="xs" c="dimmed">
                  Select which scopes this client may request. Known scopes map to specific token claims.
                </Text>
              </Box>
              <Paper withBorder radius="md" bg="var(--nx-color-surface-sunken)">
                <ScrollArea.Autosize mah={220} type="auto">
                  <Stack gap={8} p="sm">
                    {scopes.length === 0 && <Text size="xs" c="dimmed">No scopes defined.</Text>}
                    {scopes.map((scope: any) => {
                      const claimHints = SCOPE_CLAIM_MAP[scope.name]
                      return (
                        <Checkbox
                          key={scope.id}
                          size="xs"
                          checked={formData.allowedScopes.includes(scope.name)}
                          onChange={() => toggleScope(scope.name)}
                          label={<Text span size="xs" ff="monospace">{scope.name}</Text>}
                          description={(scope.description || claimHints) ? (
                            <>
                              {scope.description && <Text span size="xs" c="dimmed" display="block">{scope.description}</Text>}
                              {claimHints && (
                                <Text span size="10px" c="dimmed" ff="monospace" display="block">
                                  claims: {claimHints.join(', ')}
                                </Text>
                              )}
                            </>
                          ) : undefined}
                        />
                      )
                    })}
                  </Stack>
                </ScrollArea.Autosize>
              </Paper>
            </Stack>
            <Stack gap={6}>
              <Text size="sm" fw={500}>Grants</Text>
              <Paper withBorder radius="md" bg="var(--nx-color-surface-sunken)">
                <ScrollArea.Autosize mah={220} type="auto">
                  <Stack gap={8} p="sm">
                    {GRANT_OPTIONS.map((grant) => (
                      <Checkbox
                        key={grant.value}
                        size="xs"
                        checked={formData.grants.includes(grant.value)}
                        onChange={() => toggleGrant(grant.value)}
                        label={
                          <Group gap={6} wrap="wrap">
                            <Text span size="xs" ff="monospace">{grant.value}</Text>
                            <Text span size="xs" c="dimmed">{grant.label}</Text>
                          </Group>
                        }
                      />
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Paper>
            </Stack>
          </SimpleGrid>
          <Stack gap={6}>
            <Text size="sm" fw={500}>Allowed Authentication Flows</Text>
            <Paper withBorder radius="md" bg="var(--nx-color-surface-sunken)">
              <ScrollArea.Autosize mah={140} type="auto">
                <Stack gap={8} p="sm">
                  {(flows as any[]).length === 0 && <Text size="xs" c="dimmed">No flows defined.</Text>}
                  {(flows as any[]).map((flow: any) => (
                    <Checkbox
                      key={flow.id}
                      size="xs"
                      checked={formData.flowIds.includes(flow.id)}
                      onChange={() => toggleFlow(flow.id)}
                      label={
                        <Group gap={6}>
                          <Text span size="xs">{flow.name}</Text>
                          {flow.enabled && <Badge size="xs" variant="light" color="green">active</Badge>}
                        </Group>
                      }
                    />
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            </Paper>
          </Stack>
          <Paper withBorder radius="md" p="sm" bg="var(--nx-color-surface-sunken)">
            <Stack gap="xs">
              <Box>
                <Text size="sm" fw={600}>Scope Catalog</Text>
                <Text size="xs" c="dimmed">
                  Add custom API scopes here, then enable them for clients above. Built-in scopes unlock standard OIDC claims.
                </Text>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <TextInput
                  value={newScopeName}
                  onChange={e => setNewScopeName(e.currentTarget.value)}
                  ff="monospace"
                  placeholder="PDV"
                  aria-label="Scope name"
                />
                <TextInput
                  value={newScopeDescription}
                  onChange={e => setNewScopeDescription(e.currentTarget.value)}
                  placeholder="Sales point system"
                  aria-label="Scope description"
                />
              </SimpleGrid>
              <Group justify="flex-end">
                <Button
                  size="xs"
                  onClick={handleCreateScope}
                  disabled={!newScopeName.trim()}
                  loading={createScope.isPending}
                >
                  Add Scope
                </Button>
              </Group>
              <Stack gap={6}>
                {scopes.length === 0 ? (
                  <Text size="xs" c="dimmed">No scopes available.</Text>
                ) : (
                  scopes.map((scope: any) => (
                    <Paper key={scope.id} withBorder radius="sm" px="sm" py={6}>
                      <Group justify="space-between" wrap="nowrap" gap="sm">
                        <Box miw={0}>
                          <Text size="xs" ff="monospace" truncate>{scope.name}</Text>
                          <Text size="xs" c="dimmed" truncate>{scope.description || 'No description'}</Text>
                        </Box>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDeleteScope(scope)}
                          disabled={deleteScope.isPending}
                          aria-label="Delete scope"
                          title="Delete scope"
                        >
                          <Trash2 size={12} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>
            </Stack>
          </Paper>
          <Checkbox
            checked={formData.requirePkce}
            onChange={e => { const checked = e.currentTarget.checked; setFormData(f => ({ ...f, requirePkce: checked })) }}
            label="Require PKCE (recommended for public clients)"
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Access token TTL (seconds)"
              description="Lifetime of issued access tokens. Leave blank to use the default (900 = 15 min). Allowed: 60 – 86,400."
              min={60}
              max={86400}
              allowDecimal={false}
              value={formData.accessTokenTtlSeconds}
              onChange={(value) => setFormData(f => ({ ...f, accessTokenTtlSeconds: value === '' ? '' : Number(value) }))}
              placeholder="900"
            />
            <NumberInput
              label="Refresh token TTL (seconds)"
              description="Lifetime of issued refresh tokens. Leave blank to use the default (2,592,000 = 30 days). Allowed: 300 – 31,536,000."
              min={300}
              max={31536000}
              allowDecimal={false}
              value={formData.refreshTokenTtlSeconds}
              onChange={(value) => setFormData(f => ({ ...f, refreshTokenTtlSeconds: value === '' ? '' : Number(value) }))}
              placeholder="2592000"
            />
          </SimpleGrid>
          {formError && <Alert color="red" variant="light">{formError}</Alert>}
          <Group justify="flex-end" gap="xs" pt="xs">
            <Button onClick={closeClientModal} variant="default">
              Cancel
            </Button>
            <Button
              onClick={editClient ? handleUpdate : handleCreate}
              loading={editClient ? updateClient.isPending : createClient.isPending}
              disabled={
                editClient
                  ? !formData.name || formData.allowedScopes.length === 0 || formData.grants.length === 0
                  : !formData.id || !formData.name || !formData.secret || formData.allowedScopes.length === 0 || formData.grants.length === 0
              }
            >
              {editClient ? 'Save Changes' : 'Create Client'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Resources modal */}
      <Modal isOpen={!!resourcesClient} onClose={() => setResourcesClient(null)} title={`Resources: ${resourcesClient?.name ?? ''}`}>
        <Stack gap="md">
          <Text size="xs" c="dimmed">Define resource identifiers for this client. NexusHub consent requires an administrator-owned label and description for each audience.</Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              value={newResource}
              onChange={e => setNewResource(e.currentTarget.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddResource() }}
              ff="monospace"
              placeholder="invoices"
              aria-label="Resource identifier"
              flex={1}
            />
            <ActionIcon
              size="lg"
              onClick={handleAddResource}
              disabled={!newResource.trim() || updateClient.isPending}
              aria-label="Add resource"
            >
              <Plus size={16} />
            </ActionIcon>
          </Group>
          <Stack gap={6}>
            {(resourcesClient?.resources ?? []).length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="xs">No resources defined yet.</Text>
            )}
            {(resourcesClient?.resources ?? []).map(r => (
              <Paper key={r} withBorder radius="md" px="sm" py={6} bg="var(--nx-color-surface-sunken)">
                <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" ff="monospace" truncate>{r}</Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleRemoveResource(r)}
                    aria-label={`Remove resource ${r}`}
                  >
                    <X size={13} />
                  </ActionIcon>
                </Group>
                <TextInput label="Trusted consent label" placeholder="Customer conversations" value={resourcesClient?.resourceMetadata?.[r]?.label ?? ''} onChange={e => saveResourceMetadata(r, 'label', e.currentTarget.value)} />
                <TextInput label="Trusted consent description" placeholder="Read and update conversations you have access to." value={resourcesClient?.resourceMetadata?.[r]?.description ?? ''} onChange={e => saveResourceMetadata(r, 'description', e.currentTarget.value)} />
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Group justify="flex-end" pt={4}>
            <Button onClick={() => setResourcesClient(null)} variant="default">
              Done
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        isOpen={!!clientToDelete}
        title="Delete Client"
        message={`Delete client "${clientToDelete ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete Client"
        variant="danger"
        pending={deleteClient.isPending}
        onConfirm={confirmDeleteClient}
        onCancel={() => setClientToDelete(null)}
      />
    </>
  )
}

export default Clients;
