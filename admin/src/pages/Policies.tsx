import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  Code,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { PageHeader, PageHeaderSkeleton, SearchInput, SectionCard, TableSkeleton } from '@nexus/design'
import { ScrollText } from 'lucide-react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import Editor from '@monaco-editor/react'
import CodeBlock from '../components/CodeBlock'
import EmptyState from '../components/EmptyState'

import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useRemovePolicyAssignment,
  useSetPolicyAssignment,
  useUpdatePolicy,
  usePolicyDecisions,
} from '../hooks/useApi'
import { PolicyDecisionSimulator } from '../components/policies/PolicyDecisionSimulator'
import {
  AUTH_STAGES,
  defaultJsTemplate,
  exampleConfigs,
  type AuthStageType,
  type PolicyCategory,
  type ScopeType,
} from '../components/policies/policy-config'

type PolicyTab = 'definitions' | 'configuration' | 'decisions'

type ConfigFieldKind = 'boolean' | 'number' | 'string' | 'string_array' | 'number_array' | 'json'

type AssignmentDraft = {
  scopeType: ScopeType
  scopeId: string
  config: Record<string, unknown>
  rawConfig: string
  rawMode: boolean
}

const monoInputStyles = {
  input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-xs)' },
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: '0.05em' }}>
      {children}
    </Text>
  )
}

function PolicyBadges({ policy }: { policy: any }) {
  return (
    <>
      <Badge color="gray" variant="light" ff="monospace" tt="none">{policy.key}</Badge>
      <Badge color="blue" variant="light" ff="monospace" tt="none">{policy.category ?? 'authentication'}</Badge>
    </>
  )
}

function StageBindingChips({
  selected,
  onToggle,
}: {
  selected: AuthStageType[]
  onToggle: (stage: AuthStageType, active: boolean) => void
}) {
  return (
    <Group gap="xs">
      {AUTH_STAGES.map((stage) => {
        const active = selected.includes(stage)
        return (
          <Chip
            key={stage}
            size="xs"
            checked={active}
            onChange={() => onToggle(stage, active)}
            styles={{ label: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          >
            {stage}
          </Chip>
        )
      })}
    </Group>
  )
}

function PolicyCodeEditor({
  value,
  onChange,
  placeholder,
  height = 220,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  height?: number
}) {
  return (
    <Box
      style={{
        overflow: 'hidden',
        borderRadius: 'var(--mantine-radius-sm)',
        border: '1px solid var(--nx-color-border)',
      }}
    >
      <Editor
        language="javascript"
        value={value}
        height={height}
        onChange={(next) => onChange(next ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
        loading={
          <Textarea
            w="100%"
            variant="unstyled"
            px="sm"
            py="xs"
            minRows={8}
            autosize
            styles={monoInputStyles}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        }
      />
    </Box>
  )
}

function parseExampleConfig(policyKey: string) {
  try {
    return JSON.parse(exampleConfigs[policyKey] ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function createAssignmentDraft(policyKey: string): AssignmentDraft {
  const config = parseExampleConfig(policyKey)
  return {
    scopeType: 'global',
    scopeId: '',
    config,
    rawConfig: JSON.stringify(config, null, 2),
    rawMode: false,
  }
}

function inferFieldKind(value: unknown): ConfigFieldKind {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number') ? 'number_array' : 'string_array'
  }
  return 'json'
}

function humanizeFieldName(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config)
  if (entries.length === 0) return 'No configuration'
  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
      if (typeof value === 'object' && value !== null) return `${key}: ${JSON.stringify(value)}`
      return `${key}: ${String(value)}`
    })
    .join(' | ')
}

function AssignmentConfigEditor({
  draft,
  policyKey,
  onDraftChange,
}: {
  draft: AssignmentDraft
  policyKey: string
  onDraftChange: (next: AssignmentDraft) => void
}) {
  const fieldEntries = Object.entries(draft.config)

  const updateConfigValue = (key: string, value: unknown) => {
    const nextConfig = { ...draft.config, [key]: value }
    onDraftChange({
      ...draft,
      config: nextConfig,
      rawConfig: JSON.stringify(nextConfig, null, 2),
    })
  }

  const setRawConfig = (rawConfig: string) => {
    onDraftChange({ ...draft, rawConfig })
  }

  const applyRawConfig = () => {
    const parsed = JSON.parse(draft.rawConfig || '{}') as Record<string, unknown>
    onDraftChange({
      ...draft,
      config: parsed,
      rawConfig: JSON.stringify(parsed, null, 2),
    })
  }

  return (
    <Stack gap="md">
      <Box>
        <SectionLabel>Where It Applies</SectionLabel>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <NativeSelect
            label="Scope Type"
            value={draft.scopeType}
            onChange={(e) => onDraftChange({
              ...draft,
              scopeType: e.target.value as ScopeType,
              scopeId: e.target.value === 'global' ? '' : draft.scopeId,
            })}
            data={['global', 'tenant', 'group', 'user']}
          />
          <TextInput
            label="Scope ID"
            placeholder={draft.scopeType === 'global' ? 'Not required for global scope' : `Enter ${draft.scopeType} id`}
            value={draft.scopeId}
            disabled={draft.scopeType === 'global'}
            onChange={(e) => onDraftChange({ ...draft, scopeId: e.target.value })}
          />
        </SimpleGrid>
      </Box>

      <Box>
        <Group justify="space-between" align="flex-start" gap="sm" mb="xs" wrap="nowrap">
          <Box>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>Configuration</Text>
            <Text size="xs" c="dimmed" mt={4}>
              Fields are generated from the default config shape for <Code>{policyKey}</Code>.
            </Text>
          </Box>
          <Button
            variant="default"
            size="xs"
            onClick={() => onDraftChange({ ...draft, rawMode: !draft.rawMode })}
          >
            {draft.rawMode ? 'Use Generated Fields' : 'Edit Raw JSON'}
          </Button>
        </Group>

        {draft.rawMode ? (
          <Stack gap="xs">
            <Textarea
              autosize
              minRows={8}
              styles={monoInputStyles}
              value={draft.rawConfig}
              onChange={(e) => setRawConfig(e.target.value)}
              placeholder="{}"
            />
            <Group justify="flex-end">
              <Button size="xs" onClick={applyRawConfig}>
                Apply JSON
              </Button>
            </Group>
          </Stack>
        ) : fieldEntries.length === 0 ? (
          <Paper
            withBorder
            px="sm"
            py="md"
            radius="sm"
            bg="var(--nx-color-surface-sunken)"
            style={{ borderStyle: 'dashed' }}
          >
            <Text size="sm" c="dimmed">
              This policy has no default config fields yet. Use raw JSON mode if you want to store custom configuration.
            </Text>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            {fieldEntries.map(([key, value]) => {
              const fieldKind = inferFieldKind(value)

              if (fieldKind === 'boolean') {
                return (
                  <NativeSelect
                    key={key}
                    label={humanizeFieldName(key)}
                    value={String(Boolean(value))}
                    onChange={(e) => updateConfigValue(key, e.target.value === 'true')}
                    data={['true', 'false']}
                  />
                )
              }

              if (fieldKind === 'number') {
                return (
                  <NumberInput
                    key={key}
                    label={humanizeFieldName(key)}
                    value={value as number}
                    onChange={(next) => updateConfigValue(key, Number(next))}
                  />
                )
              }

              if (fieldKind === 'string') {
                return (
                  <TextInput
                    key={key}
                    label={humanizeFieldName(key)}
                    value={String(value)}
                    onChange={(e) => updateConfigValue(key, e.target.value)}
                  />
                )
              }

              if (fieldKind === 'string_array' || fieldKind === 'number_array') {
                const current = Array.isArray(value) ? value.join(', ') : ''
                return (
                  <TextInput
                    key={key}
                    style={{ gridColumn: '1 / -1' }}
                    label={humanizeFieldName(key)}
                    description="Use comma-separated values."
                    inputWrapperOrder={['label', 'input', 'description', 'error']}
                    value={current}
                    onChange={(e) => {
                      const items = e.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                      updateConfigValue(
                        key,
                        fieldKind === 'number_array' ? items.map((item) => Number(item)) : items
                      )
                    }}
                  />
                )
              }

              return (
                <Textarea
                  key={key}
                  style={{ gridColumn: '1 / -1' }}
                  label={humanizeFieldName(key)}
                  autosize
                  minRows={5}
                  styles={monoInputStyles}
                  value={JSON.stringify(value ?? {}, null, 2)}
                  onChange={(e) => {
                    try {
                      updateConfigValue(key, JSON.parse(e.target.value))
                    } catch {
                      onDraftChange({
                        ...draft,
                        config: draft.config,
                        rawConfig: JSON.stringify({ ...draft.config, [key]: e.target.value }, null, 2),
                      })
                    }
                  }}
                />
              )
            })}
          </SimpleGrid>
        )}
      </Box>
    </Stack>
  )
}

export default function Policies() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput)
  const { data: policies = [], isLoading } = usePolicies(debouncedSearch)
  const { data: decisions = [], isLoading: decisionsLoading } = usePolicyDecisions(100)
  const createPolicy = useCreatePolicy()
  const updatePolicy = useUpdatePolicy()
  const deletePolicy = useDeletePolicy()
  const setAssignment = useSetPolicyAssignment()
  const removeAssignment = useRemovePolicyAssignment()

  const [activeTab, setActiveTab] = useState<PolicyTab>('definitions')
  const [newPolicy, setNewPolicy] = useState({
    key: '',
    name: '',
    description: '',
    category: 'authentication' as PolicyCategory,
    stageBindings: [] as AuthStageType[],
    javascriptCode: '',
    enabled: true
  })
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({})
  const [policyEditState, setPolicyEditState] = useState<Record<string, { category: PolicyCategory; stageBindings: AuthStageType[]; javascriptCode: string }>>({})

  const sortedPolicies = useMemo(() => [...policies].sort((a: any, b: any) => a.key.localeCompare(b.key)), [policies])

  if (isLoading) {
    return (
      <Stack gap="lg">
        <PageHeaderSkeleton blocks={1} />
        <TableSkeleton rows={4} />
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Security"
        title="Policies"
        description="Define policy behavior in JavaScript, then manage where each policy applies and its configuration separately."
      />

      <SearchInput maw={360} value={searchInput} onChange={setSearchInput} placeholder="Search policies by key or name…" />

      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value as PolicyTab)}>
        <Tabs.List>
          <Tabs.Tab value="definitions">Definitions</Tabs.Tab>
          <Tabs.Tab value="configuration">Configuration</Tabs.Tab>
          <Tabs.Tab value="decisions">Decision History</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === 'definitions' ? (
        <Stack gap="lg">
          <SectionCard title="Create Policy Definition">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                <TextInput aria-label="key" placeholder="key" value={newPolicy.key} onChange={(e) => setNewPolicy((v) => ({ ...v, key: e.target.value }))} />
                <TextInput aria-label="name" placeholder="name" value={newPolicy.name} onChange={(e) => setNewPolicy((v) => ({ ...v, name: e.target.value }))} />
                <TextInput aria-label="description" placeholder="description" value={newPolicy.description} onChange={(e) => setNewPolicy((v) => ({ ...v, description: e.target.value }))} />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                <NativeSelect
                  aria-label="Category"
                  value={newPolicy.category}
                  onChange={(e) => setNewPolicy((v) => ({
                    ...v,
                    category: e.target.value as PolicyCategory,
                    stageBindings: e.target.value === 'authorization' ? [] : v.stageBindings
                  }))}
                  data={['authentication', 'authorization']}
                />
              </SimpleGrid>

              {newPolicy.category === 'authentication' ? (
                <Box>
                  <SectionLabel>Stage Bindings</SectionLabel>
                  <StageBindingChips
                    selected={newPolicy.stageBindings}
                    onToggle={(stage, active) => setNewPolicy((v) => ({
                      ...v,
                      stageBindings: active ? v.stageBindings.filter((s) => s !== stage) : [...v.stageBindings, stage]
                    }))}
                  />
                </Box>
              ) : (
                <Text size="xs" c="dimmed">Authorization policies do not use stage bindings.</Text>
              )}

              <Box>
                <SectionLabel>JavaScript Validator (optional)</SectionLabel>
                <PolicyCodeEditor
                  value={newPolicy.javascriptCode}
                  placeholder={defaultJsTemplate}
                  onChange={(next) => setNewPolicy((v) => ({ ...v, javascriptCode: next }))}
                />
              </Box>

              <Group justify="flex-end">
                <Button
                  loading={createPolicy.isPending}
                  onClick={async () => {
                    await createPolicy.mutateAsync({
                      ...newPolicy,
                      stageBindings: newPolicy.category === 'authorization' ? [] : newPolicy.stageBindings,
                      javascriptCode: newPolicy.javascriptCode.trim() || undefined
                    })
                    setNewPolicy({ key: '', name: '', description: '', category: 'authentication', stageBindings: [], javascriptCode: '', enabled: true })
                  }}
                >
                  Add
                </Button>
              </Group>
            </Stack>
          </SectionCard>

          <SectionCard
            title="JavaScript Policy Interface"
            description="Available objects/functions in server-side policy scripts:"
          >
            <CodeBlock
              fz="xs"
              language="javascript"
              code={`policy.key
policy.name
policy.stage
policy.assignment.enabled
policy.assignment.config
policy.user.id
policy.user.email
policy.user.username
policy.user.givenName
policy.user.familyName
policy.user.active
policy.user.isServiceUser
policy.user.customAttributes
policy.request.tenantId
policy.request.clientId
policy.request.ip
policy.request.resource
policy.request.action
policy.request.context
now() // returns current ISO timestamp

// Return one of:
// true | undefined
// false
// "error message"
// { allow: false, message: "error message" }`}
            />
          </SectionCard>

          <PolicyDecisionSimulator />

          <Stack gap="md">
            {sortedPolicies.map((policy: any) => {
              const editState = policyEditState[policy.id] ?? {
                category: (policy.category ?? 'authentication') as PolicyCategory,
                stageBindings: (policy.stageBindings ?? []) as AuthStageType[],
                javascriptCode: policy.javascriptCode ?? ''
              }

              return (
                <SectionCard key={policy.id}>
                  <Stack gap="md">
                    <Box>
                      <Group gap="xs" wrap="wrap">
                        <Title order={3} size="h5">{policy.name}</Title>
                        <PolicyBadges policy={policy} />
                        <Button
                          variant={policy.enabled ? 'light' : 'subtle'}
                          color={policy.enabled ? 'green' : 'gray'}
                          size="xs"
                          onClick={() => updatePolicy.mutate({ id: policy.id, enabled: !policy.enabled })}
                        >
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                        <Button
                          color="red"
                          variant="light"
                          size="xs"
                          ml="auto"
                          onClick={() => deletePolicy.mutate(policy.id)}
                        >
                          Delete
                        </Button>
                      </Group>
                      {policy.description ? <Text size="sm" c="dimmed" mt="xs">{policy.description}</Text> : null}
                    </Box>

                    <Box>
                      <SectionLabel>Category</SectionLabel>
                      <NativeSelect
                        aria-label="Category"
                        maw={260}
                        value={editState.category}
                        onChange={(e) => setPolicyEditState((prev) => ({
                          ...prev,
                          [policy.id]: {
                            ...editState,
                            category: e.target.value as PolicyCategory,
                            stageBindings: e.target.value === 'authorization' ? [] : editState.stageBindings
                          }
                        }))}
                        data={['authentication', 'authorization']}
                      />
                    </Box>

                    <Box>
                      <SectionLabel>Stage Bindings</SectionLabel>
                      {editState.category === 'authentication' ? (
                        <StageBindingChips
                          selected={editState.stageBindings}
                          onToggle={(stage, active) => setPolicyEditState((prev) => ({
                            ...prev,
                            [policy.id]: {
                              ...editState,
                              stageBindings: active
                                ? editState.stageBindings.filter((s) => s !== stage)
                                : [...editState.stageBindings, stage]
                            }
                          }))}
                        />
                      ) : (
                        <Text size="xs" c="dimmed">Authorization policies do not use stage bindings.</Text>
                      )}
                    </Box>

                    <Box>
                      <SectionLabel>JavaScript Validator</SectionLabel>
                      <PolicyCodeEditor
                        value={editState.javascriptCode}
                        placeholder={defaultJsTemplate}
                        height={260}
                        onChange={(next) => setPolicyEditState((prev) => ({
                          ...prev,
                          [policy.id]: { ...editState, javascriptCode: next }
                        }))}
                      />
                      <Group justify="flex-end" mt="xs">
                        <Button
                          size="xs"
                          onClick={async () => {
                            await updatePolicy.mutateAsync({
                              id: policy.id,
                              category: editState.category,
                              stageBindings: editState.category === 'authorization' ? [] : editState.stageBindings,
                              javascriptCode: editState.javascriptCode.trim() || null
                            })
                          }}
                        >
                          Save Definition
                        </Button>
                      </Group>
                    </Box>
                  </Stack>
                </SectionCard>
              )
            })}
          </Stack>
        </Stack>
      ) : activeTab === 'configuration' ? (
        <Stack gap="md">
          <SectionCard
            title="Policy Configuration"
            description="Choose where a policy applies first, then fill in the generated configuration fields derived from its default JSON structure."
          />

          {sortedPolicies.map((policy: any) => {
            const draft = assignmentDrafts[policy.id] ?? createAssignmentDraft(policy.key)

            return (
              <SectionCard key={policy.id}>
                <Stack gap="md">
                  <Box>
                    <Group gap="xs" wrap="wrap">
                      <Title order={3} size="h5">{policy.name}</Title>
                      <PolicyBadges policy={policy} />
                      <Badge color={policy.enabled ? 'green' : 'gray'} variant="light">
                        {policy.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </Group>
                    {policy.description ? <Text size="sm" c="dimmed" mt="xs">{policy.description}</Text> : null}
                  </Box>

                  <Paper withBorder radius="md" p="md" bg="var(--nx-color-surface-sunken)">
                    <AssignmentConfigEditor
                      draft={draft}
                      policyKey={policy.key}
                      onDraftChange={(next) => setAssignmentDrafts((prev) => ({ ...prev, [policy.id]: next }))}
                    />
                    <Group justify="flex-end" mt="md">
                      <Button
                        loading={setAssignment.isPending && setAssignment.variables?.id === policy.id}
                        onClick={async () => {
                          await setAssignment.mutateAsync({
                            id: policy.id,
                            scopeType: draft.scopeType,
                            scopeId: draft.scopeType === 'global' ? undefined : draft.scopeId,
                            enabled: true,
                            config: draft.rawMode ? JSON.parse(draft.rawConfig || '{}') : draft.config
                          })
                        }}
                      >
                        Upsert Assignment
                      </Button>
                    </Group>
                  </Paper>

                  <Box>
                    <SectionLabel>Existing Assignments</SectionLabel>
                    {(policy.assignments ?? []).length === 0 ? (
                      <Paper
                        withBorder
                        px="sm"
                        py="md"
                        radius="sm"
                        bg="var(--nx-color-surface-sunken)"
                        style={{ borderStyle: 'dashed' }}
                      >
                        <Text size="sm" c="dimmed">No assignments configured yet.</Text>
                      </Paper>
                    ) : (
                      <Stack gap="xs">
                        {(policy.assignments ?? []).map((assignment: any) => (
                          <Paper key={assignment.id} withBorder px="sm" py="xs" radius="sm">
                            <Group gap="xs" wrap="nowrap">
                              <Badge color="gray" variant="light" ff="monospace" tt="none">{assignment.scopeType}</Badge>
                              <Text size="xs" ff="monospace" c="dimmed">{assignment.scopeId || 'global'}</Text>
                              <Text size="xs" c="dimmed" truncate style={{ flex: 1, minWidth: 0 }}>
                                {summarizeConfig(assignment.config ?? {})}
                              </Text>
                              <Button
                                color="red"
                                variant="subtle"
                                size="xs"
                                onClick={() => removeAssignment.mutate({
                                  id: policy.id,
                                  scopeType: assignment.scopeType,
                                  scopeId: assignment.scopeType === 'global' ? undefined : assignment.scopeId
                                })}
                              >
                                Remove
                              </Button>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </SectionCard>
            )
          })}
        </Stack>
      ) : (
        <SectionCard
          flush
          title="Authorization Decision History"
          description="View recent policy evaluation decisions for audit and debugging purposes."
        >
          {decisionsLoading ? (
            <TableSkeleton rows={4} />
          ) : decisions.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No authorization decisions recorded yet."
              description="Run policy evaluations or access protected resources to generate decision logs."
            />
          ) : (
            <Table.ScrollContainer minWidth={860}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Timestamp</Table.Th>
                    <Table.Th>Subject</Table.Th>
                    <Table.Th>Resource</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Decision</Table.Th>
                    <Table.Th>Policy Applied</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {decisions.map((decision: any, idx: number) => {
                    const allowed = decision.decision === 'allow' || decision.allowed
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text size="xs" c="dimmed" ff="monospace">
                            {new Date(decision.evaluatedAt ?? decision.createdAt).toLocaleString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" ff="monospace">{decision.userId?.slice(0, 12)}…</Text>
                        </Table.Td>
                        <Table.Td maw={280}>
                          <Text size="sm" truncate>{decision.resource || '—'}</Text>
                        </Table.Td>
                        <Table.Td><Code>{decision.action}</Code></Table.Td>
                        <Table.Td>
                          <Badge color={allowed ? 'green' : 'red'} variant="light">
                            {allowed ? 'ALLOW' : 'DENY'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{decision.policyId || decision.policyKey || '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SectionCard>
      )}
    </Stack>
  )
}
