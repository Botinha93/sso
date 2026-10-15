import { Group, Select, SimpleGrid, Table, Text, TextInput } from '@mantine/core'
import { AreaChart } from '@mantine/charts'
import { useMemo, useState } from 'react'
import { Activity, BarChart3, Clock, Hash, Search } from 'lucide-react'
import { MeterBar, PageHeader, SectionCard, StatCard, TableSkeleton } from '@nexus/design'
import EmptyState from '../components/EmptyState'
import { useAuthMetrics } from '../hooks/useApi'

function toIsoHour(minutesAgo: number) {
  const date = new Date(Date.now() - minutesAgo * 60_000)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

const HOUR_MS = 3_600_000

export default function Metrics() {
  const [eventFilter, setEventFilter] = useState('')
  const [rangeHours, setRangeHours] = useState('24')

  const params = useMemo(() => {
    const hours = Math.max(1, Number(rangeHours) || 24)
    return {
      startHour: toIsoHour(hours * 60),
      endHour: toIsoHour(0),
      event: eventFilter || undefined
    }
  }, [eventFilter, rangeHours])

  const { data, isLoading } = useAuthMetrics(params)
  const rows = data?.data ?? []

  const totals = useMemo(() => {
    const grouped = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.event] = (acc[row.event] ?? 0) + row.count
      return acc
    }, {})

    const totalCount = Object.values(grouped).reduce((acc, value) => acc + value, 0)
    return {
      grouped,
      totalCount,
      distinctEvents: Object.keys(grouped).length
    }
  }, [rows])

  // Hourly totals across the selected window; hours without data are shown as 0.
  const timeline = useMemo(() => {
    const byHour = new Map<number, number>()
    for (const row of rows) {
      const time = new Date(row.bucket).getTime()
      if (Number.isNaN(time)) continue
      const hour = Math.floor(time / HOUR_MS) * HOUR_MS
      byHour.set(hour, (byHour.get(hour) ?? 0) + row.count)
    }
    const start = new Date(params.startHour).getTime()
    const end = new Date(params.endHour).getTime()
    const multiDay = end - start > 24 * HOUR_MS
    const points: Array<{ hour: string; Events: number }> = []
    for (let t = start; t <= end; t += HOUR_MS) {
      const date = new Date(t)
      points.push({
        hour: multiDay
          ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })
          : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        Events: byHour.get(t) ?? 0,
      })
    }
    return points
  }, [rows, params.startHour, params.endHour])

  const breakdown = useMemo(
    () => Object.entries(totals.grouped).sort((a, b) => b[1] - a[1]),
    [totals.grouped]
  )

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Authentication Metrics"
        description="Monitor authentication throughput trends and event distribution from the metrics rollup endpoint."
        actions={
          <Group gap="xs" wrap="wrap">
            <Select
              aria-label="Time range"
              value={rangeHours}
              onChange={(value) => setRangeHours(value ?? '24')}
              allowDeselect={false}
              w={160}
              data={[
                { value: '1', label: 'Last 1 hour' },
                { value: '6', label: 'Last 6 hours' },
                { value: '24', label: 'Last 24 hours' },
                { value: '72', label: 'Last 72 hours' },
                { value: '168', label: 'Last 7 days' },
              ]}
            />
            <TextInput
              aria-label="Filter event"
              leftSection={<Search size={14} />}
              value={eventFilter}
              onChange={(event) => setEventFilter(event.currentTarget.value)}
              placeholder="Filter event (e.g. login_success)"
              w={260}
            />
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard
          label="Total Events"
          value={totals.totalCount.toLocaleString()}
          icon={<Activity size={16} />}
          loading={isLoading}
        />
        <StatCard
          label="Distinct Types"
          value={totals.distinctEvents}
          icon={<Hash size={16} />}
          iconColor="violet"
          loading={isLoading}
        />
        <StatCard
          label="Selected Window"
          value={`${rangeHours}h`}
          icon={<Clock size={16} />}
          iconColor="gray"
        />
      </SimpleGrid>

      <SectionCard title="Events over time" description="Hourly event count across the selected window." loading={isLoading} loadingRows={6}>
        {totals.totalCount === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">No metric data found for this filter.</Text>
        ) : (
          <AreaChart
            h={260}
            data={timeline}
            dataKey="hour"
            series={[{ name: 'Events', color: 'blue.6' }]}
            curveType="monotone"
            gridAxis="y"
            tickLine="none"
            strokeWidth={2}
            fillOpacity={0.18}
            withDots={false}
            valueFormatter={(v) => v.toLocaleString()}
            xAxisProps={{ minTickGap: 24 }}
          />
        )}
      </SectionCard>

      <SectionCard title="Event Breakdown" icon={<BarChart3 size={16} />} flush>
        {isLoading ? (
          <TableSkeleton rows={5} withHeader={false} columns={['text', 'number']} />
        ) : breakdown.length === 0 ? (
          <EmptyState icon={BarChart3} title="No metric data found for this filter." />
        ) : (
          <Table.ScrollContainer minWidth={520}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Event</Table.Th>
                  <Table.Th w="40%">Share</Table.Th>
                  <Table.Th ta="right" w={120}>Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {breakdown.map(([event, count]) => (
                  <Table.Tr key={event}>
                    <Table.Td><Text size="sm" ff="monospace">{event}</Text></Table.Td>
                    <Table.Td>
                      <MeterBar
                        value={count}
                        max={totals.totalCount || 1}
                        compact
                        valueLabel={totals.totalCount ? `${Math.round((count / totals.totalCount) * 100)}%` : '0%'}
                        aria-label={`${event} share`}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={500} className="nx-tabular">{count.toLocaleString()}</Text>
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
