import { useState } from 'react'
import { Alert, Box, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import { ShieldAlert, Plus, CheckCircle, PlayCircle, XCircle, Clock, Zap } from 'lucide-react'
import { ExpiryBadge, SectionCard, StatusBadge } from '@nexus/design'
import {
  useElevationRequests,
  useCreateElevationRequest,
  useApproveElevationRequest,
  useActivateElevationRequest,
  useRevokeElevationRequest,
  useBreakGlassElevation,
  type ElevationRequestDto
} from '../hooks/useApi'
import ElevationSessionList from './ElevationSessionList'

const statusLabels: Record<ElevationRequestDto['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired'
}

interface CreateFormState {
  justification: string
  resource: string
  action: string
  durationMinutes: string
}

const defaultForm: CreateFormState = {
  justification: '',
  resource: '',
  action: '',
  durationMinutes: '60'
}

export default function ElevationPanel() {
  const [statusFilter, setStatusFilter] = useState<ElevationRequestDto['status'] | undefined>(undefined)
  const [form, setForm] = useState<CreateFormState>(defaultForm)
  const [error, setError] = useState<string | null>(null)

  const [bgForm, setBgForm] = useState({ resource: '', action: '', reason: '', durationMinutes: '60' })
  const [bgSuccess, setBgSuccess] = useState<string | null>(null)
  const [bgError, setBgError] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useElevationRequests(statusFilter)
  const createRequest = useCreateElevationRequest()
  const approveRequest = useApproveElevationRequest()
  const activateRequest = useActivateElevationRequest()
  const revokeRequest = useRevokeElevationRequest()
  const breakGlass = useBreakGlassElevation()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await createRequest.mutateAsync({
        justification: form.justification,
        resource: form.resource,
        action: form.action,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined
      })
      setForm(defaultForm)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create elevation request')
    }
  }

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault()
    setBgError(null)
    setBgSuccess(null)
    try {
      await breakGlass.mutateAsync({
        resource: bgForm.resource,
        action: bgForm.action,
        reason: bgForm.reason,
        durationMinutes: bgForm.durationMinutes ? Number(bgForm.durationMinutes) : undefined
      })
      setBgForm({ resource: '', action: '', reason: '', durationMinutes: '60' })
      setBgSuccess('Emergency break-glass elevation granted and audited.')
    } catch (err: unknown) {
      setBgError(err instanceof Error ? err.message : 'Break-glass failed')
    }
  }

  return (
    <Stack gap="lg">
      <Group gap="xs">
        <ShieldAlert size={18} color="var(--nx-color-text-muted)" />
        <Title order={3} size="h4">Privileged access elevations</Title>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {/* Create Form */}
        <SectionCard title="Request elevation">
          <form onSubmit={handleCreate}>
            <Stack gap="md">
              <Textarea
                label="Justification"
                value={form.justification}
                onChange={e => { const value = e.currentTarget.value; setForm(v => ({ ...v, justification: value })) }}
                autosize
                minRows={3}
                required
                placeholder="Describe why elevated access is needed"
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Resource"
                  value={form.resource}
                  onChange={e => { const value = e.currentTarget.value; setForm(v => ({ ...v, resource: value })) }}
                  required
                  placeholder="admin:users"
                />
                <TextInput
                  label="Action"
                  value={form.action}
                  onChange={e => { const value = e.currentTarget.value; setForm(v => ({ ...v, action: value })) }}
                  required
                  placeholder="delete"
                />
              </SimpleGrid>
              <TextInput
                type="number"
                label="Duration (minutes)"
                description="Maximum 480 minutes (8 hours)"
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                min={1}
                max={480}
                value={form.durationMinutes}
                onChange={e => { const value = e.currentTarget.value; setForm(v => ({ ...v, durationMinutes: value })) }}
              />
              {error ? (
                <Text size="sm" c="red">{error}</Text>
              ) : null}
              <Box>
                <Button type="submit" loading={createRequest.isPending} leftSection={<Plus size={16} />}>
                  Request elevation
                </Button>
              </Box>
            </Stack>
          </form>
        </SectionCard>

        {/* Requests List */}
        <SectionCard
          title="Elevation requests"
          loading={isLoading}
          actions={
            <NativeSelect
              size="xs"
              aria-label="Filter requests by status"
              value={statusFilter ?? ''}
              onChange={e => setStatusFilter((e.currentTarget.value as ElevationRequestDto['status']) || undefined)}
              data={[
                { value: '', label: 'All statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'active', label: 'Active' },
                { value: 'revoked', label: 'Revoked' },
                { value: 'expired', label: 'Expired' }
              ]}
            />
          }
        >
          {requests.length === 0 ? (
            <Text size="sm" c="dimmed">No elevation requests found.</Text>
          ) : (
            <Stack gap="sm">
              {requests.map(req => (
                <Paper key={req.id} withBorder p="sm" radius="md" bg="var(--nx-color-surface-sunken)">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                      <Box miw={0} style={{ flex: 1 }}>
                        <Text size="sm" fw={500} truncate>{req.justification}</Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          <Text span ff="monospace" inherit>{req.resource}</Text>
                          {' → '}
                          <Text span ff="monospace" inherit>{req.action}</Text>
                        </Text>
                      </Box>
                      <StatusBadge status={req.status}>{statusLabels[req.status]}</StatusBadge>
                    </Group>
                    {req.expiresAt ? (
                      <Group gap="xs">
                        <Group gap={4}>
                          <Clock size={14} color="var(--nx-color-text-muted)" />
                          <Text size="xs" c="dimmed">Expires {new Date(req.expiresAt).toLocaleString()}</Text>
                        </Group>
                        {req.status === 'active' ? <ExpiryBadge size="xs" expiresAt={req.expiresAt} /> : null}
                      </Group>
                    ) : null}
                    <Group gap={6}>
                      {req.status === 'pending' ? (
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => approveRequest.mutate(req.id)}
                          disabled={approveRequest.isPending}
                          leftSection={<CheckCircle size={14} color="var(--mantine-color-green-6)" />}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {req.status === 'approved' ? (
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => activateRequest.mutate(req.id)}
                          disabled={activateRequest.isPending}
                          leftSection={<PlayCircle size={14} color="var(--mantine-color-blue-6)" />}
                        >
                          Activate
                        </Button>
                      ) : null}
                      {(req.status === 'active' || req.status === 'approved') ? (
                        <Button
                          size="xs"
                          variant="default"
                          c="red"
                          onClick={() => revokeRequest.mutate(req.id)}
                          disabled={revokeRequest.isPending}
                          leftSection={<XCircle size={14} />}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </SectionCard>

        <ElevationSessionList />
      </SimpleGrid>

      {/* Break-Glass Section */}
      <SectionCard
        variant="danger"
        icon={<Zap size={16} />}
        title="Emergency break-glass"
        description="Grants immediate elevation without approval. All break-glass activations are permanently audited and require justification."
      >
        <form onSubmit={handleBreakGlass}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label="Resource" value={bgForm.resource} onChange={e => { const value = e.currentTarget.value; setBgForm(v => ({ ...v, resource: value })) }} required placeholder="admin:users" />
              <TextInput label="Action" value={bgForm.action} onChange={e => { const value = e.currentTarget.value; setBgForm(v => ({ ...v, action: value })) }} required placeholder="delete" />
            </SimpleGrid>
            <Textarea label="Reason (required)" value={bgForm.reason} onChange={e => { const value = e.currentTarget.value; setBgForm(v => ({ ...v, reason: value })) }} autosize minRows={2} required placeholder="Describe the emergency requiring break-glass access" />
            <TextInput type="number" label="Duration (minutes)" min={1} max={480} value={bgForm.durationMinutes} onChange={e => { const value = e.currentTarget.value; setBgForm(v => ({ ...v, durationMinutes: value })) }} />
            {bgError ? <Text size="sm" c="red">{bgError}</Text> : null}
            {bgSuccess ? <Alert color="green" p="xs"><Text size="xs">{bgSuccess}</Text></Alert> : null}
            <Box>
              <Button type="submit" color="red" loading={breakGlass.isPending} leftSection={<Zap size={16} />}>
                Activate break-glass
              </Button>
            </Box>
          </Stack>
        </form>
      </SectionCard>
    </Stack>
  )
}
