import { PageHeader } from '@botinha93/nexus-design'
import EffectivePermissionsPanel from '../components/EffectivePermissionsPanel'

export default function EffectivePermissions() {
  return (
    <>
      <PageHeader
        eyebrow="Identity & Access"
        title="Effective Permissions"
        description="See exactly what a user or group can do today: resolved roles, inherited group permissions, applicable ABAC policies, and active elevations in one place."
      />

      <EffectivePermissionsPanel />
    </>
  )
}
