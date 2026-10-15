import { useMemo, useState } from 'react'
import { Box, Button, Group, Paper, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { SectionCard, StatusBadge } from '@nexus/design'
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
    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
      <SectionCard
        title="Access review campaign"
        description="Generate recertification items from current role and group assignments."
      >
        <Stack gap="sm">
          <TextInput
            aria-label="Campaign name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Campaign name"
          />
          <Textarea
            aria-label="Campaign description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            autosize
            minRows={3}
            placeholder="Campaign scope and reviewer guidance"
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput
              type="date"
              aria-label="Due date"
              value={dueAtDate}
              onChange={(event) => setDueAtDate(event.currentTarget.value)}
            />
            <TextInput
              type="time"
              aria-label="Due time"
              value={dueAtTime}
              onChange={(event) => setDueAtTime(event.currentTarget.value)}
              step={60}
              disabled={!dueAtDate}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">Due date is optional. Select date first, then time.</Text>
          <Box>
            <Button
              onClick={runCreateCampaign}
              loading={createCampaign.isPending}
              disabled={name.trim().length < 3}
            >
              Create campaign
            </Button>
          </Box>
          {message ? <Text size="xs" c="dimmed">{message}</Text> : null}
        </Stack>
      </SectionCard>

      <SectionCard
        title="Campaign items"
        description="Certify or revoke each generated entitlement entry."
        loading={reviewCampaign.isLoading}
      >
        {!campaignId ? <Text size="sm" c="dimmed">Create a campaign to load review items.</Text> : null}
        {payload?.campaign ? (
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              {payload.campaign.name} • {payload.campaign.status} • {payload.items.length} item(s)
            </Text>
            {payload.items.length === 0 ? <Text size="sm" c="dimmed">No assignments are currently in scope.</Text> : null}
            {payload.items.map((item) => {
              const subjectLabel = userLabelById.get(item.subjectUserId) ?? item.subjectUserId
              const entitlementLabel = item.entitlementType === 'role'
                ? (roleLabelById.get(item.entitlementValue) ?? item.entitlementValue)
                : (groupLabelById.get(item.entitlementValue) ?? item.entitlementValue)

              return (
                <Paper key={item.id} withBorder p="sm" radius="md" bg="var(--nx-color-surface-sunken)">
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" fw={500}>{item.entitlementType}: {entitlementLabel}</Text>
                    <StatusBadge status={item.decision === 'certified' ? 'approved' : item.decision === 'revoked' ? 'revoked' : 'pending'}>
                      {item.decision ?? 'pending'}
                    </StatusBadge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>Subject: {subjectLabel}</Text>
                  {item.decision ? (
                    <Text size="xs" c="dimmed" mt={4}>Decision recorded at {new Date(item.updatedAt).toLocaleString()}</Text>
                  ) : (
                    <Group gap="xs" mt="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="green"
                        onClick={() => runDecision(item.id, 'certified')}
                        disabled={decideItem.isPending}
                      >
                        Certify
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => runDecision(item.id, 'revoked')}
                        disabled={decideItem.isPending}
                      >
                        Revoke
                      </Button>
                    </Group>
                  )}
                </Paper>
              )
            })}
          </Stack>
        ) : null}
      </SectionCard>
    </SimpleGrid>
  )
}
