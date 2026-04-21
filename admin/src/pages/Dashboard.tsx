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
import { Link } from 'react-router-dom'
import {
  useAccessRequests,
  useAuditLog,
  useAdminMe,
  useAdminRiskEvents,
  useClients,
  useConnectors,
  useConsents,
  useElevationRequests,
  useElevationSessions,
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

interface AuditEvent {
  id: string
  type: string
  createdAt: string
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

interface RiskEventItem {
  id: string
  severity: 'medium' | 'high' | 'critical'
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
          <circle key={`${p.label}-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#0369a1" />
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-7 gap-2 text-[11px] text-slate-500">
        {data.filter((_, i) => i % 2 === 0).map((d) => (
          <div key={d.label}>{d.label}</div>
        ))}
      </div>
    </div>
  )
}

function HorizontalBars({ data, emptyLabel }: { data: SeriesPoint[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-2.5">
      {data.map((item) => {
        const ratio = clamp(item.value / maxValue, 0, 1)
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 truncate pr-2">{item.label}</span>
              <span className="text-slate-500">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
  const { data: events = [], isLoading: loadingAudit } = useAuditLog(300)
  const { data: notifications = [], isLoading: loadingNotifications } = useEventNotifications(200)
  const { data: accessRequests = [], isLoading: loadingAccessRequests } = useAccessRequests(undefined, 200)
  const { data: elevationRequests = [], isLoading: loadingElevationRequests } = useElevationRequests()
  const { data: elevationSessions = [], isLoading: loadingElevationSessions } = useElevationSessions()
  const { data: connectorsData, isLoading: loadingConnectors } = useConnectors()
  const { data: riskEvents = [], isLoading: loadingRiskEvents } = useAdminRiskEvents(200)

  const now = Date.now()

  const userItems = users as UserItem[]
  const clientItems = clients as ClientItem[]
  const sessionItems = sessions as SessionItem[]
  const consentItems = consents as ConsentItem[]
  const auditItems = events as AuditEvent[]
  const notificationItems = notifications as EventNotification[]
  const accessRequestItems = accessRequests as AccessRequestItem[]
  const elevationRequestItems = elevationRequests as ElevationRequestItem[]
  const elevationSessionItems = elevationSessions as ElevationSessionItem[]
  const connectorItems = (connectorsData?.data ?? []) as ConnectorItem[]
  const riskEventItems = riskEvents as RiskEventItem[]

  const activeUsers = userItems.filter((u) => u.active).length
  const inactiveUsers = userItems.length - activeUsers
  const activeSessions = sessionItems.filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now).length
  const revokedSessions = sessionItems.filter((s) => !!s.revokedAt).length
  const pkceClients = clientItems.filter((c) => c.requirePkce).length
  const clientResourcesCount = clientItems.reduce((sum, c) => sum + (c.resources?.length ?? 0), 0)
  const pendingAccessRequests = accessRequestItems.filter((r) => r.status === 'pending').length
  const approvedAccessRequests = accessRequestItems.filter((r) => r.status === 'approved').length
  const activeElevationSessions = elevationSessionItems.filter((s) => s.status === 'active').length
  const pendingElevationRequests = elevationRequestItems.filter((r) => r.status === 'pending').length
  const failedConnectors = connectorItems.filter((c) => c.status === 'error').length
  const activeConnectors = connectorItems.filter((c) => c.status === 'active').length
  const criticalRiskEvents = riskEventItems.filter((r) => r.severity === 'critical').length
  const highRiskEvents = riskEventItems.filter((r) => r.severity === 'high').length

  const allLoading = [
    loadingUsers,
    loadingRoles,
    loadingGroups,
    loadingTenants,
    loadingClients,
    loadingSessions,
    loadingConsents,
    loadingAudit,
    loadingNotifications,
    loadingAccessRequests,
    loadingElevationRequests,
    loadingElevationSessions,
    loadingConnectors,
    loadingRiskEvents
  ].every(Boolean)

  const timelineDays = 14
  const timeline: SeriesPoint[] = Array.from({ length: timelineDays }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (timelineDays - index - 1))
    const key = keyForDay(date)
    const value = auditItems.filter((e) => keyForDay(new Date(e.createdAt)) === key).length
    return {
      label: dayLabel(date),
      value
    }
  })

  const eventDistribution = Object.entries(
    auditItems.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([label, value]) => ({ label, value }))

  const sessionsByClient = Object.entries(
    sessionItems.reduce<Record<string, number>>((acc, session) => {
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

  const riskSeverityDistribution = Object.entries(
    riskEventItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.severity] = (acc[item.severity] ?? 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  const notificationSuccessRate = notificationItems.length === 0
    ? 0
    : notificationItems.filter((n) => n.status === 'success').length / notificationItems.length

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

  const sessionCoverage = userItems.length === 0 ? 0 : activeSessions / userItems.length

  if (allLoading) {
    return <div className="text-sm text-slate-500">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,#f0f9ff_0%,#ecfeff_45%,#f8fafc_100%)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Control Center</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Identity Usage Dashboard</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Live view of account growth, authentication activity, consent behavior, and client-level traffic distribution.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {operationLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-600">{item.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700">
              Open view <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
        {operationLinks.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            You do not currently have permission to access the operations views.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Users size={14} /> Users</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{userItems.length}</div>
          <p className="mt-1 text-xs text-slate-500">{activeUsers} active · {inactiveUsers} inactive</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Activity size={14} /> Sessions</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{activeSessions}</div>
          <p className="mt-1 text-xs text-slate-500">{revokedSessions} revoked · {sessionItems.length} total</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><AppWindow size={14} /> Clients</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{clientItems.length}</div>
          <p className="mt-1 text-xs text-slate-500">{pkceClients} with PKCE · {clientResourcesCount} resources</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Shield size={14} /> Access Model</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{roles.length}</div>
          <p className="mt-1 text-xs text-slate-500">roles · {groups.length} groups · {tenants.length} tenants</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Authentication Activity</h3>
              <p className="text-xs text-slate-500">Audit events over the last 14 days</p>
            </div>
            <span className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 border border-sky-100">
              {timeline.reduce((sum, p) => sum + p.value, 0)} events
            </span>
          </div>
          <LineChart data={timeline} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Security Posture</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><Fingerprint size={12} /> PKCE Coverage</span>
                <span>{clientItems.length ? formatPct(pkceClients / clientItems.length) : '0%'}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${clientItems.length ? (pkceClients / clientItems.length) * 100 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><CheckSquare size={12} /> Webhook Success</span>
                <span>{formatPct(notificationSuccessRate)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${notificationSuccessRate * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><Users size={12} /> Session Coverage</span>
                <span>{formatPct(sessionCoverage)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${clamp(sessionCoverage, 0, 1) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Avg permissions per role: <span className="font-semibold text-slate-800">{permissionDensity.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Top Event Types</h3>
          <p className="mb-4 text-xs text-slate-500">Most frequent actions in audit history</p>
          <HorizontalBars data={eventDistribution} emptyLabel="No audit events yet." />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Session Load by Client</h3>
          <p className="mb-4 text-xs text-slate-500">Where active authentication traffic is concentrated</p>
          <HorizontalBars data={sessionsByClient} emptyLabel="No sessions recorded yet." />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Most Requested Scopes</h3>
          <p className="mb-4 text-xs text-slate-500">Popularity derived from consent grants</p>
          <HorizontalBars data={scopePopularity} emptyLabel="No consent scopes recorded yet." />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><ShieldAlert size={14} /> Pending Access Requests</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{pendingAccessRequests}</div>
          <p className="mt-1 text-xs text-slate-500">{approvedAccessRequests} approved · {accessRequestItems.length} total</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Shield size={14} /> Elevation Sessions</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{activeElevationSessions}</div>
          <p className="mt-1 text-xs text-slate-500">{pendingElevationRequests} pending requests</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><GitMerge size={14} /> Connectors</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{connectorItems.length}</div>
          <p className="mt-1 text-xs text-slate-500">{activeConnectors} active · {failedConnectors} in error</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><AlertTriangle size={14} /> Risk Events</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{riskEventItems.length}</div>
          <p className="mt-1 text-xs text-slate-500">{criticalRiskEvents} critical · {highRiskEvents} high</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Governance And Elevation Activity</h3>
          <p className="mb-4 text-xs text-slate-500">Operational status of access requests and privileged elevation lifecycle.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Access Requests</p>
              <HorizontalBars data={accessRequestStatusDistribution} emptyLabel="No access request data available yet." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Elevation Requests</p>
              <HorizontalBars data={elevationRequestStatusDistribution} emptyLabel="No elevation request data available yet." />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Connector And Risk Distribution</h3>
          <p className="mb-4 text-xs text-slate-500">Integration footprint and current security event severity mix.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Connector Types</p>
              <HorizontalBars data={connectorTypeDistribution} emptyLabel="No connector data available yet." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Risk Severity</p>
              <HorizontalBars data={riskSeverityDistribution} emptyLabel="No risk events recorded yet." />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Platform Inventory</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Tenants</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{tenants.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Groups</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{groups.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Roles</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{roles.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Consents</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{consentItems.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Event Hooks</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{notificationItems.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Grants</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {Array.from(new Set(clientItems.flatMap((c) => c.grants ?? []))).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard