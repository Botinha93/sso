import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { PageHeader, TableSkeleton } from '../components/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import Input from '../components/ui/Input'
import { useAuthMetrics } from '../hooks/useApi'
import React from 'react';

function toIsoHour(minutesAgo: number) {
  const date = new Date(Date.now() - minutesAgo * 60_000)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Authentication Metrics"
        description="Monitor authentication throughput trends and event distribution from the metrics rollup endpoint."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={rangeHours}
              onChange={(event) => setRangeHours(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              <option value="1">Last 1 hour</option>
              <option value="6">Last 6 hours</option>
              <option value="24">Last 24 hours</option>
              <option value="72">Last 72 hours</option>
              <option value="168">Last 7 days</option>
            </Select>
            <Input
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              placeholder="Filter event (e.g. login_success)"
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Events</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totals.totalCount.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distinct Types</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totals.distinctEvents}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected Window</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{rangeHours}h</p>
        </Card>
      </div>

      <Table>
        <TableHeaderRow className="px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Event Breakdown</h2>
          </div>
        </TableHeaderRow>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : Object.keys(totals.grouped).length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No metric data found for this filter.</div>
        ) : (
          <TableBody>
            {Object.entries(totals.grouped)
              .sort((a, b) => b[1] - a[1])
              .map(([event, count]) => (
                <TableRow key={event} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-foreground">{event}</p>
                  <StatusBadge tone="neutral">{count.toLocaleString()}</StatusBadge>
                </TableRow>
              ))}
          </TableBody>
        )}
      </Table>
    </div>
  )
}
