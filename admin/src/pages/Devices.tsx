import { Clock, Layers, MonitorSmartphone, ShieldOff, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { ActionIcon, Badge, Box, Group, SimpleGrid, Stack, Table, Text, Tooltip } from '@mantine/core'
import { PageHeader, RefreshButton, SectionCard, StatCard, StatusBadge, TableSkeleton } from '@nexus/design'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'

import { useDevices, useRevokeDeviceRequest, useRevokeDeviceSession } from '../hooks/useApi'

interface DeviceRequest {
  deviceCode: string
  userCode: string
  clientId: string
  clientName: string
  userId?: string
  scope: string[]
  createdAt: string
  expiresAt: string
  status: 'pending' | 'approved' | 'denied'
  lastPolledAt?: string
}

interface DeviceSession {
  id: string
  clientId: string
  clientName: string
  userId: string
  createdAt: string
  expiresAt: string
  revokedAt?: string
  status: 'active' | 'expired' | 'revoked'
}

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Never'

export default function Devices() {
  const { data, isLoading, isFetching, refetch } = useDevices()
  const revokeRequest = useRevokeDeviceRequest()
  const revokeSession = useRevokeDeviceSession()
  const [requestToRevoke, setRequestToRevoke] = useState<string | null>(null)
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null)

  const requests = ((data as { requests?: DeviceRequest[] } | undefined)?.requests ?? []) as DeviceRequest[]
  const sessions = ((data as { sessions?: DeviceSession[] } | undefined)?.sessions ?? []) as DeviceSession[]

  const confirmRequestRevoke = () => {
    if (!requestToRevoke) return
    revokeRequest.mutate(requestToRevoke, { onSuccess: () => setRequestToRevoke(null) })
  }

  const confirmSessionRevoke = () => {
    if (!sessionToRevoke) return
    revokeSession.mutate(sessionToRevoke, { onSuccess: () => setSessionToRevoke(null) })
  }

  return (
    <>
      <PageHeader
        eyebrow="Device Access"
        title="Devices"
        description="Monitor pending device authorization requests and revoke device-issued sessions from one place."
        actions={
          <RefreshButton loading={isFetching} onRefresh={() => refetch()} lastUpdated={null} />
        }
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <StatCard
          label="Pending Requests"
          value={requests.filter((item) => item.status === 'pending').length}
          icon={<Clock size={16} />}
          iconColor="yellow"
          loading={isLoading}
        />
        <StatCard
          label="Active Device Sessions"
          value={sessions.filter((item) => item.status === 'active').length}
          icon={<Smartphone size={16} />}
          iconColor="green"
          loading={isLoading}
        />
        <StatCard
          label="Managed Clients"
          value={new Set([...requests.map((item) => item.clientId), ...sessions.map((item) => item.clientId)]).size}
          icon={<Layers size={16} />}
          loading={isLoading}
        />
      </SimpleGrid>

      <SectionCard
        flush
        title="Pending Device Requests"
        description="Requests waiting for approval, already approved, or denied before token exchange."
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={['text', 'mono', 'mono', 'pill', 'text', 'action']} p="md" label="Loading device requests…" />
        ) : !requests.length ? (
          <EmptyState icon={MonitorSmartphone} title="No device requests found" />
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Codes</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Scopes</Table.Th>
                  <Table.Th>Timing</Table.Th>
                  <Table.Th w={56} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {requests.map((request) => (
                  <Table.Tr key={request.deviceCode}>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={500}>{request.clientName}</Text>
                          <StatusBadge status={request.status}>{request.status}</StatusBadge>
                        </Group>
                        <Text size="xs" c="dimmed" ff="monospace">{request.clientId}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">User code {request.userCode}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">Device {request.deviceCode.slice(0, 16)}…</Text>
                    </Table.Td>
                    <Table.Td>
                      {request.userId ? (
                        <Text size="xs" ff="monospace" c="dimmed">{request.userId.slice(0, 12)}…</Text>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {request.scope.map((scope) => (
                          <Badge key={scope} color="gray" variant="light" ff="monospace" tt="none">{scope}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">Created {formatDate(request.createdAt)}</Text>
                      <Text size="xs" c="dimmed">Expires {formatDate(request.expiresAt)}</Text>
                      <Text size="xs" c="dimmed">Last poll {formatDate(request.lastPolledAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        <Tooltip label="Revoke device request">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setRequestToRevoke(request.deviceCode)}
                            disabled={revokeRequest.isPending}
                            aria-label="Revoke device request"
                          >
                            <ShieldOff size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <SectionCard
        flush
        title="Device Sessions"
        description="Sessions issued through clients that support the device_code grant."
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={['text', 'mono', 'mono', 'text', 'action']} p="md" label="Loading device sessions…" />
        ) : !sessions.length ? (
          <EmptyState icon={MonitorSmartphone} title="No device sessions found" />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Session</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Timing</Table.Th>
                  <Table.Th w={56} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((session) => (
                  <Table.Tr key={session.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Box c="dimmed" style={{ display: 'flex' }}>
                          <MonitorSmartphone size={16} />
                        </Box>
                        <Stack gap={4}>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={500}>{session.clientName}</Text>
                            <StatusBadge status={session.status}>{session.status}</StatusBadge>
                          </Group>
                          <Text size="xs" c="dimmed" ff="monospace">{session.clientId}</Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">{session.id.slice(0, 16)}…</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="dimmed">{session.userId.slice(0, 12)}…</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">Created {formatDate(session.createdAt)}</Text>
                      <Text size="xs" c="dimmed">Expires {formatDate(session.expiresAt)}</Text>
                      {session.revokedAt ? <Text size="xs" c="dimmed">Revoked {formatDate(session.revokedAt)}</Text> : null}
                    </Table.Td>
                    <Table.Td>
                      {session.status === 'active' ? (
                        <Group justify="flex-end">
                          <Tooltip label="Revoke device session">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setSessionToRevoke(session.id)}
                              disabled={revokeSession.isPending}
                              aria-label="Revoke device session"
                            >
                              <ShieldOff size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <ConfirmDialog
        isOpen={!!requestToRevoke}
        title="Revoke Device Request"
        message="Revoke this pending or approved device authorization request? The device will no longer be able to complete the flow with this code."
        confirmLabel="Revoke Request"
        pending={revokeRequest.isPending}
        onConfirm={confirmRequestRevoke}
        onCancel={() => setRequestToRevoke(null)}
      />

      <ConfirmDialog
        isOpen={!!sessionToRevoke}
        title="Revoke Device Session"
        message="Revoke this device-issued session? The device will lose access immediately and need to re-authorize."
        confirmLabel="Revoke Session"
        pending={revokeSession.isPending}
        onConfirm={confirmSessionRevoke}
        onCancel={() => setSessionToRevoke(null)}
      />
    </>
  )
}
