import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type {
  EventHookRepository,
  EventNotificationRepository
} from "../repositories/contracts.js";

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

  createHook(input: {
    eventType: string;
    targetUrl: string;
    method: "POST" | "PUT";
    headers?: Record<string, string>;
    enabled?: boolean;
  }) {
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
}
