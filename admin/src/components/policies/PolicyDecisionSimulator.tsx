import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  NativeSelect,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { SectionCard } from '@nexus/design'
import { useState } from 'react'
import {
  useAuthorizationCheck,
  useEvaluatePolicyDecision,
  usePolicyDecisions,
  useUsers,
} from '../../hooks/useApi'
import { DECISION_STRATEGIES, type PolicyDecisionStrategy } from './policy-config'

function AllowBadge({ allow, children }: { allow: boolean; children: React.ReactNode }) {
  return (
    <Badge color={allow ? 'green' : 'red'} variant="light" size="sm">
      {children}
    </Badge>
  )
}

export function PolicyDecisionSimulator() {
  const { data: users = [] } = useUsers()
  const { data: history = [] } = usePolicyDecisions(20)
  const evaluatePolicyDecision = useEvaluatePolicyDecision()
  const authorizationCheck = useAuthorizationCheck()

  const [simulationInput, setSimulationInput] = useState({
    userId: '',
    resource: 'finance:invoice:123',
    action: 'write',
    decisionStrategy: 'deny_overrides' as PolicyDecisionStrategy,
    tenantId: '',
    clientId: 'sso-admin-ui',
    ip: '127.0.0.1',
    context: '{"department":"finance"}'
  })
  const [simulationResult, setSimulationResult] = useState<any | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)
  const [runMode, setRunMode] = useState<'evaluate' | 'check'>('evaluate')

  const isRunning = evaluatePolicyDecision.isPending || authorizationCheck.isPending

  return (
    <SectionCard
      title="Decision Simulator"
      description="Simulate authorization policy outcomes using unbound policies (those with no stage bindings)."
    >
      <Stack gap="md">
        <SegmentedControl
          w="fit-content"
          size="xs"
          value={runMode}
          onChange={(value) => setRunMode(value as 'evaluate' | 'check')}
          data={[
            { value: 'evaluate', label: 'Policies Evaluate' },
            { value: 'check', label: 'Authorization Check' },
          ]}
        />

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
          <NativeSelect
            aria-label="User"
            value={simulationInput.userId}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, userId: e.target.value }))}
          >
            <option value="">Select user</option>
            {users.map((user: any) => (
              <option key={user.id} value={user.id}>
                {user.email} ({user.id})
              </option>
            ))}
          </NativeSelect>
          <TextInput
            placeholder="resource"
            value={simulationInput.resource}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, resource: e.target.value }))}
          />
          <TextInput
            placeholder="action"
            value={simulationInput.action}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, action: e.target.value }))}
          />
          <NativeSelect
            aria-label="Decision strategy"
            value={simulationInput.decisionStrategy}
            onChange={(e) => setSimulationInput((prev) => ({
              ...prev,
              decisionStrategy: e.target.value as PolicyDecisionStrategy
            }))}
            data={DECISION_STRATEGIES}
          />
          <TextInput
            placeholder="tenantId (optional)"
            value={simulationInput.tenantId}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, tenantId: e.target.value }))}
          />
          <TextInput
            placeholder="clientId (optional)"
            value={simulationInput.clientId}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, clientId: e.target.value }))}
          />
          <TextInput
            placeholder="ip (optional)"
            value={simulationInput.ip}
            onChange={(e) => setSimulationInput((prev) => ({ ...prev, ip: e.target.value }))}
          />
        </SimpleGrid>

        <Textarea
          autosize
          minRows={4}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 'var(--mantine-font-size-xs)' } }}
          placeholder='context json e.g. {"department":"finance"}'
          value={simulationInput.context}
          onChange={(e) => setSimulationInput((prev) => ({ ...prev, context: e.target.value }))}
          description={
            <>
              Tip: assignment config supports <Code>effect</Code>, <Code>priority</Code>, <Code>resourcePattern</Code>, and <Code>actionPattern</Code>.
            </>
          }
          inputWrapperOrder={['label', 'input', 'description', 'error']}
        />

        <Group justify="flex-end">
          <Button
            loading={isRunning}
            disabled={isRunning}
            onClick={async () => {
              setSimulationError(null)
              setSimulationResult(null)

              let parsedContext: Record<string, unknown> = {}
              try {
                parsedContext = simulationInput.context.trim() ? JSON.parse(simulationInput.context) : {}
              } catch {
                setSimulationError('Context must be valid JSON')
                return
              }

              try {
                const payload = {
                  userId: simulationInput.userId,
                  resource: simulationInput.resource,
                  action: simulationInput.action,
                  decisionStrategy: simulationInput.decisionStrategy,
                  tenantId: simulationInput.tenantId || undefined,
                  clientId: simulationInput.clientId || undefined,
                  ip: simulationInput.ip || undefined,
                  context: parsedContext
                }

                const result = runMode === 'check'
                  ? await authorizationCheck.mutateAsync(payload)
                  : await evaluatePolicyDecision.mutateAsync(payload)
                setSimulationResult(result)
              } catch (err) {
                setSimulationError(err instanceof Error ? err.message : 'Simulation failed')
              }
            }}
          >
            {isRunning ? 'Evaluating...' : runMode === 'check' ? 'Run Check' : 'Evaluate'}
          </Button>
        </Group>

        {simulationError ? (
          <Alert color="red" variant="light">
            {simulationError}
          </Alert>
        ) : null}

        {simulationResult ? (
          <Stack gap="sm">
            <Alert color={simulationResult.allow ? 'green' : 'red'} variant="light" p="xs">
              <Text size="sm" fw={500}>Decision: {simulationResult.allow ? 'ALLOW' : 'DENY'}</Text>
            </Alert>
            <Text size="xs" c="dimmed">
              Strategy: {String(simulationResult.decisionStrategy ?? simulationInput.decisionStrategy)}
            </Text>
            <Stack gap="xs">
              {(simulationResult.decisions ?? []).map((decision: any) => (
                <Paper key={decision.policyId} withBorder px="sm" py="xs" radius="sm">
                  <Group gap="xs" wrap="wrap">
                    <Text size="xs" ff="monospace">{decision.key}</Text>
                    <Badge color="gray" variant="light" size="sm">
                      {String(decision.effect ?? 'deny')}
                    </Badge>
                    <Badge color="gray" variant="light" size="sm">
                      p={String(decision.priority ?? 0)}
                    </Badge>
                    <Badge color={decision.applied ? 'blue' : 'gray'} variant="light" size="sm">
                      {decision.applied ? 'applied' : 'not_applied'}
                    </Badge>
                    <AllowBadge allow={Boolean(decision.allow)}>
                      {decision.allow ? 'allow' : 'deny'}
                    </AllowBadge>
                  </Group>
                  {decision.message ? <Text size="xs" c="red" mt={4}>{decision.message}</Text> : null}
                </Paper>
              ))}
            </Stack>
          </Stack>
        ) : null}

        <Divider />
        <Box>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: '0.05em' }}>
            Recent Decisions
          </Text>
          <Stack gap="xs">
            {(history as any[]).slice(0, 10).map((item: any) => (
              <Paper key={item.id} withBorder px="sm" py="xs" radius="sm">
                <Group gap="xs" wrap="wrap">
                  <AllowBadge allow={Boolean(item.allow)}>
                    {item.allow ? 'allow' : 'deny'}
                  </AllowBadge>
                  <Text size="xs" ff="monospace">{String(item.action ?? '')}</Text>
                  <Text size="xs" ff="monospace" c="dimmed">{String(item.resource ?? '')}</Text>
                </Group>
                {Array.isArray(item.deniedBy) && item.deniedBy.length > 0 ? (
                  <Text size="xs" c="red" mt={4}>Denied by: {item.deniedBy.join(', ')}</Text>
                ) : null}
              </Paper>
            ))}
          </Stack>
        </Box>
      </Stack>
    </SectionCard>
  )
}
