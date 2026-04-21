import { ValidationError } from "../core/errors.js";
import type { AppRepository } from "../repositories/contracts.js";

export class AppService {
  constructor(private readonly appRepository: AppRepository) {}

  async listApps() {
    return this.appRepository.list();
  }

  async findAppById(id: string) {
    return this.appRepository.findById(id);
  }

  async createApp(input: { name: string; description: string; icon?: string; imageUrl?: string; url?: string }) {
    return this.appRepository.create(input);
  }

  async updateApp(id: string, input: { name?: string; description?: string; icon?: string; imageUrl?: string; url?: string | null }) {
    const updated = await this.appRepository.update(id, {
      ...input,
      url: input.url ?? undefined
    });
    if (!updated) {
      throw new ValidationError("App not found");
    }
    return updated;
  }

  async deleteApp(id: string) {
    await this.appRepository.delete(id);
  }
}