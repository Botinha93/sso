import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Apps, 
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
    { path: '/clients', label: 'Clients', icon: Apps },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/roles', label: 'Roles', icon: Shield },
    { path: '/sessions', label: 'Sessions', icon: MonitorSmartphone },
    { path: '/audit', label: 'Audit Log', icon: FileText },
    { path: '/consents', label: 'Consents', icon: CheckSquare },
    { path: '/tenants', label: 'Tenants', icon: Building2 },
  ]

  return (
    <aside className="w-72 border-r border-border bg-card/80 backdrop-blur-xl sticky top-0 h-screen p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
          <span className="font-extrabold text-[hsl(40,100%,98%)] tracking-wider">NS</span>
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Identity Control</p>
          <h1 className="font-bold text-xl">Northstar SSO</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
              ${isActive 
                ? 'bg-primary/14 font-semibold text-foreground' 
                : 'text-foreground/80 hover:bg-primary/8 hover:text-foreground'}
            `}
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="text-muted-foreground text-sm leading-relaxed mt-8">
        Local-first identity workspace with SQLite durability and OAuth2/OIDC controls.
      </p>
    </aside>
  )
}

export default Sidebar