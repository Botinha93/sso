import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../security/password.js";
import { ValidationError } from "../core/errors.js";
import type { ServiceIdentity, ServiceIdentityCredential } from "../domain/models.js";
import type { User } from "../domain/models.js";
import type { UserRepository } from "../repositories/contracts.js";

export interface ServiceIdentityWithCredentials extends ServiceIdentity {
  credentials: ServiceIdentityCredential[];
}

const SI_ALLOWED_SCOPES_KEY = "si.allowedScopes";
const SI_ALLOWED_AUDIENCES_KEY = "si.allowedAudiences";
const SI_OWNER_ID_KEY = "si.ownerId";
const SI_METADATA_KEY = "si.metadata";

export class ServiceIdentityService {
  constructor(private readonly userRepository: UserRepository) {}

  private parseStringList(value: string | undefined): string[] {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    } catch {
      return [];
    }
  }

  private serializeStringList(input: string[] | undefined): string {
    if (!input) {
      return JSON.stringify([]);
    }
    const normalized = Array.from(new Set(input.map((entry) => entry.trim()).filter((entry) => entry.length > 0)));
    return JSON.stringify(normalized);
  }

  private parseMetadata(value: string | undefined): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private buildServiceIdentityAttributes(
    existing: Record<string, string>,
    input: Partial<Pick<ServiceIdentity, "allowedScopes" | "allowedAudiences" | "ownerId" | "metadata">>
  ): Record<string, string> {
    const next = { ...existing };
    if (input.allowedScopes !== undefined) {
      next[SI_ALLOWED_SCOPES_KEY] = this.serializeStringList(input.allowedScopes);
    }
    if (input.allowedAudiences !== undefined) {
      next[SI_ALLOWED_AUDIENCES_KEY] = this.serializeStringList(input.allowedAudiences);
    }
    if (input.ownerId !== undefined) {
      if (input.ownerId.trim().length > 0) {
        next[SI_OWNER_ID_KEY] = input.ownerId;
      } else {
        delete next[SI_OWNER_ID_KEY];
      }
    }
    if (input.metadata !== undefined) {
      next[SI_METADATA_KEY] = JSON.stringify(input.metadata);
    }
    return next;
  }

  private toServiceIdentity(user: User): ServiceIdentity {
    return {
      id: user.id,
      name: user.givenName,
      description: user.familyName || undefined,
      ownerId: user.customAttributes[SI_OWNER_ID_KEY],
      appId: user.appId,
      status: user.active ? "active" : "inactive",
      allowedScopes: this.parseStringList(user.customAttributes[SI_ALLOWED_SCOPES_KEY]),
      allowedAudiences: this.parseStringList(user.customAttributes[SI_ALLOWED_AUDIENCES_KEY]),
      metadata: this.parseMetadata(user.customAttributes[SI_METADATA_KEY]),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private toCredential(user: User): ServiceIdentityCredential {
    return {
      id: user.id,
      serviceIdentityId: user.id,
      clientId: user.username,
      clientSecretHash: user.passwordHash,
      createdAt: user.updatedAt
    };
  }

  private async ensureMachineUser(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.isServiceUser) {
      throw new ValidationError("Service identity not found");
    }
    return user;
  }

  private buildUniqueUsername(base: string) {
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "service-user";
    return `${slug}-${randomBytes(3).toString("hex")}`;
  }

  async createServiceIdentity(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): Promise<ServiceIdentity> {
    const username = this.buildUniqueUsername(input.name);
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
        metadata: input.metadata
      }),
      active: input.status !== "inactive" && input.status !== "suspended"
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
    return {
      ...this.toServiceIdentity(user),
      credentials: [this.toCredential(user)]
    };
  }

  async updateServiceIdentity(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): Promise<ServiceIdentity | undefined> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.isServiceUser) {
      return undefined;
    }

    const updated = await this.userRepository.updateProfile(id, {
      appId: input.appId,
      givenName: input.name,
      familyName: input.description,
      isServiceUser: true
    });

    if (input.status !== undefined) {
      await this.userRepository.setActive(id, input.status !== "inactive" && input.status !== "suspended");
    }

    if (
      input.allowedScopes !== undefined ||
      input.allowedAudiences !== undefined ||
      input.ownerId !== undefined ||
      input.metadata !== undefined
    ) {
      const customAttributes = this.buildServiceIdentityAttributes(user.customAttributes, {
        allowedScopes: input.allowedScopes,
        allowedAudiences: input.allowedAudiences,
        ownerId: input.ownerId,
        metadata: input.metadata
      });
      await this.userRepository.setCustomAttributes(id, customAttributes);
    }

    const finalUser = updated ? await this.userRepository.findById(updated.id) : await this.userRepository.findById(id);
    return finalUser ? this.toServiceIdentity(finalUser) : undefined;
  }

  async deleteServiceIdentity(id: string): Promise<void> {
    await this.ensureMachineUser(id);
    await this.userRepository.delete(id);
  }

  async issueCredential(serviceIdentityId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const user = await this.ensureMachineUser(serviceIdentityId);
    const clientId = user.username;
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);

    await this.userRepository.setPasswordHash(serviceIdentityId, secretHash);
    await this.userRepository.setActive(serviceIdentityId, true);

    const refreshed = await this.ensureMachineUser(serviceIdentityId);
    const credential: ServiceIdentityCredential = {
      ...this.toCredential(refreshed),
      clientId
    };

    return { credential, plainClientSecret: plainSecret };
  }

  async rotateCredential(serviceIdentityId: string, credentialId: string, expiresInDays?: number): Promise<{ credential: ServiceIdentityCredential; plainClientSecret: string }> {
    const user = await this.ensureMachineUser(serviceIdentityId);
    if (credentialId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }

    const clientId = user.username;
    const plainSecret = randomBytes(32).toString("hex");
    const secretHash = hashPassword(plainSecret);

    await this.userRepository.setPasswordHash(serviceIdentityId, secretHash);
    await this.userRepository.setActive(serviceIdentityId, true);
    const refreshed = await this.ensureMachineUser(serviceIdentityId);

    return { credential: { ...this.toCredential(refreshed), clientId }, plainClientSecret: plainSecret };
  }

  async revokeCredential(serviceIdentityId: string, credentialId: string): Promise<void> {
    await this.ensureMachineUser(serviceIdentityId);
    if (credentialId !== serviceIdentityId) {
      throw new ValidationError("Credential not found or does not belong to this service identity");
    }
    await this.userRepository.setActive(serviceIdentityId, false);
  }

  async getUsage(serviceIdentityId: string): Promise<{ credentialId: string; clientId: string; lastUsedAt?: Date; status: string }[]> {
    const user = await this.ensureMachineUser(serviceIdentityId);
    return [{
      credentialId: user.id,
      clientId: user.username,
      lastUsedAt: undefined,
      status: user.active ? "active" : "revoked"
    }];
  }

  async verifyCredential(clientId: string, clientSecret: string): Promise<ServiceIdentity | undefined> {
    const user = await this.userRepository.findByUsername(clientId);
    if (!user || !user.isServiceUser || !user.active) return undefined;

    const valid = verifyPassword(clientSecret, user.passwordHash);
    if (!valid) return undefined;

    return this.toServiceIdentity(user);
  }
}
