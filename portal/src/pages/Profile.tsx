import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, Plus, Save, ShieldCheck, Trash2, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PortalUser } from '../hooks'
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

const fieldCls = 'h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'
const portalHome = import.meta.env.BASE_URL

interface Props {
  user: PortalUser
}

type Section = 'profile' | 'password' | 'totp' | 'danger'

export default function Profile({ user }: Props) {
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('profile')

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = portalHome
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft size={15} />
            Back to Apps
          </Link>
          <button
            onClick={handleLogout}
            className="h-8 px-3 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your profile and security settings</p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar nav */}
          <nav className="w-full shrink-0 lg:w-44">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {([
              { key: 'profile', label: 'Profile', icon: <User size={14} /> },
              { key: 'password', label: 'Password', icon: <KeyRound size={14} /> },
              { key: 'totp', label: 'Two-Factor', icon: <ShieldCheck size={14} /> },
              { key: 'danger', label: 'Account', icon: <AlertTriangle size={14} /> },
            ] as { key: Section; label: string; icon: React.ReactNode }[]).map(item => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                  section === item.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${item.key === 'danger' && section !== 'danger' ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : ''}`}
              >
                {item.icon}
                {item.label}
              </button>
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
  const update = usePortalUpdateProfile()
  const uploadAvatar = usePortalUploadAvatar()
  const [form, setForm] = useState({
    givenName: user.givenName,
    familyName: user.familyName,
    avatarUrl: user.avatarUrl ?? '',
    email: user.email,
    username: user.username,
  })
  const [customAttrs, setCustomAttrs] = useState<[string, string][]>(
    Object.entries(user.customAttributes)
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Sync if user data changes
  useEffect(() => {
    setForm({ givenName: user.givenName, familyName: user.familyName, avatarUrl: user.avatarUrl ?? '', email: user.email, username: user.username })
    setCustomAttrs(Object.entries(user.customAttributes))
  }, [user])

  const initials = `${form.givenName?.[0] ?? ''}${form.familyName?.[0] ?? ''}`.toUpperCase() || (form.username?.slice(0, 2).toUpperCase() ?? 'AB')
  const { data: defaultAvatars } = usePortalDefaultAvatars(initials)

  const handleSave = async () => {
    setError('')
    setSaved(false)
    try {
      await update.mutateAsync({
        ...form,
        customAttributes: Object.fromEntries(customAttrs.filter(([k]) => k.trim()))
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    }
  }

  const addAttr = () => setCustomAttrs(p => [...p, ['', '']])
  const removeAttr = (i: number) => setCustomAttrs(p => p.filter((_, idx) => idx !== i))
  const setAttrKey = (i: number, v: string) => setCustomAttrs(p => p.map((pair, idx) => idx === i ? [v, pair[1]] : pair))
  const setAttrVal = (i: number, v: string) => setCustomAttrs(p => p.map((pair, idx) => idx === i ? [pair[0], v] : pair))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>First Name</label>
          <input className={fieldCls} value={form.givenName} onChange={e => setForm(p => ({ ...p, givenName: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Last Name</label>
          <input className={fieldCls} value={form.familyName} onChange={e => setForm(p => ({ ...p, familyName: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Profile Picture</label>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
            {form.avatarUrl ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}
          </div>
          <input
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
                setError(e.message ?? 'Avatar upload failed')
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {((defaultAvatars as any)?.items ?? []).map((item: any) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, avatarUrl: item.url }))}
              className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 hover:ring-2 hover:ring-slate-300"
              title={item.label}
            >
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Email Address</label>
        <input type="email" className={fieldCls} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </div>

      <div>
        <label className={labelCls}>Username</label>
        <input className={fieldCls} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
      </div>

      {/* Custom Attributes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Custom Attributes</label>
          <button
            onClick={addAttr}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {customAttrs.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No custom attributes</p>
        ) : (
          <div className="space-y-2">
            {customAttrs.map(([key, val], i) => (
              <div key={i} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <input
                  className={`${fieldCls} font-mono`}
                  value={key}
                  onChange={e => setAttrKey(i, e.target.value)}
                  placeholder="key"
                />
                <input
                  className={fieldCls}
                  value={val}
                  onChange={e => setAttrVal(i, e.target.value)}
                  placeholder="value"
                />
                <button onClick={() => removeAttr(i)} className="self-end text-slate-400 hover:text-red-500 transition-colors shrink-0 sm:self-center">
                  <X size={14} />
                </button>
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
            <Check size={14} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── Two-Factor Section ─────────────────────────────────────────────────────

function TotpSection() {
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
      setSuccess('Copied to clipboard')
      setTimeout(() => setSuccess(''), 1800)
    } catch {
      setError('Could not copy to clipboard')
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
      const begin = await passkeyBegin.mutateAsync()
      await passkeyFinish.mutateAsync({
        registrationId: begin.registrationId,
        credentialId: generateBase64Url(32),
        publicKey: generateBase64Url(64),
        transports: ['internal'],
        signCount: 0
      })
      setSuccess('Passkey registered')
    } catch (e: any) {
      setError(e.message ?? 'Failed to register passkey')
    }
  }

  const handleDeletePasskey = async (credentialId: string) => {
    setError('')
    setSuccess('')
    try {
      await passkeyDelete.mutateAsync(credentialId)
      setSuccess('Passkey removed')
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove passkey')
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
      setError(e.message ?? 'Failed to start 2FA enrollment')
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
      setSuccess('Two-factor authentication enabled')
    } catch (e: any) {
      setError(e.message ?? 'Invalid authenticator code')
    }
  }

  const handleDisable = async () => {
    setError('')
    setSuccess('')
    try {
      await disable.mutateAsync()
      setEnrollment(null)
      setVerificationCode('')
      setSuccess('Two-factor authentication disabled')
    } catch (e: any) {
      setError(e.message ?? 'Failed to disable two-factor authentication')
    }
  }

  if (statusLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">Loading two-factor settings...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Use an authenticator app to protect your account with a one-time verification code at sign-in.
        </p>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-sm ${mfaEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {mfaEnabled ? '2FA is currently enabled on this account.' : '2FA is currently disabled on this account.'}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>
      )}

      {mfaEnabled ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">If you lost access to your authenticator, you can disable 2FA and enroll again.</p>
          <button
            onClick={handleDisable}
            disabled={disable.isPending}
            className="h-9 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            {disable.isPending ? 'Disabling...' : 'Disable 2FA'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {!enrollment ? (
            <button
              onClick={handleStartEnrollment}
              disabled={enroll.isPending}
              className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {enroll.isPending ? 'Starting...' : 'Start 2FA setup'}
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Step 1: Add account to your authenticator app</p>
                <p className="text-xs text-slate-500 mt-1">Use the secret below or the full OTP auth URI.</p>
              </div>

              <div>
                <label className={labelCls}>Secret</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={enrollment.secret} className={`${fieldCls} font-mono`} />
                  <button
                    onClick={() => copy(enrollment.secret)}
                    className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>OTP Auth URI</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={enrollment.otpauthUri} className={`${fieldCls} font-mono text-xs`} />
                  <button
                    onClick={() => copy(enrollment.otpauthUri)}
                    className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">Step 2: Verify one-time code</p>
                <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                  placeholder="123456"
                  className={`${fieldCls} tracking-[0.18em] font-mono sm:max-w-[220px]`}
                />
                <button
                  onClick={handleVerify}
                  disabled={verify.isPending || verificationCode.trim().length < 6}
                  className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
                >
                  {verify.isPending ? 'Verifying...' : 'Enable 2FA'}
                </button>
                <button
                  onClick={() => {
                    setEnrollment(null)
                    setVerificationCode('')
                    setError('')
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Passkeys (WebAuthn)</h3>
          <p className="text-xs text-slate-500 mt-1">Register platform passkeys for phishing-resistant MFA and passwordless sign-in flows.</p>
        </div>

        <button
          onClick={handleAddPasskey}
          disabled={passkeyBegin.isPending || passkeyFinish.isPending}
          className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {passkeyBegin.isPending || passkeyFinish.isPending ? 'Registering...' : 'Register passkey'}
        </button>

        {passkeys && passkeys.length > 0 ? (
            <div className="space-y-2">
            {passkeys.map((credential) => (
              <div key={credential.credentialId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-700 truncate">{credential.credentialId}</p>
                  <p className="text-xs text-slate-500">signCount {credential.signCount} {credential.transports.length > 0 ? `• ${credential.transports.join(', ')}` : ''}</p>
                </div>
                <button
                  onClick={() => handleDeletePasskey(credential.credentialId)}
                  disabled={passkeyDelete.isPending}
                  className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No registered passkeys yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Password Section ─────────────────────────────────────────────────────────

function PasswordSection() {
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
      setError('New passwords do not match')
      return
    }
    try {
      await change.mutateAsync({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message ?? 'Failed to change password')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-5">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Current Password</label>
          <div className="relative">
            <input
              type={showCur ? 'text' : 'password'}
              className={`${fieldCls} pr-9`}
              value={form.currentPassword}
              onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
              required
            />
            <button type="button" onClick={() => setShowCur(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
              {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              className={`${fieldCls} pr-9`}
              value={form.newPassword}
              onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={8}
            />
            <button type="button" onClick={() => setShowNew(p => !p)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700">
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Confirm New Password</label>
          <input
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
            <Check size={14} /> Password changed successfully
          </p>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={change.isPending}
            className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {change.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Danger Section ───────────────────────────────────────────────────────────

function DangerSection({ user, onDeleted }: { user: PortalUser; onDeleted: () => void }) {
  const deleteAccount = usePortalDeleteAccount()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== user.username) {
      setError(`Please type your username "${user.username}" to confirm`)
      return
    }
    try {
      await deleteAccount.mutateAsync()
      onDeleted()
      window.location.href = portalHome
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete account')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Account Information</h2>
        <p className="text-sm text-slate-500 mb-4">Your account details</p>
        <div className="space-y-2 text-sm">
          <div className="flex flex-col gap-1 py-2 border-b border-slate-100 sm:flex-row sm:justify-between">
            <span className="text-slate-500">User ID</span>
            <span className="font-mono text-slate-700 text-xs break-all sm:text-right">{user.id}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 border-b border-slate-100 sm:flex-row sm:justify-between">
            <span className="text-slate-500">Username</span>
            <span className="text-slate-800 font-medium sm:text-right">{user.username}</span>
          </div>
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-800 break-all sm:text-right">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Delete Account</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>

        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="h-9 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Type your username <span className="font-mono font-semibold text-slate-900">{user.username}</span> to confirm:
            </p>
            <input
              className={fieldCls}
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError('') }}
              placeholder={user.username}
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmOpen(false); setConfirmText(''); setError('') }}
                className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteAccount.isPending}
                className="h-9 px-4 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteAccount.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
