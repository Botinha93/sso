import test from "node:test";
import assert from "node:assert/strict";
import type { AppConfig } from "../../src/core/config.js";
import type { WebauthnCredential } from "../../src/domain/models.js";
import { WebauthnService } from "../../src/services/webauthn-service.js";

class InMemoryWebauthnCredentialRepository {
  private readonly items = new Map<string, WebauthnCredential>();

  async listByUserId(userId: string): Promise<WebauthnCredential[]> {
    return Array.from(this.items.values()).filter((item) => item.userId === userId);
  }

  async findByCredentialId(credentialId: string): Promise<WebauthnCredential | undefined> {
    return this.items.get(credentialId);
  }

  async upsert(input: Omit<WebauthnCredential, "id" | "createdAt" | "updatedAt">): Promise<WebauthnCredential> {
    const existing = this.items.get(input.credentialId);
    const createdAt = existing?.createdAt ?? new Date();
    const updatedAt = new Date();
    const next: WebauthnCredential = {
      id: existing?.id ?? `cred-${input.credentialId}`,
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      signCount: input.signCount,
      transports: input.transports,
      aaguid: input.aaguid,
      createdAt,
      updatedAt
    };

    this.items.set(next.credentialId, next);
    return next;
  }

  async deleteByCredentialId(credentialId: string): Promise<void> {
    this.items.delete(credentialId);
  }
}

const config: AppConfig = {
  port: 4000,
  host: "127.0.0.1",
  databaseProvider: "sqlite",
  databasePath: "./data/test.sqlite",
  issuer: "http://localhost:4000",
  ttl: {
    accessTokenSeconds: 900,
    idTokenSeconds: 900,
    refreshTokenSeconds: 86_400
  },
  admin: {
    email: "admin@example.com",
    password: "change-me-now"
  },
  federation: {
    providers: []
  }
};

test("webauthn service registration + login challenge lifecycle", async () => {
  const repository = new InMemoryWebauthnCredentialRepository();
  const service = new WebauthnService(config, repository);
  const user = {
    id: "user-1",
    appId: undefined,
    externalSource: undefined,
    externalId: undefined,
    isServiceUser: false,
    email: "user@example.com",
    username: "user",
    passwordHash: "hash",
    givenName: "User",
    familyName: "One",
    customAttributes: {},
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const beginRegistration = service.startRegistration(user);
  assert.ok(beginRegistration.registrationId);
  assert.ok(beginRegistration.challenge);

  const stored = await service.finishRegistration({
    userId: user.id,
    registrationId: beginRegistration.registrationId,
    credentialId: "cred-1",
    publicKey: "pub-key-1",
    transports: ["internal"],
    signCount: 0
  });

  assert.equal(stored.credentialId, "cred-1");

  const beginLogin = await service.startLogin({
    user,
    clientId: "sso-admin-ui",
    scope: ["openid", "profile"],
    ip: "127.0.0.1"
  });

  assert.ok(beginLogin.loginId);
  assert.equal(beginLogin.allowCredentials.includes("cred-1"), true);

  const finishLogin = await service.finishLogin({
    loginId: beginLogin.loginId,
    credentialId: "cred-1",
    signCount: 1
  });

  assert.equal(finishLogin.userId, user.id);

  const credentials = await service.listCredentials(user.id);
  assert.equal(credentials.length, 1);
  assert.equal(credentials[0]?.signCount, 1);
});
