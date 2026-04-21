import { useEffect, useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'

const fieldCls = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const portalHome = import.meta.env.BASE_URL

interface UiCustomization {
  title?: string
  subtitle?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  backgroundCss?: string
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [ui, setUi] = useState<UiCustomization | null>(null)

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
        setError(json?.message ?? 'Invalid credentials')
        return
      }
      // Reload to let App detect session
      window.location.href = portalHome
    } catch {
      setError('Network error — please try again')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: ui?.backgroundCss ?? 'linear-gradient(to bottom right, #f1f5f9, #e2e8f0)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 overflow-hidden" style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}>
            {ui?.logoUrl ? <img src={ui.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : '👤'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{ui?.title ?? 'Account Portal'}</h1>
          <p className="text-sm text-slate-500 mt-1">{ui?.subtitle ?? 'Sign in to access your account'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Username or Email
              </label>
              <input
                className={fieldCls}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className={`${fieldCls} pr-10`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full h-10 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
              style={{ backgroundColor: ui?.primaryColor ?? '#0f172a' }}
            >
              <LogIn size={15} />
              {pending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
