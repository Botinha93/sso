import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowRight,
  CheckSquare,
  Fingerprint,
  GitMerge,
  Shield,
  ShieldAlert,
  Users
} from 'lucide-react'
import React from 'react';
import { Badge, Box, Card, Grid, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import { AreaChart } from '@mantine/charts'
import { MeterBar, MetricRow, PageHeader, PageHeaderSkeleton, SectionCard, StatCard, StatGroup } from '@nexus/design'
import { Link } from 'react-router-dom'
import {
  useAccessRequests,
  useAuditStats,
  useAdminMe,
  useClients,
  useConnectors,
  useConsents,
  useElevationRequests,
  useElevationSessions,
  useEventHooks,
  useEventNotifications,
  useGroups,
  useRoles,
  useSessions,
  useTenants,
  useUsers
} from '../hooks/useApi'

interface UserItem {
  id: string
  active: boolean
}

interface ClientItem {
  id: string
  name: string
  requirePkce: boolean
  grants: string[]
  resources?: string[]
}

interface SessionItem {
  id: string
  userId: string
  clientId: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
}

interface ConsentItem {
  id: string
  clientId: string
  scope: string[]
}

interface EventNotification {
  id: string
  status: 'pending' | 'success' | 'failed'
}

interface AccessRequestItem {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
}

interface ElevationRequestItem {
  id: string
  status: 'pending' | 'approved' | 'active' | 'revoked' | 'expired'
}

interface ElevationSessionItem {
  id: string
  status: 'active' | 'revoked' | 'expired'
}

interface ConnectorItem {
  id: string
  type: 'ldap' | 'scim' | 'csv' | 'sql' | 'custom'
  status: 'active' | 'inactive' | 'error'
}

type SeriesPoint = {
  label: string
  value: number
}

const dayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const keyForDay = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const formatPct = (value: number) => `${Math.round(value * 100)}%`

// Lists fetched with a row limit only show the most recent slice; say so instead of implying a total.
const LIST_LIMIT = 200
const countLabel = (count: number, limit = LIST_LIMIT) => (count >= limit ? `${limit}+` : String(count))

const STATS_DAYS = 14
function ActivityChart({ data }: { data: SeriesPoint[] }) {
  return (
    <AreaChart
      h={240}
      data={data}
      dataKey="label"
      series={[{ name: 'value', label: 'Events', color: 'blue.6' }]}
      curveType="monotone"
      gridAxis="y"
      tickLine="none"
      strokeWidth={1.75}
      fillOpacity={0.18}
      withDots={false}
      unit=" events"
      yAxisProps={{ width: 48, allowDecimals: false }}
      xAxisProps={{ minTickGap: 16 }}
    />
  )
}

function HorizontalBars({ data, emptyLabel }: { data: SeriesPoint[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <Text size="sm" c="dimmed">{emptyLabel}</Text>
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <Stack gap="sm">
      {data.map((item) => (
        <MeterBar
          key={item.label}
          label={item.label}
          value={clamp(item.value, 0, maxValue)}
          max={maxValue}
          valueLabel={item.value}
          color="blue"
          size="sm"
        />
      ))}
    </Stack>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: '0.04em' }}>
      {children}
    </Text>
  )
}

const Dashboard = () => {
  const { data: adminMe } = useAdminMe()
  const { data: users = [], isLoading: loadingUsers } = useUsers()
  const { data: roles = [], isLoading: loadingRoles } = useRoles()
  const { data: groups = [], isLoading: loadingGroups } = useGroups()
  const { data: tenants = [], isLoading: loadingTenants } = useTenants()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: sessions = [], isLoading: loadingSessions } = useSessions()
  const { data: consents = [], isLoading: loadingConsents } = useConsents()
  const { data: auditStats, isLoading: loadingAudit, isError: auditError } = useAuditStats(STATS_DAYS)
  const { data: eventHooks = [], isLoading: loadingEventHooks, isError: eventHooksError } = useEventHooks()
  const { data: notifications = [], isLoading: loadingNotifications, isError: notificationsError } = useEventNotifications(LIST_LIMIT)
  const { data: accessRequests = [], isLoading: loadingAccessRequests, isError: accessRequestsError } = useAccessRequests(undefined, LIST_LIMIT)
  const { data: pendingAccessRequestList = [], isLoading: loadingPendingAccessRequests } = useAccessRequests('pending', LIST_LIMIT)
  const { data: elevationRequests = [], isLoading: loadingElevationRequests, isError: elevationError } = useElevationRequests()
  const { data: elevationSessions = [], isLoading: loadingElevationSessions } = useElevationSessions()
  const { data: connectorsData, isLoading: loadingConnectors, isError: connectorsError } = useConnectors()

  const now = Date.now()

  const userItems = users as UserItem[]
  const clientItems = clients as ClientItem[]
  const sessionItems = sessions as SessionItem[]
  const consentItems = consents as ConsentItem[]
  const notificationItems = notifications as EventNotification[]
  const accessRequestItems = accessRequests as AccessRequestItem[]
  const elevationRequestItems = elevationRequests as ElevationRequestItem[]
  const elevationSessionItems = elevationSessions as ElevationSessionItem[]
  const connectorItems = (connectorsData?.data ?? []) as ConnectorItem[]

  const activeUsers = userItems.filter((u) => u.active).length
  const inactiveUsers = userItems.length - activeUsers
  const activeSessions = sessionItems.filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now).length
  const revokedSessions = sessionItems.filter((s) => !!s.revokedAt).length
  const pkceClients = clientItems.filter((c) => c.requirePkce).length
  const clientResourcesCount = clientItems.reduce((sum, c) => sum + (c.resources?.length ?? 0), 0)
  const pendingAccessRequests = (pendingAccessRequestList as AccessRequestItem[]).length
  const approvedAccessRequests = accessRequestItems.filter((r) => r.status === 'approved').length
  const activeElevationSessions = elevationSessionItems.filter((s) => s.status === 'active').length
  const pendingElevationRequests = elevationRequestItems.filter((r) => r.status === 'pending').length
  const failedConnectors = connectorItems.filter((c) => c.status === 'error').length
  const activeConnectors = connectorItems.filter((c) => c.status === 'active').length
  const riskBySeverity = auditStats?.riskBySeverity ?? { medium: 0, high: 0, critical: 0 }
  const totalRiskEvents = riskBySeverity.medium + riskBySeverity.high + riskBySeverity.critical
  // Render "—" rather than a misleading 0 when a source failed or is not permitted.
  const show = (failed: boolean, value: React.ReactNode) => (failed ? '—' : value)

  const allLoading = [
    loadingUsers,
    loadingRoles,
    loadingGroups,
    loadingTenants,
    loadingClients,
    loadingSessions,
    loadingConsents,
    loadingAudit,
    loadingEventHooks,
    loadingNotifications,
    loadingAccessRequests,
    loadingPendingAccessRequests,
    loadingElevationRequests,
    loadingElevationSessions,
    loadingConnectors
  ].some(Boolean)

  // The server returns UTC hour buckets for the whole window; fold them into local calendar days.
  const countsByDay = new Map<string, number>()
  for (const bucket of auditStats?.byHour ?? []) {
    const key = keyForDay(new Date(`${bucket.hour}:00:00Z`))
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + bucket.count)
  }
  const timeline: SeriesPoint[] = Array.from({ length: STATS_DAYS }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (STATS_DAYS - index - 1))
    return {
      label: dayLabel(date),
      value: countsByDay.get(keyForDay(date)) ?? 0
    }
  })
  const timelineTotal = timeline.reduce((sum, p) => sum + p.value, 0)

  const eventDistribution = (auditStats?.byType ?? [])
    .slice(0, 7)
    .map((row) => ({ label: row.type, value: row.count }))

  const activeSessionItems = sessionItems.filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now)
  const sessionsByClient = Object.entries(
    activeSessionItems.reduce<Record<string, number>>((acc, session) => {
      acc[session.clientId] = (acc[session.clientId] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }))

  const scopePopularity = Object.entries(
    consentItems.reduce<Record<string, number>>((acc, consent) => {
      for (const scope of consent.scope) {
        acc[scope] = (acc[scope] ?? 0) + 1
      }
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([label, value]) => ({ label, value }))

  const accessRequestStatusDistribution = Object.entries(
    accessRequestItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label: label.replace('_', ' '), value }))

  const elevationRequestStatusDistribution = Object.entries(
    elevationRequestItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label: label.replace('_', ' '), value }))

  const connectorTypeDistribution = Object.entries(
    connectorItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label: label.toUpperCase(), value }))

  const riskSeverityDistribution = Object.entries(riskBySeverity)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  // Pending deliveries have no outcome yet, so they are excluded from the rate.
  const settledNotifications = notificationItems.filter((n) => n.status !== 'pending')
  const notificationSuccessRate = settledNotifications.length === 0
    ? 0
    : settledNotifications.filter((n) => n.status === 'success').length / settledNotifications.length

  const permissions: string[] = (adminMe as any)?.permissions ?? []
  const can = (permission: string) => permissions.includes('*:*') || permissions.includes(permission)

  const operationLinks = [
    {
      to: '/access-governance',
      title: 'Access Governance',
      description: 'Open request approvals, stalled queue, and recertification campaigns.',
      permission: 'administration:view'
    },
    {
      to: '/elevations',
      title: 'Elevation Operations',
      description: 'Request, approve, activate, revoke, and emergency break-glass access.',
      permission: 'administration:view'
    },
    {
      to: '/elevation-sessions',
      title: 'Elevation Sessions',
      description: 'Inspect active, revoked, and expired privileged access sessions.',
      permission: 'administration:view'
    },
    {
      to: '/metrics',
      title: 'Auth Metrics',
      description: 'Review authentication throughput and event breakdown metrics.',
      permission: 'connectors:view'
    }
  ].filter((item) => can(item.permission))

  const permissionDensity = roles.length === 0
    ? 0
    : (roles as any[]).reduce((sum, role) => sum + ((role.permissions ?? []).length as number), 0) / roles.length

  // Share of active users holding at least one live session (a user with several sessions counts once).
  const usersWithActiveSession = new Set(activeSessionItems.map((s) => s.userId)).size
  const sessionCoverage = activeUsers === 0 ? 0 : usersWithActiveSession / activeUsers

  if (allLoading) {
    return (
      <Stack gap="lg">
        <PageHeaderSkeleton blocks={1} />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {[...Array(4)].map((_, i) => <Skeleton key={i} h={112} radius="md" />)}
        </SimpleGrid>
        <Skeleton h={288} radius="md" />
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <PageHeader
        variant="hero"
        eyebrow="Control Center"
        title="Identity Usage Dashboard"
        description={`Current identity inventory, live sessions, consent behavior, and the last ${STATS_DAYS} days of audit activity.`}
      />

      {operationLinks.length === 0 ? (
        <Paper withBorder radius="md" px="md" py="sm" bg="var(--nx-color-surface-sunken)">
          <Text size="xs" c="dimmed">
            You do not currently have permission to access the operations views.
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {operationLinks.map((item) => (
            <Card key={item.to} component={Link} to={item.to} withBorder radius="md" padding="md" className="nx-interactive">
              <Text size="sm" fw={600}>{item.title}</Text>
              <Text size="xs" c="dimmed" mt={4} lh={1.5} style={{ flex: 1 }}>{item.description}</Text>
              <Group gap={4} mt="sm" c="blue">
                <Text size="xs" fw={500} c="blue">Open</Text>
                <ArrowRight size={12} />
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard
          label="Users"
          value={userItems.length}
          icon={<Users size={16} />}
          iconColor="indigo"
          caption={`${activeUsers} active · ${inactiveUsers} inactive`}
        />
        <StatCard
          label="Sessions"
          value={activeSessions}
          icon={<Activity size={16} />}
          iconColor="blue"
          caption={`active · ${revokedSessions} revoked · ${sessionItems.length} total`}
        />
        <StatCard
          label="Clients"
          value={clientItems.length}
          icon={<AppWindow size={16} />}
          iconColor="violet"
          caption={`${pkceClients} with PKCE · ${clientResourcesCount} resources`}
        />
        <StatCard
          label="Access model"
          value={roles.length}
          icon={<Shield size={16} />}
          iconColor="teal"
          caption={`roles · ${groups.length} groups · ${tenants.length} tenants`}
        />
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <SectionCard
            h="100%"
            title="Audit activity"
            description={`All audit events per day over the last ${STATS_DAYS} days`}
            actions={<Badge variant="light" color="blue">{show(auditError, timelineTotal)} events</Badge>}
          >
            {auditError
              ? <Text size="sm" c="dimmed">Audit statistics are unavailable.</Text>
              : <ActivityChart data={timeline} />}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard h="100%" title="Security posture">
            <Stack gap="md">
              <MeterBar
                aria-label="PKCE coverage"
                label={<Group component="span" gap={6} wrap="nowrap"><Fingerprint size={14} /> PKCE coverage</Group>}
                value={clientItems.length ? pkceClients / clientItems.length : 0}
                max={1}
                valueLabel={clientItems.length ? formatPct(pkceClients / clientItems.length) : '0%'}
                color="green"
              />
              <MeterBar
                aria-label="Webhook success"
                label={
                  <Tooltip label={`Delivered vs failed, across the latest ${LIST_LIMIT} webhook deliveries`} openDelay={300}>
                    <Group component="span" gap={6} wrap="nowrap"><CheckSquare size={14} /> Webhook success</Group>
                  </Tooltip>
                }
                value={notificationSuccessRate}
                max={1}
                valueLabel={show(notificationsError, settledNotifications.length ? formatPct(notificationSuccessRate) : 'n/a')}
                color="cyan"
              />
              <MeterBar
                aria-label="Users with live session"
                label={
                  <Tooltip label="Active users with at least one live session" openDelay={300}>
                    <Group component="span" gap={6} wrap="nowrap"><Users size={14} /> Users with live session</Group>
                  </Tooltip>
                }
                value={clamp(sessionCoverage, 0, 1)}
                max={1}
                valueLabel={`${formatPct(sessionCoverage)} · ${usersWithActiveSession}/${activeUsers}`}
                color="violet"
              />
              <MetricRow label="Avg permissions per role" value={permissionDensity.toFixed(1)} size="sm" />
            </Stack>
          </SectionCard>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <SectionCard title="Top event types" description={`Most frequent audit event types in the last ${STATS_DAYS} days`}>
          <HorizontalBars data={eventDistribution} emptyLabel={auditError ? 'Audit statistics are unavailable.' : `No audit events in the last ${STATS_DAYS} days.`} />
        </SectionCard>
        <SectionCard title="Session load by client" description="Live (unexpired, unrevoked) sessions per client">
          <HorizontalBars data={sessionsByClient} emptyLabel="No live sessions right now." />
        </SectionCard>
        <SectionCard title="Most requested scopes" description="Popularity derived from consent grants">
          <HorizontalBars data={scopePopularity} emptyLabel="No consent scopes recorded yet." />
        </SectionCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard
          label="Pending requests"
          value={show(accessRequestsError, countLabel(pendingAccessRequests))}
          icon={<ShieldAlert size={16} />}
          iconColor="yellow"
          caption={show(accessRequestsError, `${approvedAccessRequests} approved of latest ${countLabel(accessRequestItems.length)}`)}
        />
        <StatCard
          label="Elevation sessions"
          value={show(elevationError, activeElevationSessions)}
          icon={<Shield size={16} />}
          iconColor="red"
          caption={show(elevationError, `active · ${pendingElevationRequests} pending requests`)}
        />
        <StatCard
          label="Connectors"
          value={show(connectorsError, connectorItems.length)}
          icon={<GitMerge size={16} />}
          iconColor="cyan"
          caption={show(connectorsError, `${activeConnectors} active · ${failedConnectors} in error`)}
        />
        <StatCard
          label={`Risk events (${STATS_DAYS}d)`}
          value={show(auditError, totalRiskEvents)}
          icon={<AlertTriangle size={16} />}
          iconColor="red"
          caption={show(auditError, `${riskBySeverity.critical} critical · ${riskBySeverity.high} high · ${riskBySeverity.medium} medium`)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <SectionCard
          title="Governance and elevation activity"
          description={`Status mix of the latest ${LIST_LIMIT} access requests and all elevation requests.`}
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Box>
              <SubHeading>Access requests</SubHeading>
              <HorizontalBars data={accessRequestStatusDistribution} emptyLabel="No access request data available yet." />
            </Box>
            <Box>
              <SubHeading>Elevation requests</SubHeading>
              <HorizontalBars data={elevationRequestStatusDistribution} emptyLabel="No elevation request data available yet." />
            </Box>
          </SimpleGrid>
        </SectionCard>

        <SectionCard
          title="Connector and risk distribution"
          description={`Integration footprint and risk event severity over the last ${STATS_DAYS} days.`}
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Box>
              <SubHeading>Connector types</SubHeading>
              <HorizontalBars data={connectorTypeDistribution} emptyLabel="No connector data available yet." />
            </Box>
            <Box>
              <SubHeading>Risk severity</SubHeading>
              <HorizontalBars data={riskSeverityDistribution} emptyLabel={auditError ? 'Risk statistics are unavailable.' : `No risk events in the last ${STATS_DAYS} days.`} />
            </Box>
          </SimpleGrid>
        </SectionCard>
      </SimpleGrid>

      <SectionCard title="Platform inventory">
        <StatGroup minItemWidth={130}>
          <StatGroup.Item label="Tenants" value={tenants.length} />
          <StatGroup.Item label="Groups" value={groups.length} />
          <StatGroup.Item label="Roles" value={roles.length} />
          <StatGroup.Item label="Consents" value={consentItems.length} />
          <StatGroup.Item label="Event hooks" value={show(eventHooksError, (eventHooks as unknown[]).length)} />
          <StatGroup.Item
            label={<span title="Distinct OAuth grant types enabled across clients">Grant types</span>}
            value={Array.from(new Set(clientItems.flatMap((c) => c.grants ?? []))).length}
          />
        </StatGroup>
      </SectionCard>
    </Stack>
  )
}

export default Dashboard
