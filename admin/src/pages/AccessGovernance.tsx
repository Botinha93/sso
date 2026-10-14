import AccessGovernancePanel from '../components/AccessGovernancePanel'
import AccessReviewCampaignPanel from '../components/AccessReviewCampaignPanel'
import { PageHeader } from '../components/PageHeader'
import React from 'react';

export default function AccessGovernance() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Access Governance"
        description="Manage access requests, approval workflows, and periodic access reviews to maintain least-privilege compliance and reduce access sprawl."
      />

      <AccessGovernancePanel />
      <AccessReviewCampaignPanel />
    </div>
  )
}
