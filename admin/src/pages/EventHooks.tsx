import { useState } from 'react'
import { ActionIcon, Badge, Box, Button, Code, Group, NativeSelect, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { Plus, Send, Trash2, Webhook } from 'lucide-react'
import { PageHeader, PageHeaderSkeleton, SearchInput, SectionCard } from '@nexus/design'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import EmptyState from '../components/EmptyState'
import {
  useCreateEventHook,
  useDeleteEventHook,
  useEventHooks,
  useEventNotifications,
  useSystemEventTypes,
  useTestEventHook,
  useUpdateEventHook,
} from '../hooks/useApi'


export default function EventHooks() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: hooks = [], isLoading } = useEventHooks(debouncedSearch)
  const { data: systemEventTypes = [] } = useSystemEventTypes()
  const { data: notifications = [] } = useEventNotifications(100)
  const createHook = useCreateEventHook()
  const updateHook = useUpdateEventHook()
  const deleteHook = useDeleteEventHook()
  const testHook = useTestEventHook()

  const [form, setForm] = useState({
    eventType: 'auth.login.succeeded',
    targetUrl: 'http://localhost:9999/hooks',
    method: 'POST',
    headers: '{}',
    enabled: true
  })
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [formError, setFormError] = useState<string | null>(null)

  const eventOptions = (systemEventTypes as string[]).length > 0
    ? (systemEventTypes as string[])
    : ['*', 'auth.login.succeeded', 'auth.login.failed', 'user.created']

  const filteredNotifications = (notifications as any[]).filter((item) => {
    const statusOk = notificationFilter === 'all' || item.status === notificationFilter
    const eventOk = eventFilter === 'all' || item.eventType === eventFilter
    return statusOk && eventOk
  })

  const notificationColor = (status: string) =>
    status === 'delivered' || status === 'success' ? 'green' : status === 'failed' ? 'red' : 'gray'

  if (isLoading) {
    return <PageHeaderSkeleton blocks={3} />
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Automation"
        title="Events and Hooks"
        description="Dispatch platform events to webhooks and review delivery logs."
      />

      <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search hooks by event type or URL…" maw={360} />

      <SectionCard
        title="Create hook"
        description={<>Choose one of the supported system events. Use <Code>*</Code> to receive all events.</>}
      >
        <Group align="flex-start" gap="sm" wrap="wrap">
          <NativeSelect
            aria-label="Event type"
            value={form.eventType}
            onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, eventType: value })) }}
            data={eventOptions}
            miw={200}
            style={{ flex: 1 }}
          />
          <TextInput
            aria-label="Target URL"
            value={form.targetUrl}
            onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, targetUrl: value })) }}
            placeholder="https://hooks.example.com/identity"
            miw={240}
            style={{ flex: 2 }}
          />
          <NativeSelect
            aria-label="HTTP method"
            value={form.method}
            onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, method: value })) }}
            data={['POST', 'PUT']}
            w={100}
          />
          <TextInput
            aria-label="Headers (JSON)"
            value={form.headers}
            onChange={(e) => { const value = e.currentTarget.value; setForm((v) => ({ ...v, headers: value })) }}
            placeholder='{"x-key":"123"}'
            ff="monospace"
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-xs)' } }}
            miw={180}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<Plus size={16} />}
            loading={createHook.isPending}
            onClick={async () => {
              try {
                setFormError(null)
                const parsedHeaders = JSON.parse(form.headers || '{}')
                await createHook.mutateAsync({
                  eventType: form.eventType,
                  targetUrl: form.targetUrl,
                  method: form.method,
                  headers: parsedHeaders,
                  enabled: form.enabled
                })
              } catch (error) {
                setFormError(error instanceof Error ? error.message : 'Failed to create event hook')
              }
            }}
          >
            Add hook
          </Button>
        </Group>
        {formError ? <Text size="xs" c="red" mt="xs">{formError}</Text> : null}
      </SectionCard>

      <SectionCard title="Configured hooks" flush>
        {hooks.length === 0 ? (
          <EmptyState icon={Webhook} title="No hooks configured" description="Create a hook above to start dispatching events." />
        ) : (
          <Table.ScrollContainer minWidth={640} mb={0}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th pl="lg">Event</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                  <Table.Th pr="lg" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hooks.map((hook: any) => (
                  <Table.Tr key={hook.id}>
                    <Table.Td pl="lg"><Code>{hook.eventType}</Code></Table.Td>
                    <Table.Td><Text size="sm">{hook.method}</Text></Table.Td>
                    <Table.Td maw={360}><Text size="sm" truncate>{hook.targetUrl}</Text></Table.Td>
                    <Table.Td>
                      <Switch
                        size="sm"
                        checked={!!hook.enabled}
                        onChange={() => updateHook.mutate({ id: hook.id, enabled: !hook.enabled })}
                        label={hook.enabled ? 'Enabled' : 'Disabled'}
                      />
                    </Table.Td>
                    <Table.Td pr="lg">
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<Send size={14} />}
                          disabled={testHook.isPending}
                          onClick={() => testHook.mutate({ id: hook.id })}
                        >
                          Send test
                        </Button>
                        <Tooltip label="Delete">
                          <ActionIcon variant="subtle" color="red" aria-label="Delete" onClick={() => deleteHook.mutate(hook.id)}>
                            <Trash2 size={16} />
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
        title="Notification log"
        flush
        actions={
          <Group gap="xs">
            <NativeSelect
              size="xs"
              aria-label="Filter by status"
              value={notificationFilter}
              onChange={(e) => setNotificationFilter(e.currentTarget.value)}
              data={[
                { value: 'all', label: 'All statuses' },
                { value: 'delivered', label: 'Delivered' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
            <NativeSelect
              size="xs"
              aria-label="Filter by event"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.currentTarget.value)}
              data={[{ value: 'all', label: 'All events' }, ...eventOptions.filter((eventType) => eventType !== '*')]}
            />
          </Group>
        }
      >
        <Table.ScrollContainer minWidth={700} mb={0}>
          <Table verticalSpacing="xs" fz="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th pl="lg">When</Table.Th>
                <Table.Th>Event</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>HTTP</Table.Th>
                <Table.Th pr="lg">Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredNotifications.map((item: any) => (
                <Table.Tr key={item.id}>
                  <Table.Td pl="lg" style={{ whiteSpace: 'nowrap' }}>{new Date(item.createdAt).toLocaleString()}</Table.Td>
                  <Table.Td ff="monospace">{item.eventType}</Table.Td>
                  <Table.Td><Badge size="sm" variant="light" color={notificationColor(item.status)}>{item.status}</Badge></Table.Td>
                  <Table.Td className="nx-tabular">{item.responseStatus ?? '-'}</Table.Td>
                  <Table.Td pr="lg"><Box maw={320}><Text size="xs" c={item.error ? 'red' : 'dimmed'} lineClamp={2}>{item.error ?? '-'}</Text></Box></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </SectionCard>
    </Stack>
  )
}
