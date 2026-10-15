import { useMemo, useState } from 'react'
import { Group, NativeSelect, Stack, Table, Text } from '@mantine/core'
import { Clock3, ShieldAlert } from 'lucide-react'
import { ExpiryBadge, PageHeader, SectionCard, StatGroup, StatusBadge, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import { type ElevationSessionDto, useElevationSessions } from '../hooks/useApi'
import React from 'react';

export default function ElevationSessions() {
  const [status, setStatus] = useState<ElevationSessionDto['status'] | 'all'>('active')
  const { data: sessions = [], isLoading } = useElevationSessions(status === 'all' ? undefined : status)

  const stats = useMemo(() => {
    return sessions.reduce(
      (acc, session) => {
        acc.total += 1
        acc[session.status] += 1
        return acc
      },
      { total: 0, active: 0, revoked: 0, expired: 0 }
    )
  }, [sessions])

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Elevation Sessions"
        description="Inspect active and historical privileged sessions created through elevation approvals and emergency break-glass operations."
        actions={
          <NativeSelect
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as ElevationSessionDto['status'] | 'all')}
            data={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'revoked', label: 'Revoked' },
              { value: 'expired', label: 'Expired' }
            ]}
          />
        }
      />

      <StatGroup>
        <StatGroup.Item label="Total" value={stats.total} loading={isLoading} />
        <StatGroup.Item label="Active" value={stats.active} tone="green" loading={isLoading} />
        <StatGroup.Item label="Revoked" value={stats.revoked} tone="red" loading={isLoading} />
        <StatGroup.Item label="Expired" value={stats.expired} loading={isLoading} />
      </StatGroup>

      <SectionCard title="Session timeline" flush>
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No elevation sessions found"
            description="Privilege escalation sessions will appear here."
          />
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Permission</Table.Th>
                  <Table.Th>Session</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((session) => (
                  <Table.Tr key={session.id}>
                    <Table.Td>
                      <Text size="sm">
                        <Text span ff="monospace" inherit>{session.resource}</Text>
                        <Text span c="dimmed" mx={4} inherit>→</Text>
                        <Text span ff="monospace" inherit>{session.action}</Text>
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" ff="monospace">session {session.id.slice(0, 12)}...</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Clock3 size={14} color="var(--nx-color-text-muted)" />
                        <Text size="xs" c="dimmed">Started {new Date(session.startedAt).toLocaleString()}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        {session.status === 'active' ? <ExpiryBadge expiresAt={session.expiresAt} /> : null}
                        <Text size="xs" c="dimmed">Expires {new Date(session.expiresAt).toLocaleString()}</Text>
                        {session.endedAt ? <Text size="xs" c="dimmed">Ended {new Date(session.endedAt).toLocaleString()}</Text> : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={session.status}>{session.status}</StatusBadge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>
    </>
  )
}
