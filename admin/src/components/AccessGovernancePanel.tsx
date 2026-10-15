import { useMemo, useState } from 'react'
import { Box, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { SectionCard, StatusBadge } from '@nexus/design'
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


type AccessRequestStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

const requestStatusTone: Record<Exclude<AccessRequestStatusFilter, 'all'>, string> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'denied',
  expired: 'expired',
  cancelled: 'canceled'
}

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
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <SectionCard
          title="Access request intake"
          description="Create lightweight governance requests before assignment approval workflows are introduced."
        >
          <Stack gap="sm">
            <NativeSelect
              aria-label="Target user"
              value={subjectUserId}
              onChange={(event) => setSubjectUserId(event.currentTarget.value)}
              data={[
                { value: '', label: 'Select target user' },
                ...users.map((user) => ({ value: user.id, label: `${user.username} (${user.email})` }))
              ]}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <NativeSelect
                aria-label="Entitlement type"
                value={entitlementType}
                onChange={(event) => {
                  setEntitlementType(event.currentTarget.value)
                  setEntitlementValue('')
                }}
                data={[
                  { value: 'role', label: 'Role' },
                  { value: 'group', label: 'Group' }
                ]}
              />
              <NativeSelect
                aria-label="Entitlement"
                value={entitlementValue}
                onChange={(event) => setEntitlementValue(event.currentTarget.value)}
                data={[
                  { value: '', label: `Select ${entitlementType}` },
                  ...entitlementOptions.map((option) => ({ value: option.id, label: option.name }))
                ]}
              />
            </SimpleGrid>

            <Textarea
              aria-label="Justification"
              value={justification}
              onChange={(event) => setJustification(event.currentTarget.value)}
              autosize
              minRows={3}
              placeholder="Why this access is needed"
            />

            <SimpleGrid cols={2} spacing="sm">
              <TextInput
                type="date"
                aria-label="Expiration date"
                value={expiresAtDate}
                onChange={(event) => setExpiresAtDate(event.currentTarget.value)}
              />
              <TextInput
                type="time"
                aria-label="Expiration time"
                value={expiresAtTime}
                onChange={(event) => setExpiresAtTime(event.currentTarget.value)}
                step={60}
                disabled={!expiresAtDate}
              />
            </SimpleGrid>
            <Text size="xs" c="dimmed">Expiration is optional. Select date first, then time.</Text>

            <Box>
              <Button
                onClick={submitRequest}
                loading={createAccessRequest.isPending}
                disabled={!subjectUserId || entitlementType.trim().length === 0 || entitlementValue.trim().length === 0 || justification.trim().length < 3}
              >
                Create access request
              </Button>
            </Box>
          </Stack>
        </SectionCard>

        <SectionCard
          title="Recent access requests"
          description="Track pending and finalized requests for audit-ready visibility."
          actions={
            <NativeSelect
              size="xs"
              aria-label="Filter requests by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.currentTarget.value as AccessRequestStatusFilter)}
              data={[
                { value: 'all', label: 'All statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          }
        >
          <Stack gap="sm">
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                onClick={() => sweepExpiredRequests(true)}
                disabled={processExpiredAccessRequests.isPending}
              >
                Dry-run expiration sweep
              </Button>
              <Button
                size="xs"
                onClick={() => sweepExpiredRequests(false)}
                disabled={processExpiredAccessRequests.isPending}
              >
                Run expiration sweep
              </Button>
            </Group>
            {sweepMessage ? <Text size="xs" c="dimmed">{sweepMessage}</Text> : null}
            {requests.length === 0 ? <Text size="sm" c="dimmed">No access requests found for this filter.</Text> : null}
            {requests.map((request) => {
              const subject = usersById.get(request.subjectUserId)
              return (
                <Paper key={request.id} withBorder p="sm" radius="md" bg="var(--nx-color-surface-sunken)">
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" fw={500}>{request.entitlementType}: {request.entitlementValue}</Text>
                    <StatusBadge status={requestStatusTone[request.status] ?? 'pending'}>{request.status}</StatusBadge>
                  </Group>
                  <Stack gap={2} mt={4}>
                    <Text size="xs" c="dimmed">Subject: {subject ? `${subject.username} (${subject.email})` : request.subjectUserId}</Text>
                    <Text size="xs" c="dimmed">Justification: {request.justification}</Text>
                    <Text size="xs" c="dimmed">Created: {new Date(request.createdAt).toLocaleString()}</Text>
                    {request.expiresAt ? <Text size="xs" c="dimmed">Expires: {new Date(request.expiresAt).toLocaleString()}</Text> : null}
                  </Stack>
                  {request.status === 'pending' ? (
                    <Group gap="xs" mt="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="green"
                        onClick={() => approveRequest(request.id)}
                        disabled={approveAccessRequest.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => rejectRequest(request.id)}
                        disabled={rejectAccessRequest.isPending}
                      >
                        Reject
                      </Button>
                    </Group>
                  ) : null}
                </Paper>
              )
            })}
          </Stack>
        </SectionCard>
      </SimpleGrid>

      {/* Stalled Requests */}
      <SectionCard
        title="Stalled access requests"
        description="Pending requests that have not been acted on within the threshold — may need escalation."
        actions={
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed">Stalled after</Text>
            <NativeSelect
              size="xs"
              aria-label="Stalled after"
              value={String(stalledAfterMinutes)}
              onChange={e => setStalledAfterMinutes(Number(e.currentTarget.value))}
              data={[
                { value: '30', label: '30 min' },
                { value: '60', label: '1 hr' },
                { value: '240', label: '4 hrs' },
                { value: '1440', label: '24 hrs' },
                { value: '10080', label: '7 days' }
              ]}
            />
          </Group>
        }
      >
        {stalledRequests.length === 0 ? (
          <Text size="sm" c="dimmed">No stalled requests in this window.</Text>
        ) : (
          <Stack gap="sm">
            {stalledRequests.map((request: any) => {
              const subject = usersById.get(request.subjectUserId)
              return (
                <Paper
                  key={request.id}
                  withBorder
                  p="sm"
                  radius="md"
                  bg="var(--mantine-color-yellow-light)"
                >
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" fw={500}>{request.entitlementType}: {request.entitlementValue}</Text>
                    <StatusBadge status="warning">stalled</StatusBadge>
                  </Group>
                  <Stack gap={2} mt={4}>
                    <Text size="xs" c="dimmed">Subject: {subject ? `${subject.username} (${subject.email})` : request.subjectUserId}</Text>
                    <Text size="xs" c="dimmed">Justification: {request.justification}</Text>
                    <Text size="xs" c="dimmed">Created: {new Date(request.createdAt).toLocaleString()}</Text>
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  )
}
