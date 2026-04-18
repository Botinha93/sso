import { useState } from 'react'
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
  const { data: hooks = [], isLoading } = useEventHooks()
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

  if (isLoading) {
    return <div className="p-6">Loading event hooks...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Events and Hooks</h1>
        <p className="mt-1 text-sm text-slate-600">Dispatch platform events to webhooks and review delivery logs.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Create Hook</h2>
        <p className="mt-1 text-xs text-slate-500">Choose one of the supported system events. Use <span className="font-mono">*</span> to receive all events.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <select
            className="rounded border px-3 py-2"
            value={form.eventType}
            onChange={(e) => setForm((v) => ({ ...v, eventType: e.target.value }))}
          >
            {eventOptions.map((eventType) => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </select>
          <input className="rounded border px-3 py-2" value={form.targetUrl} onChange={(e) => setForm((v) => ({ ...v, targetUrl: e.target.value }))} placeholder="target url" />
          <select className="rounded border px-3 py-2" value={form.method} onChange={(e) => setForm((v) => ({ ...v, method: e.target.value }))}>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
          <input className="rounded border px-3 py-2 font-mono text-xs" value={form.headers} onChange={(e) => setForm((v) => ({ ...v, headers: e.target.value }))} placeholder='headers json e.g. {"x-key":"123"}' />
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
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
            Add Hook
          </button>
        </div>
        {formError ? <p className="mt-2 text-xs text-rose-600">{formError}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Configured Hooks</h2>
        <div className="mt-3 space-y-2">
          {hooks.map((hook: any) => (
            <div key={hook.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">{hook.eventType}</span>
              <span>{hook.method}</span>
              <span className="truncate">{hook.targetUrl}</span>
              <button
                className={`rounded px-2 py-1 ${hook.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
                onClick={() => updateHook.mutate({ id: hook.id, enabled: !hook.enabled })}
              >
                {hook.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button
                className="rounded bg-sky-100 px-2 py-1 text-sky-700 disabled:opacity-60"
                disabled={testHook.isPending}
                onClick={() => testHook.mutate({ id: hook.id })}
              >
                Send Test
              </button>
              <button className="ml-auto rounded bg-rose-100 px-2 py-1 text-rose-700" onClick={() => deleteHook.mutate(hook.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Notification Log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border px-2 py-1 text-xs"
              value={notificationFilter}
              onChange={(e) => setNotificationFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
            <select
              className="rounded border px-2 py-1 text-xs"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="all">All events</option>
              {eventOptions.filter((eventType) => eventType !== '*').map((eventType) => (
                <option key={eventType} value={eventType}>{eventType}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">When</th>
                <th className="py-2">Event</th>
                <th className="py-2">Status</th>
                <th className="py-2">HTTP</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map((item: any) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-2 font-mono">{item.eventType}</td>
                  <td className="py-2">{item.status}</td>
                  <td className="py-2">{item.responseStatus ?? '-'}</td>
                  <td className="py-2">{item.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
