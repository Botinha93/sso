import { useUsers, useRoles, useTenants, useClients } from '../hooks/useApi'
import { Users, Shield, Building2, AppWindow } from 'lucide-react'

const stats = [
  { label: 'Users', icon: Users, key: 'users' as const },
  { label: 'Roles', icon: Shield, key: 'roles' as const },
  { label: 'Tenants', icon: Building2, key: 'tenants' as const },
  { label: 'Clients', icon: AppWindow, key: 'clients' as const },
]

const Dashboard = () => {
  const { data: users = [] } = useUsers()
  const { data: roles = [] } = useRoles()
  const { data: tenants = [] } = useTenants()
  const { data: clients = [] } = useClients()

  const counts = { users: users.length, roles: roles.length, tenants: tenants.length, clients: clients.length }

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Operational Surface</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Identity Administration
        </h2>
        <p className="text-slate-500 text-base mt-2 max-w-2xl leading-relaxed">
          Users, roles, tenants, clients, and token flows — all in one place, backed by SQLite.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, icon: Icon, key }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
              <Icon size={14} />
              {label}
            </div>
            <strong className="block text-4xl font-bold tracking-tight text-slate-900">{counts[key]}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard