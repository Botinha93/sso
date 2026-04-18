import { ValidationError } from "../core/errors.js";
export class TenantService {
    tenantRepository;
    constructor(tenantRepository) {
        this.tenantRepository = tenantRepository;
    }
    createTenant(input) {
        if (this.tenantRepository.findBySlug(input.slug)) {
            throw new ValidationError("A tenant with this slug already exists");
        }
        return this.tenantRepository.create({
            slug: input.slug,
            name: input.name,
            active: input.active ?? true
        });
    }
    listTenants() {
        return this.tenantRepository.list();
    }
    findBySlug(slug) {
        return this.tenantRepository.findBySlug(slug);
    }
}
