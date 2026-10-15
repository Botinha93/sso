import { useMemo, useState } from 'react'
import { Alert, Button, Code, Group, Paper, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core'
import { CopyField, SectionCard, StatusBadge } from '@nexus/design'
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import {
  useCreateProvisioningMapping,
  useCreateProvisioningToken,
  useDeleteProvisioningMapping,
  useDeleteProvisioningToken,
  useDeprovisioningQueue,
  useProvisioningJobs,
  useProvisioningMappings,
  useProvisioningTokens,
  useRunProvisioningReconcile,
  type DeprovisioningQueueItemDto
} from '../hooks/useApi'


export default function ProvisioningAdminPanel() {
  const { data: tokens = [] } = useProvisioningTokens()
  const { data: mappings = [] } = useProvisioningMappings()
  const { data: jobs = [] } = useProvisioningJobs(15)
  const { data: deprovisioningQueue = [] } = useDeprovisioningQueue(20)
  const createToken = useCreateProvisioningToken()
  const deleteToken = useDeleteProvisioningToken()
  const createMapping = useCreateProvisioningMapping()
  const deleteMapping = useDeleteProvisioningMapping()
  const runReconcile = useRunProvisioningReconcile()

  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiryDate, setTokenExpiryDate] = useState('')
  const [tokenExpiryTime, setTokenExpiryTime] = useState('23:59')
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [sourceAttribute, setSourceAttribute] = useState('')
  const [targetAttribute, setTargetAttribute] = useState('')
  const [transformExpression, setTransformExpression] = useState('')

  const latestJob = useMemo(() => jobs[0], [jobs])

  const getStatusIcon = (status: DeprovisioningQueueItemDto['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} color="var(--mantine-color-green-6)" />
      case 'failed':
        return <XCircle size={16} color="var(--mantine-color-red-6)" />
      case 'in_progress':
        return <Clock size={16} color="var(--mantine-color-blue-6)" />
      default:
        return <AlertCircle size={16} color="var(--mantine-color-yellow-6)" />
    }
  }

  const createNewToken = async () => {
    setIssuedToken(null)
    const expiresAt = tokenExpiryDate
      ? new Date(`${tokenExpiryDate}T${tokenExpiryTime || '23:59'}:00`).toISOString()
      : undefined

    const created = await createToken.mutateAsync({
      label: tokenLabel,
      expiresAt
    })
    setIssuedToken(created.token)
    setTokenLabel('')
    setTokenExpiryDate('')
    setTokenExpiryTime('23:59')
  }

  const createNewMapping = async () => {
    await createMapping.mutateAsync({
      name: mappingName,
      sourceAttribute,
      targetAttribute,
      transformExpression: transformExpression || undefined,
      enabled: true
    })
    setMappingName('')
    setSourceAttribute('')
    setTargetAttribute('')
    setTransformExpression('')
  }

  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
      <SectionCard
        title="SCIM provisioning tokens"
        description="Issue one-time display bearer tokens for directory connectors and revoke them when rotating integrations."
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              value={tokenLabel}
              onChange={(event) => setTokenLabel(event.currentTarget.value)}
              placeholder="okta-prod"
              aria-label="Token label"
            />
            <SimpleGrid cols={2} spacing="xs">
              <TextInput
                type="date"
                value={tokenExpiryDate}
                onChange={(event) => setTokenExpiryDate(event.currentTarget.value)}
                aria-label="Expiry date"
              />
              <TextInput
                type="time"
                value={tokenExpiryTime}
                onChange={(event) => setTokenExpiryTime(event.currentTarget.value)}
                step={60}
                disabled={!tokenExpiryDate}
                aria-label="Expiry time"
              />
            </SimpleGrid>
          </SimpleGrid>
          <Text size="xs" c="dimmed">Expiry is optional. Pick a date first, then an end time.</Text>
          <Group>
            <Button
              onClick={createNewToken}
              disabled={tokenLabel.trim().length < 2}
              loading={createToken.isPending}
            >
              Issue token
            </Button>
          </Group>

          {issuedToken ? (
            <Alert color="yellow" icon={<AlertTriangle size={16} />} title="Copy now, this token is shown once">
              <CopyField value={issuedToken} />
            </Alert>
          ) : null}

          <Stack gap="xs">
            {tokens.length === 0 ? <Text size="sm" c="dimmed">No provisioning tokens yet.</Text> : null}
            {tokens.map((token) => (
              <Paper key={token.id} withBorder radius="md" px="sm" py="xs" bg="var(--nx-color-surface-sunken)">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={500}>{token.label}</Text>
                    <Text size="xs" c="dimmed">Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'}</Text>
                  </div>
                  <Button
                    size="xs"
                    variant="default"
                    c="red"
                    onClick={() => deleteToken.mutate(token.id)}
                    disabled={deleteToken.isPending}
                  >
                    Revoke
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Provisioning mappings"
        description="Map external directory attributes into local profile fields for lifecycle sync."
      >
        <Stack gap="md">
          <Stack gap="xs">
            <TextInput
              value={mappingName}
              onChange={(event) => setMappingName(event.currentTarget.value)}
              placeholder="Workday manager mapping"
              aria-label="Mapping name"
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <TextInput
                value={sourceAttribute}
                onChange={(event) => setSourceAttribute(event.currentTarget.value)}
                placeholder="urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager"
                aria-label="Source attribute"
              />
              <TextInput
                value={targetAttribute}
                onChange={(event) => setTargetAttribute(event.currentTarget.value)}
                placeholder="customAttributes.managerId"
                aria-label="Target attribute"
              />
            </SimpleGrid>
            <TextInput
              value={transformExpression}
              onChange={(event) => setTransformExpression(event.currentTarget.value)}
              placeholder="value?.toLowerCase()"
              aria-label="Transform expression"
            />
            <Group>
              <Button
                onClick={createNewMapping}
                disabled={mappingName.trim().length < 2 || sourceAttribute.trim().length === 0 || targetAttribute.trim().length === 0}
                loading={createMapping.isPending}
              >
                Add mapping
              </Button>
            </Group>
          </Stack>

          <Stack gap="xs">
            {mappings.length === 0 ? <Text size="sm" c="dimmed">No mappings configured.</Text> : null}
            {mappings.map((mapping) => (
              <Paper key={mapping.id} withBorder radius="md" p="sm" bg="var(--nx-color-surface-sunken)">
                <Group justify="space-between" gap="sm" wrap="nowrap">
                  <Text size="sm" fw={500}>{mapping.name}</Text>
                  <Button
                    size="xs"
                    variant="default"
                    c="red"
                    onClick={() => deleteMapping.mutate(mapping.id)}
                    disabled={deleteMapping.isPending}
                  >
                    Delete
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mt={4} ff="monospace" style={{ wordBreak: 'break-all' }}>
                  {mapping.sourceAttribute} → {mapping.targetAttribute}
                </Text>
                {mapping.transformExpression ? <Text size="xs" c="dimmed" mt={4}>Transform: {mapping.transformExpression}</Text> : null}
              </Paper>
            ))}
          </Stack>

          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" gap="xs">
              <Text size="sm" fw={500}>Run reconciliation</Text>
              <Button
                size="xs"
                variant="default"
                onClick={() => runReconcile.mutate({ dryRun: true })}
                loading={runReconcile.isPending}
              >
                Run dry-run
              </Button>
            </Group>
            {latestJob ? (
              <Text size="xs" c="dimmed" mt="xs">
                Last job: {latestJob.status} at {new Date(latestJob.createdAt).toLocaleString()} ({String((latestJob.summary as Record<string, unknown>).usersEvaluated ?? 0)} users scanned)
              </Text>
            ) : (
              <Text size="xs" c="dimmed" mt="xs">No reconcile jobs yet.</Text>
            )}
          </Paper>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Deprovisioning queue"
        description="Monitor pending revocation and deactivation tasks from provisioning sync operations."
        flush
        style={{ gridColumn: '1 / -1' }}
      >
        {deprovisioningQueue.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            No pending deprovisioning tasks.
          </Text>
        ) : (
          <>
            <Table.ScrollContainer minWidth={820}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Resource</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Created</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {deprovisioningQueue.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          {getStatusIcon(item.status)}
                          <StatusBadge status={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}>
                            {item.status}
                          </StatusBadge>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs" c="dimmed" ff="monospace">{item.userId.slice(0, 12)}…</Text></Table.Td>
                      <Table.Td><Code>{item.action}</Code></Table.Td>
                      <Table.Td><Text size="sm" truncate>{item.resourceName}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{item.reason || '—'}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{new Date(item.createdAt).toLocaleString()}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {deprovisioningQueue.length > 10 && (
              <Text size="xs" c="dimmed" px="md" py="sm">Showing {deprovisioningQueue.length} tasks. Older tasks are automatically cleaned after completion.</Text>
            )}
          </>
        )}

        {deprovisioningQueue.some(item => item.status === 'failed') && (
          <Alert color="red" icon={<AlertTriangle size={16} />} title="Failed deprovisioning tasks detected" m="md">
            Some deprovisioning operations have failed and may require manual intervention.
          </Alert>
        )}
      </SectionCard>
    </SimpleGrid>
  )
}
