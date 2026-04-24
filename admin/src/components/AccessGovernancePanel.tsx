import { useMemo, useState } from 'react'
import {
  useAccessRequests,
  useApproveAccessRequest,
  useCreateAccessRequest,
  useGroups,
  useProcessExpiredAccessRequests,
  useRejectAccessRequest,
  useRoles,
  useUsers,
  useStalledAccessRequests
} from '../hooks/useApi'

const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

type AccessRequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export default function AccessGovernancePanel() {
  const [statusFilter, setStatusFilter] = useState<AccessRequestStatusFilter>('all')
  const [subjectUserId, setSubjectUserId] = useState('')
  const [entitlementType, setEntitlementType] = useState('role')
  const [entitlementValue, setEntitlementValue] = useState('')
  const [justification, setJustification] = useState('')
  const [expiresAtDate, setExpiresAtDate] = useState('')
  const [expiresAtTime, setExpiresAtTime] = useState('23:59')
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [stalledAfterMinutes, setStalledAfterMinutes] = useState(60)

  const { data: users = [] } = useUsers() as { data: Array<{ id: string; username: string; email: string }> }
  const { data: roles = [] } = useRoles() as { data: Array<{ id: string; name: string }> }
  const { data: groups = [] } = useGroups() as { data: Array<{ id: string; name: string }> }
  const { data: requests = [] } = useAccessRequests(statusFilter === 'all' ? undefined : statusFilter, 50)
  const createAccessRequest = useCreateAccessRequest()
  const approveAccessRequest = useApproveAccessRequest()
  const rejectAccessRequest = useRejectAccessRequest()
  const processExpiredAccessRequests = useProcessExpiredAccessRequests()

  const entitlementOptions = entitlementType === 'group' ? groups : roles

  const usersById = useMemo(() => {
    const map = new Map<string, { username: string; email: string }>()
    for (const user of users) {
      map.set(user.id, { username: user.username, email: user.email })
    }
    return map
  }, [users])

  const { data: stalledRequests = [] } = useStalledAccessRequests(stalledAfterMinutes)

  const submitRequest = async () => {
    setSweepMessage(null)
    await createAccessRequest.mutateAsync({
      subjectUserId,
      entitlementType,
      entitlementValue,
      justification,
      expiresAt: expiresAtDate ? new Date(`${expiresAtDate}T${expiresAtTime || '23:59'}:00`).toISOString() : undefined
    })

    setEntitlementValue('')
    setJustification('')
    setExpiresAtDate('')
    setExpiresAtTime('23:59')
  }

  const approveRequest = async (id: string) => {
    const rationale = window.prompt('Approval rationale (optional):') ?? undefined
    await approveAccessRequest.mutateAsync({ id, rationale: rationale?.trim() || undefined })
  }

  const rejectRequest = async (id: string) => {
    const rationale = window.prompt('Rejection rationale (optional):') ?? undefined
    await rejectAccessRequest.mutateAsync({ id, rationale: rationale?.trim() || undefined })
  }

  const sweepExpiredRequests = async (dryRun: boolean) => {
    const result = await processExpiredAccessRequests.mutateAsync({ dryRun })
    setSweepMessage(
      `${dryRun ? 'Dry-run' : 'Sweep'} complete: ${result.expiredRequests} expired request(s), ${result.revokedAssignments} assignment(s) processed.`
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className={sectionCls}>
        <h2 className="text-base font-semibold text-slate-900">Access Request Intake</h2>
        <p className="mt-1 text-sm text-slate-600">Create lightweight governance requests before assignment approval workflows are introduced.</p>

        <div className="mt-4 grid gap-2">
          <select
            value={subjectUserId}
            onChange={(event) => setSubjectUserId(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          >
            <option value="">Select target user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.username} ({user.email})</option>
            ))}
          </select>

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={entitlementType}
              onChange={(event) => {
                setEntitlementType(event.target.value)
                setEntitlementValue('')
              }}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            >
              <option value="role">Role</option>
              <option value="group">Group</option>
            </select>
            <select
              value={entitlementValue}
              onChange={(event) => setEntitlementValue(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            >
              <option value="">Select {entitlementType}</option>
              {entitlementOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>

          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            rows={3}
            placeholder="Why this access is needed"
            className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={expiresAtDate}
              onChange={(event) => setExpiresAtDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
            <input
              type="time"
              value={expiresAtTime}
              onChange={(event) => setExpiresAtTime(event.target.value)}
              step={60}
              disabled={!expiresAtDate}
              className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <p className="text-xs text-slate-500">Expiration is optional. Select date first, then time.</p>

          <div>
            <button
              onClick={submitRequest}
              disabled={createAccessRequest.isPending || !subjectUserId || entitlementType.trim().length === 0 || entitlementValue.trim().length === 0 || justification.trim().length < 3}
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {createAccessRequest.isPending ? 'Submitting…' : 'Create Access Request'}
            </button>
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Access Requests</h2>
            <p className="mt-1 text-sm text-slate-600">Track pending and finalized requests for audit-ready visibility.</p>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AccessRequestStatusFilter)}
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="mt-4 space-y-2">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => sweepExpiredRequests(true)}
              disabled={processExpiredAccessRequests.isPending}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Dry-Run Expiration Sweep
            </button>
            <button
              onClick={() => sweepExpiredRequests(false)}
              disabled={processExpiredAccessRequests.isPending}
              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Run Expiration Sweep
            </button>
          </div>
          {sweepMessage ? <p className="text-xs text-slate-600">{sweepMessage}</p> : null}
          {requests.length === 0 ? <p className="text-sm text-slate-500">No access requests found for this filter.</p> : null}
          {requests.map((request) => {
            const subject = usersById.get(request.subjectUserId)
            return (
              <div key={request.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{request.entitlementType}: {request.entitlementValue}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">{request.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">Subject: {subject ? `${subject.username} (${subject.email})` : request.subjectUserId}</p>
                <p className="mt-1 text-xs text-slate-600">Justification: {request.justification}</p>
                <p className="mt-1 text-xs text-slate-500">Created: {new Date(request.createdAt).toLocaleString()}</p>
                {request.expiresAt ? <p className="mt-1 text-xs text-slate-500">Expires: {new Date(request.expiresAt).toLocaleString()}</p> : null}
                {request.status === 'pending' ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => approveRequest(request.id)}
                      disabled={approveAccessRequest.isPending}
                      className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectRequest(request.id)}
                      disabled={rejectAccessRequest.isPending}
                      className="rounded border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Stalled Requests */}
      <section className={`${sectionCls} xl:col-span-2`}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Stalled Access Requests</h2>
            <p className="mt-0.5 text-sm text-slate-600">Pending requests that have not been acted on within the threshold — may need escalation.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Stalled after</label>
            <select
              value={stalledAfterMinutes}
              onChange={e => setStalledAfterMinutes(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hr</option>
              <option value={240}>4 hrs</option>
              <option value={1440}>24 hrs</option>
              <option value={10080}>7 days</option>
            </select>
          </div>
        </div>
        {stalledRequests.length === 0 ? (
          <p className="text-sm text-slate-400">No stalled requests in this window.</p>
        ) : (
          <div className="space-y-2">
            {stalledRequests.map((request: any) => {
              const subject = usersById.get(request.subjectUserId)
              return (
                <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{request.entitlementType}: {request.entitlementValue}</p>
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">stalled</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Subject: {subject ? `${subject.username} (${subject.email})` : request.subjectUserId}</p>
                  <p className="mt-1 text-xs text-slate-600">Justification: {request.justification}</p>
                  <p className="mt-1 text-xs text-slate-500">Created: {new Date(request.createdAt).toLocaleString()}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
