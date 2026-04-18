import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";

interface RecoveryChallenge {
  ticket: string;
  userId: string;
  verificationCode: string;
  expiresAt: Date;
  failedAttempts: number;
  verifiedAt?: Date;
}

export class RecoveryService {
  private readonly challenges = new Map<string, RecoveryChallenge>();

  createChallenge(input: { userId: string; expiresInSeconds?: number }) {
    this.purgeExpired();

    const challenge: RecoveryChallenge = {
      ticket: nanoid(40),
      userId: input.userId,
      verificationCode: this.generateNumericCode(6),
      expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 600) * 1000),
      failedAttempts: 0
    };

    this.challenges.set(challenge.ticket, challenge);

    return {
      ticket: challenge.ticket,
      verificationCode: challenge.verificationCode,
      expiresIn: Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000)
    };
  }

  getChallenge(ticket: string) {
    this.purgeExpired();
    const challenge = this.challenges.get(ticket);
    if (!challenge) {
      throw new ValidationError("Invalid or expired recovery ticket");
    }
    return challenge;
  }

  verifyCode(input: { ticket: string; code: string }) {
    const challenge = this.getChallenge(input.ticket);

    if (challenge.failedAttempts >= 5) {
      this.challenges.delete(challenge.ticket);
      throw new ValidationError("Recovery ticket has been invalidated");
    }

    if (input.code.trim() !== challenge.verificationCode) {
      challenge.failedAttempts += 1;
      return false;
    }

    challenge.verifiedAt = new Date();
    return true;
  }

  consume(ticket: string) {
    const challenge = this.getChallenge(ticket);
    this.challenges.delete(ticket);
    return challenge;
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [ticket, challenge] of this.challenges.entries()) {
      if (challenge.expiresAt.getTime() <= now) {
        this.challenges.delete(ticket);
      }
    }
  }

  private generateNumericCode(length: number) {
    let output = "";
    for (let i = 0; i < length; i += 1) {
      output += String(Math.floor(Math.random() * 10));
    }
    return output;
  }
}
