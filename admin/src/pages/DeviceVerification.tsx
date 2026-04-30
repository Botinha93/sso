import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, MonitorSmartphone, ShieldCheck, XCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

type SubmissionState = 'idle' | 'approved' | 'denied'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

export default function DeviceVerification() {
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
        const payload = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(payload.message ?? payload.error ?? 'Unable to complete device verification')
        return
      }

      const payload = await res.json().catch(() => ({ status: approve ? 'approved' : 'denied' }))
      setResult(payload.status === 'denied' ? 'denied' : 'approved')
    } catch {
      setError('Network error while completing device verification')
    } finally {
      setLoading(false)
    }
  }

  if (result !== 'idle') {
    const approved = result === 'approved'
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 font-sans">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm px-8 py-10 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${approved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {approved ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{approved ? 'Device Approved' : 'Device Request Denied'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {approved
              ? 'You can return to your device. It may take a few seconds for the sign-in to complete.'
              : 'The device authorization request has been denied. You can close this window.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-8 py-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30">
              <MonitorSmartphone size={16} className="text-sky-300" />
            </div>
            <div className="text-xl font-semibold text-slate-50 tracking-tight">Device Sign-in</div>
          </div>
          <p className="text-slate-400 text-sm">Approve or deny a device authorization request using the code shown on your other device.</p>
        </div>

        <div className="px-8 py-7 space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Only approve requests that match the code displayed on a device you trust.</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>User Code</label>
            <Input
              type="text"
              value={userCode}
              onChange={(event) => setUserCode(event.target.value.toUpperCase())}
              className="font-mono tracking-[0.2em] uppercase"
              placeholder="ABCD-1234"
              autoFocus={!userCode}
            />
          </div>

          <div>
            <label className={labelCls}>Email or Username</label>
            <Input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin@example.com or admin"
            />
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => submit(true)}
              disabled={loading || !userCode.trim() || !username.trim() || !password}
            >
              {loading ? 'Submitting…' : 'Approve'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => submit(false)}
              disabled={loading || !userCode.trim() || !username.trim() || !password}
            >
              Deny
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}