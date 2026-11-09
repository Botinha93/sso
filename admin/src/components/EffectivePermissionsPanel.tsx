import { useMemo, useState } from 'react'
import { Badge, Group, NativeSelect, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import { ExpiryBadge, SectionCard } from '@botinha93/nexus-design'
import { ShieldQuestion } from 'lucide-react'
import EmptyState from './EmptyState'
import {
  useGroupEffectivePermissions,
  useGroups,
  useUserEffectivePermissions,
  useUsers,
  type ApplicablePolicySummary,
} from '../hooks/useApi'

type SubjectType = 'user' | 'group'

function PermissionBadges({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) {
    return <Text size="xs" c="dimmed">No permissions</Text>
  }

  return (
    <Group gap={6} wrap="wrap">
      {permissions.map((permission) => (
        <Badge key={permission} variant="light" color="gray" size="sm" ff="monospace" tt="none">
          {permission}
        </Badge>
      ))}
    </Group>
  )
}

function PolicyList({ policies }: { policies: ApplicablePolicySummary[] }) {
  if (policies.length === 0) {
    return <Text size="xs" c="dimmed">No ABAC policies apply to this scope.</Text>
  }

  return (
    <Stack gap="xs">
      {policies.map((policy) => (
        <Paper key={policy.policyId} withBorder px="sm" py="xs" radius="sm">
          <Group gap="xs" wrap="wrap">
            <Text size="xs" ff="monospace">{policy.key}</Text>
            <Badge color={policy.effect === 'allow' ? 'green' : 'red'} variant="light" size="sm">
              {policy.effect}
            </Badge>
            <Badge color="gray" variant="light" size="sm">
              via {policy.matchedScope}
            </Badge>
            {policy.resourcePattern ? (
              <Text size="xs" c="dimmed" ff="monospace">{policy.resourcePattern} → {policy.actionPattern ?? '*'}</Text>
            ) : null}
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}

export default function EffectivePermissionsPanel() {
  const [subjectType, setSubjectType] = useState<SubjectType>('user')
  const [userId, setUserId] = useState('')
  const [groupId, setGroupId] = useState('')

  const { data: users = [] } = useUsers()
  const { data: groups = [] } = useGroups()

  const userReport = useUserEffectivePermissions(subjectType === 'user' ? userId : undefined)
  const groupReport = useGroupEffectivePermissions(subjectType === 'group' ? groupId : undefined)

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of userReport.data?.groups ?? []) {
      map.set(group.id, group.name)
    }
    return map
  }, [userReport.data])

  const isLoading = subjectType === 'user' ? userReport.isLoading : groupReport.isLoading
  const hasSubject = subjectType === 'user' ? Boolean(userId) : Boolean(groupId)

  return (
    <Stack gap="md">
      <SectionCard
        title="Subject"
        description="Pick a user or group to see every permission currently granted to it, and where each one comes from."
      >
        <Stack gap="sm">
          <SegmentedControl
            w="fit-content"
            size="xs"
            value={subjectType}
            onChange={(value) => setSubjectType(value as SubjectType)}
            data={[
              { value: 'user', label: 'User' },
              { value: 'group', label: 'Group' },
            ]}
          />
          {subjectType === 'user' ? (
            <NativeSelect
              aria-label="User"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Select user</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.id})
                </option>
              ))}
            </NativeSelect>
          ) : (
            <NativeSelect
              aria-label="Group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">Select group</option>
              {groups.map((group: any) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Stack>
      </SectionCard>

      {!hasSubject ? (
        <SectionCard title="Effective permissions">
          <EmptyState
            icon={ShieldQuestion}
            title="No subject selected"
            description="Choose a user or group above to view its effective permissions."
          />
        </SectionCard>
      ) : subjectType === 'user' ? (
        <>
          <SectionCard title="Effective permissions" loading={isLoading}>
            <PermissionBadges permissions={userReport.data?.permissions ?? []} />
          </SectionCard>

          <SectionCard title="Roles" description="Direct assignments and roles inherited via group membership." loading={isLoading}>
            {(userReport.data?.roles ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">No roles assigned.</Text>
            ) : (
              <Stack gap="xs">
                {(userReport.data?.roles ?? []).map((role) => (
                  <Paper key={role.id} withBorder px="sm" py="xs" radius="sm">
                    <Group gap="xs" wrap="wrap">
                      <Text size="sm" fw={500}>{role.name}</Text>
                      <Badge color="gray" variant="light" size="sm">{role.scope}</Badge>
                      {role.direct ? (
                        <Badge color="blue" variant="light" size="sm">Direct</Badge>
                      ) : null}
                      {role.viaGroupIds.map((id) => (
                        <Badge key={id} color="violet" variant="light" size="sm">
                          via {groupNameById.get(id) ?? id}
                        </Badge>
                      ))}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>

          <SectionCard title="Group memberships" loading={isLoading}>
            {(userReport.data?.groups ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">Not a member of any group.</Text>
            ) : (
              <Group gap={6} wrap="wrap">
                {(userReport.data?.groups ?? []).map((group) => (
                  <Badge key={group.id} variant="light" color="violet" size="sm">
                    {group.name}
                  </Badge>
                ))}
              </Group>
            )}
          </SectionCard>

          <SectionCard
            title="Active elevations"
            description="Temporary break-glass grants layered on top of the roles above."
            loading={isLoading}
          >
            {(userReport.data?.activeElevations ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">No active elevations.</Text>
            ) : (
              <Stack gap="xs">
                {(userReport.data?.activeElevations ?? []).map((elevation) => (
                  <Paper key={elevation.id} withBorder px="sm" py="xs" radius="sm">
                    <Group gap="xs" wrap="wrap">
                      <Text size="xs" ff="monospace">{elevation.resource} → {elevation.action}</Text>
                      <ExpiryBadge size="xs" expiresAt={elevation.expiresAt} />
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>

          <SectionCard
            title="Applicable ABAC policies"
            description="Policy assignments whose scope reaches this user. These need a concrete resource and action to produce an actual allow/deny — use the Decision Simulator on the Policies page for that."
            loading={isLoading}
          >
            <PolicyList policies={userReport.data?.applicablePolicies ?? []} />
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Effective permissions" loading={isLoading}>
            <PermissionBadges permissions={groupReport.data?.permissions ?? []} />
          </SectionCard>

          <SectionCard
            title="Roles"
            description={`Granted directly to this group and inherited by every member (${groupReport.data?.memberCount ?? 0} member${groupReport.data?.memberCount === 1 ? '' : 's'}).`}
            loading={isLoading}
          >
            {(groupReport.data?.roles ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">No roles assigned.</Text>
            ) : (
              <Stack gap="xs">
                {(groupReport.data?.roles ?? []).map((role) => (
                  <Paper key={role.id} withBorder px="sm" py="xs" radius="sm">
                    <Group gap="xs" wrap="wrap">
                      <Text size="sm" fw={500}>{role.name}</Text>
                      <Badge color="gray" variant="light" size="sm">{role.scope}</Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>

          <SectionCard
            title="Applicable ABAC policies"
            description="Policy assignments whose scope reaches this group. These need a concrete resource and action to produce an actual allow/deny — use the Decision Simulator on the Policies page for that."
            loading={isLoading}
          >
            <PolicyList policies={groupReport.data?.applicablePolicies ?? []} />
          </SectionCard>
        </>
      )}
    </Stack>
  )
}
