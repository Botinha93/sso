import type { ClientInstance } from "../core/types.js";

export type NameIdFormat = "persistent" | "transient" | "emailAddress";
export type CertificateType = "signing" | "encryption";

export interface SDKSamlServiceProvider {
  id: string;
  appId?: string;
  entityId: string;
  metadata?: string;
  acsUrl: string;
  sloUrl?: string;
  signingCertificate?: string;
  encryptionCertificate?: string;
  nameIdFormat: NameIdFormat;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SDKSamlNameIdMapping {
  id: string;
  spId: string;
  format: NameIdFormat;
  sourceAttribute: string;
  createdAt: Date;
}

export interface SDKSamlServiceProviderDetail extends SDKSamlServiceProvider {
  nameIdMappings: SDKSamlNameIdMapping[];
}

export interface SDKSamlAssertionAudit {
  id: string;
  spId: string;
  requestId: string;
  responseId: string;
  subject: string;
  audience: string;
  assertionId: string;
  issueInstant: Date;
  notOnOrAfter: Date;
  destinationUrl: string;
  statusCode: string;
  createdAt: Date;
}

export interface CreateServiceProviderInput {
  entityId: string;
  acsUrl: string;
  sloUrl?: string;
  signingCertificate?: string;
  encryptionCertificate?: string;
  nameIdFormat: NameIdFormat;
}

export interface UpdateServiceProviderInput {
  entityId?: string;
  acsUrl?: string;
  sloUrl?: string;
  signingCertificate?: string;
  encryptionCertificate?: string;
  nameIdFormat?: NameIdFormat;
  enabled?: boolean;
}

export interface UploadServiceProviderMetadataInput {
  metadata: string;
  overwriteManualFields?: boolean;
}

export interface RotateServiceProviderCertificateInput {
  certificateType: CertificateType;
  certificate: string;
}

export interface ListServiceProvidersQuery {
  enabled?: string;
  offset?: number;
  limit?: number;
}

export interface ListAssertionAuditsQuery {
  spId?: string;
  startDate?: string;
  endDate?: string;
  offset?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadMetadataResult {
  serviceProvider: SDKSamlServiceProvider;
  imported: {
    entityId: string;
    acsUrl: string;
    sloUrl?: string;
    hasSigningCertificate: boolean;
  };
}

export interface SamlServiceProvidersAPI {
  /** Lists SAML service providers with pagination/filtering options. */
  list(query?: ListServiceProvidersQuery): Promise<PaginatedResponse<SDKSamlServiceProvider>>;
  /** Gets a single service provider and its NameID mappings. */
  get(id: string): Promise<SDKSamlServiceProviderDetail>;
  /** Creates a new SAML service provider configuration. */
  create(input: CreateServiceProviderInput): Promise<SDKSamlServiceProvider>;
  /** Updates an existing SAML service provider. */
  update(id: string, input: UpdateServiceProviderInput): Promise<SDKSamlServiceProvider>;
  /** Uploads and parses IdP/SP metadata into a service provider configuration. */
  uploadMetadata(id: string, input: UploadServiceProviderMetadataInput): Promise<UploadMetadataResult>;
  /** Rotates a signing or encryption certificate for a service provider. */
  rotateCertificate(id: string, input: RotateServiceProviderCertificateInput): Promise<SDKSamlServiceProvider>;
  /** Deletes a SAML service provider by id. */
  delete(id: string): Promise<void>;
}

export interface SamlAssertionAuditsAPI {
  /** Lists SAML assertion audit events. */
  list(query?: ListAssertionAuditsQuery): Promise<PaginatedResponse<SDKSamlAssertionAudit>>;
}

export interface SamlAdminAPI {
  serviceProviders: SamlServiceProvidersAPI;
  assertions: SamlAssertionAuditsAPI;
}
