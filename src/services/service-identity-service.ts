import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/password.js";
import { ValidationError } from "../core/errors.js";
import type { ServiceIdentity, ServiceIdentityCredential } from "../domain/models.js";
import type { ServiceIdentityCredentialRepository, ServiceIdentityRepository } from "../repositories/contracts.js";

export interface ServiceIdentityWithCredentials extends ServiceIdentity {
  credentials: ServiceIdentityCredential[];
}

export class ServiceIdentityService {
  constructor(
    private readonly serviceIdentityRepository: ServiceIdentityRepository,
    private readonly credentialRepository: ServiceIdentityCredentialRepository
  ) {}

  private async ensureServiceIdentity(id: string): Promise<ServiceIdentity> {
    const identity = await this.serviceIdentityRepository.findById(id);
    if (!identity) {
      throw new ValidationError("Service identity not found");
    }
    return identity;
  }

  private buildUniqueClientId(base: string) {
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "service-user";
    return `${slug}-${randomBytes(3).toString("hex")}`;
  }

  async createServiceIdentity(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): Promise<ServiceIdentity> {
    return this.serviceIdentityRepository.create(input);
  }

  async listServiceIdentities(): Promise<ServiceIdentity[]> {
    return this.serviceIdentityRepository.list();
  }

  async getServiceIdentity(id: string): Promise<ServiceIdentityWithCredentials | undefined> {
    const identity = await this.serviceIdentityRepository.findById(id);
    if (!identity) return undefined;
    const credentials = await this.credentialRepository.listByServiceIdentity(id);
    return {
      ...identity,
      credentials
    };
  }

  async updateServiceIdentity(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): Promise<ServiceIdentity | undefined> {
    return this.serviceIdentityRepository.update(id, input);
  }

  async deleteServiceIdentity(id: string): Promise<void> {
    await this.ensureServiceIdentity(id);
    await this.serviceIdentityRepository.delete(id);
  }

  async issueCredential(serviceIdentityId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const identity = await this.ensureServiceIdentity(serviceIdentityId);
    const clientId = this.buildUniqueClientId(identity.name);
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);

    const credential = await this.credentialRepository.create({
      serviceIdentityId,
      clientId,
      clientSecretHash: secretHash,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      revokedAt: undefined,
      rotatedFromId: undefined,
      lastUsedAt: undefined
    });

    return { credential, plainClientSecret: plainSecret };
  }

  async rotateCredential(serviceIdentityId: string, credentialId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const identity = await this.ensureServiceIdentity(serviceIdentityId);
    const existing = await this.credentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }

    await this.credentialRepository.revoke(credentialId, new Date());

    const clientId = this.buildUniqueClientId(identity.name);
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);

    const credential = await this.credentialRepository.create({
      serviceIdentityId,
      clientId,
      clientSecretHash: secretHash,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      revokedAt: undefined,
      rotatedFromId: credentialId,
      lastUsedAt: undefined
    });

    return { credential, plainClientSecret: plainSecret };
  }

  async revokeCredential(serviceIdentityId: string, credentialId: string): Promise<void> {
    await this.ensureServiceIdentity(serviceIdentityId);
    const existing = await this.credentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }
    await this.credentialRepository.revoke(credentialId, new Date());
  }

  async getUsage(serviceIdentityId: string): Promise<{ credentialId: string; clientId: string; lastUsedAt?: Date; status: string }[]> {
    await this.ensureServiceIdentity(serviceIdentityId);
    const now = Date.now();
    const credentials = await this.credentialRepository.listByServiceIdentity(serviceIdentityId);
    return credentials.map((credential) => ({
      credentialId: credential.id,
      clientId: credential.clientId,
      lastUsedAt: credential.lastUsedAt,
      status: credential.revokedAt ? "revoked" : credential.expiresAt && credential.expiresAt.getTime() <= now ? "expired" : "active"
    }));
  }

  async verifyCredential(clientId: string, clientSecret: string): Promise<ServiceIdentity | undefined> {
    const credential = await this.credentialRepository.findByClientId(clientId);
    if (!credential || credential.revokedAt || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
      return undefined;
    }

    const valid = verifyPassword(clientSecret, credential.clientSecretHash);
    if (!valid) return undefined;

    const identity = await this.serviceIdentityRepository.findById(credential.serviceIdentityId);
    if (!identity || identity.status !== "active") return undefined;

    await this.credentialRepository.touchLastUsed(credential.id, new Date());
    return identity;
  }
}
