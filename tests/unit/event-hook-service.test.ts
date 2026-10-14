import test from "node:test";
import assert from "node:assert/strict";
import { EventHookService } from "../../src/services/event-hook-service.js";
import type { EventHook, EventNotification } from "../../src/domain/models.js";
import type {
  EventHookRepository,
  EventNotificationRepository
} from "../../src/repositories/contracts.js";

const createHook = (input: Partial<EventHook> = {}): EventHook => ({
  id: input.id ?? "hook-1",
  eventType: input.eventType ?? "user.created",
  targetUrl: input.targetUrl ?? "https://example.test/hooks",
  method: input.method ?? "POST",
  headers: input.headers ?? {},
  enabled: input.enabled ?? true,
  createdAt: input.createdAt ?? new Date("2026-01-01T00:00:00Z"),
  updatedAt: input.updatedAt ?? new Date("2026-01-01T00:00:00Z")
});

const createRepositories = (input: {
  listByEventType?: (eventType: string) => Promise<EventHook[]>;
}) => {
  const hooks: EventHook[] = [];
  const notifications: EventNotification[] = [];

  const eventHookRepository: EventHookRepository = {
    list: async () => hooks,
    listByEventType: input.listByEventType ?? (async (eventType) => hooks.filter((hook) => hook.eventType === eventType)),
    findById: async (id) => hooks.find((hook) => hook.id === id),
    create: async (hook) => {
      const created = {
        ...hook,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z")
      };
      hooks.push(created);
      return created;
    },
    update: async () => undefined,
    delete: async () => undefined
  };

  const eventNotificationRepository: EventNotificationRepository = {
    list: async (limit = 100) => notifications.slice(0, limit),
    create: async (notification) => {
      const created = {
        ...notification,
        id: `notification-${notifications.length + 1}`,
        createdAt: new Date("2026-01-01T00:00:00Z")
      };
      notifications.push(created);
      return created;
    }
  };

  return { hooks, notifications, eventHookRepository, eventNotificationRepository };
};

test("emit queues event hook delivery without waiting for repository or network work", async () => {
  const hook = createHook();
  let listCalls = 0;
  let resolveExactHooks: (hooks: EventHook[]) => void = () => undefined;
  const exactHooks = new Promise<EventHook[]>((resolve) => {
    resolveExactHooks = resolve;
  });
  const repositories = createRepositories({
    listByEventType: async (eventType) => {
      listCalls += 1;
      if (eventType === "user.created") {
        return exactHooks;
      }
      return [];
    }
  });

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const service = new EventHookService(
      repositories.eventHookRepository,
      repositories.eventNotificationRepository,
      { deliveryTimeoutMs: 10 }
    );

    await service.emit("user.created", { userId: "user-1" });

    assert.equal(listCalls, 0);
    assert.equal(fetchCalls, 0);

    resolveExactHooks([hook]);
    await service.waitForIdle();

    assert.equal(fetchCalls, 1);
    assert.equal(repositories.notifications[0].status, "delivered");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("background hook delivery records timeout failures", async () => {
  const hook = createHook();
  const repositories = createRepositories({
    listByEventType: async (eventType) => eventType === "user.created" ? [hook] : []
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url, init) => {
    const signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  }) as typeof fetch;

  try {
    const service = new EventHookService(
      repositories.eventHookRepository,
      repositories.eventNotificationRepository,
      { deliveryTimeoutMs: 1 }
    );

    await service.emit("user.created", { userId: "user-1" });
    await service.waitForIdle();

    assert.equal(repositories.notifications.length, 1);
    assert.equal(repositories.notifications[0].status, "failed");
    assert.equal(repositories.notifications[0].hookId, hook.id);
    assert.match(repositories.notifications[0].error ?? "", /timed out after 1ms/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("full delivery queue drops new events and records a failed notification", async () => {
  const repositories = createRepositories({
    listByEventType: async () => []
  });
  const service = new EventHookService(
    repositories.eventHookRepository,
    repositories.eventNotificationRepository,
    { maxQueueSize: 1 }
  );

  await service.emit("user.created", { userId: "queued" });
  await service.emit("user.created", { userId: "dropped" });
  await service.waitForIdle();

  const droppedNotification = repositories.notifications.find((notification) =>
    notification.error?.includes("queue is full")
  );
  assert.ok(droppedNotification);
  assert.deepEqual(droppedNotification.payload, { userId: "dropped" });
});
