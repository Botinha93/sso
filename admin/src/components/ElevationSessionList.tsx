import { useState } from 'react'
import { Group, NativeSelect, Paper, Stack, Text } from '@mantine/core'
import { Clock3 } from 'lucide-react'
import { ExpiryBadge, SectionCard, StatusBadge } from '@nexus/design'
import { useElevationSessions, type ElevationSessionDto } from '../hooks/useApi'

const statusLabels: Record<ElevationSessionDto['status'], string> = {
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired'
}

export default function ElevationSessionList() {
  const [statusFilter, setStatusFilter] = useState<ElevationSessionDto['status'] | undefined>('active')
  const { data: sessions = [], isLoading } = useElevationSessions(statusFilter)

  return (
    <SectionCard
      title="Elevation sessions"
      loading={isLoading}
      actions={
        <NativeSelect
          size="xs"
          aria-label="Filter sessions by status"
          value={statusFilter ?? ''}
          onChange={e => setStatusFilter((e.currentTarget.value as ElevationSessionDto['status']) || undefined)}
          data={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'revoked', label: 'Revoked' },
            { value: 'expired', label: 'Expired' }
          ]}
        />
      }
    >
      {sessions.length === 0 ? (
        <Text size="sm" c="dimmed">No elevation sessions found.</Text>
      ) : (
        <Stack gap="sm">
          {sessions.map(session => (
            <Paper key={session.id} withBorder p="sm" radius="md" bg="var(--nx-color-surface-sunken)">
              <Stack gap={6}>
                <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                  <Text size="sm">
                    <Text span ff="monospace" inherit>{session.resource}</Text>
                    {' → '}
                    <Text span ff="monospace" inherit>{session.action}</Text>
                  </Text>
                  <StatusBadge status={session.status}>{statusLabels[session.status]}</StatusBadge>
                </Group>
                <Group gap={4}>
                  <Clock3 size={14} color="var(--nx-color-text-muted)" />
                  <Text size="xs" c="dimmed">Started {new Date(session.startedAt).toLocaleString()}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">Expires {new Date(session.expiresAt).toLocaleString()}</Text>
                  {session.status === 'active' ? <ExpiryBadge size="xs" expiresAt={session.expiresAt} /> : null}
                </Group>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </SectionCard>
  )
}
