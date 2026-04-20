import { ValidationError } from "../core/errors.js";
import type { AccessRequest } from "../domain/models.js";
import type { AccessRequestRepository, UserRepository } from "../repositories/contracts.js";

export class AccessGovernanceService {
  constructor(
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly userRepository: UserRepository
  ) {}

  async listAccessRequests(input?: { limit?: number; status?: AccessRequest["status"] }) {
    return this.accessRequestRepository.list(input);
  }

  async createAccessRequest(input: {
    requesterId: string;
    subjectUserId: string;
    entitlementType: string;
    entitlementValue: string;
    justification: string;
    expiresAt?: Date;
  }) {
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester) {
      throw new ValidationError("Requester user not found");
    }

    const subject = await this.userRepository.findById(input.subjectUserId);
    if (!subject) {
      throw new ValidationError("Subject user not found");
    }

    const entitlementType = input.entitlementType.trim();
    const entitlementValue = input.entitlementValue.trim();
    const justification = input.justification.trim();

    if (!entitlementType) {
      throw new ValidationError("Entitlement type is required");
    }
    if (!entitlementValue) {
      throw new ValidationError("Entitlement value is required");
    }
    if (!justification) {
      throw new ValidationError("Justification is required");
    }

    if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) {
      throw new ValidationError("Invalid expiration date");
    }

    return this.accessRequestRepository.create({
      requesterId: input.requesterId,
      subjectUserId: input.subjectUserId,
      entitlementType,
      entitlementValue,
      status: "pending",
      justification,
      expiresAt: input.expiresAt
    });
  }
}
