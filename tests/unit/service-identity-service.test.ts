import test from "node:test";
import assert from "node:assert/strict";
import type { ServiceIdentityCredential, User } from "../../src/domain/models.js";
import { ServiceIdentityService } from "../../src/services/service-identity-service.js";

class InMemoryUserRepository {
  private readonly store = new Map<string, User>();

  async create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date();
    const id = `si-${this.store.size + 1}`;
    const created: User = { id, ...input, createdAt: now, updatedAt: now };
    this.store.set(id, created);
    return created;
  }

  async list(): Promise<User[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<User | undefined> {
    return this.store.get(id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.store.values()).find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.store.values()).find((user) => user.username.toLowerCase() === username.toLowerCase());
  }

  async updateProfile(id: string, input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId" | "externalSource" | "externalId" | "isServiceUser" | "avatarUrl">>): Promise<User | undefined> {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated: User = { ...existing, ...input, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, passwordHash, updatedAt: new Date() });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, active, updatedAt: new Date() });
  }

  async setCustomAttributes(id: string, customAttributes: Record<string, string>): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, customAttributes, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryServiceIdentityCredentialRepository {
  private readonly store = new Map<string, ServiceIdentityCredential>();

  async create(input: Omit<ServiceIdentityCredential, "id" | "createdAt">): Promise<ServiceIdentityCredential> {
    const id = `cred-${this.store.size + 1}`;
    const created: ServiceIdentityCredential = {
      id,
      serviceIdentityId: input.serviceIdentityId,
      clientId: input.clientId,
      clientSecretHash: input.clientSecretHash,
      expiresAt: input.expiresAt,
      revokedAt: input.revokedAt,
      rotatedFromId: input.rotatedFromId,
      lastUsedAt: input.lastUsedAt,
      createdAt: new Date()
    };
    this.store.set(id, created);
    return created;
  }

  async listByServiceIdentity(serviceIdentityId: string): Promise<ServiceIdentityCredential[]> {
    return Array.from(this.store.values()).filter((c) => c.serviceIdentityId === serviceIdentityId);
  }

  async findById(id: string): Promise<ServiceIdentityCredential | undefined> {
    return this.store.get(id);
  }

  async findByClientId(clientId: string): Promise<ServiceIdentityCredential | undefined> {
    return Array.from(this.store.values()).find((c) => c.clientId === clientId);
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, revokedAt });
  }

  async touchLastUsed(id: string, usedAt: Date): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;
    this.store.set(id, { ...existing, lastUsedAt: usedAt });
  }
}

test("rotation revokes previous credential and keeps replacement active", async () => {
  const repo = new InMemoryUserRepository();
  const credRepo = new InMemoryServiceIdentityCredentialRepository();
  const service = new ServiceIdentityService(repo as any, credRepo as any);

  const identity = await service.createServiceIdentity({
    name: "worker-a",
    description: "",
    status: "active",
    allowedScopes: ["read:data"],
    allowedAudiences: ["api.example.com"]
  });

  const issued = await service.issueCredential(identity.id, 30);
  const rotated = await service.rotateCredential(identity.id, issued.credential.id, 90);

  const previous = await credRepo.findById(issued.credential.id);
  const replacement = await credRepo.findById(rotated.credential.id);

  assert.ok(previous?.revokedAt);
  assert.equal(replacement?.rotatedFromId, issued.credential.id);
  assert.equal(Boolean(replacement?.revokedAt), false);
});

test("verifyCredential rejects expired and revoked credentials", async () => {
  const repo = new InMemoryUserRepository();
  const credRepo = new InMemoryServiceIdentityCredentialRepository();
  const service = new ServiceIdentityService(repo as any, credRepo as any);

  const identity = await service.createServiceIdentity({
    name: "worker-b",
    description: "",
    status: "active",
    allowedScopes: ["read:data"],
    allowedAudiences: ["api.example.com"]
  });

  const expired = await credRepo.create({
    serviceIdentityId: identity.id,
    clientId: "expired-client",
    clientSecretHash: "invalid-hash",
    expiresAt: new Date(Date.now() - 60_000),
    revokedAt: undefined,
    rotatedFromId: undefined,
    lastUsedAt: undefined
  });

  const revoked = await credRepo.create({
    serviceIdentityId: identity.id,
    clientId: "revoked-client",
    clientSecretHash: "invalid-hash",
    expiresAt: undefined,
    revokedAt: new Date(),
    rotatedFromId: undefined,
    lastUsedAt: undefined
  });

  const expiredResult = await service.verifyCredential(expired.clientId, "irrelevant");
  const revokedResult = await service.verifyCredential(revoked.clientId, "irrelevant");

  assert.equal(expiredResult, undefined);
  assert.equal(revokedResult, undefined);
});
