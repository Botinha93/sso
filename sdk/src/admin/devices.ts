import type { ClientInstance } from "../core/types.js";
import { applyPagination } from "../core/list-helpers.js";
import type { DeviceListQuery, DevicesAPI, SDKDeviceRequest, SDKDeviceSession, SDKDevicesResponse } from "./types.js";

/**
 * Creates the Devices admin API module.
 *
 * Supports listing device requests/sessions and revoking each type.
 */
export const createDevicesAPI = (client: ClientInstance): DevicesAPI => ({
  list: async (query?: DeviceListQuery) => {
    const response = await client.get<SDKDevicesResponse>("/api/admin/devices");
    const requests = applyPagination(response.requests ?? [], query);
    const sessions = applyPagination(response.sessions ?? [], query);
    return { requests, sessions } satisfies { requests: SDKDeviceRequest[]; sessions: SDKDeviceSession[] };
  },
  revokeRequest: async (deviceCode: string) => {
    await client.delete(`/api/admin/devices/requests/${deviceCode}`);
  },
  revokeSession: async (id: string) => {
    await client.delete(`/api/admin/devices/sessions/${id}`);
  }
});
