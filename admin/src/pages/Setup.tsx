import { useState } from 'react'
import { useInitializeSetup } from '../hooks/useApi'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Setup = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const initializeSetup = useInitializeSetup()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Admin name is required')
      return
    }
    if (!email.trim()) {
      setError('Admin email is required')
      return
    }
    if (!username.trim()) {
      setError('Admin username is required')
      return
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      setError('Username may only contain letters, numbers, _, ., and -')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    await initializeSetup.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      username: username.trim(),
      password
    }, {
      onSuccess: (result: any) => {
        const next = result?.email ? `/login?identifier=${encodeURIComponent(result.email)}` : '/login'
        window.location.href = next
      },
      onError: (err: any) => {
        setError(err?.message ?? 'Failed to initialize setup')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-4 font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-8 py-7">
          <div className="text-xl font-semibold text-slate-50 tracking-tight">First-run Setup</div>
          <p className="text-slate-400 text-sm mt-1">Create the initial administrator account with your own username and email.</p>
        </div>

        <form onSubmit={onSubmit} className="px-8 py-7 space-y-4">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <div>
            <label className={labelCls}>Administrator Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={fieldCls}
              placeholder="Platform Administrator"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Administrator Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={fieldCls}
              placeholder="admin@yourcompany.com"
            />
          </div>

          <div>
            <label className={labelCls}>Administrator Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={fieldCls}
              placeholder="admin"
            />
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={fieldCls}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className={labelCls}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={fieldCls}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={initializeSetup.isPending}
            className="h-9 w-full rounded-lg bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {initializeSetup.isPending ? 'Initializing…' : 'Initialize Installation'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Setup
