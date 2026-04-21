import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useAuthMetrics } from '../hooks/useApi'

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Operations</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Authentication Metrics</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Monitor authentication throughput trends and event distribution from the metrics rollup endpoint.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangeHours}
            onChange={(event) => setRangeHours(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          >
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="72">Last 72 hours</option>
            <option value="168">Last 7 days</option>
          </select>
          <input
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
            placeholder="Filter event (e.g. login_success)"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Events</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totals.totalCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Distinct Types</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totals.distinctEvents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Window</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{rangeHours}h</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Event Breakdown</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-sm text-slate-500">Loading metrics...</div>
        ) : Object.keys(totals.grouped).length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">No metric data found for this filter.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(totals.grouped)
              .sort((a, b) => b[1] - a[1])
              .map(([event, count]) => (
                <div key={event} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-slate-800">{event}</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
