import { describe, expect, it, vi } from "vitest";
import { createClient } from "../../src/core/client.js";

const jsonResponse = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

describe("retry inter-request delay", () => {
  it("throttles consecutive requests by at least the configured delay", async () => {
    const callTimes: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async () => {
      callTimes.push(Date.now());
      return jsonResponse();
    });

    const client = createClient({
      baseUrl: "https://iam.example.com",
      retry: { interRequestDelayMs: 60 },
      fetch: fetchMock as unknown as typeof fetch
    });

    await client.get("/api/first");
    await client.get("/api/second");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(50);
  });

  it("does not delay the first request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());

    const client = createClient({
      baseUrl: "https://iam.example.com",
      retry: { interRequestDelayMs: 1_000 },
      fetch: fetchMock as unknown as typeof fetch
    });

    const start = Date.now();
    await client.get("/api/first");

    expect(Date.now() - start).toBeLessThan(500);
  });
});
