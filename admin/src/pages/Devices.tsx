import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Card from '../components/ui/Card'
import { MonitorSmartphone, RefreshCw, ShieldOff } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import React from 'react';

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
  pending: 'warning',
  approved: 'success',
  denied: 'danger',
  active: 'success',
  expired: 'neutral',
  revoked: 'danger'
} as const

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Never'

export default function Devices() {
  const { data, isLoading, isFetching, refetch } = useDevices()
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
      <PageHeader
        eyebrow="Device Access"
        title="Devices"
        description="Monitor pending device authorization requests and revoke device-issued sessions from one place."
        action={
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Pending Requests</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {requests.filter((item) => item.status === 'pending').length}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Active Device Sessions</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {sessions.filter((item) => item.status === 'active').length}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Managed Clients</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {new Set([...requests.map((item) => item.clientId), ...sessions.map((item) => item.clientId)]).size}
          </p>
        </Card>
      </div>

      <Table className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Pending Device Requests</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Requests waiting for approval, already approved, or denied before token exchange.</p>
          </div>
        </TableHeaderRow>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading device requests…</div>
        ) : !requests.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No device requests found</div>
        ) : (
          <TableBody className="divide-y divide-border">
            {requests.map((request) => (
              <TableRow key={request.deviceCode} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{request.clientName}</p>
                    <StatusBadge tone={statusTone[request.status]}>{request.status}</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">User code {request.userCode} · Device {request.deviceCode.slice(0, 16)}…</p>
                  <p className="text-xs text-muted-foreground">
                    Client <span className="font-mono">{request.clientId}</span>
                    {request.userId ? <> {' · '}User <span className="font-mono">{request.userId.slice(0, 12)}…</span></> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(request.createdAt)} {' · '}Expires {formatDate(request.expiresAt)} {' · '}Last poll {formatDate(request.lastPolledAt)}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {request.scope.map((scope) => (
                      <StatusBadge key={scope} tone="neutral" mono>{scope}</StatusBadge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => setRequestToRevoke(request.deviceCode)}
                    disabled={revokeRequest.isPending}
                    title="Revoke device request"
                  >
                    <ShieldOff size={14} />
                  </Button>
                </div>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>

      <Table className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <TableHeaderRow className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Device Sessions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Sessions issued through clients that support the device_code grant.</p>
          </div>
        </TableHeaderRow>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading device sessions…</div>
        ) : !sessions.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No device sessions found</div>
        ) : (
          <TableBody className="divide-y divide-border">
            {sessions.map((session) => (
              <TableRow key={session.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MonitorSmartphone size={16} className="text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">{session.clientName}</p>
                    <StatusBadge tone={statusTone[session.status]}>{session.status}</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">Session {session.id.slice(0, 16)}…</p>
                  <p className="text-xs text-muted-foreground">
                    User <span className="font-mono">{session.userId.slice(0, 12)}…</span>
                    {' · '}Client <span className="font-mono">{session.clientId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(session.createdAt)} {' · '}Expires {formatDate(session.expiresAt)}
                    {session.revokedAt ? <> {' · '}Revoked {formatDate(session.revokedAt)}</> : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {session.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setSessionToRevoke(session.id)}
                      disabled={revokeSession.isPending}
                      title="Revoke device session"
                    >
                      <ShieldOff size={14} />
                    </Button>
                  ) : null}
                </div>
              </TableRow>
            ))}
          </TableBody>
        )}
      </Table>

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