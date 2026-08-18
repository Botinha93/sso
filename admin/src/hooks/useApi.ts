import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from '../lib/errors'

const API_BASE = '/api/admin'

const adminListUrl = (path: string, search?: string) => {
  const params = new URLSearchParams()
  if (search?.trim()) {
    params.set('search', search.trim())
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

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
    const err = await res.json().catch(() => null)
    throw new Error(extractErrorMessage(err, 'Request failed'))
  }
  if (res.status === 204) return null
  return res.json()
}

const uploadFetch = async (url: string, file: File) => {
  const headers: Record<string, string> = {}
  if (url.startsWith(API_BASE)) {
    headers['X-CSRF-Token'] = await getCsrfToken()
  }

  const form = new FormData()
  form.set('file', file)

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: form
  })

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null)
    throw new Error(extractErrorMessage(err, 'Upload failed'))
  }

  if (res.status === 204) return null
  return res.json()
}

export async function logout() {
  const res = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': await getCsrfToken() }
  })
  if (!res.ok) {
    throw new Error('Logout failed')
  }
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

export function useAdminChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      jsonFetch(`${API_BASE}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      sessionStorage.removeItem('passwordExpirationWarning')
      sessionStorage.removeItem('passwordExpirationWarningDismissed')
      queryClient.invalidateQueries({ queryKey: ['admin-me'] })
    }
  })
}

// --- Clients ---
export function useClients(search?: string) {
  return useQuery({
    queryKey: ['clients', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/clients', search))
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

export function useScopes(search?: string) {
  return useQuery({
    queryKey: ['scopes', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/scopes', search))
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
export function useSessions(search?: string) {
  return useQuery({
    queryKey: ['sessions', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/sessions', search))
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
export function useConsents(search?: string) {
  return useQuery({
    queryKey: ['consents', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/consents', search))
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
export function useAuditLog(limit = 100, search?: string) {
  return useQuery({
    queryKey: ['audit', limit, search ?? ''],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (search?.trim()) {
        params.set('search', search.trim())
      }
      return jsonFetch(`${API_BASE}/audit?${params.toString()}`)
    },
    refetchInterval: 30_000
  })
}

// --- Users ---
export function useUsers(search?: string) {
  return useQuery({
    queryKey: ['users', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/users', search))
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (user: {
      appId?: string
      appIds?: string[]
      isServiceUser?: boolean
      avatarUrl?: string | null
      email: string
      username: string
      givenName: string
      familyName: string
      password: string
      customAttributes?: Record<string, string>
      roleIds: string[]
      groupIds?: string[]
    }) => jsonFetch(`${API_BASE}/users`, {
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
      appIds?: string[]
      isServiceUser?: boolean
      avatarUrl?: string | null
      email?: string
      username?: string
      givenName?: string
      familyName?: string
      active?: boolean
      groupIds?: string[]
      customAttributes?: Record<string, string>
      roleIds?: string[]
    }) => jsonFetch(`${API_BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

// --- Apps ---
export function useApps(search?: string) {
  return useQuery({
    queryKey: ['apps', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/apps', search))
  })
}

export function useCreateApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (app: { name: string; description: string; icon?: string; imageUrl?: string | null; url?: string; resources?: string[] }) => jsonFetch(`${API_BASE}/apps`, {
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
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; icon?: string | null; imageUrl?: string | null; url?: string | null; resources?: string[] }) => jsonFetch(`${API_BASE}/apps/${id}`, {
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

export function useUploadUserAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) => uploadFetch(`${API_BASE}/users/${userId}/avatar`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

export function useUploadAppImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appId, file }: { appId: string; file: File }) => uploadFetch(`${API_BASE}/apps/${appId}/image`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apps'] })
  })
}

export function useDefaultUserAvatars(initials: string) {
  return useQuery({
    queryKey: ['default-user-avatars', initials],
    queryFn: () => jsonFetch(`/api/media/defaults/users?initials=${encodeURIComponent(initials)}`)
  })
}

export function useDefaultAppImages() {
  return useQuery({
    queryKey: ['default-app-images'],
    queryFn: () => jsonFetch('/api/media/defaults/apps')
  })
}

export function useResetUserPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      jsonFetch(`${API_BASE}/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

// --- Roles ---
export function useRoles(search?: string) {
  return useQuery({
    queryKey: ['roles', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/roles', search))
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
export function useGroups(search?: string) {
  return useQuery({
    queryKey: ['groups', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/groups', search))
  })
}

export function useGroupUsers(groupId?: string) {
  return useQuery({
    queryKey: ['group-users', groupId ?? 'none'],
    queryFn: () => jsonFetch(`${API_BASE}/groups/${groupId}/users?includeServiceUsers=true`) as Promise<{
      userIds: string[]
      users: Array<{
        id: string
        email: string
        username: string
        givenName: string
        familyName: string
        isServiceUser: boolean
        active: boolean
      }>
    }>,
    enabled: Boolean(groupId)
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (group: {
      appId?: string
      appIds?: string[]
      name: string
      description: string
      customAttributes?: Record<string, string>
      roleIds: string[]
    }) => jsonFetch(`${API_BASE}/groups`, {
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
    mutationFn: ({ id, ...data }: { id: string; appId?: string; appIds?: string[]; name?: string; description?: string; customAttributes?: Record<string, string> }) =>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['group-users'] })
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['group-users'] })
    }
  })
}

// --- Tenants ---
export function useTenants(search?: string) {
  return useQuery({
    queryKey: ['tenants', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/tenants', search))
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
export function useFederationProviders(search?: string) {
  return useQuery({
    queryKey: ['federation-providers', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/federation/providers', search))
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

export interface SamlServiceProviderDto {
  id: string
  appId?: string
  entityId: string
  metadata?: string
  acsUrl: string
  sloUrl?: string
  signingCertificate?: string
  encryptionCertificate?: string
  nameIdFormat: 'persistent' | 'transient' | 'emailAddress'
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function useSamlServiceProviders(params?: { limit?: number; offset?: number; enabled?: boolean }) {
  const qs = new URLSearchParams()
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))
  if (typeof params?.enabled === 'boolean') qs.set('enabled', String(params.enabled))
  const query = qs.toString()

  return useQuery({
    queryKey: ['saml-service-providers', params],
    queryFn: () => jsonFetch(`${API_BASE}/saml/service-providers` + (query ? `?${query}` : '')) as Promise<{
      items: SamlServiceProviderDto[]
      total: number
      limit: number
      offset: number
    }>
  })
}

export function useUploadSamlServiceProviderMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, metadata, overwriteManualFields }: { id: string; metadata: string; overwriteManualFields?: boolean }) =>
      jsonFetch(`${API_BASE}/saml/service-providers/${id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata, overwriteManualFields })
      }) as Promise<{
        serviceProvider: SamlServiceProviderDto
        imported: {
          entityId: string
          acsUrl: string
          sloUrl?: string
          hasSigningCertificate: boolean
        }
      }>,
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['saml-service-providers'] })
      queryClient.invalidateQueries({ queryKey: ['saml-service-provider', id] })
    }
  })
}

export function useRotateSamlServiceProviderCertificate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, certificateType, certificate }: {
      id: string
      certificateType: 'signing' | 'encryption'
      certificate: string
    }) =>
      jsonFetch(`${API_BASE}/saml/service-providers/${id}/certificates/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateType, certificate })
      }) as Promise<SamlServiceProviderDto>,
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['saml-service-providers'] })
      queryClient.invalidateQueries({ queryKey: ['saml-service-provider', id] })
    }
  })
}

export function useCreateSamlServiceProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      entityId: string
      acsUrl: string
      sloUrl?: string
      signingCertificate?: string
      encryptionCertificate?: string
      nameIdFormat?: 'persistent' | 'transient' | 'emailAddress'
    }) =>
      jsonFetch(`${API_BASE}/saml/service-providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<SamlServiceProviderDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saml-service-providers'] })
  })
}

export function useUpdateSamlServiceProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id: string
      entityId?: string
      acsUrl?: string
      sloUrl?: string
      signingCertificate?: string
      encryptionCertificate?: string
      nameIdFormat?: 'persistent' | 'transient' | 'emailAddress'
      enabled?: boolean
    }) =>
      jsonFetch(`${API_BASE}/saml/service-providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<SamlServiceProviderDto>,
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['saml-service-providers'] })
      queryClient.invalidateQueries({ queryKey: ['saml-service-provider', id] })
    }
  })
}

export function useDeleteSamlServiceProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/saml/service-providers/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saml-service-providers'] })
  })
}

export interface SamlAssertionAuditDto {
  id: string
  spId: string
  assertionId: string
  subject?: string
  audience?: string
  sessionIndex?: string
  createdAt: string
}

export function useSamlAssertions(params?: { spId?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.spId) qs.set('spId', params.spId)
  if (typeof params?.limit === 'number') qs.set('limit', String(params.limit))
  if (typeof params?.offset === 'number') qs.set('offset', String(params.offset))
  const query = qs.toString()
  return useQuery({
    queryKey: ['saml-assertions', params],
    queryFn: () => jsonFetch(`${API_BASE}/saml/assertions` + (query ? `?${query}` : '')) as Promise<{
      items: SamlAssertionAuditDto[]
      total: number
      limit: number
      offset: number
    }>
  })
}

export function useBreakGlassElevation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      resource: string
      action: string
      reason: string
      requesterId?: string
      durationMinutes?: number
    }) =>
      jsonFetch(`${API_BASE}/elevations/break-glass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevation-requests'] })
      queryClient.invalidateQueries({ queryKey: ['elevation-sessions'] })
    }
  })
}

export function useStalledAccessRequests(stalledAfterMinutes = 60) {
  return useQuery({
    queryKey: ['access-requests-stalled', stalledAfterMinutes],
    queryFn: () => jsonFetch(`${API_BASE}/access-requests/stalled?stalledAfterMinutes=${stalledAfterMinutes}`),
    select: (data: any) => data?.stalledRequests ?? []
  })
}

// --- Authentication Flows ---
export function useAuthenticationFlows(search?: string) {
  return useQuery({
    queryKey: ['authentication-flows', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/authentication/flows', search))
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
export function useUserAttributes(search?: string) {
  return useQuery({
    queryKey: ['user-attributes', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/user-attributes', search))
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
    mutationFn: ({ id, groupId, enabled, value }: { id: string; groupId: string; enabled: boolean; value?: string }) =>
      jsonFetch(`${API_BASE}/user-attributes/${id}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, enabled, value })
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
export function usePolicies(search?: string) {
  return useQuery({
    queryKey: ['policies', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/policies', search))
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
export function useEventHooks(search?: string) {
  return useQuery({
    queryKey: ['event-hooks', search ?? ''],
    queryFn: () => jsonFetch(adminListUrl('/events/hooks', search))
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

export interface DeprovisioningQueueItemDto {
  id: string
  userId: string
  action: 'revoke_role' | 'revoke_group' | 'deactivate_user'
  resourceId: string
  resourceName: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  reason?: string
  initiatedByUserId?: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
}

export function useDeprovisioningQueue(limit = 50) {
  return useQuery({
    queryKey: ['deprovisioning-queue', limit],
    queryFn: () => jsonFetch(`${API_BASE}/provisioning/deprovisioning-queue?limit=${limit}`) as Promise<DeprovisioningQueueItemDto[]>
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
      rateLimitMultiplier?: number
      emailTransport?: 'disabled' | 'log' | 'smtp'
      emailFrom?: string
      smtpHost?: string
      smtpPort?: number
      smtpSecure?: boolean
      smtpUser?: string
      smtpPass?: string
      uiCustomizations?: {
        defaultBySurface?: Record<string, {
          title?: string
          subtitle?: string
          logoUrl?: string
          primaryColor?: string
          accentColor?: string
          backgroundCss?: string
        }>
        byClientId?: Record<string, Record<string, {
          title?: string
          subtitle?: string
          logoUrl?: string
          primaryColor?: string
          accentColor?: string
          backgroundCss?: string
        }>>
        byAppId?: Record<string, Record<string, {
          title?: string
          subtitle?: string
          logoUrl?: string
          primaryColor?: string
          accentColor?: string
          backgroundCss?: string
        }>>
      }
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
  correlationId: string
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
  correlationId: string
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

export interface ServiceIdentityDto {
  id: string
  name: string
  description?: string
  ownerId?: string
  appId?: string
  status: 'active' | 'inactive' | 'suspended'
  allowedScopes: string[]
  allowedAudiences: string[]
  roleIds?: string[]
  groupIds?: string[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  credentials?: ServiceIdentityCredentialDto[]
}

export interface ServiceIdentityCredentialDto {
  id: string
  serviceIdentityId: string
  clientId: string
  expiresAt?: string
  revokedAt?: string
  lastUsedAt?: string
  createdAt: string
}

export interface ServiceIdentityUsageDto {
  credentialId: string
  clientId: string
  lastUsedAt?: string
  status: 'active' | 'expired' | 'revoked'
}

export function useServiceIdentities() {
  return useQuery({
    queryKey: ['service-identities'],
    queryFn: () => jsonFetch(`${API_BASE}/service-identities`) as Promise<{ data: ServiceIdentityDto[] }>
  })
}

export function useServiceIdentity(id: string) {
  return useQuery({
    queryKey: ['service-identity', id],
    queryFn: () => jsonFetch(`${API_BASE}/service-identities/${id}`) as Promise<ServiceIdentityDto>,
    enabled: !!id
  })
}

export function useServiceIdentityUsage(id: string) {
  return useQuery({
    queryKey: ['service-identity-usage', id],
    queryFn: () => jsonFetch(`${API_BASE}/service-identities/${id}/usage`) as Promise<{ data: ServiceIdentityUsageDto[] }>,
    enabled: !!id
  })
}

export function useCreateServiceIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ServiceIdentityDto>) =>
      jsonFetch(`${API_BASE}/service-identities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Promise<ServiceIdentityDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-identities'] })
  })
}

export function useUpdateServiceIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceIdentityDto> }) =>
      jsonFetch(`${API_BASE}/service-identities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Promise<ServiceIdentityDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-identities'] })
  })
}

export function useDeleteServiceIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/service-identities/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-identities'] })
  })
}

export function useIssueServiceIdentityCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, expiresInDays }: { id: string; expiresInDays?: number }) =>
      jsonFetch(`${API_BASE}/service-identities/${id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays })
      }) as Promise<{ credential: ServiceIdentityCredentialDto; plainClientSecret: string }>,
    onSuccess: (_data, { id }) => queryClient.invalidateQueries({ queryKey: ['service-identity', id] })
  })
}

export function useRotateServiceIdentityCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, credentialId, expiresInDays }: { id: string; credentialId: string; expiresInDays?: number }) =>
      jsonFetch(`${API_BASE}/service-identities/${id}/credentials/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId, expiresInDays })
      }) as Promise<{ credential: ServiceIdentityCredentialDto; plainClientSecret: string }>,
    onSuccess: (_data, { id }) => queryClient.invalidateQueries({ queryKey: ['service-identity', id] })
  })
}

export function useRevokeServiceIdentityCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, credentialId }: { id: string; credentialId: string }) =>
      jsonFetch(`${API_BASE}/service-identities/${id}/credentials/${credentialId}`, { method: 'DELETE' }),
    onSuccess: (_data, { id }) => queryClient.invalidateQueries({ queryKey: ['service-identity', id] })
  })
}

// ── Connector Framework ──────────────────────────────────────────────────────

export type ConnectorType = 'ldap' | 'scim' | 'csv' | 'sql' | 'custom'
export type ConnectorStatus = 'active' | 'inactive' | 'error'
export type ConnectorRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface ConnectorDto {
  id: string
  name: string
  type: ConnectorType
  status: ConnectorStatus
  config: Record<string, unknown>
  schedule?: string
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

export interface ConnectorRunDto {
  id: string
  connectorId: string
  status: ConnectorRunStatus
  startedAt?: string
  finishedAt?: string
  recordsImported: number
  recordsFailed: number
  errorMessage?: string
  createdAt: string
}

export interface ConnectorMappingDto {
  id: string
  connectorId: string
  sourceField: string
  targetField: string
  transform?: string
  createdAt: string
  updatedAt: string
}

export interface AuthMetricDto {
  id: string
  bucket: string
  event: string
  count: number
  createdAt: string
}

export interface PluginManifestDto {
  id: string
  name: string
  version: string
  description?: string
  entrypoint: string
  permissions: string[]
  hooks: string[]
  homepage?: string
}

export interface PluginRecordDto extends PluginManifestDto {
  status: 'uploaded' | 'active'
  uploadedAt: string
  updatedAt: string
  bundleChecksum: string
  bundleBytes: number
}

export interface PluginValidationDto {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function useConnectors() {
  return useQuery({
    queryKey: ['connectors'],
    queryFn: () => jsonFetch(`${API_BASE}/connectors`) as Promise<{ data: ConnectorDto[] }>
  })
}

export function useConnector(id: string) {
  return useQuery({
    queryKey: ['connector', id],
    queryFn: () => jsonFetch(`${API_BASE}/connectors/${id}`) as Promise<ConnectorDto>,
    enabled: !!id
  })
}

export function useCreateConnector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ConnectorDto>) =>
      jsonFetch(`${API_BASE}/connectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Promise<ConnectorDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connectors'] })
  })
}

export function useUpdateConnector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConnectorDto> }) =>
      jsonFetch(`${API_BASE}/connectors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Promise<ConnectorDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connectors'] })
  })
}

export function useDeleteConnector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/connectors/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connectors'] })
  })
}

export function useTriggerConnectorSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch(`${API_BASE}/connectors/${id}/sync`, { method: 'POST' }) as Promise<ConnectorRunDto>,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] })
      queryClient.invalidateQueries({ queryKey: ['connector-runs', id] })
    }
  })
}

export function useConnectorRuns(connectorId: string) {
  return useQuery({
    queryKey: ['connector-runs', connectorId],
    queryFn: () => jsonFetch(`${API_BASE}/connectors/${connectorId}/runs`) as Promise<{ data: ConnectorRunDto[] }>,
    enabled: !!connectorId
  })
}

export function useConnectorMappings(connectorId: string) {
  return useQuery({
    queryKey: ['connector-mappings', connectorId],
    queryFn: () => jsonFetch(`${API_BASE}/connectors/${connectorId}/mappings`) as Promise<{ data: ConnectorMappingDto[] }>,
    enabled: !!connectorId
  })
}

export function useCreateConnectorMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectorId, data }: { connectorId: string; data: { sourceField: string; targetField: string; transform?: string } }) =>
      jsonFetch(`${API_BASE}/connectors/${connectorId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Promise<ConnectorMappingDto>,
    onSuccess: (_data, { connectorId }) => queryClient.invalidateQueries({ queryKey: ['connector-mappings', connectorId] })
  })
}

export function useDeleteConnectorMapping() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectorId, mappingId }: { connectorId: string; mappingId: string }) =>
      jsonFetch(`${API_BASE}/connectors/${connectorId}/mappings/${mappingId}`, { method: 'DELETE' }),
    onSuccess: (_data, { connectorId }) => queryClient.invalidateQueries({ queryKey: ['connector-mappings', connectorId] })
  })
}

export function useAuthMetrics(params?: { startHour?: string; endHour?: string; event?: string }) {
  const qs = new URLSearchParams()
  if (params?.startHour) qs.set('startHour', params.startHour)
  if (params?.endHour) qs.set('endHour', params.endHour)
  if (params?.event) qs.set('event', params.event)
  const query = qs.toString()
  return useQuery({
    queryKey: ['auth-metrics', params],
    queryFn: () => jsonFetch(`${API_BASE}/metrics/auth` + (query ? '?' + query : '')) as Promise<{ data: AuthMetricDto[] }>
  })
}

export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: () => jsonFetch(`${API_BASE}/plugins`) as Promise<{ data: PluginRecordDto[] }>
  })
}

export function useValidatePlugin() {
  return useMutation({
    mutationFn: (payload: { manifest: PluginManifestDto; bundleBase64?: string }) =>
      jsonFetch(`${API_BASE}/plugins/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<PluginValidationDto>
  })
}

export function useUploadPlugin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { manifest: PluginManifestDto; bundleBase64: string; activate?: boolean }) =>
      jsonFetch(`${API_BASE}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as Promise<PluginRecordDto>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] })
  })
}

export function useDeletePlugin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`${API_BASE}/plugins/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] })
  })
}

export interface AdminRiskEventDto {
  id: string
  sourceType: string
  severity: 'medium' | 'high' | 'critical'
  title: string
  createdAt: string
  actorId?: string
  ip?: string
  metadata?: Record<string, unknown>
}

export function useAdminRiskEvents(limit = 25) {
  return useQuery({
    queryKey: ['admin-risk-events', limit],
    queryFn: () => jsonFetch(`${API_BASE}/security/risk-events?limit=${limit}`) as Promise<AdminRiskEventDto[]>
  })
}
