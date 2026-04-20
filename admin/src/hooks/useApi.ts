import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_BASE = '/api/admin'

let csrfToken: string | null = null

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch('/api/csrf-token', { credentials: 'include' })
  const data = await res.json()
  csrfToken = data.csrf_token
  return csrfToken!
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

const jsonFetch = async (url: string, options?: RequestInit) => {
  const method = (options?.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = { ...(options?.headers as Record<string, string>) }
  if (MUTATING_METHODS.has(method) && url.startsWith(API_BASE)) {
    headers['X-CSRF-Token'] = await getCsrfToken()
  }
  const res = await fetch(url, { credentials: 'include', ...options, headers })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

// --- Setup ---
export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup-status'],
    queryFn: () => jsonFetch('/api/setup/status')
  })
}

export function useInitializeSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      email: string
      username: string
      password: string
      databaseProvider?: 'sqlite' | 'postgresql' | 'mysql'
      databasePath?: string
      externalDatabaseUrl?: string
    }) => jsonFetch('/api/setup/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      queryClient.invalidateQueries({ queryKey: ['admin-me'] })
    }
  })
}

// --- Session User ---
export function useAdminMe() {
  return useQuery({
    queryKey: ['admin-me'],
    queryFn: () => jsonFetch(`${API_BASE}/me`),
    retry: false
  })
}

// --- Clients ---
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: () => jsonFetch(`${API_BASE}/clients`)
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (client: any) => jsonFetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => jsonFetch(`${API_BASE}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) => jsonFetch(`${API_BASE}/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useScopes() {
  return useQuery({
    queryKey: ['scopes'],
    queryFn: () => jsonFetch(`${API_BASE}/scopes`)
  })
}

export function useCreateScope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scope: { name: string; description: string }) => jsonFetch(`${API_BASE}/scopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scope)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scopes'] })
  })
}

export function useDeleteScope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scopeId: string) => jsonFetch(`${API_BASE}/scopes/${scopeId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scopes'] })
  })
}

// --- Sessions ---
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => jsonFetch(`${API_BASE}/sessions`)
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => jsonFetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] })
  })
}

// --- Devices ---
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => jsonFetch(`${API_BASE}/devices`)
  })
}

export function useRevokeDeviceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceCode: string) => jsonFetch(`${API_BASE}/devices/requests/${deviceCode}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] })
  })
}

export function useRevokeDeviceSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => jsonFetch(`${API_BASE}/devices/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }
  })
}

// --- Consents ---
export function useConsents() {
  return useQuery({
    queryKey: ['consents'],
    queryFn: () => jsonFetch(`${API_BASE}/consents`)
  })
}

export function useRevokeConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (consentId: string) => jsonFetch(`${API_BASE}/consents/${consentId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents'] })
  })
}

// --- Audit ---
export function useAuditLog(limit = 100) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: () => jsonFetch(`${API_BASE}/audit?limit=${limit}`),
    refetchInterval: 30_000
  })
}

// --- Users ---
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => jsonFetch(`${API_BASE}/users`)
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (user: any) => jsonFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string
      appId?: string
      isServiceUser?: boolean
      email?: string
      username?: string
      givenName?: string
      familyName?: string
      active?: boolean
      groupIds?: string[]
      customAttributes?: Record<string, string>
    }) => jsonFetch(`${API_BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

// --- Apps ---
export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: () => jsonFetch(`${API_BASE}/apps`)
  })
}

export function useCreateApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (app: { name: string; description: string; icon?: string; url?: string }) => jsonFetch(`${API_BASE}/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apps'] })
  })
}

export function useUpdateApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; icon?: string; url?: string | null }) => jsonFetch(`${API_BASE}/apps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apps'] })
  })
}

export function useDeleteApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apps'] })
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => jsonFetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      jsonFetch(`${API_BASE}/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
  })
}

// --- Roles ---
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => jsonFetch(`${API_BASE}/roles`)
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: any) => jsonFetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] })
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: any) => jsonFetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] })
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => jsonFetch(`${API_BASE}/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] })
  })
}

// --- Groups ---
export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => jsonFetch(`${API_BASE}/groups`)
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (group: any) => jsonFetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) => jsonFetch(`${API_BASE}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; appId?: string; name?: string; description?: string }) =>
      jsonFetch(`${API_BASE}/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export function useAssignRoleToGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, roleId }: { groupId: string; roleId: string }) =>
      jsonFetch(`${API_BASE}/group-role-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, roleId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export function useRemoveRoleFromGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, roleId }: { groupId: string; roleId: string }) =>
      jsonFetch(`${API_BASE}/group-role-assignments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, roleId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

export function useAssignUserToGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, groupId }: { userId: string; groupId: string }) =>
      jsonFetch(`${API_BASE}/user-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, groupId })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

export function useRemoveUserFromGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, groupId }: { userId: string; groupId: string }) =>
      jsonFetch(`${API_BASE}/user-groups`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, groupId })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

// --- Tenants ---
export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => jsonFetch(`${API_BASE}/tenants`)
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tenant: any) => jsonFetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] })
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; slug?: string; name?: string; active?: boolean }) =>
      jsonFetch(`${API_BASE}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] })
  })
}

// --- Federation Providers ---
export function useFederationProviders() {
  return useQuery({
    queryKey: ['federation-providers'],
    queryFn: () => jsonFetch(`${API_BASE}/federation/providers`)
  })
}

export function useCreateFederationProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (provider: any) => jsonFetch(`${API_BASE}/federation/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['federation-providers'] })
    }
  })
}

export function useUpdateFederationProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...provider }: any) => jsonFetch(`${API_BASE}/federation/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['federation-providers'] })
    }
  })
}

export function useDeleteFederationProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/federation/providers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['federation-providers'] })
    }
  })
}

// --- Authentication Flows ---
export function useAuthenticationFlows() {
  return useQuery({
    queryKey: ['authentication-flows'],
    queryFn: () => jsonFetch(`${API_BASE}/authentication/flows`)
  })
}

export function useCreateAuthenticationFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (flow: any) => jsonFetch(`${API_BASE}/authentication/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authentication-flows'] })
    }
  })
}

export function useUpdateAuthenticationFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...flow }: any) => jsonFetch(`${API_BASE}/authentication/flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authentication-flows'] })
    }
  })
}

export function useDeleteAuthenticationFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/authentication/flows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authentication-flows'] })
    }
  })
}

// --- User Attributes ---
export function useUserAttributes() {
  return useQuery({
    queryKey: ['user-attributes'],
    queryFn: () => jsonFetch(`${API_BASE}/user-attributes`)
  })
}

export function useCreateUserAttribute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attribute: any) => jsonFetch(`${API_BASE}/user-attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attribute)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-attributes'] })
  })
}

export function useUpdateUserAttribute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...attribute }: any) => jsonFetch(`${API_BASE}/user-attributes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attribute)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-attributes'] })
  })
}

export function useDeleteUserAttribute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/user-attributes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-attributes'] })
  })
}

export function useSetUserAttributeGroupAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, groupId, enabled }: { id: string; groupId: string; enabled: boolean }) =>
      jsonFetch(`${API_BASE}/user-attributes/${id}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, enabled })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-attributes'] })
  })
}

export function useRemoveUserAttributeGroupAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string }) =>
      jsonFetch(`${API_BASE}/user-attributes/${id}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-attributes'] })
  })
}

// --- Policies ---
export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: () => jsonFetch(`${API_BASE}/policies`)
  })
}

export function useCreatePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (policy: any) => jsonFetch(`${API_BASE}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  })
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...policy }: any) => jsonFetch(`${API_BASE}/policies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  })
}

export function useDeletePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  })
}

export function useSetPolicyAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => jsonFetch(`${API_BASE}/policies/${id}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  })
}

export function useRemovePolicyAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: any) => jsonFetch(`${API_BASE}/policies/${id}/assignments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] })
  })
}

export function useEvaluatePolicyDecision() {
  return useMutation({
    mutationFn: (payload: {
      userId: string
      resource: string
      action: string
      decisionStrategy?: 'deny_overrides' | 'allow_overrides' | 'first_applicable'
      tenantId?: string
      clientId?: string
      ip?: string
      context?: Record<string, unknown>
    }) =>
      jsonFetch(`${API_BASE}/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
  })
}

export function useAuthorizationCheck() {
  return useMutation({
    mutationFn: (payload: {
      userId: string
      resource: string
      action: string
      decisionStrategy?: 'deny_overrides' | 'allow_overrides' | 'first_applicable'
      tenantId?: string
      clientId?: string
      ip?: string
      context?: Record<string, unknown>
    }) =>
      jsonFetch(`${API_BASE}/authorization/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
  })
}

export function usePolicyDecisions(limit = 50) {
  return useQuery({
    queryKey: ['policy-decisions', limit],
    queryFn: () => jsonFetch(`${API_BASE}/policies/decisions?limit=${limit}`),
    refetchInterval: 15000
  })
}

// --- Event Hooks ---
export function useEventHooks() {
  return useQuery({
    queryKey: ['event-hooks'],
    queryFn: () => jsonFetch(`${API_BASE}/events/hooks`)
  })
}

export function useSystemEventTypes() {
  return useQuery({
    queryKey: ['system-event-types'],
    queryFn: () => jsonFetch(`${API_BASE}/events/types`)
  })
}

export function useCreateEventHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (hook: any) => jsonFetch(`${API_BASE}/events/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hook)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-hooks'] })
  })
}

export function useUpdateEventHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...hook }: any) => jsonFetch(`${API_BASE}/events/hooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hook)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-hooks'] })
  })
}

export function useDeleteEventHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/events/hooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-hooks'] })
  })
}

export function useTestEventHook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, eventType }: { id: string; eventType?: string }) =>
      jsonFetch(`${API_BASE}/events/hooks/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventType ? { eventType } : {})
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-notifications'] })
  })
}

export function useEventNotifications(limit = 100) {
  return useQuery({
    queryKey: ['event-notifications', limit],
    queryFn: () => jsonFetch(`${API_BASE}/events/notifications?limit=${limit}`),
    refetchInterval: 10000
  })
}

export interface ProvisioningTokenDto {
  id: string
  label: string
  createdAt: string
  updatedAt: string
  expiresAt?: string
  lastUsedAt?: string
}

export interface ProvisioningMappingDto {
  id: string
  name: string
  sourceAttribute: string
  targetAttribute: string
  transformExpression?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ProvisioningJobDto {
  id: string
  jobType: 'reconcile'
  status: 'running' | 'completed' | 'failed'
  summary: Record<string, unknown>
  initiatedByUserId?: string
  createdAt: string
  completedAt?: string
}

export interface AccessRequestDto {
  id: string
  requesterId: string
  subjectUserId: string
  entitlementType: string
  entitlementValue: string
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  justification: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface AccessReviewCampaignDto {
  id: string
  name: string
  description?: string
  status: 'active' | 'closed'
  createdByUserId: string
  dueAt?: string
  createdAt: string
  updatedAt: string
}

export interface AccessReviewItemDto {
  id: string
  campaignId: string
  subjectUserId: string
  entitlementType: 'role' | 'group'
  entitlementValue: string
  currentState: 'granted'
  decision?: 'certified' | 'revoked'
  decidedByUserId?: string
  decisionRationale?: string
  decidedAt?: string
  createdAt: string
  updatedAt: string
}

export function useProvisioningTokens() {
  return useQuery({
    queryKey: ['provisioning-tokens'],
    queryFn: () => jsonFetch(`${API_BASE}/provisioning/tokens`) as Promise<ProvisioningTokenDto[]>
  })
}

export function useCreateProvisioningToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { label: string; expiresAt?: string }) =>
      jsonFetch(`${API_BASE}/provisioning/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<{ id: string; label: string; token: string; createdAt: string; expiresAt?: string }>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provisioning-tokens'] })
  })
}

export function useDeleteProvisioningToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/provisioning/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provisioning-tokens'] })
  })
}

export function useProvisioningMappings() {
  return useQuery({
    queryKey: ['provisioning-mappings'],
    queryFn: () => jsonFetch(`${API_BASE}/provisioning/mappings`) as Promise<ProvisioningMappingDto[]>
  })
}

export function useCreateProvisioningMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      sourceAttribute: string
      targetAttribute: string
      transformExpression?: string
      enabled?: boolean
    }) =>
      jsonFetch(`${API_BASE}/provisioning/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provisioning-mappings'] })
  })
}

export function useDeleteProvisioningMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/provisioning/mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provisioning-mappings'] })
  })
}

export function useProvisioningJobs(limit = 20) {
  return useQuery({
    queryKey: ['provisioning-jobs', limit],
    queryFn: () => jsonFetch(`${API_BASE}/provisioning/jobs?limit=${limit}`) as Promise<ProvisioningJobDto[]>
  })
}

export function useRunProvisioningReconcile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { dryRun: boolean }) =>
      jsonFetch(`${API_BASE}/provisioning/jobs/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<ProvisioningJobDto>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provisioning-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['provisioning-mappings'] })
    }
  })
}

export function useAccessRequests(status?: AccessRequestDto['status'], limit = 50) {
  return useQuery({
    queryKey: ['access-requests', status ?? 'all', limit],
    queryFn: () => {
      const search = new URLSearchParams()
      search.set('limit', String(limit))
      if (status) {
        search.set('status', status)
      }
      return jsonFetch(`${API_BASE}/access-requests?${search.toString()}`) as Promise<AccessRequestDto[]>
    }
  })
}

export function useCreateAccessRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      subjectUserId: string
      entitlementType: string
      entitlementValue: string
      justification: string
      expiresAt?: string
    }) =>
      jsonFetch(`${API_BASE}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<AccessRequestDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] })
  })
}

export function useApproveAccessRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rationale }: { id: string; rationale?: string }) =>
      jsonFetch(`${API_BASE}/access-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rationale ? { rationale } : {})
      }) as Promise<AccessRequestDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] })
  })
}

export function useRejectAccessRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rationale }: { id: string; rationale?: string }) =>
      jsonFetch(`${API_BASE}/access-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rationale ? { rationale } : {})
      }) as Promise<AccessRequestDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] })
  })
}

export function useProcessExpiredAccessRequests() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { dryRun?: boolean; now?: string }) =>
      jsonFetch(`${API_BASE}/access-requests/process-expirations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<{ dryRun: boolean; evaluatedApprovedRequests: number; expiredRequests: number; revokedAssignments: number }>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] })
  })
}

export function useCreateAccessReviewCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; dueAt?: string }) =>
      jsonFetch(`${API_BASE}/access-reviews/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<{ campaign: AccessReviewCampaignDto; generatedItems: number }>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['access-review-campaign', result.campaign.id] })
    }
  })
}

export function useAccessReviewCampaign(campaignId?: string) {
  return useQuery({
    queryKey: ['access-review-campaign', campaignId ?? 'none'],
    queryFn: () => jsonFetch(`${API_BASE}/access-reviews/campaigns/${campaignId}`) as Promise<{
      campaign: AccessReviewCampaignDto
      items: AccessReviewItemDto[]
    }>,
    enabled: Boolean(campaignId)
  })
}

export function useDecideAccessReviewItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, rationale }: { id: string; decision: 'certified' | 'revoked'; rationale?: string }) =>
      jsonFetch(`${API_BASE}/access-reviews/items/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rationale ? { decision, rationale } : { decision })
      }) as Promise<AccessReviewItemDto>,
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['access-review-campaign', item.campaignId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

// --- Administration / Instance Settings ---
export function useInstanceSettings() {
  return useQuery({
    queryKey: ['instance-settings'],
    queryFn: () => jsonFetch(`${API_BASE}/settings`)
  })
}

export function useUpdateInstanceSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: {
      databaseProvider?: 'sqlite' | 'postgresql' | 'mysql'
      databasePath?: string
      externalDatabaseUrl?: string
      requireHttps?: boolean
      secureCookies?: boolean
      allowAnyCorsOrigin?: boolean
      corsAllowedOrigins?: string[]
      requireHttpsRedirectUris?: boolean
      requireS256Pkce?: boolean
      allowImplicitFlow?: boolean
      loginFailureWindowMs?: number
      loginLockoutThreshold?: number
      loginLockoutDurationMs?: number
      sessionAnomalyConcurrencyThreshold?: number
      emailTransport?: 'disabled' | 'log' | 'smtp'
      emailFrom?: string
      smtpHost?: string
      smtpPort?: number
      smtpSecure?: boolean
      smtpUser?: string
      smtpPass?: string
    }) => jsonFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instance-settings'] })
  })
}

export function useTestInstanceEmail() {
  return useMutation({
    mutationFn: (payload: { to: string; subject?: string; message?: string }) =>
      jsonFetch(`${API_BASE}/settings/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
  })
}

export function useTestExternalDatabaseConnection() {
  return useMutation({
    mutationFn: (payload: { provider: 'postgresql' | 'mysql'; externalDatabaseUrl: string }) =>
      jsonFetch(`${API_BASE}/settings/database/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
  })
}

export function useMigrateDatabaseFromSqlite() {
  return useMutation({
    mutationFn: (payload: { provider: 'postgresql' | 'mysql'; externalDatabaseUrl: string; sqlitePath?: string }) =>
      jsonFetch(`${API_BASE}/settings/database/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
  })
}

// ── Elevation Requests (PAM-lite) ──────────────────────────────────────────

export interface ElevationRequestDto {
  id: string
  requesterId: string
  justification: string
  resource: string
  action: string
  status: 'pending' | 'approved' | 'active' | 'revoked' | 'expired'
  approvedByUserId?: string
  approvedAt?: string
  activatedAt?: string
  expiresAt?: string
  revokedAt?: string
  revokedByUserId?: string
  createdAt: string
  updatedAt: string
}

export interface ElevationSessionDto {
  id: string
  elevationRequestId: string
  requesterId: string
  resource: string
  action: string
  status: 'active' | 'revoked' | 'expired'
  startedAt: string
  expiresAt: string
  endedAt?: string
  createdAt: string
  updatedAt: string
}

export function useElevationRequests(status?: ElevationRequestDto['status']) {
  return useQuery({
    queryKey: ['elevation-requests', status],
    queryFn: () => {
      const params = status ? `?status=${status}` : ''
      return jsonFetch(`${API_BASE}/elevations${params}`) as Promise<ElevationRequestDto[]>
    }
  })
}

export function useCreateElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { justification: string; resource: string; action: string; durationMinutes?: number }) =>
      jsonFetch(`${API_BASE}/elevations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<ElevationRequestDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['elevation-requests'] })
  })
}

export function useApproveElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/elevations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }) as Promise<ElevationRequestDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['elevation-requests'] })
  })
}

export function useActivateElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/elevations/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }) as Promise<ElevationRequestDto>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevation-requests'] })
      queryClient.invalidateQueries({ queryKey: ['elevation-sessions'] })
    }
  })
}

export function useRevokeElevationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/elevations/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }) as Promise<ElevationRequestDto>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevation-requests'] })
      queryClient.invalidateQueries({ queryKey: ['elevation-sessions'] })
    }
  })
}

export function useElevationSessions(status?: ElevationSessionDto['status']) {
  return useQuery({
    queryKey: ['elevation-sessions', status],
    queryFn: () => {
      const params = status ? `?status=${status}` : ''
      return jsonFetch(`${API_BASE}/elevations/sessions${params}`) as Promise<ElevationSessionDto[]>
    }
  })
}
