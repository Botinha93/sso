import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/password.js";
import { ValidationError } from "../core/errors.js";
import type { ServiceIdentity, ServiceIdentityCredential } from "../domain/models.js";
import type { ServiceIdentityRepository, ServiceIdentityCredentialRepository } from "../repositories/contracts.js";

export interface ServiceIdentityWithCredentials extends ServiceIdentity {
  credentials: ServiceIdentityCredential[];
}

export class ServiceIdentityService {
  constructor(
    private readonly serviceIdentityRepository: ServiceIdentityRepository,
    private readonly serviceIdentityCredentialRepository: ServiceIdentityCredentialRepository
  ) {}

  async createServiceIdentity(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): Promise<ServiceIdentity> {
    return this.serviceIdentityRepository.create(input);
  }

  async listServiceIdentities(): Promise<ServiceIdentity[]> {
    return this.serviceIdentityRepository.list();
  }

  async getServiceIdentity(id: string): Promise<ServiceIdentityWithCredentials | undefined> {
    const identity = await this.serviceIdentityRepository.findById(id);
    if (!identity) return undefined;
    const credentials = await this.serviceIdentityCredentialRepository.listByServiceIdentity(id);
    return { ...identity, credentials };
  }

  async updateServiceIdentity(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): Promise<ServiceIdentity | undefined> {
    return this.serviceIdentityRepository.update(id, input);
  }

  async deleteServiceIdentity(id: string): Promise<void> {
    const identity = await this.serviceIdentityRepository.findById(id);
    if (!identity) throw new ValidationError("Service identity not found");
    await this.serviceIdentityRepository.delete(id);
  }

  async issueCredential(serviceIdentityId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const identity = await this.serviceIdentityRepository.findById(serviceIdentityId);
    if (!identity) throw new ValidationError("Service identity not found");

    const clientId = `si_${randomBytes(12).toString("hex")}`;
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60_000) : undefined;

    const credential = await this.serviceIdentityCredentialRepository.create({
      serviceIdentityId,
      clientId,
      clientSecretHash: secretHash,
      expiresAt
    });

    return { credential, plainClientSecret: plainSecret };
  }

  async rotateCredential(serviceIdentityId: string, credentialId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const existing = await this.serviceIdentityCredentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }

    const clientId = `si_${randomBytes(12).toString("hex")}`;
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60_000) : undefined;

    const newCredential = await this.serviceIdentityCredentialRepository.create({
      serviceIdentityId,
      clientId,
      clientSecretHash: secretHash,
      expiresAt,
      rotatedFromId: credentialId
    });

    await this.serviceIdentityCredentialRepository.revoke(credentialId, new Date());

    return { credential: newCredential, plainClientSecret: plainSecret };
  }

  async revokeCredential(serviceIdentityId: string, credentialId: string): Promise<void> {
    const existing = await this.serviceIdentityCredentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }
    await this.serviceIdentityCredentialRepository.revoke(credentialId, new Date());
  }

  async getUsage(serviceIdentityId: string): Promise<{ credentialId: string; clientId: string; lastUsedAt?: Date; status: string }[]> {
    const credentials = await this.serviceIdentityCredentialRepository.listByServiceIdentity(serviceIdentityId);
    return credentials.map((c) => ({
      credentialId: c.id,
      clientId: c.clientId,
      lastUsedAt: c.lastUsedAt,
      status: c.revokedAt ? "revoked" : c.expiresAt && c.expiresAt < new Date() ? "expired" : "active"
    }));
  }

  async verifyCredential(clientId: string, clientSecret: string): Promise<ServiceIdentity | undefined> {
    const credential = await this.serviceIdentityCredentialRepository.findByClientId(clientId);
    if (!credential || credential.revokedAt) return undefined;
    if (credential.expiresAt && credential.expiresAt < new Date()) return undefined;

    const valid = verifyPassword(clientSecret, credential.clientSecretHash);
    if (!valid) return undefined;

    await this.serviceIdentityCredentialRepository.touchLastUsed(credential.id, new Date());
    return this.serviceIdentityRepository.findById(credential.serviceIdentityId);
  }
}
