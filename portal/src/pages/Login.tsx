import { useEffect, useState } from 'react'
import { Alert, Button, Image, Paper, PasswordInput, Skeleton, Stack, TextInput, ThemeIcon } from '@mantine/core'
import { AuthCard, AuthLayout, ColorSchemeToggle, OtpStep } from '@nexus/design'
import { ArrowLeft, Lock, LogIn, Mail } from 'lucide-react'
import LanguageSelector from '../components/LanguageSelector'
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
    <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }} aria-hidden>
      <Stack gap="md">
        <Skeleton height={44} width={44} radius="md" mx="auto" />
        <Skeleton height={24} width="60%" mx="auto" />
        <Skeleton height={14} width="75%" mx="auto" />
        <Stack gap={6} mt="md">
          <Skeleton height={12} width="40%" />
          <Skeleton height={36} />
        </Stack>
        <Stack gap={6}>
          <Skeleton height={12} width="30%" />
          <Skeleton height={36} />
        </Stack>
        <Skeleton height={36} />
      </Stack>
    </Paper>
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
    const daysRemaining = warning && typeof warning === 'object'
      ? (warning as { daysRemaining?: unknown }).daysRemaining
      : undefined
    if (typeof daysRemaining === 'number' && Number.isFinite(daysRemaining)) {
      sessionStorage.setItem('passwordExpirationWarning', String(daysRemaining))
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

  const submit = async (mfaCodeOverride?: string) => {
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
          ? { mfaTicket, code: (mfaCodeOverride ?? mfaCode).trim() }
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
              : resolveLoginCredentialError(json, t('login.invalidCredentials'), t)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submit()
  }

  const submitLabel = pending
    ? t('login.signingIn')
    : changePasswordTicket
      ? t('login.updatePassword')
      : mfaTicket
        ? t('login.verifyCode')
        : t('login.signIn')

  const backButton = (
    <Button
      type="button"
      variant="subtle"
      color={ui?.accentColor ?? 'gray'}
      size="xs"
      leftSection={<ArrowLeft size={14} />}
      onClick={resetChallengeState}
    >
      {t('login.back')}
    </Button>
  )

  const brandMark = (
    <ThemeIcon
      size={56}
      radius="lg"
      variant="filled"
      color={ui?.primaryColor ?? undefined}
      style={{ overflow: 'hidden' }}
    >
      <Image src={ui?.logoUrl ?? `${portalHome}logo.svg`} alt="Logo" w={56} h={56} fit="cover" />
    </ThemeIcon>
  )

  return (
    <AuthLayout
      style={ui?.backgroundCss ? { background: ui.backgroundCss } : undefined}
      topRight={
        <>
          <LanguageSelector />
          <ColorSchemeToggle size="lg" variant="default" />
        </>
      }
    >
      {uiLoading ? (
        <LoginLoadingSkeleton />
      ) : mfaTicket && !changePasswordTicket ? (
        <AuthCard
          logo={brandMark}
          title={ui?.title ?? t('login.title')}
          subtitle={ui?.subtitle ?? t('login.subtitle')}
          footer={backButton}
        >
          <Stack gap="md">
            <OtpStep
              value={mfaCode}
              onChange={(value) => setMfaCode(value.replace(/\D+/g, '').slice(0, 8))}
              onSubmit={(code) => {
                if (pending) return
                void submit(code)
              }}
              loading={pending}
              error={error || undefined}
              labels={{ submit: submitLabel, input: t('login.authenticatorCode') }}
              hint={t('login.authenticatorCode')}
            />
            {infoMessage ? <Alert color="yellow">{infoMessage}</Alert> : null}
          </Stack>
        </AuthCard>
      ) : (
        <AuthCard
          logo={brandMark}
          title={ui?.title ?? t('login.title')}
          subtitle={ui?.subtitle ?? t('login.subtitle')}
          footer={changePasswordTicket ? backButton : undefined}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              {changePasswordTicket ? (
                <>
                  <PasswordInput
                    label={t('login.newPassword')}
                    value={newPassword}
                    onChange={e => setNewPassword(e.currentTarget.value)}
                    autoComplete="new-password"
                    leftSection={<Lock size={16} />}
                    autoFocus
                    required
                  />
                  <PasswordInput
                    label={t('login.confirmNewPassword')}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.currentTarget.value)}
                    autoComplete="new-password"
                    leftSection={<Lock size={16} />}
                    required
                  />
                </>
              ) : (
                <>
                  <TextInput
                    label={t('login.usernameOrEmail')}
                    value={username}
                    onChange={e => setUsername(e.currentTarget.value)}
                    leftSection={<Mail size={16} />}
                    autoFocus
                    autoComplete="username"
                    required
                  />
                  <PasswordInput
                    label={t('login.password')}
                    value={password}
                    onChange={e => setPassword(e.currentTarget.value)}
                    leftSection={<Lock size={16} />}
                    autoComplete="current-password"
                    visible={showPw}
                    onVisibilityChange={setShowPw}
                    visibilityToggleButtonProps={{
                      'aria-label': showPw ? t('login.hidePassword') : t('login.showPassword'),
                      'aria-pressed': showPw,
                    }}
                    required
                  />
                </>
              )}

              {infoMessage ? <Alert color="yellow">{infoMessage}</Alert> : null}
              {error ? <Alert color="red">{error}</Alert> : null}

              <Button
                type="submit"
                fullWidth
                mt="xs"
                disabled={pending}
                color={ui?.primaryColor ?? undefined}
                leftSection={<LogIn size={16} />}
              >
                {submitLabel}
              </Button>
            </Stack>
          </form>
        </AuthCard>
      )}
    </AuthLayout>
  )
}
