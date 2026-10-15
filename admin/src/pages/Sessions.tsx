import { ShieldOff, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { ActionIcon, Group, Stack, Table, Text, Tooltip } from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, StatusBadge, TableSkeleton } from '@nexus/design'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSessions, useRevokeSession } from '../hooks/useApi'

interface Session {
  id: string
  userId: string
  clientId: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
}

const Sessions = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: sessions, isLoading, isFetching, refetch } = useSessions(debouncedSearch)
  const revokeSession = useRevokeSession()
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setSessionToRevoke(id)
  }

  const confirmRevoke = () => {
    if (!sessionToRevoke) return
    revokeSession.mutate(sessionToRevoke, { onSuccess: () => setSessionToRevoke(null) })
  }

  return (
    <>
      <PageHeader eyebrow="Session Management" title="Active Sessions" />

      <SectionCard
        flush
        title="All Sessions"
        actions={
          <Group gap="sm" wrap="nowrap">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search sessions by user or client…"
              w={{ base: '100%', xs: 300 }}
              maw={360}
            />
            <RefreshButton variant="icon" loading={isFetching} onRefresh={() => refetch()} lastUpdated={null} />
          </Group>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} columns={['mono', 'mono', 'mono', 'text', 'text', 'pill', 'action']} p="md" />
        ) : !sessions?.length ? (
          <EmptyState
            icon={MonitorSmartphone}
            title="No sessions found"
            description="Active sessions will appear here once users authenticate."
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Session</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={56} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((session: Session) => {
                  const isRevoked = !!session.revokedAt
                  const isExpired = new Date(session.expiresAt) < new Date()
                  return (
                    <Table.Tr key={session.id}>
                      <Table.Td>
                        <Text size="sm" fw={500} ff="monospace">{session.id.slice(0, 16)}…</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ff="monospace" c="dimmed">{session.userId.slice(0, 8)}…</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ff="monospace">{session.clientId}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{new Date(session.createdAt).toLocaleString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{new Date(session.expiresAt).toLocaleString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        {isRevoked ? (
                          <StatusBadge status="revoked">Revoked</StatusBadge>
                        ) : isExpired ? (
                          <StatusBadge status="expired">Expired</StatusBadge>
                        ) : (
                          <StatusBadge status="active">Active</StatusBadge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {!isRevoked && !isExpired && (
                          <Stack align="flex-end">
                            <Tooltip label="Revoke session">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleRevoke(session.id)}
                                disabled={revokeSession.isPending}
                                aria-label="Revoke session"
                              >
                                <ShieldOff size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Stack>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <ConfirmDialog
        isOpen={!!sessionToRevoke}
        title="Revoke Session"
        message="Revoke this session? The user will be signed out immediately."
        confirmLabel="Revoke Session"
        pending={revokeSession.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setSessionToRevoke(null)}
      />
    </>
  )
}

export default Sessions
