import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, Save, ShieldCheck, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PortalUser } from '../hooks'
import LanguageSelector from '../components/LanguageSelector'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
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

const fieldCls = 'h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'
const portalHome = import.meta.env.BASE_URL

interface Props {
  user: PortalUser
}

type Section = 'profile' | 'password' | 'totp' | 'danger'

export default function Profile({ user }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('profile')

  const handleLogout = async () => {
    await logout()
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft size={15} />
            {t('profile.backToApps')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector className="hidden sm:inline-flex" />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-900"
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
            <h1 className="text-2xl font-bold text-slate-900">{t('profile.accountSettings')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar nav */}
          <nav className="w-full shrink-0 lg:w-44">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {([
              { key: 'profile', label: t('profile.nav.profile'), icon: <User size={14} /> },
              { key: 'password', label: t('profile.nav.password'), icon: <KeyRound size={14} /> },
              { key: 'totp', label: t('profile.nav.twoFactor'), icon: <ShieldCheck size={14} /> },
              { key: 'danger', label: t('profile.nav.account'), icon: <AlertTriangle size={14} /> },
            ] as { key: Section; label: string; icon: React.ReactNode }[]).map(item => (
              <Button
                key={item.key}
                onClick={() => setSection(item.key)}
                variant={section === item.key ? 'primary' : 'ghost'}
                className={`flex h-auto shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                  section === item.key
                    ? 'shadow-sm'
                    : item.key === 'danger'
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                {item.label}
              </Button>
            ))}
            </div>
          </nav>

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
      <h2 className="text-base font-semibold text-slate-900">{t('profile.profileSection.title')}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('profile.profileSection.firstName')}</label>
          <Input className={fieldCls} value={form.givenName} onChange={e => setForm(p => ({ ...p, givenName: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>{t('profile.profileSection.lastName')}</label>
          <Input className={fieldCls} value={form.familyName} onChange={e => setForm(p => ({ ...p, familyName: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('profile.profileSection.profilePicture')}</label>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
            {form.avatarUrl ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}
          </div>
          <Input
            type="file"
            accept="image/*"
            className={`${fieldCls} pt-1.5`}
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
              className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 p-0 hover:ring-2 hover:ring-slate-300"
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
        <Input type="email" className={fieldCls} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </div>

      <div>
        <label className={labelCls}>{t('profile.profileSection.username')}</label>
        <Input className={fieldCls} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
      </div>

      {/* Custom Attributes */}
      <div>
        <label className={labelCls}>{t('profile.profileSection.customAttributes')}</label>
        {customFields.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{t('profile.profileSection.noCustomAttributes')}</p>
        ) : (
          <div className="space-y-3">
            {customFields.map((field) => (
              <div key={field.key}>
                <label className={labelCls} htmlFor={`custom-attr-${field.key}`}>
                  {field.name}
                </label>
                <Input
                  id={`custom-attr-${field.key}`}
                  className={fieldCls}
                  value={field.value}
                  onChange={(e) => setFieldValue(field.key, e.target.value)}
                  disabled={!field.userEditable}
                  readOnly={!field.userEditable}
                  placeholder={t('profile.profileSection.valuePlaceholder')}
                  title={field.description || field.name}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
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
        <p className="text-sm text-slate-500">{t('profile.totp.loading')}</p>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{t('profile.totp.title')}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t('profile.totp.subtitle')}
        </p>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-sm ${mfaEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {mfaEnabled ? t('profile.totp.status.enabled') : t('profile.totp.status.disabled')}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>
      )}

      {mfaEnabled ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t('profile.totp.disableHint')}</p>
          <Button
            onClick={handleDisable}
            disabled={disable.isPending}
            variant="danger"
            className="h-9 rounded-xl border border-red-200 bg-transparent text-red-600 hover:bg-red-50"
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
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{t('profile.totp.step1Title')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('profile.totp.step1Subtitle')}</p>
              </div>

              <div>
                <label className={labelCls}>{t('profile.totp.secret')}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={enrollment.secret} className={`${fieldCls} font-mono`} />
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
                  <Input readOnly value={enrollment.otpauthUri} className={`${fieldCls} font-mono text-xs`} />
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
                <p className="text-sm font-medium text-slate-900">{t('profile.totp.step2Title')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('profile.totp.step2Subtitle')}</p>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  placeholder={t('profile.totp.codePlaceholder')}
                  className={`${fieldCls} tracking-[0.18em] font-mono sm:max-w-[220px]`}
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

      <div className="pt-2 border-t border-slate-100 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('profile.passkeys.title')}</h3>
          <p className="text-xs text-slate-500 mt-1">{t('profile.passkeys.subtitle')}</p>
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
              <div key={credential.credentialId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-700 truncate">{credential.credentialId}</p>
                  <p className="text-xs text-slate-500">{t('profile.passkeys.signCount', { count: String(credential.signCount) })} {credential.transports.length > 0 ? `• ${credential.transports.join(', ')}` : ''}</p>
                </div>
                <Button
                  onClick={() => handleDeletePasskey(credential.credentialId)}
                  disabled={passkeyDelete.isPending}
                  variant="danger"
                  size="sm"
                  className="border border-red-200 bg-transparent text-red-600 hover:bg-red-50"
                >
                  {t('profile.common.remove')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">{t('profile.passkeys.none')}</p>
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
      <h2 className="text-base font-semibold text-slate-900 mb-5">{t('profile.password.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>{t('profile.password.currentPassword')}</label>
          <div className="relative">
            <Input
              type={showCur ? 'text' : 'password'}
              className={`${fieldCls} pr-9`}
              value={form.currentPassword}
              onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
              required
            />
            <Button type="button" onClick={() => setShowCur(p => !p)} variant="ghost" size="icon" className="absolute right-2 top-1.5 h-7 w-7 text-slate-400 hover:text-slate-700">
              {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('profile.password.newPassword')}</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              className={`${fieldCls} pr-9`}
              value={form.newPassword}
              onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={8}
            />
            <Button type="button" onClick={() => setShowNew(p => !p)} variant="ghost" size="icon" className="absolute right-2 top-1.5 h-7 w-7 text-slate-400 hover:text-slate-700">
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('profile.password.confirmNewPassword')}</label>
          <Input
            type="password"
            className={fieldCls}
            value={form.confirmPassword}
            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
            required
            minLength={8}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Check size={14} /> {t('profile.password.success')}
          </p>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
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
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t('profile.danger.accountInformation')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('profile.danger.accountDetails')}</p>
        <div className="space-y-2 text-sm">
          <div className="flex flex-col gap-1 py-2 border-b border-slate-100 sm:flex-row sm:justify-between">
            <span className="text-slate-500">{t('profile.danger.userId')}</span>
            <span className="font-mono text-slate-700 text-xs break-all sm:text-right">{user.id}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 border-b border-slate-100 sm:flex-row sm:justify-between">
            <span className="text-slate-500">{t('profile.profileSection.username')}</span>
            <span className="text-slate-800 font-medium sm:text-right">{user.username}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
            <span className="text-slate-500">{t('profile.profileSection.emailAddress')}</span>
            <span className="text-slate-800 break-all sm:text-right">{user.email}</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-red-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('profile.danger.deleteTitle')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
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
            <p className="text-sm text-slate-700">
              {t('profile.danger.typeUsernameToConfirm')} <span className="font-mono font-semibold text-slate-900">{user.username}</span>:
            </p>
            <Input
              className={fieldCls}
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError('') }}
              placeholder={user.username}
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
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
