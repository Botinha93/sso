import { useState } from 'react'
import { useInitializeSetup } from '../hooks/useApi'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const fieldCls = 'h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

const Setup = () => {
  const [databaseProvider, setDatabaseProvider] = useState<'sqlite' | 'postgresql' | 'mysql'>('sqlite')
  const [databasePath, setDatabasePath] = useState('./data/sso.sqlite')
  const [externalDatabaseUrl, setExternalDatabaseUrl] = useState('')
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
    if (databaseProvider === 'sqlite' && !databasePath.trim()) {
      setError('SQLite database path is required')
      return
    }
    if (databaseProvider !== 'sqlite' && !externalDatabaseUrl.trim()) {
      setError('External database URL is required for PostgreSQL/MySQL')
      return
    }

    await initializeSetup.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      username: username.trim(),
      password,
      databaseProvider,
      databasePath: databaseProvider === 'sqlite' ? databasePath.trim() : undefined,
      externalDatabaseUrl: databaseProvider !== 'sqlite' ? externalDatabaseUrl.trim() : undefined
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
            <label className={labelCls}>Database Provider</label>
            <select
              value={databaseProvider}
              onChange={e => setDatabaseProvider(e.target.value as 'sqlite' | 'postgresql' | 'mysql')}
              className={fieldCls}
            >
              <option value="sqlite">SQLite</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          {databaseProvider === 'sqlite' ? (
            <div>
              <label className={labelCls}>SQLite Database Path</label>
              <Input
                type="text"
                value={databasePath}
                onChange={e => setDatabasePath(e.target.value)}
                placeholder="./data/sso.sqlite"
              />
            </div>
          ) : (
            <div>
              <label className={labelCls}>External Database URL</label>
              <Input
                type="text"
                value={externalDatabaseUrl}
                onChange={e => setExternalDatabaseUrl(e.target.value)}
                placeholder={databaseProvider === 'postgresql' ? 'postgresql://user:pass@host:5432/sso' : 'mysql://user:pass@host:3306/sso'}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Administrator Name</label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Platform Administrator"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Administrator Email</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
            />
          </div>

          <div>
            <label className={labelCls}>Administrator Username</label>
            <Input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className={labelCls}>Confirm Password</label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            className="w-full"
            disabled={initializeSetup.isPending}
          >
            {initializeSetup.isPending ? 'Initializing…' : 'Initialize Installation'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Setup
