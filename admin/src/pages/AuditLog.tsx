import { Badge, Box, Button, Group, NativeSelect, Stack, Table, Text, TextInput } from '@mantine/core'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import CodeBlock from '../components/CodeBlock'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuditSearch, useAuditStats, type AuditEventDto } from '../hooks/useApi'
import { useMemo, useState } from 'react'

const eventColor: Record<string, string> = {
  login: 'green',
  login_failed: 'red',
  logout: 'blue',
  token_issued: 'blue',
  token_refreshed: 'blue',
  token_revoked: 'orange',
  consent_granted: 'teal',
  consent_revoked: 'orange',
  session_revoked: 'red',
  client_created: 'green',
  client_updated: 'blue',
  client_deleted: 'red',
  user_created: 'green',
}

// <input type="date"> yields a local calendar day; widen it to that day's full span.
const startOfLocalDay = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined)
const endOfLocalDay = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined)

function AuditEventRow({ event }: { event: AuditEventDto }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata = !!event.metadata && Object.keys(event.metadata).length > 0

  return (
    <Table.Tr>
      <Table.Td pl="lg" w={1} style={{ verticalAlign: 'top' }}>
        <Badge variant="light" color={eventColor[event.type] ?? 'gray'} radius="sm" tt="none" ff="monospace" fw={500} style={{ whiteSpace: 'nowrap' }}>
          {event.type}
        </Badge>
      </Table.Td>
      <Table.Td style={{ verticalAlign: 'top' }}>
        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
          {event.actorType}{event.actorId ? ` · ${event.actorId}` : ''}
          {event.clientId ? ` · client: ${event.clientId}` : ''}
          {event.ip ? ` · ip: ${event.ip}` : ''}
        </Text>
        {hasMetadata && (
          <Box mt={4}>
            <Button
              variant="subtle"
              size="compact-xs"
              px={4}
              onClick={() => setExpanded((value) => !value)}
              leftSection={expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              aria-expanded={expanded}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </Button>
            {expanded ? (
              <CodeBlock mt={4} mah={384} style={{ overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} code={JSON.stringify(event.metadata, null, 2)} language="json" />
            ) : (
              <Text size="xs" c="dimmed" ff="monospace" mt={2} lineClamp={2} style={{ wordBreak: 'break-all' }}>
                {JSON.stringify(event.metadata)}
              </Text>
            )}
          </Box>
        )}
        <Text mt={2} fz={10} c="dimmed" ff="monospace" opacity={0.75}>id: {event.id}</Text>
      </Table.Td>
      <Table.Td pr="lg" ta="right" style={{ verticalAlign: 'top' }}>
        <Text size="xs" c="dimmed" title={event.createdAt} style={{ whiteSpace: 'nowrap' }}>
          {new Date(event.createdAt).toLocaleString()}
        </Text>
      </Table.Td>
    </Table.Tr>
  )
}

const AuditLog = () => {
  const [searchInput, setSearchInput] = useState('')
  const [type, setType] = useState('')
  const [fromDay, setFromDay] = useState('')
  const [toDay, setToDay] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)

  const filters = useMemo(() => ({
    search: debouncedSearch,
    type,
    from: startOfLocalDay(fromDay),
    to: endOfLocalDay(toDay)
  }), [debouncedSearch, type, fromDay, toDay])

  const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isError } = useAuditSearch(filters)
  const { data: typeStats } = useAuditStats(90)
  const events = data?.pages.flat() ?? []
  const hasFilters = !!(debouncedSearch.trim() || type || fromDay || toDay)

  const typeOptions = useMemo(() => {
    const known = new Set([...(typeStats?.byType.map((row) => row.type) ?? []), ...Object.keys(eventColor)])
    if (type) known.add(type)
    return Array.from(known).sort()
  }, [typeStats, type])

  const clearFilters = () => { setSearchInput(''); setType(''); setFromDay(''); setToDay('') }

  return (
    <Stack gap="lg">
      <PageHeader eyebrow="Audit Trail" title="System Activity Log" />

      <Group align="flex-end" gap="sm" wrap="wrap">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search type, actor, client, IP or details…"
          style={{ flex: 1 }}
          miw={240}
        />
        <NativeSelect
          label="Event type"
          value={type}
          onChange={(e) => setType(e.currentTarget.value)}
          miw={180}
          data={[{ value: '', label: 'All types' }, ...typeOptions]}
        />
        <TextInput
          label="From"
          type="date"
          value={fromDay}
          max={toDay || undefined}
          onChange={(e) => setFromDay(e.currentTarget.value)}
          w={150}
        />
        <TextInput
          label="To"
          type="date"
          value={toDay}
          min={fromDay || undefined}
          onChange={(e) => setToDay(e.currentTarget.value)}
          w={150}
        />
        {hasFilters ? (
          <Button variant="subtle" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </Group>

      <SectionCard
        flush
        title={
          <Group gap="xs" component="span">
            Events
            {!isLoading ? (
              <Text component="span" size="xs" c="dimmed" fw={400}>
                {events.length} shown{hasNextPage ? ' · more available' : ''}
              </Text>
            ) : null}
          </Group>
        }
        actions={
          <Button
            variant="subtle"
            size="xs"
            leftSection={<RefreshCw size={14} />}
            loading={isFetching && !isFetchingNextPage}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <EmptyState title="Could not load audit events" description="Check your permissions or try refreshing." />
        ) : events.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No events match these filters' : 'No audit events recorded'}
            description={hasFilters ? 'Search covers the full audit history; try a broader term or date range.' : 'Authentication and administrative events will appear here.'}
          />
        ) : (
          <>
            <Table.ScrollContainer minWidth={720} mb={0}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Tbody>
                  {events.map((event) => <AuditEventRow key={event.id} event={event} />)}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {hasNextPage ? (
              <Group justify="center" px="lg" py="sm">
                <Button variant="subtle" size="xs" onClick={() => fetchNextPage()} loading={isFetchingNextPage} disabled={isFetchingNextPage}>
                  Load older events
                </Button>
              </Group>
            ) : null}
          </>
        )}
      </SectionCard>
    </Stack>
  )
}

export default AuditLog
