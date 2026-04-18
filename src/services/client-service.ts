import type { ClientRepository } from "../repositories/contracts.js";

export class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}

  listClients() {
    return this.clientRepository.list().map((client) => ({
      ...client,
      secretPreview: `${client.secret.slice(0, 4)}...${client.secret.slice(-4)}`
    }));
  }
}
