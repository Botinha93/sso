import {
  ActionIcon,
  Alert,
  Avatar,
  Box,
  Button,
  FileInput,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CardSkeleton, PageHeader, SectionCard, SettingRow, SettingsList } from '@nexus/design'
import { AlertTriangle, Check, Fingerprint, ImageUp, KeyRound, Save, ShieldCheck, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { PortalUser } from '../hooks'
import PortalShell from '../components/PortalShell'
import { useI18n } from '../i18n'
import {
  usePortalChangePassword,
  usePortalDefaultAvatars,
  usePortalDeleteAccount,
  usePortalUploadAvatar,
  usePortalUpdateProfile,
  useTotpDisable,
  useTotpEnroll,
  useTotpStatus,
  useTotpVerify,
  useWebauthnCredentials,
  useWebauthnDeleteCredential,
  useWebauthnRegisterBegin,
  useWebauthnRegisterFinish,
  type TotpEnrollmentResponse,
} from '../hooks'

const portalHome = import.meta.env.BASE_URL

interface Props {
  user: PortalUser
}

type Section = 'profile' | 'password' | 'totp' | 'danger'

const PROFILE_SECTIONS: Section[] = ['profile', 'password', 'totp', 'danger']

function resolveProfileSection(value: string | null): Section {
  return PROFILE_SECTIONS.includes(value as Section) ? (value as Section) : 'profile'
}

export default function Profile({ user }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>(() => resolveProfileSection(searchParams.get('section')))

  useEffect(() => {
    setSection(resolveProfileSection(searchParams.get('section')))
  }, [searchParams])

  return (
    <PortalShell user={user}>
      <PageHeader
        mb={0}
        title={t('profile.accountSettings')}
        description={user.email}
        tabs={
          <Tabs value={section} onChange={(value) => value && setSection(value as Section)}>
            <Tabs.List>
              <Tabs.Tab value="profile" leftSection={<User size={16} />}>{t('profile.nav.profile')}</Tabs.Tab>
              <Tabs.Tab value="password" leftSection={<KeyRound size={16} />}>{t('profile.nav.password')}</Tabs.Tab>
              <Tabs.Tab value="totp" leftSection={<ShieldCheck size={16} />}>{t('profile.nav.twoFactor')}</Tabs.Tab>
              <Tabs.Tab value="danger" color="red" leftSection={<AlertTriangle size={16} />}>{t('profile.nav.account')}</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        }
      />

      <Box role="tabpanel">
        {section === 'profile' && <ProfileSection user={user} />}
        {section === 'password' && <PasswordSection />}
        {section === 'totp' && <TotpSection />}
        {section === 'danger' && <DangerSection user={user} onDeleted={() => navigate('/')} />}
      </Box>
    </PortalShell>
  )
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: PortalUser }) {
  const { t } = useI18n()
  const update = usePortalUpdateProfile()
  const uploadAvatar = usePortalUploadAvatar()
  const [form, setForm] = useState({
    givenName: user.givenName,
    familyName: user.familyName,
    avatarUrl: user.avatarUrl ?? '',
    email: user.email,
    username: user.username,
  })
  const [customFields, setCustomFields] = useState(
    () => (user.customAttributeFields ?? []).map((field) => ({ ...field }))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Sync if user data changes
  useEffect(() => {
    setForm({ givenName: user.givenName, familyName: user.familyName, avatarUrl: user.avatarUrl ?? '', email: user.email, username: user.username })
    setCustomFields((user.customAttributeFields ?? []).map((field) => ({ ...field })))
  }, [user])

  const initials = `${form.givenName?.[0] ?? ''}${form.familyName?.[0] ?? ''}`.toUpperCase() || (form.username?.slice(0, 2).toUpperCase() ?? 'AB')
  const { data: defaultAvatars } = usePortalDefaultAvatars(initials)

  const handleSave = async () => {
    setError('')
    setSaved(false)
    try {
      const editableFields = customFields.filter((field) => field.userEditable)
      await update.mutateAsync({
        ...form,
        avatarUrl: form.avatarUrl.trim() ? form.avatarUrl.trim() : null,
        ...(editableFields.length > 0
          ? {
              customAttributes: Object.fromEntries(
                editableFields.map((field) => [field.key, field.value])
              )
            }
          : {})
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message ?? t('profile.profileSection.errors.saveFailed'))
    }
  }

  const setFieldValue = (key: string, value: string) => {
    setCustomFields((prev) => prev.map((field) => (field.key === key ? { ...field, value } : field)))
  }

  return (
    <SectionCard
      title={t('profile.profileSection.title')}
      footer={
        <>
          {saved && (
            <Group gap={4} c="green">
              <Check size={14} />
              <Text size="sm" c="green">{t('profile.profileSection.saved')}</Text>
            </Group>
          )}
          <Button onClick={handleSave} loading={update.isPending} leftSection={<Save size={16} />}>
            {t('profile.profileSection.saveChanges')}
          </Button>
        </>
      }
    >
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="md">
          <TextInput
            label={t('profile.profileSection.firstName')}
            value={form.givenName}
            onChange={e => setForm(p => ({ ...p, givenName: e.currentTarget.value }))}
          />
          <TextInput
            label={t('profile.profileSection.lastName')}
            value={form.familyName}
            onChange={e => setForm(p => ({ ...p, familyName: e.currentTarget.value }))}
          />
        </SimpleGrid>

        <Stack gap="xs">
          <Text size="sm" fw={500}>{t('profile.profileSection.profilePicture')}</Text>
          <Group gap="md" wrap="nowrap" align="center">
            <Avatar src={form.avatarUrl || null} alt="avatar" size={56} radius="xl" color="blue">
              {initials}
            </Avatar>
            <FileInput
              value={null}
              accept="image/*"
              placeholder={t('profile.profileSection.profilePicture')}
              aria-label={t('profile.profileSection.profilePicture')}
              leftSection={<ImageUp size={16} />}
              style={{ flex: 1 }}
              maw={360}
              onChange={async (file) => {
                if (!file) return
                try {
                  const result = await uploadAvatar.mutateAsync(file) as { avatarUrl?: string }
                  if (result?.avatarUrl) {
                    setForm((prev) => ({ ...prev, avatarUrl: result.avatarUrl ?? '' }))
                  }
                } catch (e: any) {
                  setError(e.message ?? t('profile.profileSection.errors.avatarUploadFailed'))
                }
              }}
            />
          </Group>
          <Group gap="xs">
            {((defaultAvatars as any)?.items ?? []).map((item: any) => (
              <Tooltip key={item.key} label={item.label}>
                <ActionIcon
                  onClick={() => setForm((prev) => ({ ...prev, avatarUrl: item.url }))}
                  variant="default"
                  size={40}
                  radius="xl"
                  aria-label={item.label}
                  style={{ overflow: 'hidden', padding: 0 }}
                >
                  <Avatar src={item.url} alt={item.label} size={40} radius="xl" />
                </ActionIcon>
              </Tooltip>
            ))}
            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={() => setForm((prev) => ({ ...prev, avatarUrl: '' }))}
            >
              Clear image
            </Button>
          </Group>
        </Stack>

        <TextInput
          type="email"
          label={t('profile.profileSection.emailAddress')}
          value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.currentTarget.value }))}
        />

        <TextInput
          label={t('profile.profileSection.username')}
          value={form.username}
          onChange={e => setForm(p => ({ ...p, username: e.currentTarget.value }))}
        />

        {/* Custom Attributes */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>{t('profile.profileSection.customAttributes')}</Text>
          {customFields.length === 0 ? (
            <Text size="xs" c="dimmed" fs="italic">{t('profile.profileSection.noCustomAttributes')}</Text>
          ) : (
            <Stack gap="sm">
              {customFields.map((field) => (
                field.userEditable ? (
                  <TextInput
                    key={field.key}
                    id={`custom-attr-${field.key}`}
                    label={field.name}
                    value={field.value}
                    onChange={(e) => setFieldValue(field.key, e.currentTarget.value)}
                    placeholder={t('profile.profileSection.valuePlaceholder')}
                    title={field.description || field.name}
                  />
                ) : (
                  <Stack key={field.key} gap={2}>
                    <Text size="sm" fw={500}>{field.name}</Text>
                    <Text size="sm" title={field.description || field.name}>
                      {field.value || <Text span c="dimmed" fs="italic">—</Text>}
                    </Text>
                  </Stack>
                )
              ))}
            </Stack>
          )}
        </Stack>

        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </SectionCard>
  )
}

// ─── Two-Factor Section ─────────────────────────────────────────────────────

function TotpSection() {
  const { t } = useI18n()
  const { data: status, isLoading: statusLoading } = useTotpStatus()
  const { data: passkeys } = useWebauthnCredentials()
  const enroll = useTotpEnroll()
  const verify = useTotpVerify()
  const disable = useTotpDisable()
  const passkeyBegin = useWebauthnRegisterBegin()
  const passkeyFinish = useWebauthnRegisterFinish()
  const passkeyDelete = useWebauthnDeleteCredential()

  const [enrollment, setEnrollment] = useState<TotpEnrollmentResponse | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mfaEnabled = Boolean(status?.enabled)

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setSuccess(t('profile.totp.messages.copied'))
      setTimeout(() => setSuccess(''), 1800)
    } catch {
      setError(t('profile.totp.errors.copyFailed'))
    }
  }

  const generateBase64Url = (bytes = 32) => {
    const values = new Uint8Array(bytes)
    crypto.getRandomValues(values)
    let binary = ''
    for (let index = 0; index < values.length; index += 1) {
      binary += String.fromCharCode(values[index])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const handleAddPasskey = async () => {
    setError('')
    setSuccess('')
    try {
      const begin = await passkeyBegin.mutateAsync(undefined)
      await passkeyFinish.mutateAsync({
        registrationId: begin.registrationId,
        credentialId: generateBase64Url(32),
        publicKey: generateBase64Url(64),
        transports: ['internal'],
        signCount: 0
      })
      setSuccess(t('profile.totp.messages.passkeyRegistered'))
    } catch (e: any) {
      setError(e.message ?? t('profile.totp.errors.passkeyRegisterFailed'))
    }
  }

  const handleDeletePasskey = async (credentialId: string) => {
    setError('')
    setSuccess('')
    try {
      await passkeyDelete.mutateAsync(credentialId)
      setSuccess(t('profile.totp.messages.passkeyRemoved'))
    } catch (e: any) {
      setError(e.message ?? t('profile.totp.errors.passkeyRemoveFailed'))
    }
  }

  const handleStartEnrollment = async () => {
    setError('')
    setSuccess('')
    try {
      const payload = await enroll.mutateAsync()
      setEnrollment(payload)
      setVerificationCode('')
    } catch (e: any) {
      setError(e.message ?? t('profile.totp.errors.startEnrollmentFailed'))
    }
  }

  const handleVerify = async () => {
    if (!enrollment) return
    setError('')
    setSuccess('')
    try {
      await verify.mutateAsync({
        enrollmentId: enrollment.enrollmentId,
        code: verificationCode.trim()
      })
      setEnrollment(null)
      setVerificationCode('')
      setSuccess(t('profile.totp.messages.enabled'))
    } catch (e: any) {
      setError(e.message ?? t('profile.totp.errors.invalidCode'))
    }
  }

  const handleDisable = async () => {
    setError('')
    setSuccess('')
    try {
      await disable.mutateAsync()
      setEnrollment(null)
      setVerificationCode('')
      setSuccess(t('profile.totp.messages.disabled'))
    } catch (e: any) {
      setError(e.message ?? t('profile.totp.errors.disableFailed'))
    }
  }

  if (statusLoading) {
    return <CardSkeleton label={t('profile.totp.loading')} />
  }

  const passkeyPending = passkeyBegin.isPending || passkeyFinish.isPending

  return (
    <Stack gap="lg">
      <SectionCard
        title={t('profile.totp.title')}
        description={t('profile.totp.subtitle')}
        icon={<ShieldCheck size={16} />}
      >
        <Stack gap="md">
          <Alert color={mfaEnabled ? 'green' : 'yellow'}>
            {mfaEnabled ? t('profile.totp.status.enabled') : t('profile.totp.status.disabled')}
          </Alert>

          {error && <Alert color="red">{error}</Alert>}
          {success && <Alert color="green">{success}</Alert>}

          {mfaEnabled ? (
            <SettingRow label={t('profile.totp.title')} description={t('profile.totp.disableHint')}>
              <Button onClick={handleDisable} loading={disable.isPending} color="red" variant="light">
                {t('profile.totp.disable')}
              </Button>
            </SettingRow>
          ) : !enrollment ? (
            <Group>
              <Button onClick={handleStartEnrollment} loading={enroll.isPending}>
                {t('profile.totp.startSetup')}
              </Button>
            </Group>
          ) : (
            <Paper withBorder radius="md" p="md" bg="var(--nx-color-surface-sunken)">
              <Stack gap="md">
                <Box>
                  <Text size="sm" fw={500}>{t('profile.totp.step1Title')}</Text>
                  <Text size="xs" c="dimmed" mt={2}>{t('profile.totp.step1Subtitle')}</Text>
                </Box>

                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <TextInput
                    label={t('profile.totp.secret')}
                    readOnly
                    value={enrollment.secret}
                    ff="monospace"
                    style={{ flex: 1 }}
                  />
                  <Button onClick={() => copy(enrollment.secret)} variant="default">
                    {t('profile.totp.copy')}
                  </Button>
                </Group>

                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <TextInput
                    label={t('profile.totp.otpAuthUri')}
                    readOnly
                    value={enrollment.otpauthUri}
                    ff="monospace"
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <Button onClick={() => copy(enrollment.otpauthUri)} variant="default">
                    {t('profile.totp.copy')}
                  </Button>
                </Group>

                <Box>
                  <Text size="sm" fw={500}>{t('profile.totp.step2Title')}</Text>
                  <Text size="xs" c="dimmed" mt={2}>{t('profile.totp.step2Subtitle')}</Text>
                </Box>

                <Group gap="xs" wrap="wrap">
                  <TextInput
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.currentTarget.value.replace(/\D+/g, '').slice(0, 8))}
                    placeholder={t('profile.totp.codePlaceholder')}
                    aria-label={t('profile.totp.codePlaceholder')}
                    ff="monospace"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    w={{ base: '100%', sm: 220 }}
                    styles={{ input: { letterSpacing: '0.18em' } }}
                  />
                  <Button
                    onClick={handleVerify}
                    loading={verify.isPending}
                    disabled={verificationCode.trim().length < 6}
                  >
                    {t('profile.totp.enable')}
                  </Button>
                  <Button
                    onClick={() => {
                      setEnrollment(null)
                      setVerificationCode('')
                      setError('')
                    }}
                    variant="default"
                  >
                    {t('profile.common.cancel')}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title={t('profile.passkeys.title')}
        description={t('profile.passkeys.subtitle')}
        icon={<Fingerprint size={16} />}
        actions={
          <Button onClick={handleAddPasskey} loading={passkeyPending} size="xs">
            {t('profile.passkeys.register')}
          </Button>
        }
      >
        {passkeys && passkeys.length > 0 ? (
          <SettingsList>
            {passkeys.map((credential) => (
              <SettingRow
                key={credential.credentialId}
                label={<Text span size="xs" ff="monospace" truncate="end" display="block">{credential.credentialId}</Text>}
                description={`${t('profile.passkeys.signCount', { count: String(credential.signCount) })} ${credential.transports.length > 0 ? `• ${credential.transports.join(', ')}` : ''}`}
              >
                <Button
                  onClick={() => handleDeletePasskey(credential.credentialId)}
                  disabled={passkeyDelete.isPending}
                  color="red"
                  variant="light"
                  size="xs"
                >
                  {t('profile.common.remove')}
                </Button>
              </SettingRow>
            ))}
          </SettingsList>
        ) : (
          <Text size="sm" c="dimmed">{t('profile.passkeys.none')}</Text>
        )}
      </SectionCard>
    </Stack>
  )
}

// ─── Password Section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const { t } = useI18n()
  const change = usePortalChangePassword()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.newPassword !== form.confirmPassword) {
      setError(t('profile.password.errors.mismatch'))
      return
    }
    try {
      await change.mutateAsync({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message ?? t('profile.password.errors.changeFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title={t('profile.password.title')}
        icon={<KeyRound size={16} />}
        footer={
          <Button type="submit" loading={change.isPending} leftSection={<KeyRound size={16} />}>
            {t('profile.password.updateButton')}
          </Button>
        }
      >
        <Stack gap="md" maw={480}>
          <PasswordInput
            label={t('profile.password.currentPassword')}
            value={form.currentPassword}
            onChange={e => setForm(p => ({ ...p, currentPassword: e.currentTarget.value }))}
            visible={showCur}
            onVisibilityChange={setShowCur}
            autoComplete="current-password"
            required
          />
          <PasswordInput
            label={t('profile.password.newPassword')}
            value={form.newPassword}
            onChange={e => setForm(p => ({ ...p, newPassword: e.currentTarget.value }))}
            visible={showNew}
            onVisibilityChange={setShowNew}
            autoComplete="new-password"
            required
            minLength={8}
          />
          <PasswordInput
            label={t('profile.password.confirmNewPassword')}
            value={form.confirmPassword}
            onChange={e => setForm(p => ({ ...p, confirmPassword: e.currentTarget.value }))}
            autoComplete="new-password"
            required
            minLength={8}
          />

          {error && <Alert color="red">{error}</Alert>}
          {success && (
            <Alert color="green" icon={<Check size={16} />}>
              {t('profile.password.success')}
            </Alert>
          )}
        </Stack>
      </SectionCard>
    </form>
  )
}

// ─── Danger Section ───────────────────────────────────────────────────────────

function DangerSection({ user, onDeleted }: { user: PortalUser; onDeleted: () => void }) {
  const { t } = useI18n()
  const deleteAccount = usePortalDeleteAccount()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== user.username) {
      setError(t('profile.danger.confirmPrompt', { username: user.username }))
      return
    }
    try {
      await deleteAccount.mutateAsync()
      onDeleted()
      window.location.href = portalHome
    } catch (e: any) {
      setError(e.message ?? t('profile.danger.errors.deleteFailed'))
    }
  }

  return (
    <Stack gap="lg">
      <SectionCard title={t('profile.danger.accountInformation')} description={t('profile.danger.accountDetails')}>
        <SettingsList>
          <SettingRow label={t('profile.danger.userId')}>
            <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{user.id}</Text>
          </SettingRow>
          <SettingRow label={t('profile.profileSection.username')}>
            <Text size="sm" fw={500}>{user.username}</Text>
          </SettingRow>
          <SettingRow label={t('profile.profileSection.emailAddress')}>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>{user.email}</Text>
          </SettingRow>
        </SettingsList>
      </SectionCard>

      <SectionCard
        variant="danger"
        title={t('profile.danger.deleteTitle')}
        description={t('profile.danger.deleteDescription')}
      >
        {!confirmOpen ? (
          <Group>
            <Button onClick={() => setConfirmOpen(true)} color="red" leftSection={<Trash2 size={16} />}>
              {t('profile.danger.deleteMyAccount')}
            </Button>
          </Group>
        ) : (
          <Stack gap="sm" maw={480}>
            <Text size="sm">
              {t('profile.danger.typeUsernameToConfirm')}{' '}
              <Text span ff="monospace" fw={600}>{user.username}</Text>:
            </Text>
            <TextInput
              value={confirmText}
              onChange={e => { setConfirmText(e.currentTarget.value); setError('') }}
              placeholder={user.username}
              aria-label={t('profile.danger.typeUsernameToConfirm')}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Group gap="xs">
              <Button
                onClick={() => { setConfirmOpen(false); setConfirmText(''); setError('') }}
                variant="default"
              >
                {t('profile.common.cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                loading={deleteAccount.isPending}
                color="red"
                leftSection={<Trash2 size={16} />}
              >
                {t('profile.danger.deleteAccount')}
              </Button>
            </Group>
          </Stack>
        )}
      </SectionCard>
    </Stack>
  )
}
