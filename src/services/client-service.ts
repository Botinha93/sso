import type { GrantType, OAuthClient } from "../domain/models.js";
import { timingSafeEqual } from "node:crypto";
import type { ClientRepository } from "../repositories/contracts.js";
import type { InstanceSettingsService } from "./instance-settings-service.js";

export class ClientService {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly instanceSettingsService: InstanceSettingsService
  ) {}

  async listClients() {
    const clients = await this.clientRepository.list();
    return Promise.all(clients.map(async (client) => {
      const managedCredential = this.clientRepository.managedProfileCredentialStatus
        ? await this.clientRepository.managedProfileCredentialStatus(client.id)
        : undefined;
      if (managedCredential) {
        const { secret: _secret, ...publicClient } = client;
        return { ...publicClient, secretPreview: undefined, managedCredential: { generation: managedCredential.generation, ...(managedCredential.pendingOperationId ? { pendingOperationId: managedCredential.pendingOperationId, pendingExpiresAt: managedCredential.pendingExpiresAt } : {}) } };
      }
      return { ...client, secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}` };
    }));
  }

  async findClientById(id: string) {
    return this.clientRepository.findById(id);
  }

  async authenticateClientSecret(id: string, secret: string): Promise<boolean> {
    const managed = this.clientRepository.authenticateManagedProfileSecret
      ? await this.clientRepository.authenticateManagedProfileSecret(id, secret)
      : undefined;
    if (managed !== undefined) return managed;
    const client = await this.clientRepository.findById(id);
    if (!client) return false;
    const a = Buffer.from(client.secret, "utf8");
    const b = Buffer.from(secret, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async ensureManagedProfileCredential(input: { clientId: string; installationId: string; profileId: "nexushub" | "liberide"; profileVersion: 1; secret: string }) {
    if (!this.clientRepository.ensureManagedProfileCredential) throw new Error("managed_profile_credential_storage_unavailable");
    return this.clientRepository.ensureManagedProfileCredential(input);
  }

  async stageManagedProfileCredential(input: { clientId: string; operationId: string; secret: string; expiresAt: Date }) {
    if (!this.clientRepository.stageManagedProfileCredential) throw new Error("managed_profile_credential_storage_unavailable");
    return this.clientRepository.stageManagedProfileCredential(input);
  }

  async activateManagedProfileCredential(input: { clientId: string; operationId: string; now?: Date }) {
    if (!this.clientRepository.activateManagedProfileCredential) throw new Error("managed_profile_credential_storage_unavailable");
    return this.clientRepository.activateManagedProfileCredential(input);
  }

  async abortManagedProfileCredential(input: { clientId: string; operationId: string }) {
    if (!this.clientRepository.abortManagedProfileCredential) throw new Error("managed_profile_credential_storage_unavailable");
    return this.clientRepository.abortManagedProfileCredential(input);
  }

  async managedProfileCredentialStatus(id: string, now?: Date, operationId?: string) {
    if (!this.clientRepository.managedProfileCredentialStatus) throw new Error("managed_profile_credential_storage_unavailable");
    return this.clientRepository.managedProfileCredentialStatus(id, now, operationId);
  }

  async createClient(input: {
    appId?: string;
    id: string;
    name: string;
    secret: string;
    tokenEndpointAuthMethod?: "client_secret_post" | "none";
    redirectUris: string[];
    allowedScopes: string[];
    grants: GrantType[];
    requirePkce: boolean;
    resources?: string[];
    resourceMetadata?: Record<string, { label: string; description: string }>;
    flowIds?: string[];
    accessTokenTtlSeconds?: number;
    refreshTokenTtlSeconds?: number;
  }) {
    this.instanceSettingsService.validateRedirectUris(input.redirectUris);
    return this.clientRepository.create({
      ...input,
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod ?? "client_secret_post",
      resources: input.resources ?? [],
      resourceMetadata: input.resourceMetadata ?? {},
      flowIds: input.flowIds ?? []
    });
  }

  async updateClient(id: string, input: Partial<{
    appId: string;
    name: string;
    secret: string;
    redirectUris: string[];
    allowedScopes: string[];
    grants: GrantType[];
    requirePkce: boolean;
    resources: string[];
    resourceMetadata: Record<string, { label: string; description: string }>;
    flowIds: string[];
    accessTokenTtlSeconds: number | null;
    refreshTokenTtlSeconds: number | null;
  }>) {
    if (input.redirectUris) {
      this.instanceSettingsService.validateRedirectUris(input.redirectUris);
    }
    const patch: Partial<Omit<OAuthClient, "id" | "createdAt">> = {};
    if (input.appId !== undefined) patch.appId = input.appId;
    if (input.name !== undefined) patch.name = input.name;
    if (input.secret !== undefined) patch.secret = input.secret;
    if (input.redirectUris !== undefined) patch.redirectUris = input.redirectUris;
    if (input.allowedScopes !== undefined) patch.allowedScopes = input.allowedScopes;
    if (input.grants !== undefined) patch.grants = input.grants;
    if (input.requirePkce !== undefined) patch.requirePkce = input.requirePkce;
    if (input.resources !== undefined) patch.resources = input.resources;
    if (input.resourceMetadata !== undefined) patch.resourceMetadata = input.resourceMetadata;
    if (input.flowIds !== undefined) patch.flowIds = input.flowIds;
    if (input.accessTokenTtlSeconds !== undefined) {
      patch.accessTokenTtlSeconds = input.accessTokenTtlSeconds === null ? undefined : input.accessTokenTtlSeconds;
    }
    if (input.refreshTokenTtlSeconds !== undefined) {
      patch.refreshTokenTtlSeconds = input.refreshTokenTtlSeconds === null ? undefined : input.refreshTokenTtlSeconds;
    }
    const current = await this.clientRepository.findById(id);
    if (!current) return undefined;
    if (input.resources !== undefined && input.resourceMetadata === undefined) {
      patch.resourceMetadata = Object.fromEntries(Object.entries(current.resourceMetadata ?? {}).filter(([resource]) => input.resources!.includes(resource)));
    }
    const target = { ...current, ...patch };
    if (Object.keys(target.resourceMetadata ?? {}).some((resource) => !target.resources.includes(resource))) {
      throw new Error("Resource metadata may only describe an audience configured on this client");
    }
    return this.clientRepository.update(id, patch);
  }

  async deleteClient(id: string) {
    return this.clientRepository.delete(id);
  }
}
