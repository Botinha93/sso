import { nanoid } from "nanoid";
import type { GrantType } from "../domain/models.js";
import type { ClientRepository } from "../repositories/contracts.js";
import type { InstanceSettingsService } from "./instance-settings-service.js";

export class ClientService {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly instanceSettingsService: InstanceSettingsService
  ) {}

  listClients() {
    return this.clientRepository.list().map((client) => ({
      ...client,
      secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}`
    }));
  }

  findClientById(id: string) {
    return this.clientRepository.findById(id);
  }

  createClient(input: {
    appId?: string;
    id: string;
    name: string;
    secret: string;
    redirectUris: string[];
    allowedScopes: string[];
    grants: GrantType[];
    requirePkce: boolean;
    resources?: string[];
    flowIds?: string[];
  }) {
    this.instanceSettingsService.validateRedirectUris(input.redirectUris);
    return this.clientRepository.create({
      ...input,
      resources: input.resources ?? [],
      flowIds: input.flowIds ?? []
    });
  }

  updateClient(id: string, input: Partial<{
    appId: string;
    name: string;
    secret: string;
    redirectUris: string[];
    allowedScopes: string[];
    grants: GrantType[];
    requirePkce: boolean;
    resources: string[];
    flowIds: string[];
  }>) {
    if (input.redirectUris) {
      this.instanceSettingsService.validateRedirectUris(input.redirectUris);
    }
    return this.clientRepository.update(id, input);
  }

  deleteClient(id: string) {
    return this.clientRepository.delete(id);
  }
}
