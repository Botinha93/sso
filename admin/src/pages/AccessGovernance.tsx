import AccessGovernancePanel from '../components/AccessGovernancePanel'
import AccessReviewCampaignPanel from '../components/AccessReviewCampaignPanel'

export default function AccessGovernance() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Governance</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Access Governance</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage access requests, approval workflows, and periodic access reviews to maintain least-privilege compliance and reduce access sprawl.
        </p>
      </div>

      <AccessGovernancePanel />
      <AccessReviewCampaignPanel />
    </div>
  )
}
