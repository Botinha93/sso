import { ExternalLink, LogOut, Settings, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PortalUser } from '../hooks'

interface Props {
  user: PortalUser
}

const portalHome = import.meta.env.BASE_URL

export default function Launcher({ user }: Props) {
  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm">
              👤
            </div>
            <span className="text-sm font-semibold text-slate-900">Account Portal</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/profile"
              className="h-8 px-2 sm:px-3 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="h-8 px-2 sm:px-3 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <User size={20} className="text-slate-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome back, {user.givenName}!
              </h1>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
        </div>

        {/* App Grid */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Your Apps</h2>
          {user.apps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-slate-400 text-sm">No apps have been assigned to your account yet.</p>
              <p className="text-slate-400 text-xs mt-1">Contact your administrator to get access.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              {user.apps.map(app => (
                <AppTile key={app.id} app={app} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function AppTile({ app }: { app: PortalUser['apps'][0] }) {
  const content = (
    <div className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all p-5 flex flex-col items-center gap-3 cursor-pointer relative">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-slate-200 transition-colors flex items-center justify-center text-3xl">
        {app.icon || '📦'}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{app.name}</p>
        {app.description && (
          <p className="text-xs text-slate-500 mt-0.5 leading-tight line-clamp-2">{app.description}</p>
        )}
      </div>
      {app.url && (
        <ExternalLink size={12} className="absolute top-3 right-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
      )}
    </div>
  )

  if (app.url) {
    return (
      <a href={app.url} target={app.url.startsWith('http') ? '_blank' : '_self'} rel="noreferrer">
        {content}
      </a>
    )
  }

  return content
}
