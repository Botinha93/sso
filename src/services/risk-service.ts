import type { RiskEvent, RiskDecision, RiskReason } from "../domain/models.js";
import type { RiskEventRepository } from "../repositories/contracts.js";

export interface RiskScore {
  score: number; // 0-100
  decision: RiskDecision;
  reasons: RiskReason[];
}

export class RiskService {
  constructor(private readonly riskEventRepository: RiskEventRepository) {}

  async evaluateLoginRisk(input: {
    userId?: string;
    ip?: string;
    deviceFingerprintHash?: string;
    failedAttempts?: number;
  }): Promise<RiskScore> {
    const reasons: RiskReason[] = [];
    let score = 0;

    if (input.ip) {
      const recentFailures = await this.riskEventRepository.countRecentByIp(input.ip, 15 * 60_000);
      if (recentFailures >= 10) {
        score += 60;
        reasons.push("brute_force");
      } else if (recentFailures >= 5) {
        score += 30;
        reasons.push("suspicious_ip");
      }
    }

    if (input.failedAttempts && input.failedAttempts >= 3) {
      score += 20;
      if (!reasons.includes("brute_force")) {
        reasons.push("failed_login");
      }
    }

    score = Math.min(score, 100);

    let decision: RiskDecision = "allow";
    if (score >= 80) {
      decision = "block";
    } else if (score >= 40) {
      decision = "challenge";
    }

    return { score, decision, reasons };
  }

  async recordEvent(input: Omit<RiskEvent, "id" | "createdAt">): Promise<RiskEvent> {
    return this.riskEventRepository.create(input);
  }

  async listEvents(input?: { limit?: number; userId?: string; minConfidence?: number }): Promise<RiskEvent[]> {
    return this.riskEventRepository.list(input);
  }
}
