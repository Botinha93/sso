import { MonitorSmartphone, RefreshCw, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useDevices, useRevokeDeviceRequest, useRevokeDeviceSession } from '../hooks/useApi'

interface DeviceRequest {
  deviceCode: string
  userCode: string
  clientId: string
  clientName: string
  userId?: string
  scope: string[]
  createdAt: string
  expiresAt: string
  status: 'pending' | 'approved' | 'denied'
  lastPolledAt?: string
}

interface DeviceSession {
  id: string
  clientId: string
  clientName: string
  userId: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
  status: 'active' | 'expired' | 'revoked'
}

const statusTone = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  denied: 'bg-rose-50 text-rose-700 border-rose-100',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
  revoked: 'bg-rose-50 text-rose-700 border-rose-100'
} as const

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Never'

export default function Devices() {
  const { data, isLoading, refetch } = useDevices()
  const revokeRequest = useRevokeDeviceRequest()
  const revokeSession = useRevokeDeviceSession()
  const [requestToRevoke, setRequestToRevoke] = useState<string | null>(null)
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null)

  const requests = ((data as { requests?: DeviceRequest[] } | undefined)?.requests ?? []) as DeviceRequest[]
  const sessions = ((data as { sessions?: DeviceSession[] } | undefined)?.sessions ?? []) as DeviceSession[]

  const confirmRequestRevoke = () => {
    if (!requestToRevoke) return
    revokeRequest.mutate(requestToRevoke, { onSuccess: () => setRequestToRevoke(null) })
  }

  const confirmSessionRevoke = () => {
    if (!sessionToRevoke) return
    revokeSession.mutate(sessionToRevoke, { onSuccess: () => setSessionToRevoke(null) })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Device Access</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Devices</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Monitor pending device authorization requests and revoke device-issued sessions from one place.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending Requests</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {requests.filter((item) => item.status === 'pending').length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Device Sessions</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {sessions.filter((item) => item.status === 'active').length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Managed Clients</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {new Set([...requests.map((item) => item.clientId), ...sessions.map((item) => item.clientId)]).size}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Pending Device Requests</h2>
            <p className="mt-0.5 text-xs text-slate-500">Requests waiting for approval, already approved, or denied before token exchange.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading device requests…</div>
        ) : !requests.length ? (
          <div className="p-10 text-center text-sm text-slate-400">No device requests found</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.deviceCode} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{request.clientName}</p>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${statusTone[request.status]}`}>{request.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">User code {request.userCode} · Device {request.deviceCode.slice(0, 16)}…</p>
                  <p className="text-xs text-slate-500">
                    Client <span className="font-mono">{request.clientId}</span>
                    {request.userId ? <> {' · '}User <span className="font-mono">{request.userId.slice(0, 12)}…</span></> : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    Created {formatDate(request.createdAt)} {' · '}Expires {formatDate(request.expiresAt)} {' · '}Last poll {formatDate(request.lastPolledAt)}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {request.scope.map((scope) => (
                      <span key={scope} className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">{scope}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setRequestToRevoke(request.deviceCode)}
                    disabled={revokeRequest.isPending}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Revoke device request"
                  >
                    <ShieldOff size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Device Sessions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Sessions issued through clients that support the device_code grant.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading device sessions…</div>
        ) : !sessions.length ? (
          <div className="p-10 text-center text-sm text-slate-400">No device sessions found</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MonitorSmartphone size={16} className="text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">{session.clientName}</p>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${statusTone[session.status]}`}>{session.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">Session {session.id.slice(0, 16)}…</p>
                  <p className="text-xs text-slate-500">
                    User <span className="font-mono">{session.userId.slice(0, 12)}…</span>
                    {' · '}Client <span className="font-mono">{session.clientId}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Created {formatDate(session.createdAt)} {' · '}Expires {formatDate(session.expiresAt)}
                    {session.revokedAt ? <> {' · '}Revoked {formatDate(session.revokedAt)}</> : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {session.status === 'active' ? (
                    <button
                      onClick={() => setSessionToRevoke(session.id)}
                      disabled={revokeSession.isPending}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      title="Revoke device session"
                    >
                      <ShieldOff size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!requestToRevoke}
        title="Revoke Device Request"
        message="Revoke this pending or approved device authorization request? The device will no longer be able to complete the flow with this code."
        confirmLabel="Revoke Request"
        pending={revokeRequest.isPending}
        onConfirm={confirmRequestRevoke}
        onCancel={() => setRequestToRevoke(null)}
      />

      <ConfirmDialog
        isOpen={!!sessionToRevoke}
        title="Revoke Device Session"
        message="Revoke this device-issued session? The device will lose access immediately and need to re-authorize."
        confirmLabel="Revoke Session"
        pending={revokeSession.isPending}
        onConfirm={confirmSessionRevoke}
        onCancel={() => setSessionToRevoke(null)}
      />
    </div>
  )
}