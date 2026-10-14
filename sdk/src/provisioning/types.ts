import type { ClientInstance } from "../core/types.js";

export interface SDKScimToken {
  id: string;
  label: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface SDKCreatedScimToken extends SDKScimToken {
  token: string;
}

export interface CreateScimTokenInput {
  label: string;
  expiresAt?: string;
}

export interface SDKProvisioningMapping {
  id: string;
  name: string;
  sourceAttribute: string;
  targetAttribute: string;
  transformExpression?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProvisioningMappingInput {
  name: string;
  sourceAttribute: string;
  targetAttribute: string;
  transformExpression?: string;
  enabled: boolean;
}

export interface SDKProvisioningJob {
  id: string;
  jobType: "reconcile";
  status: "running" | "completed" | "failed";
  summary: Record<string, unknown>;
  initiatedByUserId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ReconciliationInput {
  dryRun?: boolean;
}

export interface ProvisioningTokensAPI {
  /** Lists active and historical SCIM provisioning tokens. */
  list(): Promise<SDKScimToken[]>;
  /** Creates a new SCIM token and returns its one-time plaintext token value. */
  create(input: CreateScimTokenInput): Promise<SDKCreatedScimToken>;
  /** Revokes a SCIM token by id. */
  revoke(id: string): Promise<void>;
}

export interface ProvisioningMappingsAPI {
  /** Lists provisioning attribute mappings. */
  list(): Promise<SDKProvisioningMapping[]>;
  /** Creates a new provisioning attribute mapping. */
  create(input: CreateProvisioningMappingInput): Promise<SDKProvisioningMapping>;
  /** Deletes a provisioning mapping by id. */
  delete(id: string): Promise<void>;
}

export interface ReconciliationAPI {
  /** Lists recent reconciliation jobs. */
  listJobs(limit?: number): Promise<SDKProvisioningJob[]>;
  /** Triggers a reconciliation job, optionally in dry-run mode. */
  runReconcile(input?: ReconciliationInput): Promise<SDKProvisioningJob>;
}

export interface SDKDeprovisioningQueueItem {
  id: string;
  subjectType: "user" | "group";
  subjectId: string;
  actionType: "user_offboard" | "group_cleanup";
  status: "pending" | "completed" | "failed";
  payload: Record<string, unknown>;
  error?: string;
  createdAt: string;
  processedAt?: string;
}

export interface DeprovisioningQueueListQuery {
  limit?: number;
}

export interface ProvisioningAPI {
  tokens: ProvisioningTokensAPI;
  mappings: ProvisioningMappingsAPI;
  reconciliation: ReconciliationAPI;
  /** Lists queued downstream deprovisioning/offboarding tasks. */
  deprovisioningQueue(query?: DeprovisioningQueueListQuery): Promise<SDKDeprovisioningQueueItem[]>;
}
