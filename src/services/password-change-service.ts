import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";

interface LoginChallenge {
  ticket: string;
  userId: string;
  clientId: string;
  scope: string[];
  tenantSlug?: string;
  ip?: string;
  expiresAt: Date;
}

export class PasswordChangeService {
  private readonly loginChallenges = new Map<string, LoginChallenge>();

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
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    };

    this.loginChallenges.set(challenge.ticket, challenge);

    return {
      passwordChangeRequired: true as const,
      changePasswordTicket: challenge.ticket,
      expiresIn: 600,
      message: "Your password has expired. Choose a new password to continue signing in."
    };
  }

  consumeLoginChallenge(ticket: string) {
    this.purgeExpired();
    const challenge = this.loginChallenges.get(ticket);
    if (!challenge) {
      throw new ValidationError("Invalid or expired password change ticket");
    }

    this.loginChallenges.delete(ticket);
    return challenge;
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [ticket, challenge] of this.loginChallenges.entries()) {
      if (challenge.expiresAt.getTime() < now) {
        this.loginChallenges.delete(ticket);
      }
    }
  }
}
