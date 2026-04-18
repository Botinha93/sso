import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type {
  EventHookRepository,
  EventNotificationRepository
} from "../repositories/contracts.js";

const SYSTEM_EVENT_TYPES = [
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.lockout.triggered",
  "auth.session.anomaly_detected",
  "auth.logout",
  "security.rate_limit_blocked",
  "security.sqli_blocked",
  "user.created",
  "user.updated",
  "user.deleted",
  "user.password_reset",
  "client.created",
  "client.updated",
  "client.deleted",
  "session.revoked",
  "consent.revoked",
  "device.request.revoked",
  "device.session.revoked",
  "events.hook.test"
] as const;

const ALL_EVENTS_TOKEN = "*";

export class EventHookService {
  constructor(
    private readonly eventHookRepository: EventHookRepository,
    private readonly eventNotificationRepository: EventNotificationRepository
  ) {}

  listHooks() {
    return this.eventHookRepository.list();
  }

  listNotifications(limit = 100) {
    return this.eventNotificationRepository.list(limit);
  }

  listSystemEventTypes() {
    return [ALL_EVENTS_TOKEN, ...SYSTEM_EVENT_TYPES];
  }

  createHook(input: {
    eventType: string;
    targetUrl: string;
    method: "POST" | "PUT";
    headers?: Record<string, string>;
    enabled?: boolean;
  }) {
    this.assertValidEventType(input.eventType);
    return this.eventHookRepository.create({
      id: nanoid(),
      eventType: input.eventType.trim(),
      targetUrl: input.targetUrl,
      method: input.method,
      headers: input.headers ?? {},
      enabled: input.enabled ?? true
    });
  }

  updateHook(id: string, input: {
    eventType?: string;
    targetUrl?: string;
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    enabled?: boolean;
  }) {
    if (input.eventType !== undefined) {
      this.assertValidEventType(input.eventType);
    }

    const updated = this.eventHookRepository.update(id, {
      eventType: input.eventType?.trim(),
      targetUrl: input.targetUrl,
      method: input.method,
      headers: input.headers,
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Event hook not found");
    }

    return updated;
  }

  deleteHook(id: string) {
    this.eventHookRepository.delete(id);
  }

  async emit(eventType: string, payload: Record<string, unknown>) {
    const exactHooks = this.eventHookRepository.listByEventType(eventType);
    const wildcardHooks = this.eventHookRepository.listByEventType("*");
    const hooks = [...exactHooks, ...wildcardHooks].filter((hook) => hook.enabled);

    for (const hook of hooks) {
      await this.dispatchToHook(hook, eventType, payload);
    }
  }

  async emitTest(hookId: string, input?: {
    eventType?: string;
    payload?: Record<string, unknown>;
  }) {
    const hook = this.eventHookRepository.findById(hookId);
    if (!hook) {
      throw new ValidationError("Event hook not found");
    }

    const eventType = input?.eventType?.trim() || "events.hook.test";
    this.assertValidEventType(eventType);
    const payload = input?.payload ?? {
      hookId,
      targetUrl: hook.targetUrl,
      method: hook.method,
      generatedAt: new Date().toISOString()
    };

    await this.dispatchToHook(hook, eventType, payload);
    return { deliveredToHookId: hookId, eventType };
  }

  private assertValidEventType(eventType: string) {
    const normalized = eventType.trim();
    if (!this.listSystemEventTypes().includes(normalized)) {
      throw new ValidationError(`Unsupported event type: ${normalized}`);
    }
  }

  private async dispatchToHook(
    hook: {
      id: string;
      targetUrl: string;
      method: "POST" | "PUT";
      headers: Record<string, string>;
    },
    eventType: string,
    payload: Record<string, unknown>
  ) {
    const headers = {
      "content-type": "application/json",
      ...hook.headers
    };

    try {
      const response = await fetch(hook.targetUrl, {
        method: hook.method,
        headers,
        body: JSON.stringify({ eventType, payload, sentAt: new Date().toISOString() })
      });

      const responseBody = await response.text();
      this.eventNotificationRepository.create({
        eventType,
        hookId: hook.id,
        payload,
        status: response.ok ? "delivered" : "failed",
        responseStatus: response.status,
        responseBody,
        error: response.ok ? undefined : `Hook returned HTTP ${response.status}`
      });
    } catch (error) {
      this.eventNotificationRepository.create({
        eventType,
        hookId: hook.id,
        payload,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown hook delivery failure"
      });
    }
  }
}
