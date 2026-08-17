import { ExternalLink, Grid3X3, LogOut, Settings, Users as UsersIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { logout, type PortalUser } from '../hooks'
import LanguageSelector from '../components/LanguageSelector'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useI18n, formatPasswordExpirationWarning } from '../i18n'

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
  const [passwordExpirationDays, setPasswordExpirationDays] = useState<number | null>(null)
  const [warningDismissed, setWarningDismissed] = useState(() => sessionStorage.getItem('passwordExpirationWarningDismissed') === '1')
  const canManageUsers =
    Array.isArray(user.permissions) &&
    (user.permissions.includes('*:*') || user.permissions.includes('users:view'))

  const inheritedGroupsByAppId = useMemo(() => {
    const map = new Map<string, string[]>()
    const directAppIds = new Set(user.directAppIds ?? [])
    for (const source of user.inheritedAppSources ?? []) {
      if (directAppIds.has(source.appId)) continue
      const existing = map.get(source.appId) ?? []
      if (!existing.includes(source.groupName)) {
        existing.push(source.groupName)
        map.set(source.appId, existing)
      }
    }
    return map
  }, [user.directAppIds, user.inheritedAppSources])

  useEffect(() => {
    const fromMe = user.passwordExpirationWarning?.daysRemaining
    const stored = sessionStorage.getItem('passwordExpirationWarning')
    const fromLogin = stored && /^\d+$/.test(stored) ? Number(stored) : undefined
    const days = typeof fromMe === 'number' ? fromMe : fromLogin
    setPasswordExpirationDays(typeof days === 'number' && Number.isFinite(days) ? days : null)
  }, [user.passwordExpirationWarning])

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

  const passwordExpirationWarning = passwordExpirationDays == null
    ? null
    : formatPasswordExpirationWarning(t, passwordExpirationDays)

  const handleLogout = async () => {
    await logout()
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen" style={{ background: ui?.backgroundCss ?? '#f8fafc' }}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm overflow-hidden" style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}>
            {ui?.logoUrl ? <img src={ui.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Grid3X3 size={16} />}
            </div>
            <span className="text-sm font-semibold text-foreground">{ui?.title ?? 'Account Portal'}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                <Settings size={14} />
                <span className="hidden sm:inline">{t('launcher.settings')}</span>
              </Button>
            </Link>
            <LanguageSelector className="hidden sm:inline-flex" />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="px-2 sm:px-3"
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
        {passwordExpirationWarning && !warningDismissed ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <span>{passwordExpirationWarning}</span>
            <div className="flex shrink-0 items-center gap-3">
              <Link to="/profile?section=password" className="font-medium text-amber-900 underline">
                {t('launcher.changePassword')}
              </Link>
              <button
                type="button"
                className="text-amber-800 underline"
                onClick={() => {
                  sessionStorage.removeItem('passwordExpirationWarning')
                  sessionStorage.setItem('passwordExpirationWarningDismissed', '1')
                  setWarningDismissed(true)
                  setPasswordExpirationDays(null)
                }}
              >
                {t('launcher.dismissWarning')}
              </button>
            </div>
          </div>
        ) : null}
        {/* Welcome */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center overflow-hidden text-white font-bold shadow-sm">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : `${user.givenName?.[0] ?? ''}${user.email?.[0] ?? ''}`.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {t('launcher.welcomeBack', { name: user.givenName })}
              </h1>
              <p className="text-sm text-muted-foreground">{ui?.subtitle ?? user.email}</p>
            </div>
          </div>
        </div>

        {/* App Grid */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t('launcher.yourApps')}</h2>
          {canManageUsers && (
            <div className="mb-4">
              <Link to="/users">
                <Card className="group cursor-pointer rounded-2xl p-4 transition-all hover:scale-[1.01] hover:border-ring hover:shadow-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
                    <Settings size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('launcher.manageUsers')}</p>
                    <p className="text-xs text-muted-foreground">{t('launcher.manageUsersHint')}</p>
                  </div>
                </Card>
              </Link>
            </div>
          )}
          {user.apps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground text-sm">{t('launcher.noAppsTitle')}</p>
              <p className="text-muted-foreground text-xs mt-1">{t('launcher.noAppsHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
              {user.apps.map(app => (
                <AppTile
                  key={app.id}
                  app={app}
                  inheritedFromGroups={inheritedGroupsByAppId.get(app.id) ?? []}
                  viaGroupLabel={(group) => t('launcher.viaGroup', { group })}
                />
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

interface AppTileProps {
  app: PortalUser['apps'][0]
  inheritedFromGroups: string[]
  viaGroupLabel: (group: string) => string
}

function AppTile({ app, inheritedFromGroups, viaGroupLabel }: AppTileProps) {
  const isInherited = inheritedFromGroups.length > 0
  const groupTooltip = isInherited
    ? inheritedFromGroups.map((group) => viaGroupLabel(group)).join(' · ')
    : undefined

  const content = (
    <Card className="group cursor-pointer rounded-2xl p-5 transition-all hover:scale-[1.02] hover:border-ring hover:shadow-lg flex flex-col items-center gap-3 relative">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${appColor(app.name)} text-white text-2xl font-bold shadow-sm`}>
        {app.imageUrl ? <img src={app.imageUrl} alt={app.name} className="h-full w-full rounded-2xl object-cover" /> : app.name[0]?.toUpperCase()}
      </div>
      <div className="text-center w-full">
        <p className="text-sm font-semibold text-foreground leading-tight">{app.name}</p>
        {app.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2">{app.description}</p>
        )}
        {isInherited && (
          <p
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 bg-sky-50 rounded-full px-2 py-0.5 max-w-full"
            title={groupTooltip}
          >
            <UsersIcon size={10} className="shrink-0" />
            <span className="truncate">{viaGroupLabel(inheritedFromGroups[0])}{inheritedFromGroups.length > 1 ? ` +${inheritedFromGroups.length - 1}` : ''}</span>
          </p>
        )}
      </div>
      {app.url && (
        <ExternalLink size={12} className="absolute top-3 right-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
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
