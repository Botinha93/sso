import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type { ElevationRequest } from "../domain/models.js";
import type {
  AuditRepository,
  ElevationRequestRepository,
  UserRepository
} from "../repositories/contracts.js";

export class ElevationService {
  constructor(
    private readonly elevationRepository: ElevationRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly auditRepository: AuditRepository
  ) {}

  async createRequest(input: {
    requesterId: string;
    justification: string;
    resource: string;
    action: string;
    durationMinutes?: number;
  }): Promise<ElevationRequest> {
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester) {
      throw new ValidationError("Requester not found");
    }

    const justification = input.justification?.trim();
    if (!justification) {
      throw new ValidationError("Justification is required");
    }

    const resource = input.resource?.trim();
    const action = input.action?.trim();
    if (!resource || !action) {
      throw new ValidationError("Resource and action are required");
    }

    const durationMinutes = input.durationMinutes ?? 60;
    if (durationMinutes < 1 || durationMinutes > 480) {
      throw new ValidationError("Duration must be between 1 and 480 minutes");
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60_000);

    const request = await this.elevationRepository.create({
      requesterId: input.requesterId,
      justification,
      resource,
      action,
      status: "pending",
      expiresAt
    });

    await this.auditRepository.log({
      type: "elevation_request_created",
      actorId: input.requesterId,
      actorType: "user",
      metadata: { elevationRequestId: request.id, resource, action }
    });

    return request;
  }

  async approveRequest(input: {
    elevationRequestId: string;
    approverId: string;
  }): Promise<ElevationRequest> {
    const request = await this.elevationRepository.findById(input.elevationRequestId);
    if (!request) {
      throw new ValidationError("Elevation request not found");
    }

    if (request.status !== "pending") {
      throw new ValidationError(`Cannot approve a request in status: ${request.status}`);
    }

    const updated = await this.elevationRepository.update(request.id, {
      status: "approved",
      approvedByUserId: input.approverId,
      approvedAt: new Date()
    });

    await this.auditRepository.log({
      type: "elevation_request_approved",
      actorId: input.approverId,
      actorType: "user",
      metadata: { elevationRequestId: request.id }
    });

    return updated!;
  }

  async activateRequest(input: {
    elevationRequestId: string;
    actorId: string;
  }): Promise<ElevationRequest> {
    const request = await this.elevationRepository.findById(input.elevationRequestId);
    if (!request) {
      throw new ValidationError("Elevation request not found");
    }

    if (request.status !== "approved") {
      throw new ValidationError(`Cannot activate a request in status: ${request.status}`);
    }

    if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
      await this.elevationRepository.update(request.id, { status: "expired" });
      throw new ValidationError("Elevation request has expired");
    }

    const updated = await this.elevationRepository.update(request.id, {
      status: "active",
      activatedAt: new Date()
    });

    await this.auditRepository.log({
      type: "elevation_request_activated",
      actorId: input.actorId,
      actorType: "user",
      metadata: { elevationRequestId: request.id }
    });

    return updated!;
  }

  async revokeRequest(input: {
    elevationRequestId: string;
    revokedByUserId: string;
  }): Promise<ElevationRequest> {
    const request = await this.elevationRepository.findById(input.elevationRequestId);
    if (!request) {
      throw new ValidationError("Elevation request not found");
    }

    if (request.status !== "active" && request.status !== "approved") {
      throw new ValidationError(`Cannot revoke a request in status: ${request.status}`);
    }

    const updated = await this.elevationRepository.update(request.id, {
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: input.revokedByUserId
    });

    await this.auditRepository.log({
      type: "elevation_request_revoked",
      actorId: input.revokedByUserId,
      actorType: "user",
      metadata: { elevationRequestId: request.id }
    });

    return updated!;
  }

  async listRequests(input?: {
    limit?: number;
    status?: ElevationRequest["status"];
    requesterId?: string;
  }): Promise<ElevationRequest[]> {
    return this.elevationRepository.list(input);
  }

  async getRequest(id: string): Promise<ElevationRequest> {
    const request = await this.elevationRepository.findById(id);
    if (!request) {
      throw new ValidationError("Elevation request not found");
    }
    return request;
  }

  async processExpiredRequests(): Promise<{ expired: number }> {
    const active = await this.elevationRepository.list({ status: "active" });
    const approved = await this.elevationRepository.list({ status: "approved" });
    const candidates = [...active, ...approved];
    const now = Date.now();
    let expired = 0;

    for (const request of candidates) {
      if (request.expiresAt && request.expiresAt.getTime() < now) {
        await this.elevationRepository.update(request.id, { status: "expired" });
        await this.auditRepository.log({
          type: "elevation_request_expired",
          actorId: "system",
          actorType: "system",
          metadata: { elevationRequestId: request.id }
        });
        expired++;
      }
    }

    return { expired };
  }
}
