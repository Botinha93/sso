import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractErrorMessage } from './lib/errors'

const API = '/api/portal'

let csrfToken: string | null = null

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch('/api/csrf-token', { credentials: 'include' })
  const data = await res.json()
  csrfToken = data.csrf_token
  return csrfToken!
}

async function apiFetch(url: string, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) }

  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    (url.startsWith('/api/account') || url.startsWith('/api/portal') || url.startsWith('/api/admin'))
  ) {
    headers['X-CSRF-Token'] = await getCsrfToken()
  }

  const res = await fetch(url, { credentials: 'include', ...init, headers })
  if (res.status === 204) return null
  const json = await res.json()
  if (!res.ok) throw new Error(extractErrorMessage(json, 'Request failed'))
  return json
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

export interface PortalApp {
  id: string
  name: string
  description: string
  icon?: string
  imageUrl?: string
  url?: string
}

export interface PortalUser {
  id: string
  email: string
  username: string
  givenName: string
  familyName: string
  avatarUrl?: string
  appId?: string
  appIds?: string[]
  directAppIds?: string[]
  inheritedAppIds?: string[]
  roles?: string[]
  permissions?: string[]
  customAttributes: Record<string, string>
  apps: PortalApp[]
}

export interface ManagedPortalUser {
  id: string
  email: string
  username: string
  givenName: string
  familyName: string
  active: boolean
  directRoleIds?: string[]
  groups?: string[]
}

export interface PortalRoleItem {
  id: string
  name: string
}

export interface PortalGroupItem {
  id: string
  name: string
}

export function usePortalMe() {
  return useQuery<PortalUser>({
    queryKey: ['portal-me'],
    queryFn: () => apiFetch(`${API}/me`),
    retry: false
  })
}

export function usePortalUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { givenName?: string; familyName?: string; avatarUrl?: string; email?: string; username?: string; customAttributes?: Record<string, string> }) =>
      apiFetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-me'] })
  })
}

export function usePortalChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch(`${API}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
  })
}

export function usePortalDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch(`${API}/account`, { method: 'DELETE' })
  })
}

export function usePortalUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const token = await getCsrfToken()
      const form = new FormData()
      form.set('file', file)
      return apiFetch(`${API}/avatar`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        body: form
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-me'] })
  })
}

export function usePortalManagedUsers() {
  return useQuery<ManagedPortalUser[]>({
    queryKey: ['portal-managed-users'],
    queryFn: () => apiFetch('/api/admin/users')
  })
}

export function usePortalCreateManagedUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      email: string
      username: string
      givenName: string
      familyName: string
      password: string
      roleIds?: string[]
      groupIds?: string[]
      appId?: string
      appIds?: string[]
      customAttributes?: Record<string, string>
    }) => apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleIds: [], ...data })
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-managed-users'] })
  })
}

export function usePortalUpdateManagedUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string
      email?: string
      username?: string
      givenName?: string
      familyName?: string
      active?: boolean
      roleIds?: string[]
      groupIds?: string[]
      appId?: string
      appIds?: string[]
      customAttributes?: Record<string, string>
    }) => apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-managed-users'] })
  })
}

export function usePortalDeleteManagedUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-managed-users'] })
  })
}

export function usePortalRoles() {
  return useQuery<PortalRoleItem[]>({
    queryKey: ['portal-roles'],
    queryFn: () => apiFetch('/api/admin/roles')
  })
}

export function usePortalGroups() {
  return useQuery<PortalGroupItem[]>({
    queryKey: ['portal-groups'],
    queryFn: () => apiFetch('/api/admin/groups')
  })
}

export function usePortalDefaultAvatars(initials: string) {
  return useQuery({
    queryKey: ['portal-default-user-avatars', initials],
    queryFn: () => apiFetch(`/api/media/defaults/users?initials=${encodeURIComponent(initials)}`)
  })
}

export interface TotpStatusResponse {
  enabled: boolean
}

export interface TotpEnrollmentResponse {
  enrollmentId: string
  secret: string
  otpauthUri: string
  expiresIn: number
}

export interface WebauthnCredentialSummary {
  credentialId: string
  transports: string[]
  aaguid?: string
  signCount: number
  createdAt: string
}

export interface WebauthnRegistrationBeginResponse {
  registrationId: string
  challenge: string
  rpId: string
  rpName: string
  user: {
    id: string
    name: string
    displayName: string
  }
  timeoutMs: number
}

export function useTotpStatus() {
  return useQuery<TotpStatusResponse>({
    queryKey: ['account-totp-status'],
    queryFn: () => apiFetch('/api/account/mfa/totp')
  })
}

export function useTotpEnroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<TotpEnrollmentResponse> => apiFetch('/api/account/mfa/totp/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-totp-status'] })
  })
}

export function useTotpVerify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { enrollmentId: string; code: string }) => apiFetch('/api/account/mfa/totp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-totp-status'] })
  })
}

export function useTotpDisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/account/mfa/totp', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-totp-status'] })
  })
}

export function useWebauthnCredentials() {
  return useQuery<WebauthnCredentialSummary[]>({
    queryKey: ['account-webauthn-credentials'],
    queryFn: () => apiFetch('/api/account/mfa/webauthn/credentials')
  })
}

export function useWebauthnRegisterBegin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload?: { displayName?: string }): Promise<WebauthnRegistrationBeginResponse> => apiFetch('/api/account/mfa/webauthn/register/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {})
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-webauthn-credentials'] })
  })
}

export function useWebauthnRegisterFinish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      registrationId: string
      credentialId: string
      publicKey: string
      transports?: string[]
      aaguid?: string
      signCount?: number
    }) => apiFetch('/api/account/mfa/webauthn/register/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-webauthn-credentials'] })
  })
}

export function useWebauthnDeleteCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credentialId: string) => apiFetch(`/api/account/mfa/webauthn/credentials/${encodeURIComponent(credentialId)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-webauthn-credentials'] })
  })
}
