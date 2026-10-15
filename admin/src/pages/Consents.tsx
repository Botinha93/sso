import { Trash2, CheckSquare } from 'lucide-react'
import { useState } from 'react'
import { ActionIcon, Badge, Group, Stack, Table, Text, Tooltip } from '@mantine/core'
import { PageHeader, RefreshButton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useConsents, useRevokeConsent } from '../hooks/useApi'

interface Consent {
  id: string
  userId: string
  clientId: string
  scope: string[]
  createdAt: string
  updatedAt: string
}

const Consents = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: consents, isLoading, isFetching, refetch } = useConsents(debouncedSearch)
  const revokeConsent = useRevokeConsent()
  const [consentToRevoke, setConsentToRevoke] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setConsentToRevoke(id)
  }

  const confirmRevoke = () => {
    if (!consentToRevoke) return
    revokeConsent.mutate(consentToRevoke, { onSuccess: () => setConsentToRevoke(null) })
  }

  return (
    <>
      <PageHeader eyebrow="Consent Management" title="Granted Permissions" />

      <SectionCard
        flush
        title="Consent Records"
        actions={
          <Group gap="sm" wrap="nowrap">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search consents by user or client…"
              w={{ base: '100%', xs: 300 }}
              maw={360}
            />
            <RefreshButton variant="icon" loading={isFetching} onRefresh={() => refetch()} lastUpdated={null} />
          </Group>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} columns={['mono', 'mono', 'pill', 'text', 'action']} p="md" />
        ) : !consents?.length ? (
          <EmptyState
            icon={CheckSquare}
            title="No consents recorded"
            description="Granted OAuth consent scopes will appear here."
          />
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Scopes</Table.Th>
                  <Table.Th>Granted</Table.Th>
                  <Table.Th w={56} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {consents.map((consent: Consent) => (
                  <Table.Tr key={consent.id}>
                    <Table.Td>
                      <Text size="sm" fw={500} ff="monospace">{consent.clientId}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="dimmed">{consent.userId.slice(0, 12)}…</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {consent.scope.map((s) => (
                          <Badge key={s} color="gray" variant="light" ff="monospace" tt="none">{s}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{new Date(consent.createdAt).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack align="flex-end">
                        <Tooltip label="Revoke consent">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleRevoke(consent.id)}
                            disabled={revokeConsent.isPending}
                            aria-label="Revoke consent"
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      <ConfirmDialog
        isOpen={!!consentToRevoke}
        title="Revoke Consent"
        message="Revoke this consent? The user will be asked to consent again on next login."
        confirmLabel="Revoke Consent"
        pending={revokeConsent.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setConsentToRevoke(null)}
      />
    </>
  )
}

export default Consents
