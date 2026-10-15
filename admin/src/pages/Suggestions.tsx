import { Anchor, Box, Button, Group, Image, NativeSelect, Stack, Table, Text, Textarea, UnstyledButton } from '@mantine/core'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { PageHeader, SearchInput, SectionCard, StatusBadge, TableSkeleton } from '@nexus/design'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAdminSuggestions, useUpdateAdminSuggestion, type AdminSuggestion } from '../hooks/useApi'

const STATUSES: AdminSuggestion['status'][] = ['open', 'in_review', 'planned', 'completed', 'declined']

const statusTone = (status: AdminSuggestion['status']) => {
  if (status === 'completed') return 'success' as const
  if (status === 'declined') return 'danger' as const
  if (status === 'in_review') return 'info' as const
  if (status === 'planned') return 'approved' as const
  return 'neutral' as const
}

const statusLabel = (status: AdminSuggestion['status']) => status.replace('_', ' ')

const Suggestions = () => {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: suggestions, isLoading, isFetching, refetch } = useAdminSuggestions(debouncedSearch)
  const updateSuggestion = useUpdateAdminSuggestion()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<AdminSuggestion['status']>('open')
  const [internalNotes, setInternalNotes] = useState('')

  const selected = suggestions?.find((item) => item.id === selectedId) ?? suggestions?.[0]

  useEffect(() => {
    if (!selected) return
    setSelectedId(selected.id)
    setStatus(selected.status)
    setInternalNotes(selected.internalNotes ?? '')
  }, [selected?.id, selected?.status, selected?.internalNotes])

  const handleSave = () => {
    if (!selected) return
    updateSuggestion.mutate({
      id: selected.id,
      status,
      internalNotes
    })
  }

  return (
    <Stack gap="lg">
      <PageHeader eyebrow="Feedback" title="Suggestions" />

      <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search suggestions…" maw={360} />

      <Box style={{ display: 'grid', gap: 'var(--mantine-spacing-md)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', alignItems: 'start' }}>
        <SectionCard
          flush
          title="Inbox"
          actions={
            <Button variant="subtle" size="xs" leftSection={<RefreshCw size={14} />} onClick={() => refetch()} loading={isFetching} disabled={isFetching}>
              Refresh
            </Button>
          }
        >
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : !suggestions?.length ? (
            <EmptyState
              title="No suggestions yet"
              description="Portal users can submit product ideas from the Suggestions app."
            />
          ) : (
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Tbody>
                {suggestions.map((item) => {
                  const isSelected = selected?.id === item.id
                  return (
                    <Table.Tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      bg={isSelected ? 'var(--nx-color-accent-soft)' : undefined}
                      style={{ cursor: 'pointer' }}
                      aria-selected={isSelected}
                    >
                      <Table.Td pl="lg" style={{ maxWidth: 0, width: '100%' }}>
                        <UnstyledButton onClick={() => setSelectedId(item.id)} w="100%" style={{ minWidth: 0 }}>
                          <Text size="sm" fw={500} truncate>{item.title}</Text>
                          <Text size="xs" c="dimmed" truncate>
                            {item.kind === 'existing_app' ? (item.appName ?? 'Existing app') : (item.proposedName || 'New system')}
                            {item.author ? ` · ${item.author.email}` : ''}
                          </Text>
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td pr="lg" ta="right">
                        <StatusBadge status={statusTone(item.status)} size="sm" tt="capitalize">{statusLabel(item.status)}</StatusBadge>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          )}
        </SectionCard>

        <SectionCard>
          {!selected ? (
            <Stack align="center" justify="center" gap="xs" mih={192} ta="center">
              <Lightbulb size={20} color="var(--nx-color-text-muted)" />
              <Text size="sm" c="dimmed">Select a suggestion to review it.</Text>
            </Stack>
          ) : (
            <Stack gap="md">
              <Box>
                <Text size="sm" fw={600}>{selected.title}</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {selected.kind === 'existing_app' ? (selected.appName ?? 'Existing app') : (selected.proposedName || 'New system')}
                </Text>
                {selected.author ? (
                  <Text size="xs" mt="xs">
                    Author: {selected.author.givenName} {selected.author.familyName} ({selected.author.email})
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed" mt="xs">Author hidden</Text>
                )}
              </Box>

              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</Text>

              {selected.imageUrls.length > 0 && (
                <Group gap="xs">
                  {selected.imageUrls.map((url) => (
                    <Anchor key={url} href={url} target="_blank" rel="noreferrer">
                      <Image src={url} alt="" w={64} h={64} radius="md" fit="cover" style={{ border: '1px solid var(--nx-color-border)' }} />
                    </Anchor>
                  ))}
                </Group>
              )}

              <NativeSelect
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.currentTarget.value as AdminSuggestion['status'])}
                data={STATUSES.map((value) => ({ value, label: statusLabel(value) }))}
              />

              <Textarea
                label="Internal notes"
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.currentTarget.value)}
                autosize
                minRows={3}
              />

              <Group justify="flex-end">
                <Button onClick={handleSave} loading={updateSuggestion.isPending} disabled={updateSuggestion.isPending}>
                  Save
                </Button>
              </Group>
            </Stack>
          )}
        </SectionCard>
      </Box>
    </Stack>
  )
}

export default Suggestions
