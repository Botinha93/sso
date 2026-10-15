import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Alert,
  Box,
  Button,
  ColorInput,
  Group,
  Image,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton
} from '@mantine/core'
import { PageHeader, PageHeaderSkeleton, RefreshButton, SectionCard } from '@nexus/design'
import { ArrowUpRight, CheckCircle2, Save, Sparkles, Trash2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApps, useClients, useInstanceSettings, useUpdateInstanceSettings } from '../hooks/useApi'

type UiSurface = 'admin_login' | 'consent' | 'portal_login' | 'portal_launcher'

type UiSurfaceCustomization = {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

type UiCustomizationSettings = {
  defaultBySurface: Record<string, UiSurfaceCustomization>
  byClientId: Record<string, Record<string, UiSurfaceCustomization>>
  byAppId: Record<string, Record<string, UiSurfaceCustomization>>
}

type Scope = 'default' | 'client' | 'app'

const surfaces: Array<{ key: UiSurface; label: string; route: string }> = [
  { key: 'admin_login', label: 'Admin Login', route: '/login' },
  { key: 'consent', label: 'Consent', route: '/consent' },
  { key: 'portal_login', label: 'Portal Login', route: '/portal/login' },
  { key: 'portal_launcher', label: 'Portal Launcher', route: '/portal/' },
]

const presetColors = [
  '#0f172a', '#111827', '#0b1220', '#1d4ed8', '#0ea5e9', '#14b8a6', '#22c55e',
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'
]

const emptyDraft: UiSurfaceCustomization = {
  title: '',
  subtitle: '',
  logoUrl: '',
  primaryColor: '',
  accentColor: '',
  backgroundCss: '',
}

function normalize(input: any): UiCustomizationSettings {
  return {
    defaultBySurface: typeof input?.defaultBySurface === 'object' && input.defaultBySurface ? input.defaultBySurface : {},
    byClientId: typeof input?.byClientId === 'object' && input.byClientId ? input.byClientId : {},
    byAppId: typeof input?.byAppId === 'object' && input.byAppId ? input.byAppId : {},
  }
}

function cleanDraft(draft: UiSurfaceCustomization): UiSurfaceCustomization {
  const out: UiSurfaceCustomization = {}
  const entries: Array<keyof UiSurfaceCustomization> = ['title', 'subtitle', 'logoUrl', 'primaryColor', 'accentColor', 'backgroundCss']
  for (const key of entries) {
    const value = draft[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) out[key] = trimmed
    }
  }
  return out
}

function isEmptyCustomization(customization: UiSurfaceCustomization) {
  return Object.keys(customization).length === 0
}

export default function UiCustomizations() {
  const { data: settings, isLoading, isFetching, refetch } = useInstanceSettings()
  const { data: clients = [] } = useClients()
  const { data: apps = [] } = useApps()
  const updateSettings = useUpdateInstanceSettings()

  const [config, setConfig] = useState<UiCustomizationSettings>(normalize(null))
  const [scope, setScope] = useState<Scope>('default')
  const [surface, setSurface] = useState<UiSurface>('admin_login')
  const [clientId, setClientId] = useState('')
  const [appId, setAppId] = useState('')
  const [draft, setDraft] = useState<UiSurfaceCustomization>(emptyDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setConfig(normalize((settings as any)?.uiCustomizations))
  }, [settings])

  const clientOptions = useMemo(
    () => (clients as any[]).map((client: any) => ({ id: String(client.id), name: String(client.name ?? client.id) })),
    [clients]
  )

  const appOptions = useMemo(
    () => (apps as any[]).map((app: any) => ({ id: String(app.id), name: String(app.name ?? app.id) })),
    [apps]
  )

  useEffect(() => {
    if (!clientId && clientOptions.length > 0) setClientId(clientOptions[0].id)
  }, [clientId, clientOptions])

  useEffect(() => {
    if (!appId && appOptions.length > 0) setAppId(appOptions[0].id)
  }, [appId, appOptions])

  const scopedSurfaceCustomization = useMemo(() => {
    if (scope === 'default') {
      return config.defaultBySurface[surface] ?? {}
    }
    if (scope === 'client') {
      if (!clientId) return {}
      return config.byClientId[clientId]?.[surface] ?? {}
    }
    if (!appId) return {}
    return config.byAppId[appId]?.[surface] ?? {}
  }, [appId, clientId, config, scope, surface])

  useEffect(() => {
    setDraft({ ...emptyDraft, ...scopedSurfaceCustomization })
  }, [scopedSurfaceCustomization])

  const saveScopedCustomization = () => {
    setMessage(null)
    setError(null)

    if (scope === 'client' && !clientId) {
      setError('Select a client before saving a client-scoped customization.')
      return
    }

    if (scope === 'app' && !appId) {
      setError('Select an app before saving an app-scoped customization.')
      return
    }

    const cleaned = cleanDraft(draft)

    setConfig((prev) => {
      const next: UiCustomizationSettings = {
        defaultBySurface: { ...prev.defaultBySurface },
        byClientId: { ...prev.byClientId },
        byAppId: { ...prev.byAppId },
      }

      if (scope === 'default') {
        if (isEmptyCustomization(cleaned)) {
          delete next.defaultBySurface[surface]
        } else {
          next.defaultBySurface[surface] = cleaned
        }
        return next
      }

      if (scope === 'client') {
        const selectedClientId = clientId
        const clientMap = { ...(next.byClientId[selectedClientId] ?? {}) }
        if (isEmptyCustomization(cleaned)) {
          delete clientMap[surface]
        } else {
          clientMap[surface] = cleaned
        }
        if (Object.keys(clientMap).length === 0) {
          delete next.byClientId[selectedClientId]
        } else {
          next.byClientId[selectedClientId] = clientMap
        }
        return next
      }

      const selectedAppId = appId
      const appMap = { ...(next.byAppId[selectedAppId] ?? {}) }
      if (isEmptyCustomization(cleaned)) {
        delete appMap[surface]
      } else {
        appMap[surface] = cleaned
      }
      if (Object.keys(appMap).length === 0) {
        delete next.byAppId[selectedAppId]
      } else {
        next.byAppId[selectedAppId] = appMap
      }
      return next
    })

    setMessage('Customization staged locally. Click Save All to persist.')
  }

  const clearScopedCustomization = () => {
    setDraft(emptyDraft)
    setMessage('Draft cleared. Click Apply To Scope and then Save All to persist removal.')
    setError(null)
  }

  const saveAll = async () => {
    try {
      setMessage(null)
      setError(null)
      await updateSettings.mutateAsync({ uiCustomizations: config })
      setMessage('UI customizations saved successfully.')
      refetch()
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Failed to save UI customizations')
    }
  }

  const previewStyles: CSSProperties = {
    background: draft.backgroundCss?.trim() || 'var(--nx-color-surface-sunken)',
  }

  if (isLoading) {
    return <PageHeaderSkeleton blocks={3} />
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Branding and UX"
        title="Experience Customization"
        description="Configure titles, visual accents, logos, and backgrounds for hosted interaction surfaces. You can define global defaults and override by OAuth client or app."
        actions={
          <Group gap="xs" wrap="nowrap">
            <RefreshButton onRefresh={() => refetch()} loading={isFetching} withLastUpdated={false} />
            <Button onClick={saveAll} loading={updateSettings.isPending} leftSection={<Save size={16} />}>
              Save all
            </Button>
          </Group>
        }
      />

      {(message || error) ? (
        <Alert
          color={error ? 'red' : 'green'}
          icon={error ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          withCloseButton
          onClose={() => { setMessage(null); setError(null) }}
        >
          {error ?? message}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <SectionCard
          title="Editor"
          description="Select scope and surface, update fields, apply to scope, then save all changes."
          footer={
            <>
              <Button variant="default" color="red" c="red" leftSection={<Trash2 size={16} />} onClick={clearScopedCustomization}>
                Clear draft
              </Button>
              <Button variant="default" leftSection={<Sparkles size={16} />} onClick={saveScopedCustomization}>
                Apply to scope
              </Button>
            </>
          }
        >
          <Stack gap="md">
            <Stack gap={6}>
              <Text size="sm" fw={500}>Scope</Text>
              <SegmentedControl
                fullWidth
                value={scope}
                onChange={(value) => setScope(value as Scope)}
                data={[
                  { value: 'default', label: 'Default' },
                  { value: 'client', label: 'Client' },
                  { value: 'app', label: 'App' }
                ]}
                aria-label="Scope"
              />
            </Stack>

            {scope === 'client' ? (
              <Select
                label="Client override target"
                value={clientId || null}
                onChange={(value) => setClientId(value ?? '')}
                data={clientOptions.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                placeholder={clientOptions.length === 0 ? 'No clients available' : 'Select a client'}
                disabled={clientOptions.length === 0}
                allowDeselect={false}
                searchable
              />
            ) : null}

            {scope === 'app' ? (
              <Select
                label="App override target"
                value={appId || null}
                onChange={(value) => setAppId(value ?? '')}
                data={appOptions.map((option) => ({ value: option.id, label: `${option.name} (${option.id})` }))}
                placeholder={appOptions.length === 0 ? 'No apps available' : 'Select an app'}
                disabled={appOptions.length === 0}
                allowDeselect={false}
                searchable
              />
            ) : null}

            <Stack gap={6}>
              <Text size="sm" fw={500}>Surface</Text>
              <SegmentedControl
                fullWidth
                value={surface}
                onChange={(value) => setSurface(value as UiSurface)}
                data={surfaces.map((item) => ({ value: item.key, label: item.label }))}
                aria-label="Surface"
              />
            </Stack>

            <TextInput
              label="Title"
              value={draft.title ?? ''}
              onChange={(e) => { const value = e.currentTarget.value; setDraft((v) => ({ ...v, title: value })) }}
              placeholder="Welcome back"
            />
            <TextInput
              label="Subtitle"
              value={draft.subtitle ?? ''}
              onChange={(e) => { const value = e.currentTarget.value; setDraft((v) => ({ ...v, subtitle: value })) }}
              placeholder="Sign in with your enterprise account"
            />
            <TextInput
              label="Logo URL"
              value={draft.logoUrl ?? ''}
              onChange={(e) => { const value = e.currentTarget.value; setDraft((v) => ({ ...v, logoUrl: value })) }}
              placeholder="https://example.com/logo.svg"
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <ColorInput
                label="Primary color"
                value={draft.primaryColor ?? ''}
                onChange={(value) => setDraft((v) => ({ ...v, primaryColor: value }))}
                placeholder="#0f172a"
                format="hex"
                swatches={presetColors}
                swatchesPerRow={7}
                ff="monospace"
              />
              <ColorInput
                label="Accent color"
                value={draft.accentColor ?? ''}
                onChange={(value) => setDraft((v) => ({ ...v, accentColor: value }))}
                placeholder="#0ea5e9"
                format="hex"
                swatches={presetColors}
                swatchesPerRow={7}
                ff="monospace"
              />
            </SimpleGrid>

            <Textarea
              label="Background CSS"
              value={draft.backgroundCss ?? ''}
              onChange={(e) => { const value = e.currentTarget.value; setDraft((v) => ({ ...v, backgroundCss: value })) }}
              autosize
              minRows={3}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
              placeholder="linear-gradient(130deg, #e2e8f0, #f8fafc)"
            />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Preview"
          description="Preview approximates the selected surface styling. Final rendering can vary by page layout."
        >
          <Stack gap="lg">
            <Paper withBorder radius="lg" style={{ ...previewStyles, overflow: 'hidden' }}>
              <Box mih={300} px="xl" py="xl" style={{ color: draft.primaryColor?.trim() || 'var(--mantine-color-text)' }}>
                {draft.logoUrl?.trim() ? (
                  <Image src={draft.logoUrl} alt="Customization logo" h={40} w="auto" maw={180} fit="contain" radius="sm" mb="lg" />
                ) : (
                  <Paper radius="md" px="sm" py={10} mb="lg" display="inline-block" bg="var(--nx-color-surface)">
                    <Text size="xs" fw={600} c="dimmed">Logo preview</Text>
                  </Paper>
                )}
                <Title order={3} fz={24} fw={700} c="inherit">{draft.title?.trim() || 'Sign in to continue'}</Title>
                <Text size="sm" mt="xs" maw={448} c="inherit" opacity={0.9}>{draft.subtitle?.trim() || 'Use your organization account to access protected applications.'}</Text>
                <Button
                  mt="lg"
                  color={draft.accentColor?.trim() || undefined}
                  tabIndex={-1}
                >
                  Continue
                </Button>
              </Box>
            </Paper>

            <Stack gap="xs">
              <Text size="sm" fw={500}>Open surface</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {surfaces.map((item) => (
                  <UnstyledButton key={item.key} component={Link} to={item.route}>
                    <Paper withBorder radius="md" px="sm" py="xs" className="nx-interactive">
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm">{item.label}</Text>
                        <ArrowUpRight size={14} />
                      </Group>
                    </Paper>
                  </UnstyledButton>
                ))}
              </SimpleGrid>
            </Stack>

            <Text size="xs" c="dimmed">
              Scope precedence: default values are baseline, client overrides apply when a client context exists, and app overrides apply when an app context exists.
            </Text>
          </Stack>
        </SectionCard>
      </SimpleGrid>
    </Stack>
  )
}
