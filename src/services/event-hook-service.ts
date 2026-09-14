import { nanoid } from "nanoid";
import { createHmac } from "node:crypto";
import { ValidationError } from "../core/errors.js";
import { assertSafeOutboundUrl } from "../http/safe-url.js";
import type { EventHook } from "../domain/models.js";
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
  "scim.user.created",
  "scim.user.updated",
  "scim.user.deleted",
  "scim.group.created",
  "scim.group.updated",
  "scim.group.deleted",
  "client.created",
  "client.updated",
  "client.deleted",
  "session.revoked",
  "consent.revoked",
  "device.request.revoked",
  "device.session.revoked",
  "connector.sync.failed",
  "events.hook.test"
] as const;

const ALL_EVENTS_TOKEN = "*";
const DEFAULT_DELIVERY_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_QUEUE_SIZE = 1_000;
const DEFAULT_MAX_CONCURRENT_EVENTS = 4;
const MAX_RESPONSE_BODY_CHARS = 4_096;
const SIGNING_SECRET_HEADER = "_ssoSigningSecret";
const HOOK_FAILURE_THRESHOLD = 5;
const HOOK_FAILURE_COOLDOWN_MS = 5 * 60_000;

type PluginRuntimeLike = {
  dispatch: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
};

type EventDeliveryJob = {
  eventType: string;
  payload: Record<string, unknown>;
};

type EventHookServiceOptions = {
  deliveryTimeoutMs?: number;
  maxQueueSize?: number;
  maxConcurrentEvents?: number;
};

export class EventHookService {
  private pluginRuntime?: PluginRuntimeLike;
  private readonly deliveryTimeoutMs: number;
  private readonly maxQueueSize: number;
  private readonly maxConcurrentEvents: number;
  private readonly deliveryQueue: EventDeliveryJob[] = [];
  private processingQueue = false;
  private drainScheduled = false;
  private readonly hookFailures = new Map<string, { count: number; disabledUntil?: number }>();

  constructor(
    private readonly eventHookRepository: EventHookRepository,
    private readonly eventNotificationRepository: EventNotificationRepository,
    options: EventHookServiceOptions = {}
  ) {
    this.deliveryTimeoutMs = options.deliveryTimeoutMs ?? DEFAULT_DELIVERY_TIMEOUT_MS;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.maxConcurrentEvents = options.maxConcurrentEvents ?? DEFAULT_MAX_CONCURRENT_EVENTS;
  }

  setPluginRuntime(runtime: PluginRuntimeLike) {
    this.pluginRuntime = runtime;
  }

  async listHooks() {
    const hooks = await this.eventHookRepository.list();
    return hooks.map((hook) => this.toPublicHook(hook));
  }

  async listNotifications(limit = 100) {
    return this.eventNotificationRepository.list(limit);
  }

  listSystemEventTypes() {
    return [ALL_EVENTS_TOKEN, ...SYSTEM_EVENT_TYPES];
  }

  async createHook(input: {
    eventType: string;
    targetUrl: string;
    method: "POST" | "PUT";
    headers?: Record<string, string>;
    enabled?: boolean;
  }) {
    this.assertValidEventType(input.eventType);
    await assertSafeOutboundUrl(input.targetUrl, { label: "Event hook target URL" });
    this.assertSafeHeaders(input.headers);
    const created = await this.eventHookRepository.create({
      id: nanoid(),
      eventType: input.eventType.trim(),
      targetUrl: input.targetUrl,
      method: input.method,
      headers: {
        ...this.withoutSigningSecret(input.headers ?? {}),
        [SIGNING_SECRET_HEADER]: nanoid(40)
      },
      enabled: input.enabled ?? true
    });
    return this.toPublicHook(created, { includeSigningSecret: true });
  }

  async updateHook(id: string, input: {
    eventType?: string;
    targetUrl?: string;
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    enabled?: boolean;
  }) {
    if (input.eventType !== undefined) {
      this.assertValidEventType(input.eventType);
    }
    if (input.targetUrl !== undefined) {
      await assertSafeOutboundUrl(input.targetUrl, { label: "Event hook target URL" });
    }
    this.assertSafeHeaders(input.headers);

    const existing = await this.eventHookRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Event hook not found");
    }

    const nextHeaders = input.headers === undefined
      ? undefined
      : {
          ...this.withoutSigningSecret(input.headers),
          [SIGNING_SECRET_HEADER]: existing.headers[SIGNING_SECRET_HEADER] ?? nanoid(40)
        };

    const updated = await this.eventHookRepository.update(id, {
      eventType: input.eventType?.trim(),
      targetUrl: input.targetUrl,
      method: input.method,
      headers: nextHeaders,
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Event hook not found");
    }

    return this.toPublicHook(updated);
  }

  async deleteHook(id: string) {
    await this.eventHookRepository.delete(id);
  }

  async emit(eventType: string, payload: Record<string, unknown>) {
    this.enqueueDelivery({ eventType, payload });
  }

  async waitForIdle() {
    while (this.drainScheduled || this.processingQueue || this.deliveryQueue.length > 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  private enqueueDelivery(job: EventDeliveryJob) {
    if (this.deliveryQueue.length >= this.maxQueueSize) {
      void this.recordNotificationFailure(
        job.eventType,
        job.payload,
        "Event hook delivery queue is full; event was dropped"
      );
      return;
    }

    this.deliveryQueue.push(job);
    this.scheduleDrain();
  }

  private scheduleDrain() {
    if (this.drainScheduled || this.processingQueue) {
      return;
    }

    this.drainScheduled = true;
    setImmediate(() => {
      this.drainScheduled = false;
      void this.drainQueue();
    });
  }

  private async drainQueue() {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;
    try {
      while (this.deliveryQueue.length > 0) {
        const batch = this.deliveryQueue.splice(0, this.maxConcurrentEvents);
        await Promise.allSettled(batch.map((job) => this.deliverEvent(job)));
      }
    } finally {
      this.processingQueue = false;
      if (this.deliveryQueue.length > 0) {
        this.scheduleDrain();
      }
    }
  }

  private async deliverEvent({ eventType, payload }: EventDeliveryJob) {
    if (this.pluginRuntime) {
      try {
        await this.pluginRuntime.dispatch(eventType, payload);
      } catch {
        // Plugin failures must not prevent webhook delivery or affect callers.
      }
    }

    try {
      const [exactHooks, wildcardHooks] = await Promise.all([
        this.eventHookRepository.listByEventType(eventType),
        this.eventHookRepository.listByEventType("*")
      ]);
      const hooks = [...exactHooks, ...wildcardHooks].filter((hook) => hook.enabled);

      await Promise.allSettled(hooks.map((hook) => this.dispatchToHook(hook, eventType, payload)));
    } catch (error) {
      await this.recordNotificationFailure(
        eventType,
        payload,
        error instanceof Error ? error.message : "Unknown event hook dispatch failure"
      );
    }
  }

  async emitTest(hookId: string, input?: {
    eventType?: string;
    payload?: Record<string, unknown>;
  }) {
    const hook = await this.eventHookRepository.findById(hookId);
    if (!hook) {
      throw new ValidationError("Event hook not found");
    }

    if (!hook.enabled) {
      throw new ValidationError("Event hook is disabled");
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

  /**
   * Operators may attach custom headers (for example an Authorization value
   * for the receiver). Headers that would let the request impersonate a
   * browser session or override the destination host are refused.
   */
  private assertSafeHeaders(headers: Record<string, string> | undefined) {
    if (!headers) {
      return;
    }
    const forbidden = new Set(["host", "cookie", "content-length", "transfer-encoding", "connection", SIGNING_SECRET_HEADER.toLowerCase()]);
    for (const name of Object.keys(headers)) {
      if (forbidden.has(name.trim().toLowerCase())) {
        throw new ValidationError(`Event hook header not allowed: ${name}`);
      }
    }
  }

  private assertValidEventType(eventType: string) {
    const normalized = eventType.trim();
    if (!this.listSystemEventTypes().includes(normalized)) {
      throw new ValidationError(`Unsupported event type: ${normalized}`);
    }
  }

  private async dispatchToHook(
    hook: Pick<EventHook, "id" | "targetUrl" | "method" | "headers">,
    eventType: string,
    payload: Record<string, unknown>
  ) {
    if (this.isHookCircuitOpen(hook.id)) {
      await this.recordNotificationFailure(
        eventType,
        payload,
        "Hook temporarily disabled after repeated failures",
        hook.id
      );
      return;
    }

    const body = JSON.stringify({ eventType, payload, sentAt: new Date().toISOString() });
    const headers = this.buildDeliveryHeaders(hook.headers, body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.deliveryTimeoutMs);

    try {
      // Re-validate at delivery time: DNS for the hostname may have changed
      // since the hook was created (rebinding to an internal address).
      await assertSafeOutboundUrl(hook.targetUrl, { label: "Event hook target URL" });

      const response = await fetch(hook.targetUrl, {
        method: hook.method,
        headers,
        body,
        signal: controller.signal,
        // Following redirects would let a public hostname bounce the request
        // to an internal service.
        redirect: "manual"
      });

      const responseBody = (await response.text()).slice(0, MAX_RESPONSE_BODY_CHARS);
      if (response.ok) {
        this.recordHookSuccess(hook.id);
      } else {
        this.recordHookFailure(hook.id);
      }
      await this.eventNotificationRepository.create({
        eventType,
        hookId: hook.id,
        payload,
        status: response.ok ? "delivered" : "failed",
        responseStatus: response.status,
        responseBody,
        error: response.ok ? undefined : `Hook returned HTTP ${response.status}`
      });
    } catch (error) {
      this.recordHookFailure(hook.id);
      await this.recordNotificationFailure(
        eventType,
        payload,
        this.deliveryErrorMessage(error),
        hook.id
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildDeliveryHeaders(hookHeaders: Record<string, string>, body: string) {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    for (const [name, value] of Object.entries(hookHeaders)) {
      if (name === SIGNING_SECRET_HEADER) {
        continue;
      }
      headers[name] = value;
    }

    const secret = hookHeaders[SIGNING_SECRET_HEADER];
    if (secret) {
      const ts = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
      headers["x-sso-signature"] = `t=${ts},v1=${signature}`;
    }

    return headers;
  }

  private toPublicHook(hook: EventHook, options: { includeSigningSecret?: boolean } = {}) {
    const signingSecret = hook.headers[SIGNING_SECRET_HEADER];
    const headers = this.withoutSigningSecret(hook.headers);
    return {
      ...hook,
      headers,
      hasSigningSecret: Boolean(signingSecret),
      signingSecret: options.includeSigningSecret ? signingSecret : undefined
    };
  }

  private withoutSigningSecret(headers: Record<string, string>) {
    const next = { ...headers };
    delete next[SIGNING_SECRET_HEADER];
    return next;
  }

  private isHookCircuitOpen(hookId: string) {
    const state = this.hookFailures.get(hookId);
    return Boolean(state?.disabledUntil && state.disabledUntil > Date.now());
  }

  private recordHookSuccess(hookId: string) {
    this.hookFailures.delete(hookId);
  }

  private recordHookFailure(hookId: string) {
    const current = this.hookFailures.get(hookId) ?? { count: 0 };
    const count = current.count + 1;
    this.hookFailures.set(hookId, {
      count,
      disabledUntil: count >= HOOK_FAILURE_THRESHOLD ? Date.now() + HOOK_FAILURE_COOLDOWN_MS : current.disabledUntil
    });
  }

  private deliveryErrorMessage(error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return `Hook delivery timed out after ${this.deliveryTimeoutMs}ms`;
    }

    return error instanceof Error ? error.message : "Unknown hook delivery failure";
  }

  private async recordNotificationFailure(
    eventType: string,
    payload: Record<string, unknown>,
    error: string,
    hookId?: string
  ) {
    try {
      await this.eventNotificationRepository.create({
        eventType,
        hookId,
        payload,
        status: "failed",
        error
      });
    } catch {
      // Notification persistence is diagnostic only; never let it affect requests.
    }
  }
}
