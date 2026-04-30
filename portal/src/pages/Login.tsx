import { useEffect, useState } from 'react'
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import LanguageSelector from '../components/LanguageSelector'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useI18n } from '../i18n'

const fieldCls = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 focus-visible:ring-sky-500/40'
const portalHome = import.meta.env.BASE_URL

interface UiCustomization {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

function LoginLoadingSkeleton() {
  return (
    <div className="w-full max-w-sm" aria-hidden>
      <div className="mb-4 flex justify-end">
        <div className="auth-skeleton h-8 w-28 rounded-lg" />
      </div>
      <div className="mb-8 text-center">
        <div className="auth-skeleton mx-auto mb-4 h-14 w-14 rounded-2xl" />
        <div className="auth-skeleton mx-auto h-6 w-40" />
        <div className="auth-skeleton mx-auto mt-2 h-4 w-52" />
      </div>
      <Card className="space-y-4 rounded-2xl p-6 shadow-lg">
        <div className="space-y-2">
          <div className="auth-skeleton h-3 w-28" />
          <div className="auth-skeleton h-10 w-full" />
        </div>
        <div className="space-y-2">
          <div className="auth-skeleton h-3 w-20" />
          <div className="auth-skeleton h-10 w-full" />
        </div>
        <div className="auth-skeleton h-10 w-full" />
        </Card>
    </div>
  )
}

export default function Login() {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [ui, setUi] = useState<UiCustomization | null>(null)
  const [uiLoading, setUiLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const appId = params.get('app_id')
        const query = new URLSearchParams({ surface: 'portal_login' })
        if (appId) query.set('appId', appId)
        const res = await fetch(`/api/ui/customization?${query.toString()}`, { credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        setUi(json?.customization ?? null)
      } catch {
        // Customization is optional.
      } finally {
        setUiLoading(false)
      }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.message ?? t('login.invalidCredentials'))
        return
      }
      // Reload to let App detect session
      window.location.href = portalHome
    } catch {
      setError(t('login.networkError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: ui?.backgroundCss ?? 'var(--semantic-bg-page)' }}>
      {uiLoading ? (
        <LoginLoadingSkeleton />
      ) : (
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LanguageSelector />
        </div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 overflow-hidden shadow-md" style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}>
            {ui?.logoUrl
              ? <img src={ui.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              : <ShieldCheck size={26} />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{ui?.title ?? t('login.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{ui?.subtitle ?? t('login.subtitle')}</p>
        </div>

        <Card className="rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('login.usernameOrEmail')}
              </label>
              <Input
                className={`${fieldCls} h-10 rounded-xl px-3.5`}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('login.password')}
              </label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  className={`${fieldCls} h-10 rounded-xl px-3.5 pr-10`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Button
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1.5 h-7 w-7 rounded-md text-slate-400 hover:text-slate-700"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="h-10 w-full rounded-xl"
              style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}
            >
              <LogIn size={15} />
              {pending ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>
        </Card>
      </div>
      )}
    </div>
  )
}
