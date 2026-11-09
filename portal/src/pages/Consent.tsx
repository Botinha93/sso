import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { AuthCard, AuthLayout } from '@botinha93/nexus-design'
import { useI18n } from '../i18n'
import { oauthConsentContinuation } from '../lib/oauth-continuation'

interface ConsentRequest {
  requestId: string
  client: { id: string; name: string }
  redirectUri: string
  scopes: string[]
  state: string
  authorization: Record<string, string>
}

export default function Consent() {
  const [request, setRequest] = useState<ConsentRequest | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/oauth/consent/request${window.location.search}`, { credentials: 'include' })
        if (!response.ok) throw new Error('This authorization request could not be verified. Restart sign-in from the application.')
        setRequest(await response.json() as ConsentRequest)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'This authorization request could not be verified.')
      }
    })()
  }, [])

  const submit = async (decision: 'approve' | 'deny') => {
    if (!request || pending) return
    setPending(true)
    setError('')
    try {
      const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' })
      if (!csrfResponse.ok) throw new Error('Could not prepare a secure consent response. Reload and try again.')
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      if (!csrf.csrf_token) throw new Error('Could not prepare a secure consent response. Reload and try again.')
      const response = await fetch('/oauth/consent', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrf_token },
        body: JSON.stringify({
          consent_request_id: request.requestId,
          client_id: request.client.id,
          redirect_uri: request.redirectUri,
          scope: request.scopes.join(' '),
          state: request.authorization.state,
          nonce: request.authorization.nonce,
          ...(request.authorization.nexushub_profile === 'nexushub:1' ? {
            nexushub_profile: request.authorization.nexushub_profile,
            nexushub_installation_id: request.authorization.nexushub_installation_id,
            resource_audience: request.authorization.resource_audience,
          } : {}),
          decision,
        }),
      })
      if (!response.ok) throw new Error('NexusID could not record this consent decision. Reload the authorization request and try again.')
      const continuation = oauthConsentContinuation(request.authorization, decision)
      if (!continuation) throw new Error('The validated authorization request could not be resumed.')
      window.location.assign(continuation)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Consent could not be submitted.')
      setPending(false)
    }
  }

  const content = error ? <Alert color="red" title="Authorization needs attention">{error}</Alert>
    : !request ? <Group justify="center"><Loader size="sm" /><Text>Verifying authorization request…</Text></Group>
      : <Stack gap="md">
        <Text>{request.client.name} is requesting access to your NexusID account.</Text>
        <Card withBorder>
          <Stack gap="xs">
            <Text fw={600}>Requested permissions</Text>
            {request.scopes.map(scope => <Text key={scope} size="sm">• {scope}</Text>)}
            <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>Registered return address: {request.redirectUri}</Text>
          </Stack>
        </Card>
        <Text size="sm" c="dimmed">Approval applies only to this registered application and these displayed permissions.</Text>
        <Group justify="flex-end">
          <Button variant="default" disabled={pending} onClick={() => void submit('deny')}>Deny</Button>
          <Button loading={pending} onClick={() => void submit('approve')}>Approve access</Button>
        </Group>
      </Stack>

  return <AuthLayout><AuthCard title="Application access" subtitle="Review what this application may access">{content}</AuthCard></AuthLayout>
}
