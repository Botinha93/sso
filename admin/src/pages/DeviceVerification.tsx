import { useMemo, useState, type ReactNode } from 'react'
import { Alert, Button, Group, Image, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { AuthCard, AuthLayout, ColorSchemeToggle } from '@nexus/design'
import { AlertCircle, CheckCircle2, Lock, MonitorSmartphone, ShieldCheck, User, XCircle } from 'lucide-react'
import LanguageSelector from '../components/LanguageSelector'
import { useI18n } from '../i18n'
import { resolveDeviceVerificationError } from '../lib/errors'

type SubmissionState = 'idle' | 'approved' | 'denied'

function AuthBrand() {
  return (
    <Group gap={10}>
      <Image src="/logo.svg" alt="NexusID" w={32} h={32} radius="md" fit="contain" />
      <Text fw={600} fz="lg">
        NexusID
      </Text>
    </Group>
  )
}

function DeviceAuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      brand={<AuthBrand />}
      topRight={
        <>
          <LanguageSelector />
          <ColorSchemeToggle size="md" variant="default" />
        </>
      }
    >
      {children}
    </AuthLayout>
  )
}

export default function DeviceVerification() {
  const { t } = useI18n()
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [userCode, setUserCode] = useState(() => searchParams.get('user_code') ?? '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SubmissionState>('idle')

  const submit = async (approve: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/oauth/device/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_code: userCode.trim(),
          username: username.trim(),
          password,
          approve,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setError(resolveDeviceVerificationError(payload, t))
        return
      }

      const payload = await res.json().catch(() => ({ status: approve ? 'approved' : 'denied' }))
      setResult(payload.status === 'denied' ? 'denied' : 'approved')
    } catch {
      setError(t('device.errors.networkError'))
    } finally {
      setLoading(false)
    }
  }

  if (result !== 'idle') {
    const approved = result === 'approved'
    return (
      <DeviceAuthLayout>
        <AuthCard
          icon={approved ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
          iconColor={approved ? 'green' : 'red'}
          title={approved ? t('device.result.approvedTitle') : t('device.result.deniedTitle')}
          subtitle={approved ? t('device.result.approvedMessage') : t('device.result.deniedMessage')}
        />
      </DeviceAuthLayout>
    )
  }

  const submitDisabled = loading || !userCode.trim() || !username.trim() || !password

  return (
    <DeviceAuthLayout>
      <AuthCard
        icon={<MonitorSmartphone size={22} />}
        title={t('device.title')}
        subtitle={t('device.subtitle')}
      >
        <Stack gap="md">
          <Alert color="green" icon={<ShieldCheck size={16} />}>
            {t('device.securityBanner')}
          </Alert>

          {error && (
            <Alert color="red" icon={<AlertCircle size={16} />} role="alert">
              {error}
            </Alert>
          )}

          <TextInput
            label={t('device.userCode')}
            type="text"
            value={userCode}
            onChange={(event) => setUserCode(event.target.value.toUpperCase())}
            ff="monospace"
            styles={{ input: { letterSpacing: '0.2em', textTransform: 'uppercase' } }}
            placeholder={t('device.userCodePlaceholder')}
            autoFocus={!userCode}
          />

          <TextInput
            label={t('login.usernameOrEmail')}
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t('login.emailPlaceholder')}
            autoComplete="username"
            leftSection={<User size={16} />}
          />

          <PasswordInput
            label={t('login.password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            leftSection={<Lock size={16} />}
          />

          <Group grow gap="sm" mt="xs">
            <Button onClick={() => submit(true)} disabled={submitDisabled}>
              {loading ? t('device.submitting') : t('device.approve')}
            </Button>
            <Button variant="default" onClick={() => submit(false)} disabled={submitDisabled}>
              {t('consent.deny')}
            </Button>
          </Group>
        </Stack>
      </AuthCard>
    </DeviceAuthLayout>
  )
}
