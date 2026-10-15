import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  ColorInput,
  Group,
  Image,
  Paper,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon
} from '@mantine/core'
import { AuthCard, AuthLayout, PageHeader, PageHeaderSkeleton, SectionCard } from '@nexus/design'
import { AppWindow, ArrowUpRight, CheckCircle2, Monitor, RotateCcw, Save, ShieldCheck, Smartphone, Undo2, XCircle } from 'lucide-react'
import ImageField from '../components/ImageField'
import { useApps, useClients, useInstanceSettings, useUpdateInstanceSettings, useUploadBrandingLogo } from '../hooks/useApi'

type UiSurface = 'admin_login' | 'consent' | 'portal_login' | 'portal_launcher'

type UiSurfaceCustomization = {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

type Field = keyof UiSurfaceCustomization
type SurfaceMap = Partial<Record<UiSurface, UiSurfaceCustomization>>

type UiCustomizationSettings = {
  defaultBySurface: SurfaceMap
  byClientId: Record<string, SurfaceMap>
  byAppId: Record<string, SurfaceMap>
}

type Scope = 'default' | 'client' | 'app'

/** One editable slot: a surface within a scope (and client/app target for overrides). */
type SlotRef = { scope: Scope; targetId: string; surface: UiSurface }

const FIELDS: Field[] = ['title', 'subtitle', 'logoUrl', 'primaryColor', 'accentColor', 'backgroundCss']

const surfaces: Array<{ key: UiSurface; label: string; route: string; usedBy: string; fallbackTitle: string; fallbackSubtitle: string }> = [
  {
    key: 'admin_login',
    label: 'Admin login',
    route: '/login',
    usedBy: 'Admin sign-in and the password-expiration screen.',
    fallbackTitle: 'NexusID',
    fallbackSubtitle: 'Sign in to the identity administration workspace.',
  },
  {
    key: 'consent',
    label: 'Consent',
    route: '/consent',
    usedBy: 'OAuth consent screen shown when an app requests access.',
    fallbackTitle: 'Authorization Request',
    fallbackSubtitle: 'example-app is requesting access to your account.',
  },
  {
    key: 'portal_login',
    label: 'Portal login',
    route: '/portal/login',
    usedBy: 'End-user sign-in to the account portal.',
    fallbackTitle: 'Account Portal',
    fallbackSubtitle: 'Sign in to access your account',
  },
  {
    key: 'portal_launcher',
    label: 'Portal launcher',
    route: '/portal/',
    usedBy: 'App launcher home page after portal sign-in.',
    fallbackTitle: 'Account Portal',
    fallbackSubtitle: 'jane.doe@example.com',
  },
]

/** Which fields each surface actually renders — keeps the editor honest about what a field does. */
const fieldUsage: Record<UiSurface, Partial<Record<Field, string>>> = {
  admin_login: {
    title: 'Brand name next to the logo',
    subtitle: 'Text under “Sign in”',
    logoUrl: 'Brand logo above the card',
    primaryColor: 'Sign-in button',
    accentColor: '“Back” link',
    backgroundCss: 'Page background',
  },
  consent: {
    title: 'Card title',
    subtitle: 'Text under the title',
    logoUrl: 'Brand logo above the card',
    primaryColor: '“Allow access” button',
    accentColor: 'Permission check icons',
    backgroundCss: 'Page background',
  },
  portal_login: {
    title: 'Card title',
    subtitle: 'Text under the title',
    logoUrl: 'Logo tile on the card',
    primaryColor: 'Logo tile and sign-in button',
    accentColor: '“Back” link',
    backgroundCss: 'Page background',
  },
  portal_launcher: {
    title: 'Header brand name',
    subtitle: 'Text under the user’s name',
    logoUrl: 'Header logo tile',
    primaryColor: 'Header logo tile',
    backgroundCss: 'Page background',
  },
}

const presetColors = [
  '#0f172a', '#111827', '#0b1220', '#1d4ed8', '#0ea5e9', '#14b8a6', '#22c55e',
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'
]

const backgroundPresets: Array<{ label: string; value: string }> = [
  { label: 'Soft slate', value: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' },
  { label: 'Ocean', value: 'linear-gradient(135deg, #e0f2fe 0%, #c7d2fe 100%)' },
  { label: 'Mint', value: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #fff7ed 0%, #fce7f3 100%)' },
  { label: 'Midnight', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
]

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function normalize(input: any): UiCustomizationSettings {
  return {
    defaultBySurface: typeof input?.defaultBySurface === 'object' && input.defaultBySurface ? input.defaultBySurface : {},
    byClientId: typeof input?.byClientId === 'object' && input.byClientId ? input.byClientId : {},
    byAppId: typeof input?.byAppId === 'object' && input.byAppId ? input.byAppId : {},
  }
}

function clean(value: UiSurfaceCustomization | undefined): UiSurfaceCustomization {
  const out: UiSurfaceCustomization = {}
  for (const key of FIELDS) {
    const raw = value?.[key]
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim()
  }
  return out
}

function sameCustomization(a: UiSurfaceCustomization | undefined, b: UiSurfaceCustomization | undefined) {
  const ca = clean(a)
  const cb = clean(b)
  return FIELDS.every((key) => ca[key] === cb[key])
}

function slotKey(slot: SlotRef) {
  return `${slot.scope}|${slot.targetId}|${slot.surface}`
}

function parseSlotKey(key: string): SlotRef {
  const [scope, targetId, surface] = key.split('|')
  return { scope: scope as Scope, targetId, surface: surface as UiSurface }
}

function readSlot(config: UiCustomizationSettings, slot: SlotRef): UiSurfaceCustomization | undefined {
  if (slot.scope === 'default') return config.defaultBySurface[slot.surface]
  if (slot.scope === 'client') return config.byClientId[slot.targetId]?.[slot.surface]
  return config.byAppId[slot.targetId]?.[slot.surface]
}

/** Returns a new config with `value` written into `slot`. Empty overrides are removed so they inherit again. */
function writeSlot(config: UiCustomizationSettings, slot: SlotRef, value: UiSurfaceCustomization): UiCustomizationSettings {
  const cleaned = clean(value)
  const empty = Object.keys(cleaned).length === 0
  const next: UiCustomizationSettings = {
    defaultBySurface: { ...config.defaultBySurface },
    byClientId: { ...config.byClientId },
    byAppId: { ...config.byAppId },
  }

  if (slot.scope === 'default') {
    // An emptied default is kept as `{}` so the server does not restore its
    // built-in titles; the surfaces then fall back to their translated text.
    next.defaultBySurface[slot.surface] = cleaned
    return next
  }

  const bucket = slot.scope === 'client' ? next.byClientId : next.byAppId
  const map = { ...(bucket[slot.targetId] ?? {}) }
  if (empty) delete map[slot.surface]
  else map[slot.surface] = cleaned
  if (Object.keys(map).length === 0) delete bucket[slot.targetId]
  else bucket[slot.targetId] = map
  return next
}

function validate(value: UiSurfaceCustomization): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  const c = clean(value)
  if (c.title && c.title.length > 120) errors.title = 'Keep the title under 120 characters'
  if (c.subtitle && c.subtitle.length > 300) errors.subtitle = 'Keep the subtitle under 300 characters'
  if (c.logoUrl && !(/^https?:\/\//i.test(c.logoUrl) || /^\/(?![\/\\])/.test(c.logoUrl))) {
    errors.logoUrl = 'Use an http(s) URL or a path starting with /'
  }
  if (c.primaryColor && !HEX_COLOR.test(c.primaryColor)) errors.primaryColor = 'Use a hex color like #1d4ed8'
  if (c.accentColor && !HEX_COLOR.test(c.accentColor)) errors.accentColor = 'Use a hex color like #0ea5e9'
  if (c.backgroundCss && c.backgroundCss.length > 500) errors.backgroundCss = 'Keep the background under 500 characters'
  return errors
}

export default function UiCustomizations() {
  const { data: settings, isLoading } = useInstanceSettings()
  const { data: clients = [] } = useClients()
  const { data: apps = [] } = useApps()
  const updateSettings = useUpdateInstanceSettings()
  const uploadLogo = useUploadBrandingLogo()

  // `saved` mirrors the server; `drafts` holds unsaved edits per slot. Keeping
  // them apart means a background refetch never throws away what you typed.
  const [saved, setSaved] = useState<UiCustomizationSettings>(normalize(null))
  const [drafts, setDrafts] = useState<Record<string, UiSurfaceCustomization>>({})
  const [scope, setScope] = useState<Scope>('default')
  const [surface, setSurface] = useState<UiSurface>('admin_login')
  const [clientId, setClientId] = useState('')
  const [appId, setAppId] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) setSaved(normalize((settings as any).uiCustomizations))
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

  const targetId = scope === 'client' ? clientId : scope === 'app' ? appId : ''
  const slot: SlotRef = { scope, targetId, surface }
  const key = slotKey(slot)
  const targetMissing = scope !== 'default' && !targetId

  /** Current value of any slot: the unsaved draft if there is one, else what's saved. */
  const valueOf = (ref: SlotRef) => drafts[slotKey(ref)] ?? readSlot(saved, ref) ?? {}

  const draft = valueOf(slot)
  const errors = validate(draft)

  const pendingKeys = useMemo(
    () => Object.keys(drafts).filter((k) => !sameCustomization(drafts[k], readSlot(saved, parseSlotKey(k)))),
    [drafts, saved]
  )
  const isDirty = pendingKeys.includes(key)

  // What the live page will render: defaults, then the client or app override on top.
  const inherited = scope === 'default' ? {} : clean(valueOf({ scope: 'default', targetId: '', surface }))
  const effective = { ...inherited, ...clean(draft) }

  useEffect(() => {
    if (pendingKeys.length === 0) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pendingKeys.length])

  const setField = (field: Field, value: string) => {
    if (targetMissing) return
    setMessage(null)
    setDrafts((prev) => ({ ...prev, [key]: { ...valueOf(slot), ...prev[key], [field]: value } }))
  }

  const discardSlot = () => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const clearSlot = () => {
    if (targetMissing) return
    setDrafts((prev) => ({ ...prev, [key]: {} }))
  }

  const describeSlot = (ref: SlotRef) => {
    const surfaceLabel = surfaces.find((s) => s.key === ref.surface)?.label ?? ref.surface
    if (ref.scope === 'default') return `${surfaceLabel} (default)`
    const options = ref.scope === 'client' ? clientOptions : appOptions
    const name = options.find((o) => o.id === ref.targetId)?.name ?? ref.targetId
    return `${surfaceLabel} for ${name}`
  }

  const saveAll = async () => {
    setMessage(null)
    setError(null)

    const invalid = pendingKeys.find((k) => Object.keys(validate(drafts[k])).length > 0)
    if (invalid) {
      const ref = parseSlotKey(invalid)
      setScope(ref.scope)
      setSurface(ref.surface)
      if (ref.scope === 'client') setClientId(ref.targetId)
      if (ref.scope === 'app') setAppId(ref.targetId)
      setError(`Fix the highlighted fields in ${describeSlot(ref)} before saving.`)
      return
    }

    let next = saved
    for (const k of pendingKeys) next = writeSlot(next, parseSlotKey(k), drafts[k])

    try {
      const result = await updateSettings.mutateAsync({ uiCustomizations: next })
      setSaved(normalize((result as any)?.uiCustomizations ?? next))
      setDrafts({})
      setMessage(pendingKeys.length === 1 ? 'Customization saved. It is live now.' : `${pendingKeys.length} customizations saved. They are live now.`)
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'Failed to save UI customizations')
    }
  }

  const handleLogoUpload = async (file: File) => {
    try {
      const { logoUrl } = await uploadLogo.mutateAsync(file)
      setField('logoUrl', logoUrl)
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : 'Logo upload failed')
    }
  }

  const hasOverride = (ref: SlotRef) => Object.keys(clean(valueOf(ref))).length > 0
  const surfaceMeta = surfaces.find((s) => s.key === surface)!
  const usage = fieldUsage[surface]

  const livePageHref = () => {
    if (scope === 'client' && clientId && (surface === 'admin_login' || surface === 'portal_login')) {
      return `${surfaceMeta.route}?client_id=${encodeURIComponent(clientId)}`
    }
    return surfaceMeta.route
  }

  /** Label with a hint showing what the live page uses and what is inherited. */
  const fieldLabel = (field: Field, label: string) => (
    <Group gap={6} wrap="nowrap">
      <span>{label}</span>
      {scope !== 'default' && !clean(draft)[field] && inherited[field] ? (
        <Badge size="xs" variant="light" color="gray">inherited</Badge>
      ) : null}
    </Group>
  )

  const fieldDescription = (field: Field) => usage[field] ?? 'Not shown on this surface'

  if (isLoading) {
    return <PageHeaderSkeleton blocks={3} />
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Branding and UX"
        title="Experience Customization"
        description="Brand the sign-in, consent and portal pages. Edits show in the live preview as you type; save to publish them."
        actions={
          <Group gap="xs" wrap="nowrap">
            {pendingKeys.length > 0 ? (
              <Button variant="default" leftSection={<Undo2 size={16} />} onClick={() => setDrafts({})}>
                Discard all
              </Button>
            ) : null}
            <Button
              onClick={saveAll}
              loading={updateSettings.isPending}
              disabled={pendingKeys.length === 0}
              leftSection={<Save size={16} />}
            >
              {pendingKeys.length > 1 ? `Save ${pendingKeys.length} changes` : 'Save'}
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

      {pendingKeys.length > 0 ? (
        <Alert color="yellow" variant="light" title="Unsaved changes">
          <Group gap={6}>
            {pendingKeys.map((k) => {
              const ref = parseSlotKey(k)
              return (
                <Badge
                  key={k}
                  variant="outline"
                  color="yellow"
                  style={{ cursor: 'pointer', textTransform: 'none' }}
                  onClick={() => {
                    setScope(ref.scope)
                    setSurface(ref.surface)
                    if (ref.scope === 'client') setClientId(ref.targetId)
                    if (ref.scope === 'app') setAppId(ref.targetId)
                  }}
                >
                  {describeSlot(ref)}
                </Badge>
              )
            })}
          </Group>
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <SectionCard
          title="Editor"
          description={surfaceMeta.usedBy}
          footer={
            <>
              <Button variant="default" leftSection={<RotateCcw size={16} />} onClick={clearSlot} disabled={targetMissing}>
                {scope === 'default' ? 'Clear fields' : 'Remove override'}
              </Button>
              <Button variant="default" leftSection={<Undo2 size={16} />} onClick={discardSlot} disabled={!isDirty}>
                Discard changes
              </Button>
            </>
          }
        >
          <Stack gap="md">
            <Stack gap={6}>
              <Text size="sm" fw={500}>Applies to</Text>
              <SegmentedControl
                fullWidth
                value={scope}
                onChange={(value) => setScope(value as Scope)}
                data={[
                  { value: 'default', label: 'Everyone (default)' },
                  { value: 'client', label: 'One OAuth client' },
                  { value: 'app', label: 'One app' }
                ]}
                aria-label="Scope"
              />
            </Stack>

            {scope === 'client' ? (
              <Select
                label="OAuth client"
                description="Shown when sign-in or consent starts from this client. Empty fields inherit the default."
                value={clientId || null}
                onChange={(value) => setClientId(value ?? '')}
                data={clientOptions.map((option) => ({ value: option.id, label: option.name }))}
                placeholder={clientOptions.length === 0 ? 'No clients available' : 'Select a client'}
                disabled={clientOptions.length === 0}
                allowDeselect={false}
                searchable
              />
            ) : null}

            {scope === 'app' ? (
              <Select
                label="App"
                description="Shown when the page is opened in this app’s context. Empty fields inherit the default."
                value={appId || null}
                onChange={(value) => setAppId(value ?? '')}
                data={appOptions.map((option) => ({ value: option.id, label: option.name }))}
                placeholder={appOptions.length === 0 ? 'No apps available' : 'Select an app'}
                disabled={appOptions.length === 0}
                allowDeselect={false}
                searchable
              />
            ) : null}

            <Stack gap={6}>
              <Text size="sm" fw={500}>Page</Text>
              <SegmentedControl
                fullWidth
                value={surface}
                onChange={(value) => setSurface(value as UiSurface)}
                data={surfaces.map((item) => {
                  const ref = { scope, targetId, surface: item.key }
                  const dirty = pendingKeys.includes(slotKey(ref))
                  const marker = dirty ? ' ●' : scope !== 'default' && hasOverride(ref) ? ' •' : ''
                  return { value: item.key, label: `${item.label}${marker}` }
                })}
                aria-label="Page"
              />
              {scope !== 'default' ? (
                <Text size="xs" c="dimmed">• has an override · ● unsaved</Text>
              ) : null}
            </Stack>

            <TextInput
              label={fieldLabel('title', 'Title')}
              description={fieldDescription('title')}
              value={draft.title ?? ''}
              onChange={(e) => setField('title', e.currentTarget.value)}
              placeholder={inherited.title ?? surfaceMeta.fallbackTitle}
              error={errors.title}
              disabled={targetMissing}
            />
            <TextInput
              label={fieldLabel('subtitle', 'Subtitle')}
              description={fieldDescription('subtitle')}
              value={draft.subtitle ?? ''}
              onChange={(e) => setField('subtitle', e.currentTarget.value)}
              placeholder={inherited.subtitle ?? surfaceMeta.fallbackSubtitle}
              error={errors.subtitle}
              disabled={targetMissing}
            />

            <Stack gap={4}>
              <ImageField
                label="Logo"
                urlLabel="Logo URL"
                value={draft.logoUrl ?? ''}
                onChange={(value) => setField('logoUrl', value)}
                urlPlaceholder={inherited.logoUrl ?? 'Upload a file or paste https://… or /media/…'}
                onUpload={handleLogoUpload}
                uploadPending={uploadLogo.isPending}
                uploadHint={fieldDescription('logoUrl')}
                disabled={targetMissing}
              />
              {errors.logoUrl ? <Text size="xs" c="red">{errors.logoUrl}</Text> : null}
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <ColorInput
                label={fieldLabel('primaryColor', 'Primary color')}
                description={fieldDescription('primaryColor')}
                value={draft.primaryColor ?? ''}
                onChange={(value) => setField('primaryColor', value)}
                placeholder={inherited.primaryColor ?? '#1d4ed8'}
                format="hex"
                swatches={presetColors}
                swatchesPerRow={7}
                ff="monospace"
                error={errors.primaryColor}
                disabled={targetMissing || !usage.primaryColor}
              />
              <ColorInput
                label={fieldLabel('accentColor', 'Accent color')}
                description={fieldDescription('accentColor')}
                value={draft.accentColor ?? ''}
                onChange={(value) => setField('accentColor', value)}
                placeholder={inherited.accentColor ?? '#0ea5e9'}
                format="hex"
                swatches={presetColors}
                swatchesPerRow={7}
                ff="monospace"
                error={errors.accentColor}
                disabled={targetMissing || !usage.accentColor}
              />
            </SimpleGrid>

            <Stack gap={6}>
              <Textarea
                label={fieldLabel('backgroundCss', 'Background')}
                description="Any CSS background value: a color, gradient or url(…)."
                value={draft.backgroundCss ?? ''}
                onChange={(e) => setField('backgroundCss', e.currentTarget.value)}
                autosize
                minRows={2}
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
                placeholder={inherited.backgroundCss ?? 'linear-gradient(135deg, #f1f5f9, #e2e8f0)'}
                error={errors.backgroundCss}
                disabled={targetMissing}
              />
              <Group gap={6}>
                {backgroundPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    size="compact-xs"
                    variant="default"
                    disabled={targetMissing}
                    onClick={() => setField('backgroundCss', preset.value)}
                    leftSection={<Box w={12} h={12} style={{ background: preset.value, borderRadius: 3, border: '1px solid var(--nx-color-border)' }} />}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Group>
            </Stack>
          </Stack>
        </SectionCard>

        <Box style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <SectionCard
            title="Live preview"
            description="Updates as you type, using the same components as the real page."
          >
            <Stack gap="md">
              <Group justify="space-between" wrap="nowrap">
                <SegmentedControl
                  size="xs"
                  value={device}
                  onChange={(value) => setDevice(value as 'desktop' | 'mobile')}
                  data={[
                    { value: 'desktop', label: <Group gap={4} wrap="nowrap"><Monitor size={14} />Desktop</Group> },
                    { value: 'mobile', label: <Group gap={4} wrap="nowrap"><Smartphone size={14} />Mobile</Group> },
                  ]}
                  aria-label="Preview size"
                />
                <Anchor href={livePageHref()} target="_blank" rel="noreferrer" size="sm">
                  <Group gap={4} wrap="nowrap">
                    Open live page <ArrowUpRight size={14} />
                  </Group>
                </Anchor>
              </Group>

              <Paper
                withBorder
                radius="md"
                mx="auto"
                w="100%"
                maw={device === 'mobile' ? 380 : undefined}
                style={{ overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}
                aria-label="Preview"
              >
                <SurfacePreview surface={surface} ui={effective} />
              </Paper>

              {pendingKeys.length > 0 ? (
                <Text size="xs" c="dimmed">The live page shows the saved version until you click Save.</Text>
              ) : null}
            </Stack>
          </SectionCard>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}

/**
 * Renders a surface the way the real page does, field for field. Keep in sync
 * with admin/src/pages/{Login,Consent}.tsx and portal/src/pages/{Login,Launcher}.tsx.
 */
function SurfacePreview({ surface, ui }: { surface: UiSurface; ui: UiSurfaceCustomization }) {
  const meta = surfaces.find((s) => s.key === surface)!
  const background = ui.backgroundCss ? { background: ui.backgroundCss } : undefined

  if (surface === 'portal_launcher') {
    return (
      <Box mih={420} style={{ background: ui.backgroundCss ?? 'var(--nx-color-canvas)' }}>
        <Group px="md" h={52} justify="space-between" style={{ borderBottom: '1px solid var(--nx-color-border)', background: 'var(--nx-color-surface)' }}>
          <Group gap={8} wrap="nowrap">
            <BrandTile size={28} color={ui.primaryColor} logoUrl={ui.logoUrl} />
            <Text fw={600} fz={15} truncate="end">{ui.title ?? meta.fallbackTitle}</Text>
          </Group>
          <Avatar size={28} radius="xl" color="blue">JD</Avatar>
        </Group>
        <Stack p="lg" gap="lg">
          <Group gap="md" wrap="nowrap">
            <Avatar size={48} radius="xl" color="blue">JD</Avatar>
            <Box miw={0}>
              <Text fw={600} fz="lg">Welcome, Jane</Text>
              <Text size="sm" c="dimmed" truncate="end">{ui.subtitle ?? meta.fallbackSubtitle}</Text>
            </Box>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            {['Mail', 'Drive', 'CRM'].map((name) => (
              <Paper key={name} withBorder radius="md" p="sm">
                <Stack gap={8} align="center">
                  <ThemeIcon size={36} radius="md" variant="light" color="gray"><AppWindow size={18} /></ThemeIcon>
                  <Text size="sm" fw={500}>{name}</Text>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Box>
    )
  }

  let card: ReactNode
  let brand: ReactNode = <PreviewBrand logoUrl={ui.logoUrl} />

  if (surface === 'admin_login') {
    brand = <PreviewBrand logoUrl={ui.logoUrl} name={ui.title ?? meta.fallbackTitle} />
    card = (
      <AuthCard title="Sign in" subtitle={ui.subtitle ?? meta.fallbackSubtitle} animate={false}>
        <Stack gap="sm">
          <TextInput label="Username or email" placeholder="you@example.com" readOnly tabIndex={-1} />
          <PasswordInput label="Password" placeholder="••••••••" readOnly tabIndex={-1} />
          <Button fullWidth mt="xs" color={ui.primaryColor} tabIndex={-1}>Sign in</Button>
        </Stack>
      </AuthCard>
    )
  } else if (surface === 'consent') {
    card = (
      <AuthCard title={ui.title ?? meta.fallbackTitle} subtitle={ui.subtitle ?? meta.fallbackSubtitle} animate={false}>
        <Stack gap="md">
          <Paper withBorder radius="md" p="sm">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={8}>Requested permissions</Text>
            <Stack gap={8}>
              {['Verify your identity', 'View your email address', 'View your basic profile'].map((scope) => (
                <Group key={scope} gap="xs" wrap="nowrap">
                  <Text c={ui.accentColor ?? 'green'} lh={1} component="span"><ShieldCheck size={14} aria-hidden /></Text>
                  <Text size="sm">{scope}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
          <Group grow gap="sm">
            <Button color={ui.primaryColor} tabIndex={-1}>Allow access</Button>
            <Button variant="default" tabIndex={-1}>Deny</Button>
          </Group>
        </Stack>
      </AuthCard>
    )
  } else {
    brand = undefined
    card = (
      <AuthCard
        logo={<BrandTile size={56} color={ui.primaryColor} logoUrl={ui.logoUrl} />}
        title={ui.title ?? meta.fallbackTitle}
        subtitle={ui.subtitle ?? meta.fallbackSubtitle}
        animate={false}
      >
        <Stack gap="sm">
          <TextInput label="Email" placeholder="you@example.com" readOnly tabIndex={-1} />
          <PasswordInput label="Password" placeholder="••••••••" readOnly tabIndex={-1} />
          <Button fullWidth mt="xs" color={ui.primaryColor} tabIndex={-1}>Sign In</Button>
        </Stack>
      </AuthCard>
    )
  }

  return (
    <AuthLayout fullHeight={false} style={background} brand={brand} py="xl">
      {card}
    </AuthLayout>
  )
}

function PreviewBrand({ logoUrl, name }: { logoUrl?: string; name?: string }) {
  return (
    <Group gap={10}>
      <Image src={logoUrl ?? '/logo.svg'} alt="" w={32} h={32} radius="md" fit="contain" />
      {name ? <Text fw={600} fz="lg">{name}</Text> : null}
    </Group>
  )
}

function BrandTile({ size, color, logoUrl }: { size: number; color?: string; logoUrl?: string }) {
  return (
    <ThemeIcon size={size} radius={size > 40 ? 'lg' : 'md'} variant="filled" color={color} style={{ overflow: 'hidden' }}>
      {logoUrl ? <Image src={logoUrl} alt="" w={size} h={size} fit="cover" /> : <ShieldCheck size={Math.round(size * 0.46)} />}
    </ThemeIcon>
  )
}
