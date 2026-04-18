import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type { AppConfig } from "../core/config.js";
import type { TotpCredentialRepository } from "../repositories/contracts.js";
import type { User } from "../domain/models.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpToken } from "../security/totp.js";

interface PendingEnrollment {
  id: string;
  userId: string;
  secret: string;
  expiresAt: Date;
}

interface LoginChallenge {
  ticket: string;
  userId: string;
  clientId: string;
  scope: string[];
  tenantSlug?: string;
  ip?: string;
  expiresAt: Date;
}

export class TotpService {
  private readonly pendingEnrollments = new Map<string, PendingEnrollment>();
  private readonly loginChallenges = new Map<string, LoginChallenge>();

  constructor(
    private readonly appConfig: AppConfig,
    private readonly totpCredentialRepository: TotpCredentialRepository
  ) {}

  getStatus(userId: string) {
    const credential = this.totpCredentialRepository.findByUserId(userId);
    return {
      enabled: Boolean(credential?.enabled)
    };
  }

  startEnrollment(user: User) {
    this.purgeExpired();

    const secret = generateTotpSecret();
    const enrollment: PendingEnrollment = {
      id: nanoid(),
      userId: user.id,
      secret,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    };

    this.pendingEnrollments.set(enrollment.id, enrollment);

    const accountName = user.email || user.username;
    const uri = buildOtpAuthUri({
      issuer: this.appConfig.issuer,
      accountName,
      secret
    });

    return {
      enrollmentId: enrollment.id,
      secret,
      otpauthUri: uri,
      expiresIn: 600
    };
  }

  completeEnrollment(input: { userId: string; enrollmentId: string; code: string }) {
    this.purgeExpired();

    const enrollment = this.pendingEnrollments.get(input.enrollmentId);
    if (!enrollment || enrollment.userId !== input.userId) {
      throw new ValidationError("Invalid enrollment transaction");
    }

    if (!verifyTotpToken(enrollment.secret, input.code)) {
      throw new ValidationError("Invalid TOTP code");
    }

    this.totpCredentialRepository.upsert({
      userId: input.userId,
      secret: enrollment.secret,
      enabled: true
    });

    this.pendingEnrollments.delete(input.enrollmentId);
    return { enabled: true };
  }

  disable(userId: string) {
    this.totpCredentialRepository.delete(userId);
  }

  requiresTotp(userId: string): boolean {
    const credential = this.totpCredentialRepository.findByUserId(userId);
    return Boolean(credential?.enabled);
  }

  verifyUserCode(input: { userId: string; code: string }): boolean {
    const credential = this.totpCredentialRepository.findByUserId(input.userId);
    if (!credential || !credential.enabled) {
      return false;
    }

    return verifyTotpToken(credential.secret, input.code);
  }

  createLoginChallenge(input: {
    userId: string;
    clientId: string;
    scope: string[];
    tenantSlug?: string;
    ip?: string;
  }) {
    this.purgeExpired();

    const challenge: LoginChallenge = {
      ticket: nanoid(48),
      userId: input.userId,
      clientId: input.clientId,
      scope: input.scope,
      tenantSlug: input.tenantSlug,
      ip: input.ip,
      expiresAt: new Date(Date.now() + 1000 * 60 * 5)
    };

    this.loginChallenges.set(challenge.ticket, challenge);

    return {
      mfaRequired: true,
      mfaTicket: challenge.ticket,
      expiresIn: 300
    };
  }

  consumeLoginChallenge(ticket: string) {
    this.purgeExpired();
    const challenge = this.loginChallenges.get(ticket);
    if (!challenge) {
      throw new ValidationError("Invalid or expired MFA ticket");
    }

    this.loginChallenges.delete(ticket);
    return challenge;
  }

  private purgeExpired() {
    const now = Date.now();

    for (const [id, enrollment] of this.pendingEnrollments.entries()) {
      if (enrollment.expiresAt.getTime() < now) {
        this.pendingEnrollments.delete(id);
      }
    }

    for (const [ticket, challenge] of this.loginChallenges.entries()) {
      if (challenge.expiresAt.getTime() < now) {
        this.loginChallenges.delete(ticket);
      }
    }
  }
}
