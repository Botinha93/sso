import { ValidationError } from "../core/errors.js";
import type { ScopeRepository } from "../repositories/contracts.js";

export class ScopeService {
  constructor(private readonly scopeRepository: ScopeRepository) {}

  async listScopes() {
    return this.scopeRepository.list();
  }

  async createScope(input: { name: string; description: string }) {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new ValidationError("Scope name is required");
    }
    if (await this.scopeRepository.findByName(normalizedName)) {
      throw new ValidationError("Scope already exists");
    }
    return this.scopeRepository.create({ name: normalizedName, description: input.description.trim() });
  }

  async deleteScope(id: string) {
    await this.scopeRepository.delete(id);
  }
}
