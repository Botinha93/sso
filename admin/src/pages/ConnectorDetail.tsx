import { Button, Group, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import { PageHeader, RefreshButton, SectionCard, StatusBadge, type Status } from '@nexus/design'
import {
  useConnector,
  useConnectorRuns,
  useConnectorMappings,
  useTriggerConnectorSync,
  type ConnectorRunDto,
} from '../hooks/useApi'

const RUN_STATUS: Record<ConnectorRunDto['status'], Status> = {
  pending: 'pending',
  running: 'running',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
}

export default function ConnectorDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: connector, isLoading } = useConnector(id)
  const { data: runsData, isFetching: isRunsRefreshing, refetch: refetchRuns } = useConnectorRuns(id)
  const { data: mappingsData, isFetching: isMappingsRefreshing, refetch: refetchMappings } = useConnectorMappings(id)
  const triggerSync = useTriggerConnectorSync()

  if (!id) {
    return <Text size="sm" c="dimmed">Missing connector id.</Text>
  }

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton h={56} w={288} />
        <Skeleton h={192} />
      </Stack>
    )
  }

  if (!connector) {
    return <Text size="sm" c="dimmed">Connector not found.</Text>
  }

  const runs = runsData?.data ?? []
  const mappings = mappingsData?.data ?? []
  const isRefreshing = isRunsRefreshing || isMappingsRefreshing

  return (
    <>
      <PageHeader
        eyebrow="Data Sync"
        title={connector.name}
        description={`Connector detail for ${connector.type.toUpperCase()} (${connector.id})`}
        actions={
          <Group gap="xs">
            <Button component={Link} to="/connectors" variant="default" leftSection={<ArrowLeft size={16} />}>
              Back
            </Button>
            <RefreshButton
              onRefresh={() => { refetchRuns(); refetchMappings() }}
              loading={isRefreshing}
              lastUpdated={null}
            />
            <Button
              onClick={() => triggerSync.mutate(id)}
              loading={triggerSync.isPending}
              leftSection={<Play size={16} />}
            >
              Trigger Sync
            </Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <SectionCard title="Recent Runs">
          <Stack gap="xs">
            {runs.length === 0 ? (
              <Text size="sm" c="dimmed">No runs yet.</Text>
            ) : runs.map((run) => (
              <Paper key={run.id} withBorder radius="md" p="sm" bg="var(--nx-color-surface-sunken)">
                <Group justify="space-between" wrap="nowrap">
                  <StatusBadge status={RUN_STATUS[run.status] ?? 'neutral'}>{run.status}</StatusBadge>
                  <Text size="xs" c="dimmed" ff="monospace">{run.id.slice(0, 8)}</Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4} className="nx-tabular">
                  Imported {run.recordsImported} · Failed {run.recordsFailed}
                </Text>
              </Paper>
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Field Mappings">
          <Stack gap="xs">
            {mappings.length === 0 ? (
              <Text size="sm" c="dimmed">No mappings configured.</Text>
            ) : mappings.map((mapping) => (
              <Paper key={mapping.id} withBorder radius="md" p="sm" bg="var(--nx-color-surface-sunken)">
                <Text size="sm" ff="monospace">{mapping.sourceField} -&gt; {mapping.targetField}</Text>
                {mapping.transform ? <Text size="xs" c="dimmed" mt={4}>Transform: {mapping.transform}</Text> : null}
              </Paper>
            ))}
          </Stack>
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
