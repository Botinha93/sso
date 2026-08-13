import { useEffect, useState } from 'react'
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import LanguageSelector from '../components/LanguageSelector'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useI18n } from '../i18n'
import { extractErrorMessage, resolveLoginCredentialError } from '../lib/errors'

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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaTicket, setMfaTicket] = useState<string | null>(null)
  const [changePasswordTicket, setChangePasswordTicket] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
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

  const storePasswordExpirationWarning = (json: Record<string, unknown>) => {
    const warning = json.passwordExpirationWarning
    if (warning && typeof warning === 'object' && warning !== null && typeof (warning as { message?: unknown }).message === 'string') {
      sessionStorage.setItem('passwordExpirationWarning', (warning as { message: string }).message)
    }
  }

  const resetChallengeState = () => {
    setMfaTicket(null)
    setChangePasswordTicket(null)
    setMfaCode('')
    setNewPassword('')
    setConfirmPassword('')
    setInfoMessage('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setPending(true)
    try {
      const endpoint = changePasswordTicket
        ? '/auth/login/change-password'
        : mfaTicket
          ? '/auth/login/mfa'
          : '/auth/login'
      const payload = changePasswordTicket
        ? { changePasswordTicket, newPassword, confirmPassword }
        : mfaTicket
          ? { mfaTicket, code: mfaCode.trim() }
          : { email: username, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.status === 202) {
        const json = await res.json().catch(() => ({} as Record<string, unknown>))
        if (typeof json.changePasswordTicket === 'string') {
          setChangePasswordTicket(json.changePasswordTicket)
          setMfaTicket(null)
          setNewPassword('')
          setConfirmPassword('')
          setInfoMessage(typeof json.message === 'string' ? json.message : t('login.passwordExpired'))
        } else if (typeof json.mfaTicket === 'string') {
          setMfaTicket(json.mfaTicket)
          setChangePasswordTicket(null)
          setMfaCode('')
          setInfoMessage('')
        } else {
          setError(extractErrorMessage(json, t('login.additionalVerificationRequired')))
        }
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(
          changePasswordTicket
            ? extractErrorMessage(json, t('login.passwordUpdateFailed'))
            : mfaTicket
              ? extractErrorMessage(json, t('login.invalidMfaCode'))
              : resolveLoginCredentialError(json, t('login.invalidCredentials'))
        )
        return
      }

      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      storePasswordExpirationWarning(json)
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
          <h1 className="text-2xl font-bold text-foreground">{ui?.title ?? t('login.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ui?.subtitle ?? t('login.subtitle')}</p>
        </div>

        <Card className="rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {changePasswordTicket ? (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t('login.newPassword')}
                  </label>
                  <Input
                    type="password"
                    className="h-10 rounded-xl px-3.5"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t('login.confirmNewPassword')}
                  </label>
                  <Input
                    type="password"
                    className="h-10 rounded-xl px-3.5"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : mfaTicket ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t('login.authenticatorCode')}
                </label>
                <Input
                  className="h-10 rounded-xl px-3.5 tracking-[0.2em]"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  autoFocus
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t('login.usernameOrEmail')}
                  </label>
                  <Input
                    className="h-10 rounded-xl px-3.5"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t('login.password')}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      className="h-10 rounded-xl px-3.5 pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      onClick={() => setShowPw(p => !p)}
                      aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                      aria-pressed={showPw}
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1.5 h-7 w-7 rounded-md"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {infoMessage ? <Alert tone="warning">{infoMessage}</Alert> : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}

            <Button
              type="submit"
              variant="primary"
              disabled={pending}
              className="h-10 w-full rounded-xl"
              style={{ backgroundColor: ui?.primaryColor ?? undefined }}
            >
              <LogIn size={15} />
              {pending
                ? t('login.signingIn')
                : changePasswordTicket
                  ? t('login.updatePassword')
                  : mfaTicket
                    ? t('login.verifyCode')
                    : t('login.signIn')}
            </Button>

            {(mfaTicket || changePasswordTicket) ? (
              <Button type="button" variant="secondary" className="h-10 w-full rounded-xl" onClick={resetChallengeState}>
                {t('login.back')}
              </Button>
            ) : null}
          </form>
        </Card>
      </div>
      )}
    </div>
  )
}
