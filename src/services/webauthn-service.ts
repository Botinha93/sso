import { randomBytes } from "node:crypto";
import { ValidationError } from "../core/errors.js";
import type { AppConfig } from "../core/config.js";
import type { User, WebauthnCredential } from "../domain/models.js";
import type { WebauthnCredentialRepository } from "../repositories/contracts.js";

interface PendingRegistration {
  id: string;
  userId: string;
  challenge: string;
  expiresAt: Date;
}

interface PendingLogin {
  id: string;
  userId: string;
  clientId: string;
  scope: string[];
  tenantSlug?: string;
  ip?: string;
  challenge: string;
  allowedCredentialIds: string[];
  expiresAt: Date;
}

export class WebauthnService {
  private readonly pendingRegistrations = new Map<string, PendingRegistration>();
  private readonly pendingLogins = new Map<string, PendingLogin>();

  constructor(
    private readonly appConfig: AppConfig,
    private readonly webauthnCredentialRepository: WebauthnCredentialRepository
  ) {}

  async listCredentials(userId: string): Promise<WebauthnCredential[]> {
    return this.webauthnCredentialRepository.listByUserId(userId);
  }

  startRegistration(user: User, displayName?: string) {
    this.purgeExpired();

    const challenge = this.generateChallenge();
    const registration: PendingRegistration = {
      id: this.generateOpaqueId(),
      userId: user.id,
      challenge,
      expiresAt: new Date(Date.now() + 5 * 60_000)
    };

    this.pendingRegistrations.set(registration.id, registration);

    return {
      registrationId: registration.id,
      challenge,
      rpId: this.getRpId(),
      rpName: this.appConfig.issuer,
      user: {
        id: user.id,
        name: user.username,
        displayName: displayName ?? (`${user.givenName} ${user.familyName}`.trim() || user.username)
      },
      timeoutMs: 5 * 60_000
    };
  }

  async finishRegistration(input: {
    userId: string;
    registrationId: string;
    credentialId: string;
    publicKey: string;
    transports: string[];
    aaguid?: string;
    signCount: number;
  }) {
    this.purgeExpired();

    const pending = this.pendingRegistrations.get(input.registrationId);
    if (!pending || pending.userId !== input.userId) {
      throw new ValidationError("Invalid or expired WebAuthn registration transaction");
    }

    this.pendingRegistrations.delete(input.registrationId);

    const credential = await this.webauthnCredentialRepository.upsert({
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      signCount: input.signCount,
      transports: input.transports,
      aaguid: input.aaguid
    });

    return {
      credentialId: credential.credentialId,
      createdAt: credential.createdAt,
      transports: credential.transports
    };
  }

  async startLogin(input: {
    user: User;
    clientId: string;
    scope: string[];
    tenantSlug?: string;
    ip?: string;
  }) {
    this.purgeExpired();

    const credentials = await this.webauthnCredentialRepository.listByUserId(input.user.id);
    if (credentials.length === 0) {
      throw new ValidationError("No WebAuthn credentials are registered for this account");
    }

    const challenge = this.generateChallenge();
    const pending: PendingLogin = {
      id: this.generateOpaqueId(),
      userId: input.user.id,
      clientId: input.clientId,
      scope: input.scope,
      tenantSlug: input.tenantSlug,
      ip: input.ip,
      challenge,
      allowedCredentialIds: credentials.map((credential) => credential.credentialId),
      expiresAt: new Date(Date.now() + 3 * 60_000)
    };

    this.pendingLogins.set(pending.id, pending);

    return {
      loginId: pending.id,
      challenge: pending.challenge,
      rpId: this.getRpId(),
      allowCredentials: pending.allowedCredentialIds,
      timeoutMs: 3 * 60_000
    };
  }

  async finishLogin(input: {
    loginId: string;
    credentialId: string;
    signCount?: number;
  }) {
    this.purgeExpired();

    const pending = this.pendingLogins.get(input.loginId);
    if (!pending) {
      throw new ValidationError("Invalid or expired WebAuthn login transaction");
    }

    this.pendingLogins.delete(input.loginId);

    if (!pending.allowedCredentialIds.includes(input.credentialId)) {
      throw new ValidationError("Credential is not valid for this login challenge");
    }

    const credential = await this.webauthnCredentialRepository.findByCredentialId(input.credentialId);
    if (!credential || credential.userId !== pending.userId) {
      throw new ValidationError("Credential not found for this account");
    }

    if (typeof input.signCount === "number" && input.signCount < credential.signCount) {
      throw new ValidationError("WebAuthn signature counter replay detected");
    }

    await this.webauthnCredentialRepository.upsert({
      userId: credential.userId,
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      signCount: typeof input.signCount === "number" ? input.signCount : credential.signCount,
      transports: credential.transports,
      aaguid: credential.aaguid
    });

    return {
      userId: pending.userId,
      clientId: pending.clientId,
      scope: pending.scope,
      tenantSlug: pending.tenantSlug,
      ip: pending.ip
    };
  }

  async removeCredential(userId: string, credentialId: string) {
    const credential = await this.webauthnCredentialRepository.findByCredentialId(credentialId);
    if (!credential || credential.userId !== userId) {
      throw new ValidationError("Credential not found");
    }

    await this.webauthnCredentialRepository.deleteByCredentialId(credentialId);
  }

  private purgeExpired() {
    const now = Date.now();

    for (const [id, pending] of this.pendingRegistrations.entries()) {
      if (pending.expiresAt.getTime() < now) {
        this.pendingRegistrations.delete(id);
      }
    }

    for (const [id, pending] of this.pendingLogins.entries()) {
      if (pending.expiresAt.getTime() < now) {
        this.pendingLogins.delete(id);
      }
    }
  }

  private getRpId() {
    try {
      const url = new URL(this.appConfig.issuer);
      return url.hostname;
    } catch {
      return "localhost";
    }
  }

  private generateChallenge() {
    return randomBytes(32).toString("base64url");
  }

  private generateOpaqueId() {
    return randomBytes(24).toString("base64url");
  }
}
