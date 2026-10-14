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

  async createApp(input: { name: string; description: string; icon?: string; imageUrl?: string; url?: string; resources?: string[] }) {
    return this.appRepository.create({ ...input, resources: input.resources ?? [] });
  }

  async updateApp(id: string, input: { name?: string; description?: string; icon?: string | null; imageUrl?: string | null; url?: string | null; resources?: string[] }) {
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

  async ensureDefaults() {
    const existing = await this.appRepository.list();
    const byName = new Map(existing.map((app) => [app.name, app]));

    const accountPortal = byName.get("Account Portal");
    if (!accountPortal) {
      await this.appRepository.create({
        name: "Account Portal",
        description: "Default self-service user portal",
        icon: "👤",
        url: "/portal/",
        resources: [],
      });
    } else if (accountPortal.url === "/portal") {
      await this.appRepository.update(accountPortal.id, {
        url: "/portal/",
      });
    }

    if (!byName.has("Admin Portal")) {
      await this.appRepository.create({
        name: "Admin Portal",
        description: "Built-in administration portal",
        resources: [],
      });
    }
  }
}