import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowRight,
  Building2,
  CheckSquare,
  Fingerprint,
  GitMerge,
  Shield,
  ShieldAlert,
  Users
} from 'lucide-react'
import React from 'react';
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
import { PageHeaderSkeleton, PageHeroHeader } from '../components/PageHeader'

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

function LineChart({ data }: { data: SeriesPoint[] }) {
  const width = 760
  const height = 220
  const padX = 28
  const padY = 24
  const maxValue = Math.max(1, ...data.map((d) => d.value))
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0

  const points = data.map((d, i) => {
    const x = padX + i * stepX
    const y = height - padY - ((d.value / maxValue) * (height - padY * 2))
    return { ...d, x, y }
  })

  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = [
    `${padX},${height - padY}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${padX + stepX * (data.length - 1)},${height - padY}`
  ].join(' ')

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[700px] w-full h-[220px]">
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = padY + r * (height - padY * 2)
          return <line key={r} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        })}

        <polygon points={area} fill="url(#activityFill)" />
        <polyline points={line} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, idx) => (
          <circle key={`${p.label}-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#0369a1">
            <title>{`${p.label}: ${p.value} events`}</title>
          </circle>
        ))}

        {points.map((p, idx) => idx % 2 === 0 ? (
          <text key={`label-${p.label}`} x={p.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#64748b">
            {p.label}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

function HorizontalBars({ data, emptyLabel }: { data: SeriesPoint[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2.5">
      {data.map((item) => {
        const ratio = clamp(item.value / maxValue, 0, 1)
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground truncate pr-2">{item.label}</span>
              <span className="text-muted-foreground">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#22d3ee)]" style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
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
      <div className="space-y-6">
        <PageHeaderSkeleton blocks={1} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeroHeader
        eyebrow="Control Center"
        title="Identity Usage Dashboard"
        description={`Current identity inventory, live sessions, consent behavior, and the last ${STATS_DAYS} days of audit activity.`}
      />

      <div className="grid gap-3 md:grid-cols-4">
        {operationLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-xl border border-border bg-white p-4 text-sm shadow-sm transition-all hover:border-sky-200 hover:shadow-md"
          >
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-600">
              Open <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
        {operationLinks.length === 0 ? (
          <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            You do not currently have permission to access the operations views.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Users</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Users size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{userItems.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">{activeUsers} active · {inactiveUsers} inactive</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Activity size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{activeSessions}</div>
          <p className="mt-1 text-xs text-muted-foreground">active · {revokedSessions} revoked · {sessionItems.length} total</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clients</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><AppWindow size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{clientItems.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">{pkceClients} with PKCE · {clientResourcesCount} resources</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Model</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Shield size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{roles.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">roles · {groups.length} groups · {tenants.length} tenants</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Audit Activity</h3>
              <p className="text-xs text-muted-foreground">All audit events per day over the last {STATS_DAYS} days</p>
            </div>
            <span className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 border border-sky-100">
              {show(auditError, timelineTotal)} events
            </span>
          </div>
          {auditError
            ? <p className="text-sm text-muted-foreground">Audit statistics are unavailable.</p>
            : <LineChart data={timeline} />}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Security Posture</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Fingerprint size={12} /> PKCE Coverage</span>
                <span>{clientItems.length ? formatPct(pkceClients / clientItems.length) : '0%'}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${clientItems.length ? (pkceClients / clientItems.length) * 100 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1" title={`Delivered vs failed, across the latest ${LIST_LIMIT} webhook deliveries`}>
                  <CheckSquare size={12} /> Webhook Success
                </span>
                <span>{show(notificationsError, settledNotifications.length ? formatPct(notificationSuccessRate) : 'n/a')}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${notificationSuccessRate * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1" title="Active users with at least one live session">
                  <Users size={12} /> Users With Live Session
                </span>
                <span>{formatPct(sessionCoverage)} · {usersWithActiveSession}/{activeUsers}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${clamp(sessionCoverage, 0, 1) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
              Avg permissions per role: <span className="font-semibold text-foreground">{permissionDensity.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Top Event Types</h3>
          <p className="mb-4 text-xs text-muted-foreground">Most frequent audit event types in the last {STATS_DAYS} days</p>
          <HorizontalBars data={eventDistribution} emptyLabel={auditError ? 'Audit statistics are unavailable.' : `No audit events in the last ${STATS_DAYS} days.`} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Session Load by Client</h3>
          <p className="mb-4 text-xs text-muted-foreground">Live (unexpired, unrevoked) sessions per client</p>
          <HorizontalBars data={sessionsByClient} emptyLabel="No live sessions right now." />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Most Requested Scopes</h3>
          <p className="mb-4 text-xs text-muted-foreground">Popularity derived from consent grants</p>
          <HorizontalBars data={scopePopularity} emptyLabel="No consent scopes recorded yet." />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Requests</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><ShieldAlert size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{show(accessRequestsError, countLabel(pendingAccessRequests))}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {show(accessRequestsError, `${approvedAccessRequests} approved of latest ${countLabel(accessRequestItems.length)}`)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Elevation Sessions</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Shield size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{show(elevationError, activeElevationSessions)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{show(elevationError, `active · ${pendingElevationRequests} pending requests`)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connectors</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600"><GitMerge size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{show(connectorsError, connectorItems.length)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{show(connectorsError, `${activeConnectors} active · ${failedConnectors} in error`)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Events ({STATS_DAYS}d)</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><AlertTriangle size={15} /></div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{show(auditError, totalRiskEvents)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {show(auditError, `${riskBySeverity.critical} critical · ${riskBySeverity.high} high · ${riskBySeverity.medium} medium`)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Governance And Elevation Activity</h3>
          <p className="mb-4 text-xs text-muted-foreground">Status mix of the latest {LIST_LIMIT} access requests and all elevation requests.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Access Requests</p>
              <HorizontalBars data={accessRequestStatusDistribution} emptyLabel="No access request data available yet." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Elevation Requests</p>
              <HorizontalBars data={elevationRequestStatusDistribution} emptyLabel="No elevation request data available yet." />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Connector And Risk Distribution</h3>
          <p className="mb-4 text-xs text-muted-foreground">Integration footprint and risk event severity over the last {STATS_DAYS} days.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Connector Types</p>
              <HorizontalBars data={connectorTypeDistribution} emptyLabel="No connector data available yet." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk Severity</p>
              <HorizontalBars data={riskSeverityDistribution} emptyLabel={auditError ? 'Risk statistics are unavailable.' : `No risk events in the last ${STATS_DAYS} days.`} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">Platform Inventory</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tenants</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tenants.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Groups</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{groups.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Roles</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{roles.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Consents</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{consentItems.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Event Hooks</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{show(eventHooksError, (eventHooks as unknown[]).length)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground" title="Distinct OAuth grant types enabled across clients">Grant Types</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {Array.from(new Set(clientItems.flatMap((c) => c.grants ?? []))).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard