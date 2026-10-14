import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";

interface RecoveryChallenge {
  ticketHash: string;
  userId: string;
  verificationCode: string;
  expiresAt: Date;
  failedAttempts: number;
  verifiedAt?: Date;
}

const MAX_CHALLENGES = 10_000;

const hashTicket = (ticket: string) => createHash("sha256").update(ticket).digest("hex");

export class RecoveryService {
  private readonly challenges = new Map<string, RecoveryChallenge>();

  createChallenge(input: { userId: string; expiresInSeconds?: number }) {
    this.purgeExpired();

    for (const [key, existing] of this.challenges.entries()) {
      if (existing.userId === input.userId) {
        this.challenges.delete(key);
      }
    }

    if (this.challenges.size >= MAX_CHALLENGES) {
      throw new ValidationError("Recovery is temporarily unavailable");
    }

    const ticket = nanoid(40);
    const challenge: RecoveryChallenge = {
      ticketHash: hashTicket(ticket),
      userId: input.userId,
      verificationCode: this.generateNumericCode(6),
      expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 600) * 1000),
      failedAttempts: 0
    };

    this.challenges.set(challenge.ticketHash, challenge);

    return {
      ticket,
      verificationCode: challenge.verificationCode,
      expiresIn: Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000)
    };
  }

  getChallenge(ticket: string) {
    this.purgeExpired();
    const challenge = this.challenges.get(hashTicket(ticket));
    if (!challenge) {
      throw new ValidationError("Invalid or expired recovery ticket");
    }
    return challenge;
  }

  verifyCode(input: { ticket: string; code: string }) {
    const challenge = this.getChallenge(input.ticket);

    if (challenge.failedAttempts >= 5) {
      this.challenges.delete(challenge.ticketHash);
      throw new ValidationError("Recovery ticket has been invalidated");
    }

    const provided = Buffer.from(input.code.trim());
    const expected = Buffer.from(challenge.verificationCode);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      challenge.failedAttempts += 1;
      return false;
    }

    challenge.verifiedAt = new Date();
    return true;
  }

  consume(ticket: string) {
    const challenge = this.getChallenge(ticket);
    this.challenges.delete(challenge.ticketHash);
    return challenge;
  }

  private purgeExpired() {
    const now = Date.now();
    for (const [ticketHash, challenge] of this.challenges.entries()) {
      if (challenge.expiresAt.getTime() <= now) {
        this.challenges.delete(ticketHash);
      }
    }
  }

  private generateNumericCode(length: number) {
    return String(randomInt(0, 10 ** length)).padStart(length, "0");
  }
}
