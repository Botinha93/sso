export interface NexusHubSetupBundle {
  publicOrigin: string
  liberideOrigin?: string
  adoptClientId?: string
  installationId?: string
  hubClientId?: string
  provisionerIdentityId?: string
  provisionerClientId?: string
  provisionerCredentialRecordId?: string
  provisionerSecret?: string
  runnerIdentityId?: string
  runnerClientId?: string
  runnerCredentialRecordId?: string
  runnerSecret?: string
}

type Identity = { id: string }
type Credential = { credential: { clientId: string; id: string }; plainClientSecret: string }

export interface NexusHubSetupApi {
  createIdentity(input: {
    name: string
    description: string
    status: 'active'
    allowedScopes: string[]
    allowedAudiences: string[]
    roleIds: string[]
    groupIds: string[]
  }): Promise<Identity>
  issueCredential(input: { id: string; expiresInDays?: number }): Promise<Credential>
  enroll(input: {
    id: string
    credentialId: string
    publicOrigin: string
    liberideOrigin?: string
    adoptClientId?: string
  }): Promise<{ data: { installationId: string } }>
}

export function canonicalHttpsOrigin(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter a canonical HTTPS origin, such as https://hub.example.com, with no path or credentials.')
  }
  return url.origin
}

export async function hubClientIdForInstallation(installationId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nexushub-installation:${installationId}`))
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `nh_${hex.slice(0, 40)}`
}

export async function prepareNexusHubSetup(
  prior: NexusHubSetupBundle,
  expiresInDays: number | undefined,
  api: NexusHubSetupApi,
  onProgress: (bundle: NexusHubSetupBundle) => void,
): Promise<NexusHubSetupBundle> {
  const progress = { ...prior }
  const publish = () => onProgress({ ...progress })
  const hostname = new URL(progress.publicOrigin).hostname

  if (!progress.provisionerIdentityId) {
    const identity = await api.createIdentity({
      name: `NexusHub provisioning (${hostname})`,
      description: 'Least-privilege NexusHub installer identity; no roles or OAuth scopes.',
      status: 'active', allowedScopes: [], allowedAudiences: [], roleIds: [], groupIds: [],
    })
    progress.provisionerIdentityId = identity.id
    publish()
  }
  if (!progress.provisionerClientId || !progress.provisionerSecret || !progress.provisionerCredentialRecordId) {
    const credential = await api.issueCredential({ id: progress.provisionerIdentityId!, expiresInDays })
    progress.provisionerClientId = credential.credential.clientId
    progress.provisionerCredentialRecordId = credential.credential.id
    progress.provisionerSecret = credential.plainClientSecret
    publish()
  }
  if (!progress.installationId) {
    const enrollment = await api.enroll({
      id: progress.provisionerIdentityId!, credentialId: progress.provisionerCredentialRecordId!,
      publicOrigin: progress.publicOrigin,
      ...(progress.liberideOrigin ? { liberideOrigin: progress.liberideOrigin } : {}),
      ...(progress.adoptClientId ? { adoptClientId: progress.adoptClientId } : {}),
    })
    progress.installationId = enrollment.data.installationId
    publish()
  }
  if (!progress.hubClientId) {
    progress.hubClientId = progress.adoptClientId ?? await hubClientIdForInstallation(progress.installationId!)
    publish()
  }
  if (!progress.runnerIdentityId) {
    const runner = await api.createIdentity({
      name: `NexusHub LiberIDE build runner (${hostname})`,
      description: 'NexusHub LiberIDE build runner; can claim builds and import signed results for this Hub only.',
      status: 'active',
      allowedScopes: ['nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import'],
      allowedAudiences: [progress.hubClientId!], roleIds: [], groupIds: [],
    })
    progress.runnerIdentityId = runner.id
    publish()
  }
  if (!progress.runnerClientId || !progress.runnerSecret || !progress.runnerCredentialRecordId) {
    const credential = await api.issueCredential({ id: progress.runnerIdentityId!, expiresInDays })
    progress.runnerClientId = credential.credential.clientId
    progress.runnerCredentialRecordId = credential.credential.id
    progress.runnerSecret = credential.plainClientSecret
    publish()
  }
  return progress
}

export function serializeNexusHubCredentials(bundle: NexusHubSetupBundle) {
  return JSON.stringify({
    issuerSetup: {
      installationId: bundle.installationId,
      hubClientId: bundle.hubClientId,
      provisioningIdentityId: bundle.provisionerIdentityId,
      provisioningClientId: bundle.provisionerClientId,
      provisioningCredentialRecordId: bundle.provisionerCredentialRecordId,
      provisioningClientSecret: bundle.provisionerSecret,
      publicOrigin: bundle.publicOrigin,
      ...(bundle.liberideOrigin ? { liberideOrigin: bundle.liberideOrigin } : {}),
    },
    buildRunner: {
      identityId: bundle.runnerIdentityId,
      clientId: bundle.runnerClientId,
      credentialRecordId: bundle.runnerCredentialRecordId,
      clientSecret: bundle.runnerSecret,
      audience: bundle.hubClientId,
      allowedScopes: ['nexushub.liberide:build-job:claim', 'nexushub.liberide:build-result:import'],
    },
  }, null, 2)
}
