import { describe, expect, it, vi } from "vitest";
import {
  pollWorkflowState,
  waitForAccessRequestTerminalState,
  waitForElevationTerminalState
} from "../../src/governance/polling.js";

describe("governance polling", () => {
  it("pollWorkflowState resolves when terminal state is reached", async () => {
    let step = 0;

    const result = await pollWorkflowState(
      async () => {
        step += 1;
        return { status: step > 2 ? "done" : "pending" };
      },
      {
        intervalMs: 1,
        timeoutMs: 100,
        isTerminal: (state) => state.status === "done"
      }
    );

    expect(result.status).toBe("done");
    expect(step).toBeGreaterThanOrEqual(3);
  });

  it("waitForElevationTerminalState stops on active", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1", status: "approved" })
      .mockResolvedValueOnce({ id: "e1", status: "active" });

    const result = await waitForElevationTerminalState({ get } as any, "e1", {
      intervalMs: 1,
      timeoutMs: 100
    });

    expect(result.status).toBe("active");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("waitForAccessRequestTerminalState stops on approved", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([{ id: "ar1", status: "pending" }])
      .mockResolvedValueOnce([{ id: "ar1", status: "approved" }]);

    const result = await waitForAccessRequestTerminalState({ list } as any, "ar1", {
      intervalMs: 1,
      timeoutMs: 100,
      listLimit: 20
    });

    expect(result.status).toBe("approved");
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith({ limit: 20 });
  });

  it("throws on timeout", async () => {
    const get = vi.fn().mockResolvedValue({ id: "e1", status: "approved" });

    await expect(
      waitForElevationTerminalState({ get } as any, "e1", {
        intervalMs: 1,
        timeoutMs: 5,
        terminalStatuses: ["revoked"]
      })
    ).rejects.toThrow("Polling timeout");
  });
});
