import type { ClientInstance } from "../core/types.js";
import type {
  CreateEventHookInput,
  EventHookNotificationsListQuery,
  EventHooksAPI,
  SDKEventHook,
  SDKEventNotification,
  UpdateEventHookInput
} from "./types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";

/**
 * Creates the Event Hooks admin API module.
 *
 * Supports CRUD hooks, test delivery, event catalog, and notifications.
 */
export const createEventHooksAPI = (client: ClientInstance): EventHooksAPI => ({
  list: async (query) => {
    const hooks = await client.get<SDKEventHook[]>("/api/admin/events/hooks");
    const bySearch = applyTextFilter(hooks, query?.search, [
      (item) => item.id,
      (item) => item.name,
      (item) => item.url
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreateEventHookInput) => client.post<SDKEventHook>("/api/admin/events/hooks", { body: input }),
  update: (id: string, input: UpdateEventHookInput) => client.put<SDKEventHook>(`/api/admin/events/hooks/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/events/hooks/${id}`);
  },
  test: (id: string, payload?: Record<string, unknown>) => client.post<unknown>(`/api/admin/events/hooks/${id}/test`, { body: payload ?? {} }),
  types: () => client.get<string[]>("/api/admin/events/types"),
  notifications: (query?: EventHookNotificationsListQuery) => client.get<SDKEventNotification[]>("/api/admin/events/notifications", { query })
});
