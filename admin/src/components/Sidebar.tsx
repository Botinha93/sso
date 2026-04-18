import { NavLink } from 'react-router-dom'
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
  Network,
  Route,
  Fingerprint,
  Gavel,
  BellRing,
  LogOut
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'users:view' },
  { path: '/clients', label: 'Clients', icon: AppWindow, permission: 'clients:view' },
  { path: '/users', label: 'Users', icon: Users, permission: 'users:view' },
  { path: '/groups', label: 'Groups', icon: UsersRound, permission: 'groups:view' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'roles:view' },
  { path: '/sessions', label: 'Sessions', icon: MonitorSmartphone, permission: 'sessions:view' },
  { path: '/audit', label: 'Audit Log', icon: FileText, permission: 'audit_log:view' },
  { path: '/consents', label: 'Consents', icon: CheckSquare, permission: 'consents:view' },
  { path: '/tenants', label: 'Tenants', icon: Building2, permission: 'tenants:view' },
  { path: '/federation', label: 'Federation', icon: Network, permission: 'federation_providers:view' },
  { path: '/authentication', label: 'Auth Flows', icon: Route, permission: 'authentication_flows:view' },
  { path: '/user-attributes', label: 'User Attributes', icon: Fingerprint, permission: 'user_attributes:view' },
  { path: '/policies', label: 'Policies', icon: Gavel, permission: 'policies:view' },
  { path: '/events', label: 'Events', icon: BellRing, permission: 'events:view' },
]

const Sidebar = ({ permissions = [] }: { permissions?: string[] }) => {
  const can = (permission: string) => permissions.includes('*:*') || permissions.includes(permission)

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-400">
      {/* Header */}
      <div className="border-b border-slate-800/80 px-6 py-5">
        <div className="flex items-center gap-3 text-slate-50">
          <img src="/logo.svg" alt="Northstar SSO" className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-sky-400/30" />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-50">Northstar SSO</div>
            <div className="text-[10px] text-slate-500">Identity Control</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto px-3 py-4">
        <nav className="space-y-0.5">
          {navItems.filter(item => can(item.permission)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? 'bg-slate-50 text-slate-950 shadow-sm ring-1 ring-white/70'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-50'
                }`
              }
            >
              <item.icon size={15} strokeWidth={2} className="opacity-70 transition-transform group-hover:scale-110" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/80 px-3 py-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-slate-800/80 hover:text-slate-50"
        >
          <LogOut size={15} strokeWidth={2} className="opacity-70 transition-transform group-hover:scale-110" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar