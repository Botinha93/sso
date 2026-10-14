import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/password.js";
import { ValidationError } from "../core/errors.js";
import type { ServiceIdentity, ServiceIdentityCredential } from "../domain/models.js";
import type { User } from "../domain/models.js";
import type { ServiceIdentityCredentialRepository, UserRepository } from "../repositories/contracts.js";

export interface ServiceIdentityWithCredentials extends ServiceIdentity {
  credentials: ServiceIdentityCredential[];
}

const SI_ALLOWED_SCOPES_KEY = "si.allowedScopes";
const SI_ALLOWED_AUDIENCES_KEY = "si.allowedAudiences";
const SI_OWNER_ID_KEY = "si.ownerId";
const SI_METADATA_KEY = "si.metadata";
const SI_STATUS_KEY = "si.status";

export class ServiceIdentityService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly credentialRepository: ServiceIdentityCredentialRepository
  ) {}

  private parseStringList(value: string | undefined): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  private serializeStringList(input: string[] | undefined): string {
    return JSON.stringify(Array.from(new Set((input ?? []).map((entry) => entry.trim()).filter(Boolean))));
  }

  private parseMetadata(value: string | undefined): Record<string, unknown> | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
    } catch {
      return undefined;
    }
  }

  private buildServiceIdentityAttributes(
    existing: Record<string, string>,
    input: Partial<Pick<ServiceIdentity, "allowedScopes" | "allowedAudiences" | "ownerId" | "metadata" | "status">>
  ): Record<string, string> {
    const next = { ...existing };
    if (input.allowedScopes !== undefined) {
      next[SI_ALLOWED_SCOPES_KEY] = this.serializeStringList(input.allowedScopes);
    }
    if (input.allowedAudiences !== undefined) {
      next[SI_ALLOWED_AUDIENCES_KEY] = this.serializeStringList(input.allowedAudiences);
    }
    if (input.ownerId !== undefined) {
      if (input.ownerId.trim()) {
        next[SI_OWNER_ID_KEY] = input.ownerId;
      } else {
        delete next[SI_OWNER_ID_KEY];
      }
    }
    if (input.metadata !== undefined) {
      next[SI_METADATA_KEY] = JSON.stringify(input.metadata);
    }
    if (input.status !== undefined) {
      next[SI_STATUS_KEY] = input.status;
    }
    return next;
  }

  private toServiceIdentity(user: User): ServiceIdentity {
    const status = user.customAttributes[SI_STATUS_KEY] as ServiceIdentity["status"] | undefined;
    return {
      id: user.id,
      name: user.givenName,
      description: user.familyName || undefined,
      ownerId: user.customAttributes[SI_OWNER_ID_KEY],
      appId: user.appId,
      status: status ?? (user.active ? "active" : "inactive"),
      allowedScopes: this.parseStringList(user.customAttributes[SI_ALLOWED_SCOPES_KEY]),
      allowedAudiences: this.parseStringList(user.customAttributes[SI_ALLOWED_AUDIENCES_KEY]),
      metadata: this.parseMetadata(user.customAttributes[SI_METADATA_KEY]),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private async ensureServiceIdentityUser(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.isServiceUser) {
      throw new ValidationError("Service identity not found");
    }
    return user;
  }

  private buildUniqueIdentifier(base: string) {
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "service-user";
    return `${slug}-${randomBytes(3).toString("hex")}`;
  }

  async createServiceIdentity(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): Promise<ServiceIdentity> {
    const username = this.buildUniqueIdentifier(input.name);
    const user = await this.userRepository.create({
      appId: input.appId,
      appIds: input.appId ? [input.appId] : [],
      directAppIds: input.appId ? [input.appId] : [],
      inheritedAppIds: [],
      externalSource: undefined,
      externalId: undefined,
      isServiceUser: true,
      avatarUrl: undefined,
      email: `${username}@service.local`,
      username,
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      givenName: input.name,
      familyName: input.description ?? "",
      customAttributes: this.buildServiceIdentityAttributes({}, {
        allowedScopes: input.allowedScopes,
        allowedAudiences: input.allowedAudiences,
        ownerId: input.ownerId,
        metadata: input.metadata,
        status: input.status
      }),
      active: input.status === "active"
    });

    return this.toServiceIdentity(user);
  }

  async listServiceIdentities(): Promise<ServiceIdentity[]> {
    const users = await this.userRepository.list();
    return users.filter((user) => user.isServiceUser).map((user) => this.toServiceIdentity(user));
  }

  async getServiceIdentity(id: string): Promise<ServiceIdentityWithCredentials | undefined> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.isServiceUser) return undefined;
    const credentials = await this.credentialRepository.listByServiceIdentity(id);
    return {
      ...this.toServiceIdentity(user),
      credentials
    };
  }

  async updateServiceIdentity(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): Promise<ServiceIdentity | undefined> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.isServiceUser) return undefined;

    await this.userRepository.updateProfile(id, {
      appId: input.appId,
      givenName: input.name,
      familyName: input.description,
      isServiceUser: true
    });

    if (input.status !== undefined) {
      await this.userRepository.setActive(id, input.status === "active");
    }

    if (
      input.allowedScopes !== undefined ||
      input.allowedAudiences !== undefined ||
      input.ownerId !== undefined ||
      input.metadata !== undefined ||
      input.status !== undefined
    ) {
      await this.userRepository.setCustomAttributes(id, this.buildServiceIdentityAttributes(user.customAttributes, {
        allowedScopes: input.allowedScopes,
        allowedAudiences: input.allowedAudiences,
        ownerId: input.ownerId,
        metadata: input.metadata,
        status: input.status
      }));
    }

    const refreshed = await this.userRepository.findById(id);
    return refreshed ? this.toServiceIdentity(refreshed) : undefined;
  }

  async deleteServiceIdentity(id: string): Promise<void> {
    await this.ensureServiceIdentityUser(id);
    const credentials = await this.credentialRepository.listByServiceIdentity(id);
    await Promise.all(credentials.filter((credential) => !credential.revokedAt).map((credential) => this.credentialRepository.revoke(credential.id, new Date())));
    await this.credentialRepository.deleteByServiceIdentity(id);
    await this.userRepository.delete(id);
  }

  async issueCredential(serviceIdentityId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const identity = this.toServiceIdentity(await this.ensureServiceIdentityUser(serviceIdentityId));
    const clientId = this.buildUniqueIdentifier(identity.name);
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
    const identity = this.toServiceIdentity(await this.ensureServiceIdentityUser(serviceIdentityId));
    const existing = await this.credentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }

    await this.credentialRepository.revoke(credentialId, new Date());

    const clientId = this.buildUniqueIdentifier(identity.name);
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
    await this.ensureServiceIdentityUser(serviceIdentityId);
    const existing = await this.credentialRepository.findById(credentialId);
    if (!existing || existing.serviceIdentityId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }
    await this.credentialRepository.revoke(credentialId, new Date());
  }

  async getUsage(serviceIdentityId: string): Promise<{ credentialId: string; clientId: string; lastUsedAt?: Date; status: string }[]> {
    await this.ensureServiceIdentityUser(serviceIdentityId);
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

    const user = await this.userRepository.findById(credential.serviceIdentityId);
    const identity = user && user.isServiceUser ? this.toServiceIdentity(user) : undefined;
    if (!identity || identity.status !== "active") return undefined;

    await this.credentialRepository.touchLastUsed(credential.id, new Date());
    return identity;
  }
}
