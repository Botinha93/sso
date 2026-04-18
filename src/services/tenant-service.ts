import { ValidationError } from "../core/errors.js";
import type { TenantRepository } from "../repositories/contracts.js";

export class TenantService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async createTenant(input: { slug: string; name: string; active?: boolean }) {
    if (await this.tenantRepository.findBySlug(input.slug)) {
      throw new ValidationError("A tenant with this slug already exists");
    }

    return this.tenantRepository.create({
      slug: input.slug,
      name: input.name,
      active: input.active ?? true
    });
  }

  async listTenants() {
    return this.tenantRepository.list();
  }

  async findBySlug(slug: string) {
    return this.tenantRepository.findBySlug(slug);
  }

  async updateTenant(id: string, input: { slug?: string; name?: string; active?: boolean }) {
    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Tenant not found");
    }

    if (input.slug && input.slug !== existing.slug) {
      const bySlug = await this.tenantRepository.findBySlug(input.slug);
      if (bySlug && bySlug.id !== id) {
        throw new ValidationError("A tenant with this slug already exists");
      }
    }

    return this.tenantRepository.update(id, input);
  }
}
