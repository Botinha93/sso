import { ExternalLink, Grid3X3, LogOut, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PortalUser } from '../hooks'
import LanguageSelector from '../components/LanguageSelector'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useI18n } from '../i18n'

interface Props {
  user: PortalUser
}

interface UiCustomization {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

const portalHome = import.meta.env.BASE_URL

export default function Launcher({ user }: Props) {
  const { t } = useI18n()
  const [ui, setUi] = useState<UiCustomization | null>(null)
  const canManageUsers =
    Array.isArray(user.permissions) &&
    (user.permissions.includes('*:*') || user.permissions.includes('users:view'))

  useEffect(() => {
    void (async () => {
      try {
        const defaultAppId = user.apps[0]?.id
        const query = new URLSearchParams({ surface: 'portal_launcher' })
        if (defaultAppId) query.set('appId', defaultAppId)
        const res = await fetch(`/api/ui/customization?${query.toString()}`, { credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        setUi(json?.customization ?? null)
      } catch {
        // Customization is optional.
      }
    })()
  }, [user.apps])

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen" style={{ background: ui?.backgroundCss ?? '#f8fafc' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm overflow-hidden" style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}>
            {ui?.logoUrl ? <img src={ui.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Grid3X3 size={16} />}
            </div>
            <span className="text-sm font-semibold text-slate-900">{ui?.title ?? 'Account Portal'}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-slate-600 hover:text-slate-900">
                <Settings size={14} />
                <span className="hidden sm:inline">{t('launcher.settings')}</span>
              </Button>
            </Link>
            <LanguageSelector className="hidden sm:inline-flex" />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="px-2 sm:px-3 text-slate-600 hover:text-slate-900"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{t('common.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-4 sm:hidden">
          <LanguageSelector />
        </div>
        {/* Welcome */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center overflow-hidden text-white font-bold shadow-sm">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : `${user.givenName?.[0] ?? ''}${user.email?.[0] ?? ''}`.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {t('launcher.welcomeBack', { name: user.givenName })}
              </h1>
              <p className="text-sm text-slate-500">{ui?.subtitle ?? user.email}</p>
            </div>
          </div>
        </div>

        {/* App Grid */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{t('launcher.yourApps')}</h2>
          {canManageUsers && (
            <div className="mb-4">
              <Link to="/users">
                <Card className="group cursor-pointer rounded-2xl p-4 transition-all hover:scale-[1.01] hover:border-slate-300 hover:shadow-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 text-white">
                    <Settings size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Manage Users</p>
                    <p className="text-xs text-slate-500">Create, edit, assign roles/groups, and disable users</p>
                  </div>
                </Card>
              </Link>
            </div>
          )}
          {user.apps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-slate-400 text-sm">{t('launcher.noAppsTitle')}</p>
              <p className="text-slate-400 text-xs mt-1">{t('launcher.noAppsHint')}</p>
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

function appColor(name: string): string {
  const colors = [
    'from-sky-400 to-blue-600',
    'from-violet-400 to-indigo-600',
    'from-emerald-400 to-teal-600',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-600',
    'from-cyan-400 to-sky-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

function AppTile({ app }: { app: PortalUser['apps'][0] }) {
  const content = (
    <Card className="group cursor-pointer rounded-2xl p-5 transition-all hover:scale-[1.02] hover:border-slate-300 hover:shadow-lg flex flex-col items-center gap-3 relative">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${appColor(app.name)} text-white text-2xl font-bold shadow-sm`}>
        {app.imageUrl ? <img src={app.imageUrl} alt={app.name} className="h-full w-full rounded-2xl object-cover" /> : app.name[0]?.toUpperCase()}
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
    </Card>
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
