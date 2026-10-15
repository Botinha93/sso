import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Group,
  List,
  NativeSelect,
  NumberInput,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput
} from '@mantine/core'
import {
  PageHeader,
  PageHeaderSkeleton,
  RefreshButton,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusBadge
} from '@nexus/design'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Info,
  LayoutDashboard,
  Lock,
  Mail,
  Network,
  Palette,
  ShieldCheck,
  Trash2,
  Users,
  XCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  useAdminMe,
  useAdminRiskEvents,
  useApps,
  useInstanceSettings,
  useRetentionStatus,
  useMigrateDatabaseFromSqlite,
  useTestExternalDatabaseConnection,
  useTestInstanceEmail,
  useUpdateInstanceSettings
} from '../hooks/useApi'
import ProvisioningAdminPanel from '../components/ProvisioningAdminPanel'

interface SettingsForm {
  databaseProvider: 'sqlite' | 'postgresql' | 'mysql'
  databasePath: string
  externalDatabaseUrl: string
  requireHttps: boolean
  secureCookies: boolean
  allowAnyCorsOrigin: boolean
  corsAllowedOriginsText: string
  requireHttpsRedirectUris: boolean
  requireS256Pkce: boolean
  allowImplicitFlow: boolean
  loginFailureWindowMinutes: number
  loginLockoutThreshold: number
  loginLockoutDurationMinutes: number
  sessionAnomalyConcurrencyThreshold: number
  rateLimitMultiplier: number
  emailTransport: 'disabled' | 'log' | 'smtp'
  emailFrom: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  testEmailTo: string
  uiCustomizationsText: string
  retentionEnabled: boolean
  retentionDays: Record<string, number>
}

const parseOrigins = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

const parseHttpOrigin = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

const defaultForm: SettingsForm = {
  databaseProvider: 'sqlite',
  databasePath: './data/sso.sqlite',
  externalDatabaseUrl: '',
  requireHttps: false,
  secureCookies: false,
  allowAnyCorsOrigin: true,
  corsAllowedOriginsText: '',
  requireHttpsRedirectUris: false,
  requireS256Pkce: true,
  allowImplicitFlow: true,
  loginFailureWindowMinutes: 15,
  loginLockoutThreshold: 5,
  loginLockoutDurationMinutes: 15,
  sessionAnomalyConcurrencyThreshold: 5,
  rateLimitMultiplier: 10,
  emailTransport: 'log',
  emailFrom: 'no-reply@example.local',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  testEmailTo: '',
  uiCustomizationsText: JSON.stringify({
    defaultBySurface: {},
    byClientId: {},
    byAppId: {}
  }, null, 2),
  retentionEnabled: true,
  retentionDays: {},
}

export default function Administration() {
  const { data: adminMe } = useAdminMe()
  const { data, isLoading, isFetching: isSettingsRefreshing, refetch } = useInstanceSettings()
  const { data: apps = [] } = useApps()
  const { data: retentionStatus, isLoading: isRetentionLoading } = useRetentionStatus(true)
  const { data: riskEvents, isFetching: isRiskEventsRefreshing, refetch: refetchRiskEvents } = useAdminRiskEvents(15)
  const updateSettings = useUpdateInstanceSettings()
  const testEmail = useTestInstanceEmail()
  const testExternalDb = useTestExternalDatabaseConnection()
  const migrateDatabase = useMigrateDatabaseFromSqlite()
  const [form, setForm] = useState<SettingsForm>(defaultForm)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab, setTab] = useState<string | null>('overview')
  const permissions: string[] = (adminMe as any)?.permissions ?? []
  const can = (permission: string) => permissions.includes('*:*') || permissions.includes(permission)
  const appCorsOrigins = useMemo(() => {
    const origins = new Set<string>()
    for (const app of apps as any[]) {
      const appOrigin = parseHttpOrigin(app?.url)
      if (appOrigin) origins.add(appOrigin)

      const resources = Array.isArray(app?.resources) ? app.resources : []
      for (const resource of resources) {
        const resourceOrigin = parseHttpOrigin(resource)
        if (resourceOrigin) origins.add(resourceOrigin)
      }
    }
    return Array.from(origins).sort()
  }, [apps])

  const operationLinks = [
    {
      to: '/access-governance',
      title: 'Access Governance',
      description: 'Requests, approvals, stalled queue, and review campaigns.',
      permission: 'administration:view'
    },
    {
      to: '/elevations',
      title: 'Elevation Operations',
      description: 'Request, approve, activate, revoke, and break-glass elevation.',
      permission: 'administration:view'
    },
    {
      to: '/elevation-sessions',
      title: 'Elevation Sessions',
      description: 'Track active, revoked, and expired privileged sessions.',
      permission: 'administration:view'
    },
    {
      to: '/metrics',
      title: 'Auth Metrics',
      description: 'Authentication throughput trends and event distribution.',
      permission: 'connectors:view'
    }
  ].filter((item) => can(item.permission))

  useEffect(() => {
    if (!data) {
      return
    }

    setForm({
      databaseProvider: (((data as any).databaseProvider ?? 'sqlite') as SettingsForm['databaseProvider']),
      databasePath: String((data as any).databasePath ?? './data/sso.sqlite'),
      externalDatabaseUrl: String((data as any).externalDatabaseUrl ?? ''),
      requireHttps: Boolean((data as any).requireHttps),
      secureCookies: Boolean((data as any).secureCookies),
      allowAnyCorsOrigin: Boolean((data as any).allowAnyCorsOrigin),
      corsAllowedOriginsText: Array.isArray((data as any).corsAllowedOrigins) ? (data as any).corsAllowedOrigins.join('\n') : '',
      requireHttpsRedirectUris: Boolean((data as any).requireHttpsRedirectUris),
      requireS256Pkce: Boolean((data as any).requireS256Pkce),
      allowImplicitFlow: Boolean((data as any).allowImplicitFlow),
      loginFailureWindowMinutes: Math.max(1, Math.round(Number((data as any).loginFailureWindowMs ?? 15 * 60 * 1000) / 60_000)),
      loginLockoutThreshold: Number((data as any).loginLockoutThreshold ?? 5),
      loginLockoutDurationMinutes: Math.max(1, Math.round(Number((data as any).loginLockoutDurationMs ?? 15 * 60 * 1000) / 60_000)),
      sessionAnomalyConcurrencyThreshold: Number((data as any).sessionAnomalyConcurrencyThreshold ?? 5),
      rateLimitMultiplier: Number((data as any).rateLimitMultiplier ?? 10),
      emailTransport: ((data as any).emailTransport as SettingsForm['emailTransport']) ?? 'log',
      emailFrom: String((data as any).emailFrom ?? 'no-reply@example.local'),
      smtpHost: String((data as any).smtpHost ?? ''),
      smtpPort: Number((data as any).smtpPort ?? 587),
      smtpSecure: Boolean((data as any).smtpSecure ?? false),
      smtpUser: String((data as any).smtpUser ?? ''),
      smtpPass: String((data as any).smtpPass ?? ''),
      testEmailTo: String((data as any).emailFrom ?? ''),
      uiCustomizationsText: JSON.stringify((data as any).uiCustomizations ?? {
        defaultBySurface: {},
        byClientId: {},
        byAppId: {}
      }, null, 2),
      retentionEnabled: (data as any).retention?.enabled !== false,
      retentionDays: { ...((data as any).retention?.policies ?? {}) },
    })
  }, [data])

  const save = async () => {
    try {
      setSaveMessage(null)
      setSaveError(null)
      let uiCustomizations: any
      try {
        uiCustomizations = JSON.parse(form.uiCustomizationsText)
      } catch {
        setSaveError('UI customizations must be valid JSON')
        return
      }
      await updateSettings.mutateAsync({
        databaseProvider: form.databaseProvider,
        databasePath: form.databaseProvider === 'sqlite' ? form.databasePath : undefined,
        externalDatabaseUrl: form.databaseProvider === 'sqlite' ? undefined : (form.externalDatabaseUrl || undefined),
        requireHttps: form.requireHttps,
        secureCookies: form.secureCookies,
        allowAnyCorsOrigin: form.allowAnyCorsOrigin,
        corsAllowedOrigins: form.allowAnyCorsOrigin
          ? []
          : Array.from(new Set([...parseOrigins(form.corsAllowedOriginsText), ...appCorsOrigins])),
        requireHttpsRedirectUris: form.requireHttpsRedirectUris,
        requireS256Pkce: form.requireS256Pkce,
        allowImplicitFlow: form.allowImplicitFlow,
        loginFailureWindowMs: form.loginFailureWindowMinutes * 60_000,
        loginLockoutThreshold: form.loginLockoutThreshold,
        loginLockoutDurationMs: form.loginLockoutDurationMinutes * 60_000,
        sessionAnomalyConcurrencyThreshold: form.sessionAnomalyConcurrencyThreshold,
        rateLimitMultiplier: form.rateLimitMultiplier,
        emailTransport: form.emailTransport,
        emailFrom: form.emailFrom,
        smtpHost: form.smtpHost || undefined,
        smtpPort: form.smtpPort,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser || undefined,
        smtpPass: form.smtpPass || undefined,
        uiCustomizations,
        retention: {
          enabled: form.retentionEnabled,
          policies: form.retentionDays,
        },
      })
      setSaveMessage('Instance settings saved. Some changes affect the next request immediately.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save instance settings')
    }
  }

  const sendTestEmail = async () => {
    try {
      setSaveMessage(null)
      setSaveError(null)
      await testEmail.mutateAsync({
        to: form.testEmailTo,
        subject: 'SSO test email',
        message: 'This is a test email sent from Administration settings.'
      })
      setSaveMessage('Test email submitted successfully.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to send test email')
    }
  }

  const testDatabaseConnection = async () => {
    if (form.databaseProvider === 'sqlite') {
      setSaveError('Connection test is available only for PostgreSQL/MySQL providers')
      setSaveMessage(null)
      return
    }

    try {
      setSaveMessage(null)
      setSaveError(null)
      await testExternalDb.mutateAsync({
        provider: form.databaseProvider,
        externalDatabaseUrl: form.externalDatabaseUrl
      })
      setSaveMessage('External database connection is valid.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to connect to external database')
    }
  }

  const migrateFromSqlite = async () => {
    if (form.databaseProvider === 'sqlite') {
      setSaveError('Select PostgreSQL or MySQL provider before migration')
      setSaveMessage(null)
      return
    }

    try {
      setSaveMessage(null)
      setSaveError(null)
      const result = await migrateDatabase.mutateAsync({
        provider: form.databaseProvider,
        externalDatabaseUrl: form.externalDatabaseUrl,
        sqlitePath: form.databasePath
      }) as { migratedTables?: number }
      setSaveMessage(`SQLite migration completed${typeof result?.migratedTables === 'number' ? ` (${result.migratedTables} tables)` : ''}.`)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Database migration failed')
    }
  }

  if (isLoading) {
    return <PageHeaderSkeleton blocks={3} />
  }

  const smtpDisabled = form.emailTransport !== 'smtp'
  const isSettingsTab = tab === 'security' || tab === 'data' || tab === 'email'

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Instance controls"
        title="Administration"
        description="Configure instance-wide transport, browser, OAuth, and runtime attack controls. These settings affect how the server accepts requests, issues tokens, and reacts to suspicious authentication behavior."
        actions={<RefreshButton onRefresh={() => refetch()} loading={isSettingsRefreshing} withLastUpdated={false} />}
      />

      <Alert color="yellow" icon={<AlertTriangle size={16} />} title="Operational warning">
        Enabling HTTPS or secure cookies while you are still using plain HTTP in development can immediately block login or future admin requests.
      </Alert>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview" leftSection={<LayoutDashboard size={16} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<ShieldCheck size={16} />}>Security</Tabs.Tab>
          <Tabs.Tab value="data" leftSection={<Database size={16} />}>Data</Tabs.Tab>
          <Tabs.Tab value="email" leftSection={<Mail size={16} />}>Email</Tabs.Tab>
          <Tabs.Tab value="provisioning" leftSection={<Users size={16} />}>Provisioning</Tabs.Tab>
        </Tabs.List>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <Tabs.Panel value="overview">
          <Stack gap="lg">
            <SectionCard
              title="Recent security risk events"
              description="Normalized risk telemetry derived from audit activity (login failures, lockouts, anomaly detections, protocol guardrails)."
              icon={<ShieldCheck size={16} />}
              actions={
                <RefreshButton
                  size="xs"
                  onRefresh={() => refetchRiskEvents()}
                  loading={isRiskEventsRefreshing}
                  withLastUpdated={false}
                />
              }
              flush
            >
              {(riskEvents ?? []).length === 0 ? (
                <Text size="sm" c="dimmed" px="lg" py="md">No risk events recorded yet.</Text>
              ) : (
                <Stack gap={0}>
                  {(riskEvents ?? []).map((event, index) => (
                    <Group
                      key={event.id}
                      justify="space-between"
                      wrap="nowrap"
                      gap="md"
                      px="lg"
                      py="sm"
                      style={index > 0 ? { borderTop: '1px solid var(--nx-color-border)' } : undefined}
                    >
                      <Box miw={0}>
                        <Text size="sm" fw={500} truncate>{event.title}</Text>
                        <Text size="xs" c="dimmed">{event.sourceType} {event.ip ? `• ${event.ip}` : ''}</Text>
                      </Box>
                      <Group gap="sm" wrap="nowrap">
                        <Badge
                          color={event.severity === 'critical' ? 'red' : event.severity === 'high' ? 'yellow' : 'gray'}
                          variant="light"
                        >
                          {event.severity}
                        </Badge>
                        <Text size="xs" c="dimmed" visibleFrom="sm">{new Date(event.createdAt).toLocaleString()}</Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard
              title="Dedicated operations views"
              description="Governance, elevation tracking, and auth metrics now have dedicated pages for focused workflows."
              icon={<ShieldCheck size={16} />}
            >
              {operationLinks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  You do not currently have permission to access these dedicated operations views.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
                  {operationLinks.map((item) => (
                    <Paper
                      key={item.to}
                      component={Link}
                      to={item.to}
                      withBorder
                      radius="md"
                      p="md"
                      className="nx-interactive"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Text size="sm" fw={600}>{item.title}</Text>
                      <Text size="xs" c="dimmed" mt={4}>{item.description}</Text>
                      <Group gap={4} mt="sm">
                        <Text size="xs" fw={500}>Open view</Text>
                        <ArrowRight size={12} />
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              )}
            </SectionCard>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              <SectionCard
                title="Experience customization"
                description="Manage login, consent, and portal branding in the dedicated Experience Customization workspace."
                icon={<Palette size={16} />}
              >
                <Stack gap="md" align="flex-start">
                  <Text size="sm" c="dimmed">
                    The dedicated editor supports default, client, and app scopes with guided fields and preview.
                  </Text>
                  <Button component={Link} to="/experience-customization" variant="default" rightSection={<ArrowRight size={16} />}>
                    Open Experience Customization
                  </Button>
                </Stack>
              </SectionCard>

              <SectionCard title="What changes immediately" icon={<Info size={16} />}>
                <List size="sm" spacing="xs">
                  <List.Item>HTTPS requirement is applied on the next incoming request.</List.Item>
                  <List.Item>CORS origin policy is checked on the next browser preflight or cross-origin request.</List.Item>
                  <List.Item>Cookie security changes affect the next issued CSRF or session cookie.</List.Item>
                  <List.Item>Redirect URI and PKCE enforcement apply to subsequent client changes and authorize requests.</List.Item>
                  <List.Item>Disabling implicit flow immediately blocks new authorize requests that return front-channel tokens, including <Code>response_type=token</Code>, <Code>id_token token</Code>, and <Code>code id_token token</Code>.</List.Item>
                  <List.Item>Lockout and anomaly thresholds are applied immediately to new authentication and session observation events.</List.Item>
                  <List.Item>Database provider settings are persisted immediately and take effect once the backend storage rewrite path is activated.</List.Item>
                  <List.Item>Email transport settings are used immediately for recovery and other email-driven flows.</List.Item>
                </List>
              </SectionCard>
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        {/* ── Security ─────────────────────────────────────────────── */}
        <Tabs.Panel value="security">
          <Stack gap="lg">
            <SettingsList
              title="Transport security"
              description="How the server treats plain-HTTP requests, cookies and client callbacks."
            >
              <SettingRow
                label="Require HTTPS"
                description="Reject non-HTTPS requests at the server edge unless they arrive through a forwarded HTTPS proxy."
                htmlFor="admin-require-https"
              >
                <Switch id="admin-require-https" checked={form.requireHttps} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, requireHttps: checked })) }} />
              </SettingRow>
              <SettingRow
                label="Use secure cookies"
                description="Marks admin session and CSRF cookies as secure so browsers only send them over HTTPS."
                htmlFor="admin-secure-cookies"
              >
                <Switch id="admin-secure-cookies" checked={form.secureCookies} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, secureCookies: checked })) }} />
              </SettingRow>
              <SettingRow
                label="Require HTTPS redirect URIs"
                description="Enforces HTTPS for newly created or updated client redirect URIs, except localhost development callbacks."
                htmlFor="admin-https-redirects"
              >
                <Switch id="admin-https-redirects" checked={form.requireHttpsRedirectUris} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, requireHttpsRedirectUris: checked })) }} />
              </SettingRow>
            </SettingsList>

            <SettingsList
              title="OAuth and token security"
              description="Authorization request hardening for every OAuth client."
            >
              <SettingRow
                label="Require S256 PKCE"
                description="Rejects plain PKCE and requires the stronger S256 code challenge method for authorization requests."
                htmlFor="admin-s256-pkce"
              >
                <Switch id="admin-s256-pkce" checked={form.requireS256Pkce} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, requireS256Pkce: checked })) }} />
              </SettingRow>
              <SettingRow
                label="Allow implicit flow"
                description={<>Keeps front-channel token responses available, including <Code>response_type=token</Code>, <Code>id_token token</Code>, and <Code>code id_token token</Code>. Disable this to remove weaker implicit and hybrid front-channel paths.</>}
                htmlFor="admin-implicit-flow"
              >
                <Switch id="admin-implicit-flow" checked={form.allowImplicitFlow} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, allowImplicitFlow: checked })) }} />
              </SettingRow>
              <SettingRow
                label="Token signing algorithm"
                description={<>Tokens are currently signed using RS256. This implementation remains enforced server-side. Access and refresh token lifetimes are configured per OAuth client on the <Anchor component={Link} to="/clients" size="xs">Clients</Anchor> page.</>}
              >
                <StatusBadge status="success" ff="monospace">RS256</StatusBadge>
              </SettingRow>
            </SettingsList>

            <SectionCard
              title="CORS policy"
              description="Which browser origins may call the API cross-origin."
              icon={<Network size={16} />}
            >
              <Stack gap="lg">
                <SettingsList>
                  <SettingRow
                    label="Allow any origin"
                    description="Permits cross-origin requests from any browser origin. Disable this for production-grade isolation."
                    htmlFor="admin-any-origin"
                  >
                    <Switch id="admin-any-origin" checked={form.allowAnyCorsOrigin} onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, allowAnyCorsOrigin: checked })) }} />
                  </SettingRow>
                </SettingsList>

                <Stack gap={6}>
                  <Text size="sm" fw={500}>Auto-added app origins</Text>
                  <Paper withBorder radius="md" px="sm" py="xs" mih={44} bg="var(--nx-color-surface-sunken)">
                    {appCorsOrigins.length === 0 ? (
                      <Text size="xs" c="dimmed">No app URLs or resource URLs found to auto-allow.</Text>
                    ) : (
                      <Group gap={6}>
                        {appCorsOrigins.map((origin) => (
                          <Badge key={origin} variant="default" tt="none" ff="monospace" fw={400}>
                            {origin}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </Paper>
                  <Text size="xs" c="dimmed">These origins are synced from app URL and app resource URLs and are included automatically when saving.</Text>
                </Stack>

                <Textarea
                  label="Allowed origins"
                  description={<>One origin per line. Include scheme and host, for example <Code>https://admin.example.com</Code>. Manual values here are merged with the auto-added app origins.</>}
                  inputWrapperOrder={['label', 'input', 'description']}
                  value={form.corsAllowedOriginsText}
                  onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, corsAllowedOriginsText: value })) }}
                  disabled={form.allowAnyCorsOrigin}
                  autosize
                  minRows={5}
                  ff="monospace"
                  styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
                  placeholder={'https://admin.example.com\nhttps://portal.example.com'}
                />
              </Stack>
            </SectionCard>

            <SectionCard
              title="Runtime attack controls"
              description="These values are applied immediately to login lockout tracking, session anomaly detection, and rate limiting without restarting the server."
              icon={<Lock size={16} />}
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
                <NumberInput
                  label="Login failure window"
                  description="How long failed logins are counted before the counter resets, in minutes."
                  inputWrapperOrder={['label', 'input', 'description']}
                  min={1}
                  max={1440}
                  suffix=" min"
                  value={form.loginFailureWindowMinutes}
                  onChange={(value) => setForm((v) => ({ ...v, loginFailureWindowMinutes: Number(value || 1) }))}
                />
                <NumberInput
                  label="Lockout threshold"
                  description="Number of failed logins allowed before the account is temporarily locked."
                  inputWrapperOrder={['label', 'input', 'description']}
                  min={1}
                  max={100}
                  value={form.loginLockoutThreshold}
                  onChange={(value) => setForm((v) => ({ ...v, loginLockoutThreshold: Number(value || 1) }))}
                />
                <NumberInput
                  label="Lockout duration"
                  description="How long the lockout remains active after the threshold is reached, in minutes."
                  inputWrapperOrder={['label', 'input', 'description']}
                  min={1}
                  max={1440}
                  suffix=" min"
                  value={form.loginLockoutDurationMinutes}
                  onChange={(value) => setForm((v) => ({ ...v, loginLockoutDurationMinutes: Number(value || 1) }))}
                />
                <NumberInput
                  label="Session anomaly concurrency"
                  description="Raises a session anomaly event when a user exceeds this many concurrent active sessions."
                  inputWrapperOrder={['label', 'input', 'description']}
                  min={1}
                  max={100}
                  value={form.sessionAnomalyConcurrencyThreshold}
                  onChange={(value) => setForm((v) => ({ ...v, sessionAnomalyConcurrencyThreshold: Number(value || 1) }))}
                />
                <NumberInput
                  label="Rate limit multiplier"
                  description="Scales global and endpoint rate limits. 1 is the base limit; 10 allows 10x more requests per window."
                  inputWrapperOrder={['label', 'input', 'description']}
                  min={0.1}
                  max={100}
                  step={0.1}
                  decimalScale={2}
                  suffix="×"
                  value={form.rateLimitMultiplier}
                  onChange={(value) => setForm((v) => ({ ...v, rateLimitMultiplier: Number(value || 1) }))}
                />
              </SimpleGrid>
            </SectionCard>
          </Stack>
        </Tabs.Panel>

        {/* ── Data ─────────────────────────────────────────────────── */}
        <Tabs.Panel value="data">
          <Stack gap="lg">
            <SectionCard
              title="Database provider"
              description="Provider settings are persisted now; full PostgreSQL/MySQL runtime persistence is part of the ongoing repository rewrite."
              icon={<Database size={16} />}
              footer={form.databaseProvider !== 'sqlite' ? (
                <>
                  <Button
                    variant="default"
                    onClick={testDatabaseConnection}
                    disabled={!form.externalDatabaseUrl}
                    loading={testExternalDb.isPending}
                  >
                    Test connection
                  </Button>
                  <Button
                    onClick={migrateFromSqlite}
                    disabled={!form.externalDatabaseUrl}
                    loading={migrateDatabase.isPending}
                  >
                    Migrate from SQLite
                  </Button>
                </>
              ) : undefined}
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={720}>
                <NativeSelect
                  label="Provider"
                  value={form.databaseProvider}
                  onChange={(e) => { const value = e.currentTarget.value as SettingsForm['databaseProvider']; setForm((v) => ({ ...v, databaseProvider: value })) }}
                  data={[
                    { value: 'sqlite', label: 'SQLite' },
                    { value: 'postgresql', label: 'PostgreSQL' },
                    { value: 'mysql', label: 'MySQL' }
                  ]}
                />
                {form.databaseProvider === 'sqlite' ? (
                  <TextInput
                    label="SQLite database path"
                    value={form.databasePath}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, databasePath: value })) }}
                    placeholder="./data/sso.sqlite"
                    ff="monospace"
                  />
                ) : (
                  <TextInput
                    label="External database URL"
                    value={form.externalDatabaseUrl}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, externalDatabaseUrl: value })) }}
                    placeholder={form.databaseProvider === 'postgresql' ? 'postgresql://user:pass@host:5432/sso' : 'mysql://user:pass@host:3306/sso'}
                  />
                )}
              </SimpleGrid>
            </SectionCard>

            <SectionCard
              title="Data retention"
              description={<>Expired tokens, closed sessions and log rows are deleted in small batches by a background sweep that runs continuously while the server is up. Set each window in days. <Text span inherit fw={500} c="var(--mantine-color-text)">0 keeps rows forever.</Text></>}
              icon={<Trash2 size={16} />}
            >
              <Stack gap="lg">
                <SettingsList>
                  <SettingRow
                    label="Run the background retention sweep"
                    htmlFor="admin-retention-enabled"
                  >
                    <Switch
                      id="admin-retention-enabled"
                      checked={form.retentionEnabled}
                      onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, retentionEnabled: checked })) }}
                    />
                  </SettingRow>
                </SettingsList>

                {retentionStatus ? (
                  <Group gap={6} wrap="wrap">
                    <StatusBadge status={retentionStatus.running && retentionStatus.enabled ? 'success' : 'neutral'} size="sm">
                      {retentionStatus.running && retentionStatus.enabled ? 'Sweeping' : 'Idle'}
                    </StatusBadge>
                    <Text span size="xs" c="dimmed">Up to {retentionStatus.batchSize} rows every {Math.round(retentionStatus.intervalMs / 1000)}s</Text>
                    <Text span size="xs" c="dimmed" aria-hidden>·</Text>
                    <Text span size="xs" c="dimmed">{retentionStatus.deletedSinceStart.toLocaleString()} rows deleted since this server started</Text>
                    {retentionStatus.lastTickAt ? (
                      <>
                        <Text span size="xs" c="dimmed" aria-hidden>·</Text>
                        <Text span size="xs" c="dimmed">Last pass {new Date(retentionStatus.lastTickAt).toLocaleString()}</Text>
                      </>
                    ) : null}
                  </Group>
                ) : null}

                {isRetentionLoading ? (
                  <Text size="sm" c="dimmed">Loading retention policies…</Text>
                ) : !retentionStatus ? (
                  <Text size="sm" c="dimmed">Retention status is unavailable.</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="lg">
                    {retentionStatus.policies.map((policy) => {
                      const value = form.retentionDays[policy.key] ?? policy.days
                      return (
                        <Stack key={policy.key} gap={4}>
                          <NumberInput
                            label={policy.label}
                            description={policy.description}
                            inputWrapperOrder={['label', 'input', 'description']}
                            min={0}
                            max={policy.maxDays}
                            allowDecimal={false}
                            suffix=" days"
                            value={value}
                            disabled={!policy.supported}
                            onChange={(raw) => {
                              const next = Number(raw)
                              setForm((v) => ({
                                ...v,
                                retentionDays: { ...v.retentionDays, [policy.key]: Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0 },
                              }))
                            }}
                          />
                          <Text size="xs" c="dimmed">
                            {policy.basis === 'expiry' ? 'Counted from expiry.' : 'Counted from creation.'}{' '}
                            Minimum {policy.minDays} days, or 0 to keep forever. Default {policy.defaultDays}.
                          </Text>
                          {!policy.supported ? (
                            <Text size="xs" c="yellow">Not available on this database.</Text>
                          ) : value > 0 && (policy.expired ?? 0) > 0 ? (
                            <Text size="xs" c="dimmed">
                              {(policy.expired ?? 0).toLocaleString()} rows currently past this window.
                            </Text>
                          ) : null}
                          {policy.lastError ? (
                            <Text size="xs" c="red">Last sweep failed: {policy.lastError}</Text>
                          ) : null}
                        </Stack>
                      )
                    })}
                  </SimpleGrid>
                )}

                <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />} title="Before you shorten a window">
                  Deletion is permanent and is not replicated to an archive. Audit events and SAML assertion audits are
                  frequently subject to a retention obligation — confirm yours before lowering them, and use 0 to keep
                  them indefinitely.
                </Alert>
              </Stack>
            </SectionCard>
          </Stack>
        </Tabs.Panel>

        {/* ── Email ────────────────────────────────────────────────── */}
        <Tabs.Panel value="email">
          <Stack gap="lg">
            <SectionCard
              title="Email delivery"
              description="Used for recovery and other email-driven flows."
              icon={<Mail size={16} />}
            >
              <Stack gap="lg">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
                  <NativeSelect
                    label="Transport"
                    value={form.emailTransport}
                    onChange={(e) => { const value = e.currentTarget.value as SettingsForm['emailTransport']; setForm((v) => ({ ...v, emailTransport: value })) }}
                    data={[
                      { value: 'disabled', label: 'Disabled' },
                      { value: 'log', label: 'Log only (development)' },
                      { value: 'smtp', label: 'SMTP' }
                    ]}
                  />
                  <TextInput
                    label="From address"
                    type="email"
                    value={form.emailFrom}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, emailFrom: value })) }}
                    placeholder="no-reply@example.com"
                  />
                  <TextInput
                    label="SMTP host"
                    value={form.smtpHost}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, smtpHost: value })) }}
                    disabled={smtpDisabled}
                    placeholder="smtp.example.com"
                  />
                  <NumberInput
                    label="SMTP port"
                    value={form.smtpPort}
                    onChange={(value) => setForm((v) => ({ ...v, smtpPort: Number(value || 587) }))}
                    disabled={smtpDisabled}
                    allowDecimal={false}
                    thousandSeparator={false}
                  />
                  <TextInput
                    label="SMTP username"
                    value={form.smtpUser}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, smtpUser: value })) }}
                    disabled={smtpDisabled}
                  />
                  <PasswordInput
                    label="SMTP password"
                    value={form.smtpPass}
                    onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, smtpPass: value })) }}
                    disabled={smtpDisabled}
                  />
                </SimpleGrid>

                <SettingsList>
                  <SettingRow
                    label="Use TLS (secure)"
                    description="Enable for SMTPS transports, usually port 465."
                    htmlFor="admin-smtp-secure"
                  >
                    <Switch
                      id="admin-smtp-secure"
                      checked={form.smtpSecure}
                      onChange={(e) => { const checked = e.currentTarget.checked; setForm((v) => ({ ...v, smtpSecure: checked })) }}
                      disabled={smtpDisabled}
                    />
                  </SettingRow>
                </SettingsList>
              </Stack>
            </SectionCard>

            <SectionCard title="Send test email" description="Sends a message with the transport configured on the server.">
              <Group gap="sm" align="flex-end">
                <TextInput
                  type="email"
                  aria-label="Send test email to"
                  value={form.testEmailTo}
                  onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, testEmailTo: value })) }}
                  miw={240}
                  style={{ flex: 1 }}
                  maw={420}
                  placeholder="you@example.com"
                />
                <Button
                  variant="default"
                  onClick={sendTestEmail}
                  disabled={!form.testEmailTo}
                  loading={testEmail.isPending}
                >
                  Send test
                </Button>
              </Group>
            </SectionCard>
          </Stack>
        </Tabs.Panel>

        {/* ── Provisioning ─────────────────────────────────────────── */}
        <Tabs.Panel value="provisioning">
          <ProvisioningAdminPanel />
        </Tabs.Panel>
      </Tabs>

      {(saveMessage || saveError) ? (
        <Alert
          color={saveError ? 'red' : 'green'}
          icon={saveError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          withCloseButton
          onClose={() => { setSaveMessage(null); setSaveError(null) }}
        >
          {saveError ?? saveMessage}
        </Alert>
      ) : null}

      {isSettingsTab ? (
        <Group justify="flex-end">
          <Button onClick={save} loading={updateSettings.isPending}>
            Save instance settings
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}
