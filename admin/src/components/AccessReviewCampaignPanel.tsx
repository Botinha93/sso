import Card from './ui/Card'
import Textarea from './ui/Textarea'
import { useMemo, useState } from 'react'
import {
  useAccessReviewCampaign,
  useCreateAccessReviewCampaign,
  useDecideAccessReviewItem,
  useGroups,
  useRoles,
  useUsers
} from '../hooks/useApi'


export default function AccessReviewCampaignPanel() {
  const [name, setName] = useState('Quarterly Access Recertification')
  const [description, setDescription] = useState('Review direct roles and group memberships for active users.')
  const [dueAtDate, setDueAtDate] = useState('')
  const [dueAtTime, setDueAtTime] = useState('23:59')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { data: users = [] } = useUsers() as { data: Array<{ id: string; username: string; email: string }> }
  const { data: roles = [] } = useRoles() as { data: Array<{ id: string; name: string }> }
  const { data: groups = [] } = useGroups() as { data: Array<{ id: string; name: string }> }

  const createCampaign = useCreateAccessReviewCampaign()
  const reviewCampaign = useAccessReviewCampaign(campaignId ?? undefined)
  const decideItem = useDecideAccessReviewItem()

  const userLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of users) {
      map.set(user.id, `${user.username} (${user.email})`)
    }
    return map
  }, [users])

  const roleLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const role of roles) {
      map.set(role.id, role.name)
    }
    return map
  }, [roles])

  const groupLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groups) {
      map.set(group.id, group.name)
    }
    return map
  }, [groups])

  const runCreateCampaign = async () => {
    setMessage(null)
    const created = await createCampaign.mutateAsync({
      name,
      description: description.trim() || undefined,
      dueAt: dueAtDate ? new Date(`${dueAtDate}T${dueAtTime || '23:59'}:00`).toISOString() : undefined
    })

    setCampaignId(created.campaign.id)
    setMessage(`Campaign created with ${created.generatedItems} generated review item(s).`)
  }

  const runDecision = async (itemId: string, decision: 'certified' | 'revoked') => {
    const rationale = window.prompt(`${decision === 'revoked' ? 'Revocation' : 'Certification'} rationale (optional):`) ?? undefined
    await decideItem.mutateAsync({
      id: itemId,
      decision,
      rationale: rationale?.trim() || undefined
    })
  }

  const payload = reviewCampaign.data

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-foreground">Access Review Campaign</h2>
        <p className="mt-1 text-sm text-muted-foreground">Generate recertification items from current role and group assignments.</p>

        <div className="mt-4 space-y-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Campaign name"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Campaign scope and reviewer guidance"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dueAtDate}
              onChange={(event) => setDueAtDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <input
              type="time"
              value={dueAtTime}
              onChange={(event) => setDueAtTime(event.target.value)}
              step={60}
              disabled={!dueAtDate}
              className="h-9 w-full rounded-lg border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-muted/50 disabled:text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">Due date is optional. Select date first, then time.</p>
          <button
            onClick={runCreateCampaign}
            disabled={createCampaign.isPending || name.trim().length < 3}
            className="inline-flex h-9 items-center rounded-lg bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {createCampaign.isPending ? 'Generating…' : 'Create Campaign'}
          </button>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-foreground">Campaign Items</h2>
        <p className="mt-1 text-sm text-muted-foreground">Certify or revoke each generated entitlement entry.</p>

        {!campaignId ? <p className="mt-4 text-sm text-muted-foreground">Create a campaign to load review items.</p> : null}
        {reviewCampaign.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading campaign…</p> : null}
        {payload?.campaign ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {payload.campaign.name} • {payload.campaign.status} • {payload.items.length} item(s)
            </p>
            {payload.items.length === 0 ? <p className="text-sm text-muted-foreground">No assignments are currently in scope.</p> : null}
            {payload.items.map((item) => {
              const subjectLabel = userLabelById.get(item.subjectUserId) ?? item.subjectUserId
              const entitlementLabel = item.entitlementType === 'role'
                ? (roleLabelById.get(item.entitlementValue) ?? item.entitlementValue)
                : (groupLabelById.get(item.entitlementValue) ?? item.entitlementValue)

              return (
                <div key={item.id} className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.entitlementType}: {entitlementLabel}</p>
                    <StatusBadge tone={item.decision === 'certified' ? 'success' : item.decision === 'revoked' ? 'danger' : 'warning'}>
                      {item.decision ?? 'pending'}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Subject: {subjectLabel}</p>
                  {item.decision ? (
                    <p className="mt-1 text-xs text-muted-foreground">Decision recorded at {new Date(item.updatedAt).toLocaleString()}</p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => runDecision(item.id, 'certified')}
                        disabled={decideItem.isPending}
                        className="rounded border border-emerald-200 bg-card px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Certify
                      </button>
                      <button
                        onClick={() => runDecision(item.id, 'revoked')}
                        disabled={decideItem.isPending}
                        className="rounded border border-rose-200 bg-card px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
import StatusBadge from './ui/StatusBadge'
