import { randomBytes } from "node:crypto";
import { hashOpaqueToken } from "../security/token-hash.js";
import type { ScimTokenRepository } from "../repositories/contracts.js";

export class ScimTokenService {
  constructor(private readonly scimTokenRepository: ScimTokenRepository) {}

  async listTokens() {
    const tokens = await this.scimTokenRepository.list();
    return tokens.map((token) => ({
      id: token.id,
      label: token.label,
      lastUsedAt: token.lastUsedAt,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt
    }));
  }

  async createToken(input: { label: string; expiresAt?: Date }) {
    const plainToken = randomBytes(32).toString("hex");
    const persisted = await this.scimTokenRepository.create({
      label: input.label,
      tokenHash: hashOpaqueToken(plainToken),
      expiresAt: input.expiresAt
    });

    return {
      id: persisted.id,
      label: persisted.label,
      token: plainToken,
      expiresAt: persisted.expiresAt,
      createdAt: persisted.createdAt
    };
  }

  async revokeToken(id: string) {
    await this.scimTokenRepository.delete(id);
  }

  async authenticateBearerToken(token: string): Promise<boolean> {
    const tokenHash = hashOpaqueToken(token);
    const match = await this.scimTokenRepository.findByTokenHash(tokenHash);
    if (!match) {
      return false;
    }

    if (match.expiresAt && match.expiresAt.getTime() <= Date.now()) {
      return false;
    }

    await this.scimTokenRepository.touchLastUsed(match.id, new Date());
    return true;
  }
}
