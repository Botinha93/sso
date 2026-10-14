import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, Save, ShieldCheck, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { PortalUser } from '../hooks'
import LanguageSelector from '../components/LanguageSelector'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { Tabs, TabList, TabTrigger } from '../components/ui/Tabs'
import { useI18n } from '../i18n'
import {
  logout,
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

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'
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

  const handleLogout = async () => {
    await logout()
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} />
            {t('profile.backToApps')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector className="hidden sm:inline-flex" />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
            >
              {t('common.signOut')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-4 sm:hidden">
          <LanguageSelector />
        </div>
        <div className="mb-8 flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover rounded-full" />
              : `${user.givenName?.[0] ?? ''}${user.familyName?.[0] ?? ''}`.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('profile.accountSettings')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar nav */}
          <Tabs value={section} onValueChange={(value) => setSection(value as Section)} className="w-full shrink-0 lg:w-44">
            <TabList>
              <TabTrigger value="profile" icon={<User size={14} />}>{t('profile.nav.profile')}</TabTrigger>
              <TabTrigger value="password" icon={<KeyRound size={14} />}>{t('profile.nav.password')}</TabTrigger>
              <TabTrigger value="totp" icon={<ShieldCheck size={14} />}>{t('profile.nav.twoFactor')}</TabTrigger>
              <TabTrigger value="danger" tone="danger" icon={<AlertTriangle size={14} />}>{t('profile.nav.account')}</TabTrigger>
            </TabList>
          </Tabs>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {section === 'profile' && <ProfileSection user={user} />}
            {section === 'password' && <PasswordSection />}
            {section === 'totp' && <TotpSection />}
            {section === 'danger' && <DangerSection user={user} onDeleted={() => navigate('/')} />}
          </div>
        </div>
      </main>
    </div>
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
    <Card className="rounded-2xl p-6 space-y-5">
      <h2 className="text-base font-semibold text-foreground">{t('profile.profileSection.title')}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('profile.profileSection.firstName')}</label>
          <Input value={form.givenName} onChange={e => setForm(p => ({ ...p, givenName: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>{t('profile.profileSection.lastName')}</label>
          <Input value={form.familyName} onChange={e => setForm(p => ({ ...p, familyName: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('profile.profileSection.profilePicture')}</label>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {form.avatarUrl ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}
          </div>
          <Input
            type="file"
            accept="image/*"
            className="pt-1.5"
            onChange={async (event) => {
              const file = event.target.files?.[0]
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
        </div>
        <div className="flex flex-wrap gap-2">
          {((defaultAvatars as any)?.items ?? []).map((item: any) => (
            <Button
              key={item.key}
              onClick={() => setForm((prev) => ({ ...prev, avatarUrl: item.url }))}
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full overflow-hidden border border-border p-0 hover:ring-2 hover:ring-ring"
              title={item.label}
            >
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
            </Button>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => setForm((prev) => ({ ...prev, avatarUrl: '' }))}
          >
            Clear image
          </Button>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('profile.profileSection.emailAddress')}</label>
        <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </div>

      <div>
        <label className={labelCls}>{t('profile.profileSection.username')}</label>
        <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
      </div>

      {/* Custom Attributes */}
      <div>
        <label className={labelCls}>{t('profile.profileSection.customAttributes')}</label>
        {customFields.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('profile.profileSection.noCustomAttributes')}</p>
        ) : (
          <div className="space-y-3">
            {customFields.map((field) => (
              <div key={field.key}>
                <label className={labelCls} htmlFor={field.userEditable ? `custom-attr-${field.key}` : undefined}>
                  {field.name}
                </label>
                {field.userEditable ? (
                  <Input
                    id={`custom-attr-${field.key}`}
                    value={field.value}
                    onChange={(e) => setFieldValue(field.key, e.target.value)}
                    placeholder={t('profile.profileSection.valuePlaceholder')}
                    title={field.description || field.name}
                  />
                ) : (
                  <p className="text-sm text-foreground" title={field.description || field.name}>
                    {field.value || <span className="text-muted-foreground italic">—</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Check size={14} /> {t('profile.profileSection.saved')}
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={update.isPending}
          variant="primary"
          className="h-9 rounded-xl"
        >
          {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('profile.profileSection.saveChanges')}
        </Button>
      </div>
    </Card>
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
    return (
      <Card className="rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">{t('profile.totp.loading')}</p>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('profile.totp.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('profile.totp.subtitle')}
        </p>
      </div>

      <Alert tone={mfaEnabled ? 'success' : 'warning'}>
        {mfaEnabled ? t('profile.totp.status.enabled') : t('profile.totp.status.disabled')}
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {mfaEnabled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('profile.totp.disableHint')}</p>
          <Button
            onClick={handleDisable}
            disabled={disable.isPending}
            variant="danger"
            className="h-9 rounded-xl"
          >
            {disable.isPending ? t('profile.totp.disabling') : t('profile.totp.disable')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {!enrollment ? (
            <Button
              onClick={handleStartEnrollment}
              disabled={enroll.isPending}
              variant="primary"
              className="h-9 rounded-xl"
            >
              {enroll.isPending ? t('profile.totp.starting') : t('profile.totp.startSetup')}
            </Button>
          ) : (
            <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t('profile.totp.step1Title')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('profile.totp.step1Subtitle')}</p>
              </div>

              <div>
                <label className={labelCls}>{t('profile.totp.secret')}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={enrollment.secret} className="font-mono" />
                  <Button
                    onClick={() => copy(enrollment.secret)}
                    variant="secondary"
                    className="h-9 rounded-xl"
                  >
                    {t('profile.totp.copy')}
                  </Button>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('profile.totp.otpAuthUri')}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={enrollment.otpauthUri} className="font-mono text-xs" />
                  <Button
                    onClick={() => copy(enrollment.otpauthUri)}
                    variant="secondary"
                    className="h-9 rounded-xl"
                  >
                    {t('profile.totp.copy')}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">{t('profile.totp.step2Title')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('profile.totp.step2Subtitle')}</p>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  placeholder={t('profile.totp.codePlaceholder')}
                  className="tracking-[0.18em] font-mono sm:max-w-[220px]"
                />
                <Button
                  onClick={handleVerify}
                  disabled={verify.isPending || verificationCode.trim().length < 6}
                  variant="primary"
                  className="h-9 rounded-xl"
                >
                  {verify.isPending ? t('profile.totp.verifying') : t('profile.totp.enable')}
                </Button>
                <Button
                  onClick={() => {
                    setEnrollment(null)
                    setVerificationCode('')
                    setError('')
                  }}
                  variant="secondary"
                  className="h-9 rounded-xl"
                >
                  {t('profile.common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-border space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('profile.passkeys.title')}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t('profile.passkeys.subtitle')}</p>
        </div>

        <Button
          onClick={handleAddPasskey}
          disabled={passkeyBegin.isPending || passkeyFinish.isPending}
          variant="primary"
          className="h-9 rounded-xl"
        >
          {passkeyBegin.isPending || passkeyFinish.isPending ? t('profile.passkeys.registering') : t('profile.passkeys.register')}
        </Button>

        {passkeys && passkeys.length > 0 ? (
            <div className="space-y-2">
            {passkeys.map((credential) => (
              <div key={credential.credentialId} className="rounded-xl border border-border bg-muted/40 px-3 py-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">{credential.credentialId}</p>
                  <p className="text-xs text-muted-foreground">{t('profile.passkeys.signCount', { count: String(credential.signCount) })} {credential.transports.length > 0 ? `• ${credential.transports.join(', ')}` : ''}</p>
                </div>
                <Button
                  onClick={() => handleDeletePasskey(credential.credentialId)}
                  disabled={passkeyDelete.isPending}
                  variant="danger"
                  size="sm"
                >
                  {t('profile.common.remove')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('profile.passkeys.none')}</p>
        )}
      </div>
    </Card>
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
    <Card className="rounded-2xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-5">{t('profile.password.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>{t('profile.password.currentPassword')}</label>
          <div className="relative">
            <Input
              type={showCur ? 'text' : 'password'}
              className="pr-9"
              value={form.currentPassword}
              onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
              required
            />
            <Button type="button" onClick={() => setShowCur(p => !p)} variant="ghost" size="icon" className="absolute right-2 top-1.5 h-7 w-7">
              {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('profile.password.newPassword')}</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              className="pr-9"
              value={form.newPassword}
              onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={8}
            />
            <Button type="button" onClick={() => setShowNew(p => !p)} variant="ghost" size="icon" className="absolute right-2 top-1.5 h-7 w-7">
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('profile.password.confirmNewPassword')}</label>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
            required
            minLength={8}
          />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {success && (
          <Alert tone="success" className="flex items-center gap-1.5">
            <Check size={14} /> {t('profile.password.success')}
          </Alert>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="submit"
            disabled={change.isPending}
            variant="primary"
            className="h-9 rounded-xl"
          >
            {change.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {t('profile.password.updateButton')}
          </Button>
        </div>
      </form>
    </Card>
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
    <div className="space-y-4">
      <Card className="rounded-2xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">{t('profile.danger.accountInformation')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('profile.danger.accountDetails')}</p>
        <div className="space-y-2 text-sm">
          <div className="flex flex-col gap-1 py-2 border-b border-border sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">{t('profile.danger.userId')}</span>
            <span className="font-mono text-foreground text-xs break-all sm:text-right">{user.id}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 border-b border-border sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">{t('profile.profileSection.username')}</span>
            <span className="text-foreground font-medium sm:text-right">{user.username}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">{t('profile.profileSection.emailAddress')}</span>
            <span className="text-foreground break-all sm:text-right">{user.email}</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-rose-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-rose-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('profile.danger.deleteTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('profile.danger.deleteDescription')}
            </p>
          </div>
        </div>

        {!confirmOpen ? (
          <Button
            onClick={() => setConfirmOpen(true)}
            variant="danger"
            className="h-9 rounded-xl"
          >
            <Trash2 size={14} />
            {t('profile.danger.deleteMyAccount')}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {t('profile.danger.typeUsernameToConfirm')} <span className="font-mono font-semibold text-foreground">{user.username}</span>:
            </p>
            <Input
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError('') }}
              placeholder={user.username}
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2">
              <Button
                onClick={() => { setConfirmOpen(false); setConfirmText(''); setError('') }}
                variant="secondary"
                className="h-9 rounded-xl"
              >
                {t('profile.common.cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteAccount.isPending}
                variant="danger"
                className="h-9 rounded-xl"
              >
                {deleteAccount.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t('profile.danger.deleteAccount')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
