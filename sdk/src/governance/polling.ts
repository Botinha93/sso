import type {
  AccessRequestsAPI,
  ElevationStatus,
  ElevationsAPI,
  SDKAccessRequest,
  SDKElevationRequest
} from "../admin/types.js";

export interface PollWorkflowOptions<T> {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  isTerminal: (state: T) => boolean;
}

export interface WaitForElevationOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  terminalStatuses?: ElevationStatus[];
}

export interface WaitForAccessRequestOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  terminalStatuses?: SDKAccessRequest["status"][];
  listLimit?: number;
}

const wait = async (ms: number, signal?: AbortSignal): Promise<void> => {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Polling aborted"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
};

/**
 * Polls an async state fetcher until `isTerminal` returns true or timeout/abort is reached.
 *
 * Use this helper for long-running governance workflows where backend state
 * transitions occur asynchronously.
 *
 * @typeParam T State type returned by `fetchState`.
 * @param fetchState Async callback that returns the latest workflow state.
 * @param options Polling controls and terminal-state predicate.
 * @returns The terminal state value returned by `fetchState`.
 */
export const pollWorkflowState = async <T>(
  fetchState: () => Promise<T>,
  options: PollWorkflowOptions<T>
): Promise<T> => {
  const intervalMs = options.intervalMs ?? 1_500;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const started = Date.now();

  while (true) {
    if (options.signal?.aborted) {
      throw new Error("Polling aborted");
    }

    const current = await fetchState();
    if (options.isTerminal(current)) {
      return current;
    }

    if (Date.now() - started >= timeoutMs) {
      throw new Error(`Polling timeout after ${timeoutMs}ms`);
    }

    await wait(intervalMs, options.signal);
  }
};

/**
 * Waits for an elevation request to reach a terminal status.
 *
 * This is a convenience wrapper around `pollWorkflowState` for elevation workflows.
 *
 * @param elevations Elevations API subset containing `get`.
 * @param requestId Elevation request identifier.
 * @param options Polling behavior and optional terminal status override.
 * @returns The terminal elevation request state.
 */
export const waitForElevationTerminalState = (
  elevations: Pick<ElevationsAPI, "get">,
  requestId: string,
  options: WaitForElevationOptions = {}
): Promise<SDKElevationRequest> => {
  const terminalStatuses = options.terminalStatuses ?? ["active", "revoked", "expired"];

  return pollWorkflowState(
    () => elevations.get(requestId),
    {
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      isTerminal: (state) => terminalStatuses.includes(state.status)
    }
  );
};

/**
 * Waits for an access request to reach a terminal status.
 *
 * This is a convenience wrapper around `pollWorkflowState` for access request workflows.
 *
 * @param accessRequests Access requests API subset containing `list`.
 * @param requestId Access request identifier to track.
 * @param options Polling behavior, terminal status override, and list page limit.
 * @returns The terminal access request state.
 */
export const waitForAccessRequestTerminalState = (
  accessRequests: Pick<AccessRequestsAPI, "list">,
  requestId: string,
  options: WaitForAccessRequestOptions = {}
): Promise<SDKAccessRequest> => {
  const terminalStatuses = options.terminalStatuses ?? ["approved", "rejected", "expired", "cancelled"];
  const listLimit = options.listLimit ?? 100;

  return pollWorkflowState(
    async () => {
      const requests = await accessRequests.list({ limit: listLimit });
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        throw new Error(`Access request ${requestId} not found while polling`);
      }
      return request;
    },
    {
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      isTerminal: (state) => terminalStatuses.includes(state.status)
    }
  );
};
