import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import ListSearch from '../components/ListSearch'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuditSearch, useAuditStats, type AuditEventDto } from '../hooks/useApi'
import { useMemo, useState } from 'react'
import React from 'react';

const eventBadge: Record<string, string> = {
  login: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  login_failed: 'bg-rose-50 text-rose-600 border-rose-100',
  logout: 'bg-sky-50 text-sky-700 border-sky-100',
  token_issued: 'bg-sky-50 text-sky-700 border-sky-100',
  token_refreshed: 'bg-sky-50 text-sky-700 border-sky-100',
  token_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  consent_granted: 'bg-teal-50 text-teal-700 border-teal-100',
  consent_revoked: 'bg-orange-50 text-orange-700 border-orange-100',
  session_revoked: 'bg-rose-50 text-rose-600 border-rose-100',
  client_created: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  client_updated: 'bg-sky-50 text-sky-700 border-sky-100',
  client_deleted: 'bg-rose-50 text-rose-600 border-rose-100',
  user_created: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

// <input type="date"> yields a local calendar day; widen it to that day's full span.
const startOfLocalDay = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined)
const endOfLocalDay = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined)

function AuditEventRow({ event }: { event: AuditEventDto }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata = !!event.metadata && Object.keys(event.metadata).length > 0

  return (
    <TableRow className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
      <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono border mt-0.5 whitespace-nowrap ${eventBadge[event.type] ?? 'bg-muted text-muted-foreground border-border'}`}>
        {event.type}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground break-all">
          {event.actorType}{event.actorId ? ` · ${event.actorId}` : ''}
          {event.clientId ? ` · client: ${event.clientId}` : ''}
          {event.ip ? ` · ip: ${event.ip}` : ''}
        </p>
        {hasMetadata && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            {expanded ? (
              <pre className="mt-1 max-h-96 overflow-auto rounded-md border border-border bg-muted p-2 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 break-all line-clamp-2">
                {JSON.stringify(event.metadata)}
              </p>
            )}
          </div>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono">id: {event.id}</p>
      </div>
      <p className="text-xs text-muted-foreground whitespace-nowrap" title={event.createdAt}>
        {new Date(event.createdAt).toLocaleString()}
      </p>
    </TableRow>
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
    const known = new Set([...(typeStats?.byType.map((row) => row.type) ?? []), ...Object.keys(eventBadge)])
    if (type) known.add(type)
    return Array.from(known).sort()
  }, [typeStats, type])

  return (
    <div>
      <PageHeader eyebrow="Audit Trail" title="System Activity Log" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <ListSearch
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search type, actor, client, IP or details…"
          className="flex-1 min-w-[240px]"
        />
        <label className="text-xs text-muted-foreground">
          <span className="mb-1 block">Event type</span>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-9 min-w-[180px]">
            <option value="">All types</option>
            {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          <span className="mb-1 block">From</span>
          <Input type="date" value={fromDay} max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)} className="w-[150px]" />
        </label>
        <label className="text-xs text-muted-foreground">
          <span className="mb-1 block">To</span>
          <Input type="date" value={toDay} min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)} className="w-[150px]" />
        </label>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setType(''); setFromDay(''); setToDay('') }}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <Table>
        <TableHeaderRow>
          <h4 className="text-sm font-semibold text-foreground">
            Events
            {!isLoading ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {events.length} shown{hasNextPage ? ' · more available' : ''}
              </span>
            ) : null}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={12} className={isFetching && !isFetchingNextPage ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </TableHeaderRow>

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
          <TableBody>
            {events.map((event) => <AuditEventRow key={event.id} event={event} />)}
            {hasNextPage ? (
              <div className="flex justify-center px-5 py-3">
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? 'Loading…' : 'Load older events'}
                </Button>
              </div>
            ) : null}
          </TableBody>
        )}
      </Table>
    </div>
  )
}

export default AuditLog
