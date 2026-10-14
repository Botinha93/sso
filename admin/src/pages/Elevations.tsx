import ElevationPanel from '../components/ElevationPanel'
import { PageHeader } from '../components/PageHeader'
import React from 'react';

export default function Elevations() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Elevation Operations"
        description="Request, approve, activate, revoke, and emergency break-glass privileged elevation workflows."
      />

      <ElevationPanel />
    </div>
  )
}