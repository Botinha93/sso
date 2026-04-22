export type ServiceIdentityStatus = "active" | "inactive" | "suspended";

export interface SDKServiceIdentity {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  appId?: string;
  status: ServiceIdentityStatus;
  allowedScopes: string[];
  allowedAudiences: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SDKServiceIdentityCredential {
  id: string;
  serviceIdentityId: string;
  clientId: string;
  clientSecretHash: string;
  expiresAt?: string;
  revokedAt?: string;
  rotatedFromId?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ServiceIdentityWithCredentials extends SDKServiceIdentity {
  credentials: SDKServiceIdentityCredential[];
}

export interface CreateServiceIdentityInput {
  name: string;
  description?: string;
  ownerId?: string;
  appId?: string;
  status?: ServiceIdentityStatus;
  allowedScopes?: string[];
  allowedAudiences?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateServiceIdentityInput {
  name?: string;
  description?: string;
  ownerId?: string;
  appId?: string;
  status?: ServiceIdentityStatus;
  allowedScopes?: string[];
  allowedAudiences?: string[];
  metadata?: Record<string, unknown>;
}

export interface ServiceIdentityCredentialIssueInput {
  expiresInDays?: number;
}

export interface RotateServiceIdentityCredentialInput extends ServiceIdentityCredentialIssueInput {
  credentialId: string;
}

export interface SDKIssuedServiceIdentityCredential {
  credential: SDKServiceIdentityCredential;
  plainClientSecret: string;
}

export interface SDKServiceIdentityUsage {
  credentialId: string;
  clientId: string;
  lastUsedAt?: string;
  status: string;
}

export interface WorkloadAPI {
  /** Creates a new service identity. */
  createServiceIdentity(input: CreateServiceIdentityInput): Promise<SDKServiceIdentity>;
  /** Deletes a service identity by id. */
  deleteServiceIdentity(id: string): Promise<void>;
  /** Gets a service identity with all credential metadata. */
  getServiceIdentity(id: string): Promise<ServiceIdentityWithCredentials>;
  /** Retrieves usage metadata for credentials associated with a service identity. */
  getUsage(id: string): Promise<SDKServiceIdentityUsage[]>;
  /** Issues a new credential for a service identity. */
  issueCredential(id: string, input?: ServiceIdentityCredentialIssueInput): Promise<SDKIssuedServiceIdentityCredential>;
  /** Lists service identities visible to the caller. */
  listServiceIdentities(): Promise<SDKServiceIdentity[]>;
  /** Revokes a specific credential on a service identity. */
  revokeCredential(id: string, credentialId: string): Promise<void>;
  /** Rotates an existing credential and returns the new issued secret material. */
  rotateCredential(id: string, input: RotateServiceIdentityCredentialInput): Promise<SDKIssuedServiceIdentityCredential>;
  /** Updates mutable fields of a service identity. */
  updateServiceIdentity(id: string, input: UpdateServiceIdentityInput): Promise<SDKServiceIdentity>;
}
