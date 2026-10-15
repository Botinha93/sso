import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Collapse,
  Group,
  Image,
  Menu,
  NativeSelect,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  VisuallyHidden
} from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, StatusBadge, TableSkeleton } from '@nexus/design'
import { AppWindow, CheckCircle2, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Plus, Shield, Trash2, Upload } from 'lucide-react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

import {
  useCreateFederationProvider,
  useDeleteFederationProvider,
  useFederationProviders,
  useRotateSamlServiceProviderCertificate,
  useSamlServiceProviders,
  useUploadSamlServiceProviderMetadata,
  useUpdateFederationProvider,
  useCreateSamlServiceProvider,
  useUpdateSamlServiceProvider,
  useDeleteSamlServiceProvider,
  useSamlAssertions,
  type SamlServiceProviderDto,
  type SamlAssertionAuditDto,
} from '../hooks/useApi'

interface FederationProvider {
  id: string
  label: string
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint: string
  clientId: string
  scopes: string[]
  enabled: boolean
  source: 'env' | 'db'
  secretPreview?: string
}

// ─── Provider templates ────────────────────────────────────────────────────────

interface ProviderTemplate {
  id: string
  label: string
  logo: string
  color: string
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint: string
  scopes: string
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'google',
    label: 'Google',
    logo: 'https://www.google.com/favicon.ico',
    color: '#4285F4',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    logo: 'https://www.microsoft.com/favicon.ico',
    color: '#00A4EF',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: 'openid profile email User.Read',
  },
  {
    id: 'github',
    label: 'GitHub',
    logo: 'https://github.com/favicon.ico',
    color: '#24292F',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userInfoEndpoint: 'https://api.github.com/user',
    scopes: 'read:user user:email',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    logo: 'https://www.linkedin.com/favicon.ico',
    color: '#0A66C2',
    authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    logo: 'https://www.facebook.com/favicon.ico',
    color: '#1877F2',
    authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoEndpoint: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: 'public_profile email',
  },
  {
    id: 'discord',
    label: 'Discord',
    logo: 'https://discord.com/assets/favicon.ico',
    color: '#5865F2',
    authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    userInfoEndpoint: 'https://discord.com/api/users/@me',
    scopes: 'identify email',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    logo: 'https://twitter.com/favicon.ico',
    color: '#000000',
    authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    userInfoEndpoint: 'https://api.twitter.com/2/users/me',
    scopes: 'tweet.read users.read offline.access',
  },
  {
    id: 'apple',
    label: 'Apple',
    logo: 'https://www.apple.com/favicon.ico',
    color: '#000000',
    authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
    tokenEndpoint: 'https://appleid.apple.com/auth/token',
    userInfoEndpoint: 'https://appleid.apple.com/auth/userinfo',
    scopes: 'openid name email',
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    logo: 'https://gitlab.com/favicon.ico',
    color: '#FC6D26',
    authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
    tokenEndpoint: 'https://gitlab.com/oauth/token',
    userInfoEndpoint: 'https://gitlab.com/oauth/userinfo',
    scopes: 'openid profile email read_user',
  },
  {
    id: 'okta',
    label: 'Okta',
    logo: 'https://www.okta.com/favicon.ico',
    color: '#007DC1',
    authorizationEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/authorize',
    tokenEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/token',
    userInfoEndpoint: 'https://{your-domain}.okta.com/oauth2/default/v1/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'auth0',
    label: 'Auth0',
    logo: 'https://auth0.com/favicon.ico',
    color: '#EB5424',
    authorizationEndpoint: 'https://{your-tenant}.auth0.com/authorize',
    tokenEndpoint: 'https://{your-tenant}.auth0.com/oauth/token',
    userInfoEndpoint: 'https://{your-tenant}.auth0.com/userinfo',
    scopes: 'openid profile email',
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    logo: 'https://www.keycloak.org/resources/favicon.ico',
    color: '#00B8D9',
    authorizationEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/auth',
    tokenEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/token',
    userInfoEndpoint: 'https://{host}/realms/{realm}/protocol/openid-connect/userinfo',
    scopes: 'openid profile email',
  },
]

// ─── Template picker component ────────────────────────────────────────────────

function TemplatePicker({ onSelect }: { onSelect: (t: ProviderTemplate) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <Paper withBorder radius="md" mb="lg" style={{ overflow: 'hidden' }}>
      <UnstyledButton
        type="button"
        onClick={() => setOpen(p => !p)}
        w="100%"
        px="md"
        py="sm"
        bg="var(--nx-color-surface-sunken)"
        aria-expanded={open}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={600}>Start from a template</Text>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs" p="sm">
          {PROVIDER_TEMPLATES.map((t) => (
            <UnstyledButton
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              title={`Use ${t.label} template`}
            >
              <Paper withBorder radius="md" p="sm" className="nx-interactive" h="100%">
                <Stack gap={6} align="center">
                  <Image
                    src={t.logo}
                    alt={t.label}
                    w={24}
                    h={24}
                    fit="contain"
                    radius="sm"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                  <Text size="xs" fw={500} c="dimmed" ta="center" lh={1.2}>{t.label}</Text>
                </Stack>
              </Paper>
            </UnstyledButton>
          ))}
          <UnstyledButton
            type="button"
            onClick={() => setOpen(false)}
            title="Start blank"
          >
            <Paper withBorder radius="md" p="sm" className="nx-interactive" h="100%" style={{ borderStyle: 'dashed' }}>
              <Stack gap={6} align="center">
                <Plus size={18} color="var(--nx-color-text-muted)" />
                <Text size="xs" fw={500} c="dimmed" ta="center" lh={1.2}>Custom</Text>
              </Stack>
            </Paper>
          </UnstyledButton>
        </SimpleGrid>
      </Collapse>
    </Paper>
  )
}

const blankForm = {
  id: '',
  label: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userInfoEndpoint: '',
  clientId: '',
  clientSecret: '',
  scopes: 'openid profile email',
  enabled: true,
}

const FederationProviders = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data, isLoading, isFetching: isProvidersRefreshing, refetch } = useFederationProviders(debouncedSearch)
  const { data: samlData, isLoading: samlLoading, isFetching: isSamlProvidersRefreshing, refetch: refetchSamlProviders } = useSamlServiceProviders({ limit: 100, offset: 0 })
  const { data: assertionsData, isLoading: assertionsLoading, isFetching: isAssertionsRefreshing, refetch: refetchAssertions } = useSamlAssertions({ limit: 50 })
  const createProvider = useCreateFederationProvider()
  const updateProvider = useUpdateFederationProvider()
  const deleteProvider = useDeleteFederationProvider()
  const uploadSamlMetadata = useUploadSamlServiceProviderMetadata()
  const rotateSamlCertificate = useRotateSamlServiceProviderCertificate()
  const createSamlSp = useCreateSamlServiceProvider()
  const updateSamlSp = useUpdateSamlServiceProvider()
  const deleteSamlSp = useDeleteSamlServiceProvider()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<FederationProvider | null>(null)
  const [metadataTarget, setMetadataTarget] = useState<SamlServiceProviderDto | null>(null)
  const [rotateTarget, setRotateTarget] = useState<SamlServiceProviderDto | null>(null)
  const [metadataXml, setMetadataXml] = useState('')
  const [overwriteManualFields, setOverwriteManualFields] = useState(true)
  const [certificateType, setCertificateType] = useState<'signing' | 'encryption'>('signing')
  const [certificatePem, setCertificatePem] = useState('')
  const [samlActionMessage, setSamlActionMessage] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string>('')
  const [templatePicked, setTemplatePicked] = useState(false)

  // SAML SP CRUD state
  const [samlSpCreateOpen, setSamlSpCreateOpen] = useState(false)
  const [samlSpEditTarget, setSamlSpEditTarget] = useState<SamlServiceProviderDto | null>(null)
  const [samlSpDeleteTarget, setSamlSpDeleteTarget] = useState<SamlServiceProviderDto | null>(null)
  const [samlSpForm, setSamlSpForm] = useState<{
    entityId: string; acsUrl: string; sloUrl: string;
    nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean
  }>({ entityId: '', acsUrl: '', sloUrl: '', nameIdFormat: 'persistent', enabled: true })
  const [samlSpError, setSamlSpError] = useState<string | null>(null)

  // Assertions tab
  const [assertionsSpFilter, setAssertionsSpFilter] = useState('')

  const providers = useMemo(() => (data ?? []) as FederationProvider[], [data])
  const samlProviders = useMemo(() => samlData?.items ?? [], [samlData])
  const assertions = useMemo(() => {
    const items = (assertionsData as any)?.items ?? []
    if (!assertionsSpFilter) return items as SamlAssertionAuditDto[]
    return (items as SamlAssertionAuditDto[]).filter(a => a.spId === assertionsSpFilter)
  }, [assertionsData, assertionsSpFilter])

  const openCreate = () => {
    setForm(blankForm)
    setTemplatePicked(false)
    setCreateOpen(true)
  }

  const applyTemplate = (t: ProviderTemplate) => {
    setForm(p => ({
      ...p,
      id: t.id,
      label: t.label,
      authorizationEndpoint: t.authorizationEndpoint,
      tokenEndpoint: t.tokenEndpoint,
      userInfoEndpoint: t.userInfoEndpoint,
      scopes: t.scopes,
    }))
    setTemplatePicked(true)
  }

  const openEdit = (provider: FederationProvider) => {
    setEditingId(provider.id)
    setForm({
      id: provider.id,
      label: provider.label,
      authorizationEndpoint: provider.authorizationEndpoint,
      tokenEndpoint: provider.tokenEndpoint,
      userInfoEndpoint: provider.userInfoEndpoint,
      clientId: provider.clientId,
      clientSecret: '',
      scopes: provider.scopes.join(' '),
      enabled: provider.enabled,
    })
    setEditOpen(true)
  }

  const onCreate = async () => {
    if (!form.id || !form.label || !form.authorizationEndpoint || !form.tokenEndpoint || !form.userInfoEndpoint || !form.clientId || !form.clientSecret) {
      return
    }

    await createProvider.mutateAsync({
      id: form.id.trim(),
      label: form.label.trim(),
      authorizationEndpoint: form.authorizationEndpoint.trim(),
      tokenEndpoint: form.tokenEndpoint.trim(),
      userInfoEndpoint: form.userInfoEndpoint.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      scopes: form.scopes.split(' ').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
    })
    setCreateOpen(false)
    setForm(blankForm)
  }

  const onEdit = async () => {
    if (!editingId) return

    await updateProvider.mutateAsync({
      id: editingId,
      label: form.label.trim(),
      authorizationEndpoint: form.authorizationEndpoint.trim(),
      tokenEndpoint: form.tokenEndpoint.trim(),
      userInfoEndpoint: form.userInfoEndpoint.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret || undefined,
      scopes: form.scopes.split(' ').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
    })

    setEditOpen(false)
    setEditingId('')
    setForm(blankForm)
  }

  const onDelete = (provider: FederationProvider) => {
    if (provider.source === 'env') return
    setProviderToDelete(provider)
  }

  const confirmDeleteProvider = () => {
    if (!providerToDelete) return
    deleteProvider.mutate(providerToDelete.id, { onSuccess: () => setProviderToDelete(null) })
  }

  const openMetadataUpload = (provider: SamlServiceProviderDto) => {
    setMetadataTarget(provider)
    setMetadataXml(provider.metadata ?? '')
    setOverwriteManualFields(true)
    setSamlActionMessage(null)
  }

  const openCertificateRotate = (provider: SamlServiceProviderDto, type: 'signing' | 'encryption') => {
    setRotateTarget(provider)
    setCertificateType(type)
    setCertificatePem('')
    setSamlActionMessage(null)
  }

  const submitMetadataUpload = async () => {
    if (!metadataTarget || !metadataXml.trim()) return
    await uploadSamlMetadata.mutateAsync({
      id: metadataTarget.id,
      metadata: metadataXml,
      overwriteManualFields,
    })
    setMetadataTarget(null)
    setSamlActionMessage('Service provider metadata uploaded successfully.')
    await refetchSamlProviders()
  }

  const submitCertificateRotation = async () => {
    if (!rotateTarget || !certificatePem.trim()) return
    await rotateSamlCertificate.mutateAsync({
      id: rotateTarget.id,
      certificateType,
      certificate: certificatePem,
    })
    setRotateTarget(null)
    setSamlActionMessage(`${certificateType === 'signing' ? 'Signing' : 'Encryption'} certificate rotated.`)
    await refetchSamlProviders()
  }

  const openSamlSpCreate = () => {
    setSamlSpForm({ entityId: '', acsUrl: '', sloUrl: '', nameIdFormat: 'persistent', enabled: true })
    setSamlSpError(null)
    setSamlSpCreateOpen(true)
  }

  const submitSamlSpCreate = async () => {
    setSamlSpError(null)
    try {
      await createSamlSp.mutateAsync({
        entityId: samlSpForm.entityId,
        acsUrl: samlSpForm.acsUrl,
        sloUrl: samlSpForm.sloUrl || undefined,
        nameIdFormat: samlSpForm.nameIdFormat,
      })
      setSamlSpCreateOpen(false)
      setSamlActionMessage('SAML service provider created.')
    } catch (err: unknown) {
      setSamlSpError(err instanceof Error ? err.message : 'Failed to create service provider')
    }
  }

  const openSamlSpEdit = (sp: SamlServiceProviderDto) => {
    setSamlSpForm({
      entityId: sp.entityId,
      acsUrl: sp.acsUrl,
      sloUrl: sp.sloUrl ?? '',
      nameIdFormat: sp.nameIdFormat,
      enabled: sp.enabled,
    })
    setSamlSpError(null)
    setSamlSpEditTarget(sp)
  }

  const submitSamlSpEdit = async () => {
    if (!samlSpEditTarget) return
    setSamlSpError(null)
    try {
      await updateSamlSp.mutateAsync({
        id: samlSpEditTarget.id,
        entityId: samlSpForm.entityId,
        acsUrl: samlSpForm.acsUrl,
        sloUrl: samlSpForm.sloUrl || undefined,
        nameIdFormat: samlSpForm.nameIdFormat,
        enabled: samlSpForm.enabled,
      })
      setSamlSpEditTarget(null)
      setSamlActionMessage('SAML service provider updated.')
    } catch (err: unknown) {
      setSamlSpError(err instanceof Error ? err.message : 'Failed to update service provider')
    }
  }

  const confirmSamlSpDelete = () => {
    if (!samlSpDeleteTarget) return
    deleteSamlSp.mutate(samlSpDeleteTarget.id, {
      onSuccess: () => {
        setSamlSpDeleteTarget(null)
        setSamlActionMessage('SAML service provider deleted.')
      }
    })
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="User federation"
        title="Federation Providers"
        actions={
          <Button onClick={openCreate} leftSection={<Plus size={16} />}>
            New provider
          </Button>
        }
      />

      <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search federation providers…" maw={360} />

      <SectionCard
        title="Configured providers"
        badge={!isLoading ? <Badge variant="light" color="gray">{providers.length}</Badge> : undefined}
        actions={<RefreshButton size="xs" onRefresh={() => refetch()} loading={isProvidersRefreshing} withLastUpdated={false} />}
        flush
      >
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : providers.length === 0 ? (
          <EmptyState
            icon={AppWindow}
            title="No federation providers configured"
            description="Configure LDAP or SAML to sync users from external directories."
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Provider</Table.Th>
                  <Table.Th>Endpoints</Table.Th>
                  <Table.Th>Scopes</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={88} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {providers.map((provider) => (
                  <Table.Tr key={provider.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon variant="light" color="gray" size="md" radius="md">
                          <AppWindow size={14} />
                        </ThemeIcon>
                        <Box miw={0}>
                          <Text size="sm" fw={500}>{provider.label}</Text>
                          <Text size="xs" c="dimmed" ff="monospace">{provider.id}</Text>
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td maw={360}>
                      <Text size="xs" c="dimmed" truncate>auth: {provider.authorizationEndpoint}</Text>
                      <Text size="xs" c="dimmed" truncate>token: {provider.tokenEndpoint}</Text>
                      <Text size="xs" c="dimmed" truncate>userinfo: {provider.userInfoEndpoint}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {provider.scopes.map((scope) => (
                          <Badge key={scope} variant="default" tt="none" fw={400} ff="monospace">{scope}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <StatusBadge status={provider.enabled ? 'success' : 'neutral'}>
                          {provider.enabled ? 'Enabled' : 'Disabled'}
                        </StatusBadge>
                        <Badge variant="light" color={provider.source === 'env' ? 'cyan' : 'violet'}>
                          {provider.source.toUpperCase()}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label={provider.source === 'env' ? 'Environment providers are read-only' : 'Edit provider'}>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => openEdit(provider)}
                            disabled={provider.source === 'env'}
                            aria-label={provider.source === 'env' ? 'Environment providers are read-only' : 'Edit provider'}
                          >
                            <Pencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={provider.source === 'env' ? 'Environment providers are read-only' : 'Delete provider'}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => onDelete(provider)}
                            disabled={provider.source === 'env' || deleteProvider.isPending}
                            aria-label={provider.source === 'env' ? 'Environment providers are read-only' : 'Delete provider'}
                          >
                            <Trash2 size={16} />
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

      {samlActionMessage ? (
        <Alert color="green" icon={<CheckCircle2 size={16} />} withCloseButton onClose={() => setSamlActionMessage(null)}>
          {samlActionMessage}
        </Alert>
      ) : null}

      <SectionCard
        title="SAML service providers"
        description="Manage SAML 2.0 service provider registrations, metadata, and certificates."
        actions={
          <Group gap="xs" wrap="nowrap">
            <RefreshButton size="xs" onRefresh={() => refetchSamlProviders()} loading={isSamlProvidersRefreshing} withLastUpdated={false} />
            <Button size="xs" onClick={openSamlSpCreate} leftSection={<Plus size={14} />}>
              Add SP
            </Button>
          </Group>
        }
        flush
      >
        {samlLoading ? (
          <TableSkeleton rows={3} />
        ) : samlProviders.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No SAML service providers configured"
            description="Register a SAML service provider to enable SSO federation."
          />
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Entity ID</Table.Th>
                  <Table.Th>ACS URL</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th w={88}><VisuallyHidden>Actions</VisuallyHidden></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {samlProviders.map((provider) => (
                  <Table.Tr key={provider.id}>
                    <Table.Td>
                      <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{provider.entityId}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>{provider.acsUrl}</Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={provider.enabled ? 'success' : 'neutral'}>
                        {provider.enabled ? 'enabled' : 'disabled'}
                      </StatusBadge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{new Date(provider.updatedAt).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" color="gray" onClick={() => openSamlSpEdit(provider)} aria-label={`Edit ${provider.entityId}`}>
                            <Pencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label={`More actions for ${provider.entityId}`}>
                              <MoreHorizontal size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<Upload size={14} />} onClick={() => openMetadataUpload(provider)}>
                              Metadata
                            </Menu.Item>
                            <Menu.Item leftSection={<Shield size={14} />} onClick={() => openCertificateRotate(provider, 'signing')}>
                              Rotate signing
                            </Menu.Item>
                            <Menu.Item leftSection={<Shield size={14} />} onClick={() => openCertificateRotate(provider, 'encryption')}>
                              Rotate encryption
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => setSamlSpDeleteTarget(provider)}>
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      {/* SAML Assertions Audit Log */}
      <SectionCard
        title="SAML assertion audit log"
        description="Recent assertion activity across all service providers."
        actions={
          <Group gap="xs" wrap="nowrap">
            <NativeSelect
              size="xs"
              aria-label="Filter by service provider"
              value={assertionsSpFilter}
              onChange={e => setAssertionsSpFilter(e.currentTarget.value)}
              data={[
                { value: '', label: 'All SPs' },
                ...samlProviders.map(sp => ({ value: sp.id, label: sp.entityId }))
              ]}
              maw={240}
            />
            <RefreshButton size="xs" onRefresh={() => refetchAssertions()} loading={isAssertionsRefreshing} withLastUpdated={false} />
          </Group>
        }
        flush
      >
        {assertionsLoading ? (
          <Text size="sm" c="dimmed" ta="center" p="xl">Loading assertions…</Text>
        ) : assertions.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" p="xl">No assertion records found</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>SP</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Assertion ID</Table.Th>
                  <Table.Th>Session index</Table.Th>
                  <Table.Th>Time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {assertions.map(a => (
                  <Table.Tr key={a.id}>
                    <Table.Td maw={160}><Text size="xs" c="dimmed" ff="monospace" truncate>{samlProviders.find(sp => sp.id === a.spId)?.entityId ?? a.spId}</Text></Table.Td>
                    <Table.Td maw={160}><Text size="xs" ff="monospace" truncate>{a.subject ?? '—'}</Text></Table.Td>
                    <Table.Td maw={160}><Text size="xs" c="dimmed" ff="monospace" truncate>{a.assertionId}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{a.sessionIndex ?? '—'}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{new Date(a.createdAt).toLocaleString()}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create federation provider" size="lg">
        <TemplatePicker onSelect={applyTemplate} />
        <ProviderForm form={form} setForm={setForm} showId onSubmit={onCreate} submitLabel="Create provider" pending={createProvider.isPending} />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit federation provider" size="lg">
        <ProviderForm form={form} setForm={setForm} onSubmit={onEdit} submitLabel="Save changes" pending={updateProvider.isPending} />
      </Modal>

      {/* SAML SP Create Modal */}
      <Modal isOpen={samlSpCreateOpen} onClose={() => setSamlSpCreateOpen(false)} title="Add SAML service provider">
        <SamlSpForm form={samlSpForm} setForm={setSamlSpForm} error={samlSpError} onSubmit={submitSamlSpCreate} submitLabel="Create SP" pending={createSamlSp.isPending} />
      </Modal>

      {/* SAML SP Edit Modal */}
      <Modal isOpen={!!samlSpEditTarget} onClose={() => setSamlSpEditTarget(null)} title="Edit SAML service provider">
        <SamlSpForm form={samlSpForm} setForm={setSamlSpForm} error={samlSpError} onSubmit={submitSamlSpEdit} submitLabel="Save changes" pending={updateSamlSp.isPending} />
      </Modal>

      <ConfirmDialog
        isOpen={!!samlSpDeleteTarget}
        title="Delete SAML Service Provider"
        message={`Delete service provider "${samlSpDeleteTarget?.entityId ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete SP"
        variant="danger"
        pending={deleteSamlSp.isPending}
        onConfirm={confirmSamlSpDelete}
        onCancel={() => setSamlSpDeleteTarget(null)}
      />

      <Modal isOpen={!!metadataTarget} onClose={() => setMetadataTarget(null)} title="Upload SAML metadata" size="lg">
        <Stack gap="md">
          {metadataTarget ? <Text size="xs" c="dimmed">Target: <Code>{metadataTarget.entityId}</Code></Text> : null}
          <Textarea
            label="Metadata XML"
            autosize
            minRows={10}
            maxRows={20}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-xs)' } }}
            placeholder="<EntityDescriptor ...>...</EntityDescriptor>"
            value={metadataXml}
            onChange={(e) => setMetadataXml(e.currentTarget.value)}
          />
          <Checkbox
            label="Overwrite manually configured SAML fields with parsed metadata values"
            checked={overwriteManualFields}
            onChange={(e) => setOverwriteManualFields(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button
              onClick={submitMetadataUpload}
              disabled={!metadataXml.trim()}
              loading={uploadSamlMetadata.isPending}
              leftSection={<Upload size={16} />}
            >
              Upload metadata
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal isOpen={!!rotateTarget} onClose={() => setRotateTarget(null)} title="Rotate SAML certificate" size="lg">
        <Stack gap="md">
          {rotateTarget ? <Text size="xs" c="dimmed">Target: <Code>{rotateTarget.entityId}</Code></Text> : null}
          <NativeSelect
            label="Certificate type"
            value={certificateType}
            onChange={(e) => setCertificateType(e.currentTarget.value as 'signing' | 'encryption')}
            data={[
              { value: 'signing', label: 'Signing' },
              { value: 'encryption', label: 'Encryption' }
            ]}
          />
          <Textarea
            label="Certificate (PEM)"
            autosize
            minRows={10}
            maxRows={20}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-xs)' } }}
            placeholder="-----BEGIN CERTIFICATE-----"
            value={certificatePem}
            onChange={(e) => setCertificatePem(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              onClick={submitCertificateRotation}
              disabled={!certificatePem.trim()}
              loading={rotateSamlCertificate.isPending}
              leftSection={<Shield size={16} />}
            >
              Rotate certificate
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        isOpen={!!providerToDelete}
        title="Delete Federation Provider"
        message={`Delete provider "${providerToDelete?.label ?? ''}"?`}
        confirmLabel="Delete Provider"
        variant="danger"
        pending={deleteProvider.isPending}
        onConfirm={confirmDeleteProvider}
        onCancel={() => setProviderToDelete(null)}
      />
    </Stack>
  )
}

const monoInput = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } }

function ProviderForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  pending,
  showId = false,
}: {
  form: typeof blankForm
  setForm: Dispatch<SetStateAction<typeof blankForm>>
  onSubmit: () => void
  submitLabel: string
  pending: boolean
  showId?: boolean
}) {
  return (
    <Stack gap="md">
      {showId && (
        <TextInput label="Provider ID" styles={monoInput} value={form.id} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, id: value })) }} placeholder="google" />
      )}
      <TextInput label="Label" value={form.label} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, label: value })) }} placeholder="Google Workspace" />
      <TextInput label="Authorization endpoint" styles={monoInput} value={form.authorizationEndpoint} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, authorizationEndpoint: value })) }} placeholder="https://accounts.google.com/o/oauth2/v2/auth" />
      <TextInput label="Token endpoint" styles={monoInput} value={form.tokenEndpoint} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, tokenEndpoint: value })) }} placeholder="https://oauth2.googleapis.com/token" />
      <TextInput label="UserInfo endpoint" styles={monoInput} value={form.userInfoEndpoint} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, userInfoEndpoint: value })) }} placeholder="https://openidconnect.googleapis.com/v1/userinfo" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput label="Client ID" styles={monoInput} value={form.clientId} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, clientId: value })) }} />
        <PasswordInput label="Client secret" styles={monoInput} value={form.clientSecret} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, clientSecret: value })) }} placeholder="Leave empty to keep existing" autoComplete="new-password" />
      </SimpleGrid>
      <TextInput label="Scopes" description="Space-separated." styles={monoInput} value={form.scopes} onChange={(e) => { const value = e.currentTarget.value; setForm((p) => ({ ...p, scopes: value })) }} placeholder="openid profile email" />
      <Switch label="Provider is enabled" checked={form.enabled} onChange={(e) => { const checked = e.currentTarget.checked; setForm((p) => ({ ...p, enabled: checked })) }} />
      <Group justify="flex-end">
        <Button onClick={onSubmit} loading={pending}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  )
}

function SamlSpForm({
  form,
  setForm,
  error,
  onSubmit,
  submitLabel,
  pending,
}: {
  form: { entityId: string; acsUrl: string; sloUrl: string; nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean }
  setForm: Dispatch<SetStateAction<{ entityId: string; acsUrl: string; sloUrl: string; nameIdFormat: 'persistent' | 'transient' | 'emailAddress'; enabled: boolean }>>
  error: string | null
  onSubmit: () => void
  submitLabel: string
  pending: boolean
}) {
  return (
    <Stack gap="md">
      {error ? <Alert color="red">{error}</Alert> : null}
      <TextInput label="Entity ID" styles={monoInput} value={form.entityId} onChange={e => { const value = e.currentTarget.value; setForm(p => ({ ...p, entityId: value })) }} placeholder="https://sp.example.com/saml/metadata" required />
      <TextInput label="ACS URL" styles={monoInput} value={form.acsUrl} onChange={e => { const value = e.currentTarget.value; setForm(p => ({ ...p, acsUrl: value })) }} placeholder="https://sp.example.com/saml/acs" required />
      <TextInput label="SLO URL (optional)" styles={monoInput} value={form.sloUrl} onChange={e => { const value = e.currentTarget.value; setForm(p => ({ ...p, sloUrl: value })) }} placeholder="https://sp.example.com/saml/slo" />
      <NativeSelect
        label="Name ID format"
        value={form.nameIdFormat}
        onChange={e => { const value = e.currentTarget.value as typeof form.nameIdFormat; setForm(p => ({ ...p, nameIdFormat: value })) }}
        data={[
          { value: 'persistent', label: 'Persistent' },
          { value: 'transient', label: 'Transient' },
          { value: 'emailAddress', label: 'Email Address' }
        ]}
      />
      <Switch label="Service provider is enabled" checked={form.enabled} onChange={e => { const checked = e.currentTarget.checked; setForm(p => ({ ...p, enabled: checked })) }} />
      <Group justify="flex-end">
        <Button onClick={onSubmit} loading={pending}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  )
}

export default FederationProviders
