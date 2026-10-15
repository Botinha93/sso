import ElevationPanel from '../components/ElevationPanel'
import { PageHeader } from '@nexus/design'
import React from 'react';

export default function Elevations() {
  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Elevation Operations"
        description="Request, approve, activate, revoke, and emergency break-glass privileged elevation workflows."
      />

      <ElevationPanel />
    </>
  )
}
