import { useMemo, useState } from 'react'
import {
  useAccessRequests,
  useApproveAccessRequest,
  useCreateAccessRequest,
  useGroups,
  useProcessExpiredAccessRequests,
  useRejectAccessRequest,
  useRoles,
  useUsers
} from '../hooks/useApi'

const sectionCls = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

type AccessRequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export default function AccessGovernancePanel() {
  const [statusFilter, setStatusFilter] = useState<AccessRequestStatusFilter>('all')
  const [subjectUserId, setSubjectUserId] = useState('')
  const [entitlementType, setEntitlementType] = useState('role')
  const [entitlementValue, setEntitlementValue] = useState('')
  const [justification, setJustification] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

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

  const submitRequest = async () => {
    setSweepMessage(null)
    await createAccessRequest.mutateAsync({
      subjectUserId,
      entitlementType,
      entitlementValue,
      justification,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
    })

    setEntitlementValue('')
    setJustification('')
    setExpiresAt('')
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

          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />

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
    </div>
  )
}
