import { Table, TableHeaderRow, TableBody, TableRow } from '../components/ui/Table'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { PageHeader, TableSkeleton, EmptyState } from '../components/PageHeader'
import { useEffect, useState } from 'react'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ListSearch from '../components/ListSearch'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAdminSuggestions, useUpdateAdminSuggestion, type AdminSuggestion } from '../hooks/useApi'

const STATUSES: AdminSuggestion['status'][] = ['open', 'in_review', 'planned', 'completed', 'declined']

const statusTone = (status: AdminSuggestion['status']) => {
  if (status === 'completed') return 'success' as const
  if (status === 'declined') return 'danger' as const
  if (status === 'in_review') return 'info' as const
  if (status === 'planned') return 'accent' as const
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
    <div>
      <PageHeader eyebrow="Feedback" title="Suggestions" />

      <div className="mb-4">
        <ListSearch value={searchInput} onChange={setSearchInput} placeholder="Search suggestions…" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <Table>
          <TableHeaderRow>
            <h4 className="text-sm font-semibold text-foreground">Inbox</h4>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </TableHeaderRow>

          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : !suggestions?.length ? (
            <EmptyState
              title="No suggestions yet"
              description="Portal users can submit product ideas from the Suggestions app."
            />
          ) : (
            <TableBody>
              {suggestions.map((item) => (
                <TableRow
                  key={item.id}
                  className={`flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/50 ${
                    selected?.id === item.id ? 'bg-muted/60' : ''
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.kind === 'existing_app' ? (item.appName ?? 'Existing app') : (item.proposedName || 'New system')}
                      {item.author ? ` · ${item.author.email}` : ''}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>

        <Card className="p-5">
          {!selected ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Lightbulb size={20} className="mb-2" />
              Select a suggestion to review it.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.kind === 'existing_app' ? (selected.appName ?? 'Existing app') : (selected.proposedName || 'New system')}
                </p>
                {selected.author ? (
                  <p className="mt-2 text-xs text-foreground">
                    Author: {selected.author.givenName} {selected.author.familyName} ({selected.author.email})
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Author hidden</p>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm text-foreground">{selected.body}</p>

              {selected.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={status} onChange={(event) => setStatus(event.target.value as AdminSuggestion['status'])}>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>{statusLabel(value)}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal notes</label>
                <Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
              </div>

              <Button onClick={handleSave} disabled={updateSuggestion.isPending}>
                {updateSuggestion.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Suggestions
