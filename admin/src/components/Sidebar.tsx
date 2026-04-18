import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  AppWindow, 
  Users, 
  Shield, 
  MonitorSmartphone, 
  FileText, 
  CheckSquare, 
  Building2 
} from 'lucide-react'

const Sidebar = () => {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clients', label: 'Clients', icon: AppWindow },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/roles', label: 'Roles', icon: Shield },
    { path: '/sessions', label: 'Sessions', icon: MonitorSmartphone },
    { path: '/audit', label: 'Audit Log', icon: FileText },
    { path: '/consents', label: 'Consents', icon: CheckSquare },
    { path: '/tenants', label: 'Tenants', icon: Building2 },
  ]

  return (
    <aside className="w-64 border-r border-sidebar bg-sidebar h-screen p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <span className="font-extrabold text-sidebar-primary-foreground text-sm tracking-wider">NS</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Identity Control</p>
          <h1 className="font-semibold text-base">Northstar SSO</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm group
              ${isActive 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
            `}
          >
            <item.icon size={16} strokeWidth={2} className="opacity-80" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="text-sidebar-foreground/60 text-xs leading-relaxed mt-auto p-2">
        Local-first identity workspace with SQLite durability and OAuth2/OIDC controls.
      </p>
    </aside>
  )
}

export default Sidebar