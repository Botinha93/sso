import { ValidationError } from "../core/errors.js";
import type { AppRepository } from "../repositories/contracts.js";

export class AppService {
  constructor(private readonly appRepository: AppRepository) {}

  listApps() {
    return this.appRepository.list();
  }

  createApp(input: { name: string; description: string }) {
    return this.appRepository.create(input);
  }

  updateApp(id: string, input: { name?: string; description?: string }) {
    const updated = this.appRepository.update(id, input);
    if (!updated) {
      throw new ValidationError("App not found");
    }
    return updated;
  }

  deleteApp(id: string) {
    this.appRepository.delete(id);
  }
}