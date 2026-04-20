import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type { ElevationRequest, ElevationSession } from "../domain/models.js";
import type {
  AuditRepository,
  ElevationSessionRepository,
  ElevationRequestRepository,
  UserRepository
} from "../repositories/contracts.js";

export class ElevationService {
  constructor(
    private readonly elevationRepository: ElevationRequestRepository,
    private readonly elevationSessionRepository: ElevationSessionRepository,
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
    const correlationId = nanoid();

    const request = await this.elevationRepository.create({
      correlationId,
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
      metadata: { elevationRequestId: request.id, correlationId: request.correlationId, resource, action }
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
      metadata: { elevationRequestId: request.id, correlationId: request.correlationId }
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

    const activatedAt = new Date();
    const expiresAt = request.expiresAt ?? new Date(activatedAt.getTime() + 60 * 60_000);

    const existingSession = await this.elevationSessionRepository.findActive({
      requesterId: request.requesterId,
      resource: request.resource,
      action: request.action,
      now: activatedAt
    });

    if (existingSession) {
      throw new ValidationError("An active elevation session already exists for this resource/action");
    }

    const updated = await this.elevationRepository.update(request.id, {
      status: "active",
      activatedAt,
      expiresAt
    });

    await this.elevationSessionRepository.create({
      correlationId: request.correlationId,
      elevationRequestId: request.id,
      requesterId: request.requesterId,
      resource: request.resource,
      action: request.action,
      status: "active",
      startedAt: activatedAt,
      expiresAt
    });

    await this.auditRepository.log({
      type: "elevation_request_activated",
      actorId: input.actorId,
      actorType: "user",
      metadata: { elevationRequestId: request.id, correlationId: request.correlationId }
    });

    await this.auditRepository.log({
      type: "elevation_session_started",
      actorId: input.actorId,
      actorType: "user",
      metadata: { elevationRequestId: request.id, correlationId: request.correlationId, requesterId: request.requesterId, resource: request.resource, action: request.action }
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

    const revokedAt = new Date();
    const updated = await this.elevationRepository.update(request.id, {
      status: "revoked",
      revokedAt,
      revokedByUserId: input.revokedByUserId
    });

    const closedSessions = await this.elevationSessionRepository.closeByElevationRequestId({
      elevationRequestId: request.id,
      status: "revoked",
      closedAt: revokedAt
    });

    await this.auditRepository.log({
      type: "elevation_request_revoked",
      actorId: input.revokedByUserId,
      actorType: "user",
      metadata: { elevationRequestId: request.id, correlationId: request.correlationId }
    });

    if (closedSessions > 0) {
      await this.auditRepository.log({
        type: "elevation_session_revoked",
        actorId: input.revokedByUserId,
        actorType: "user",
        metadata: { elevationRequestId: request.id, correlationId: request.correlationId, closedSessions }
      });
    }

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
        await this.elevationSessionRepository.closeByElevationRequestId({
          elevationRequestId: request.id,
          status: "expired",
          closedAt: new Date()
        });
        await this.auditRepository.log({
          type: "elevation_request_expired",
          actorId: "system",
          actorType: "system",
          metadata: { elevationRequestId: request.id, correlationId: request.correlationId }
        });
        expired++;
      }
    }

    const closedExpiredSessions = await this.elevationSessionRepository.closeExpired(new Date());
    if (closedExpiredSessions > 0) {
      await this.auditRepository.log({
        type: "elevation_session_expired",
        actorId: "system",
        actorType: "system",
        metadata: { closedSessions: closedExpiredSessions }
      });
    }

    return { expired };
  }

  async listSessions(input?: {
    limit?: number;
    status?: ElevationSession["status"];
    requesterId?: string;
  }): Promise<ElevationSession[]> {
    return this.elevationSessionRepository.list(input);
  }

  async checkAccess(input: {
    requesterId: string;
    resource: string;
    action: string;
  }): Promise<{ allowed: boolean; sessionId?: string }> {
    const session = await this.elevationSessionRepository.findActive({
      requesterId: input.requesterId,
      resource: input.resource,
      action: input.action,
      now: new Date()
    });

    return {
      allowed: Boolean(session),
      sessionId: session?.id
    };
  }

  async createEmergencyBreakGlass(input: {
    adminId: string;
    resource: string;
    action: string;
    reason: string;
    requesterId?: string;
    durationMinutes?: number;
  }): Promise<{
    request: ElevationRequest;
    session: ElevationSession;
    breakGlassId: string;
  }> {
    const admin = await this.userRepository.findById(input.adminId);
    if (!admin) {
      throw new ValidationError("Admin user not found");
    }

    const reason = input.reason?.trim();
    if (!reason) {
      throw new ValidationError("Emergency reason is required");
    }

    if (reason.length < 10) {
      throw new ValidationError("Emergency reason must be at least 10 characters");
    }

    const resource = input.resource?.trim();
    const action = input.action?.trim();
    if (!resource || !action) {
      throw new ValidationError("Resource and action are required");
    }

    const durationMinutes = input.durationMinutes ?? 30; // Shorter breakglass window
    if (durationMinutes < 1 || durationMinutes > 120) {
      throw new ValidationError("Emergency duration must be between 1 and 120 minutes");
    }

    // Break-glass is for the admin themselves by default
    const requesterId = input.requesterId || input.adminId;

    const expiresAt = new Date(Date.now() + durationMinutes * 60_000);
    const breakGlassId = nanoid();
    const correlationId = nanoid();

    // Create request directly (skips normal approval)
    const request = await this.elevationRepository.create({
      correlationId,
      requesterId,
      justification: `[BREAK-GLASS] ${reason}`,
      resource,
      action,
      status: "active",
      activatedAt: new Date(),
      approvedByUserId: input.adminId,
      approvedAt: new Date(),
      expiresAt
    });

    // Store break-glass metadata in audit
    const breakGlassMetadata = {
      breakGlassId,
      elevationRequestId: request.id,
      correlationId: request.correlationId,
      initiatedBy: input.adminId,
      targetUser: requesterId,
      resource,
      action,
      reason,
      durationMinutes
    };

    // Create session immediately
    const session = await this.elevationSessionRepository.create({
      correlationId,
      elevationRequestId: request.id,
      requesterId,
      resource,
      action,
      status: "active",
      startedAt: new Date(),
      expiresAt
    });

    // Log break-glass activation with highest audit visibility
    await this.auditRepository.log({
      type: "elevation_break_glass_activated",
      actorId: input.adminId,
      actorType: "user",
      metadata: breakGlassMetadata
    });

    await this.auditRepository.log({
      type: "elevation_session_started",
      actorId: input.adminId,
      actorType: "user",
      metadata: {
        elevationRequestId: request.id,
        correlationId: request.correlationId,
        requesterId,
        resource,
        action,
        breakGlass: true
      }
    });

    return {
      request,
      session,
      breakGlassId
    };
  }
}
