import { NavLink } from 'react-router-dom'
import { logout } from '../hooks/useApi'
import {
  LayoutDashboard,
  AppWindow,
  Users,
  UsersRound,
  Shield,
  MonitorSmartphone,
  FileText,
  CheckSquare,
  Building2,
  Boxes,
  Network,
  Route,
  ScanFace,
  Fingerprint,
  Gavel,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  History,
  Tablet,
  BellRing,
  BarChart3,
  Lightbulb,
  Settings2,
  BookText,
  KeyRound,
  LogOut,
  Bot,
  GitMerge,
  Puzzle,
  Sparkles
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'users:view' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { path: '/access-governance', label: 'Access Governance', icon: CheckCircle2, permission: 'administration:view' },
      { path: '/elevations', label: 'Elevation Operations', icon: ShieldAlert, permission: 'administration:view' },
      { path: '/elevation-sessions', label: 'Elevation Sessions', icon: History, permission: 'administration:view' },
      { path: '/sessions', label: 'Sessions', icon: ShieldCheck, permission: 'sessions:view' },
      { path: '/devices', label: 'Devices', icon: Tablet, permission: 'sessions:view' },
      { path: '/events', label: 'Events', icon: BellRing, permission: 'events:view' },
      { path: '/suggestions', label: 'Suggestions', icon: Lightbulb, permission: 'suggestions:view' },
      { path: '/audit', label: 'Audit Log', icon: FileText, permission: 'audit_log:view' },
    ]
  },
  {
    label: 'Identity & Access',
    items: [
      { path: '/users', label: 'Users', icon: Users, permission: 'users:view' },
      { path: '/service-identities', label: 'Service Identities', icon: Bot, permission: 'service_identities:view' },
      { path: '/groups', label: 'Groups', icon: UsersRound, permission: 'groups:view' },
      { path: '/roles', label: 'Roles', icon: Shield, permission: 'roles:view' },
      { path: '/clients', label: 'Clients', icon: AppWindow, permission: 'clients:view' },
      { path: '/apps', label: 'Apps', icon: Boxes, permission: 'apps:view' },
      { path: '/consents', label: 'Consents', icon: CheckSquare, permission: 'consents:view' },
    ]
  },
  {
    label: 'Authentication',
    items: [
      { path: '/federation', label: 'Federation', icon: Network, permission: 'federation_providers:view' },
      { path: '/authentication', label: 'Auth Flows', icon: Route, permission: 'authentication_flows:view' },
      { path: '/interaction-views', label: 'Interaction Views', icon: ScanFace, permission: 'authentication_flows:view' },
      { path: '/policies', label: 'Policies', icon: Gavel, permission: 'policies:view' },
      { path: '/user-attributes', label: 'User Attributes', icon: Fingerprint, permission: 'user_attributes:view' },
    ]
  },
  {
    label: 'Platform',
    items: [
      { path: '/connectors', label: 'Connectors', icon: GitMerge, permission: 'connectors:view' },
      { path: '/plugins', label: 'Plugins', icon: Puzzle, permission: 'administration:view' },
      { path: '/experience-customization', label: 'Experience Customization', icon: Sparkles, permission: 'administration:view' },
      { path: '/metrics', label: 'Auth Metrics', icon: BarChart3, permission: 'connectors:view' },
      { path: '/tenants', label: 'Tenants', icon: Building2, permission: 'tenants:view' },
      { path: '/administration', label: 'Administration', icon: Settings2, permission: 'administration:view' },
      { path: '/documentation', label: 'Documentation', icon: BookText, permission: 'users:view' },
    ]
  },
]

const Sidebar = ({
  permissions = [],
  onNavigate,
  onChangePassword,
}: {
  permissions?: string[]
  onNavigate?: () => void
  onChangePassword?: () => void
}) => {
  const can = (permission: string) => permissions.includes('*:*') || permissions.includes(permission)

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-400 sm:w-[300px] md:w-[260px]">
      {/* Header */}
      <div className="border-b border-slate-800/80 px-6 py-5">
        <div className="flex items-center gap-3 text-slate-50">
          <img src="/logo.svg" alt="NexusID" className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-50">NexusID</div>
            <div className="text-[10px] text-slate-500">Identity Control</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto px-3 py-4">
        <nav className="space-y-5">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => can(item.permission))
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500/90">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'border-slate-700/80 bg-slate-800 text-slate-100'
                            : 'text-slate-400 hover:border-slate-700/70 hover:bg-slate-800/80 hover:text-slate-100'
                        }`
                      }
                    >
                      <item.icon size={15} strokeWidth={2} className="opacity-70 transition-transform group-hover:scale-110" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/80 px-3 py-4 space-y-0.5">
        {onChangePassword ? (
          <button
            type="button"
            onClick={() => {
              onChangePassword()
              onNavigate?.()
            }}
            className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-400 transition-colors hover:border-slate-700/70 hover:bg-slate-800/80 hover:text-slate-100"
          >
            <KeyRound size={15} strokeWidth={2} className="opacity-70 transition-transform group-hover:scale-110" />
            Change password
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-400 transition-colors hover:border-slate-700/70 hover:bg-slate-800/80 hover:text-slate-100"
        >
          <LogOut size={15} strokeWidth={2} className="opacity-70 transition-transform group-hover:scale-110" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
