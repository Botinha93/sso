import { ValidationError } from "../core/errors.js";
import type { AppRepository } from "../repositories/contracts.js";

export class AppService {
  constructor(private readonly appRepository: AppRepository) {}

  listApps() {
    return this.appRepository.list();
  }

  findAppById(id: string) {
    return this.appRepository.findById(id);
  }

  createApp(input: { name: string; description: string; icon?: string; url?: string }) {
    return this.appRepository.create(input);
  }

  updateApp(id: string, input: { name?: string; description?: string; icon?: string; url?: string | null }) {
    const updated = this.appRepository.update(id, {
      ...input,
      url: input.url ?? undefined
    });
    if (!updated) {
      throw new ValidationError("App not found");
    }
    return updated;
  }

  deleteApp(id: string) {
    this.appRepository.delete(id);
  }
}