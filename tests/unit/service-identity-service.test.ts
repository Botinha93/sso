import test from "node:test";
import assert from "node:assert/strict";
import type { ServiceIdentity, ServiceIdentityCredential } from "../../src/domain/models.js";
import { ServiceIdentityService } from "../../src/services/service-identity-service.js";

class InMemoryServiceIdentityRepository {
  private readonly store = new Map<string, ServiceIdentity>();

  async create(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): Promise<ServiceIdentity> {
    const now = new Date();
    const id = `si-${this.store.size + 1}`;
    const created: ServiceIdentity = { id, ...input, createdAt: now, updatedAt: now };
    this.store.set(id, created);
    return created;
  }

  async list(): Promise<ServiceIdentity[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<ServiceIdentity | undefined> {
    return this.store.get(id);
  }

  async update(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): Promise<ServiceIdentity | undefined> {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated: ServiceIdentity = { ...existing, ...input, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
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
  const repo = new InMemoryServiceIdentityRepository();
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
  const repo = new InMemoryServiceIdentityRepository();
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
