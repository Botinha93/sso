import { describe, expect, it, vi } from "vitest";
import { createClient } from "../../src/core/client.js";

describe("auth config headers", () => {
  it("injects bearer token header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = createClient({
      baseUrl: "https://iam.example.com",
      auth: { type: "bearer", token: "bearer-token" },
      fetch: fetchMock as unknown as typeof fetch
    });

    await client.get("/api/ping");

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get("authorization")).toBe("Bearer bearer-token");
  });

  it("injects session cookie header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = createClient({
      baseUrl: "https://iam.example.com",
      auth: { type: "session", cookie: "sid=session-cookie" },
      fetch: fetchMock as unknown as typeof fetch
    });

    await client.get("/api/ping");

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get("cookie")).toBe("sid=session-cookie");
  });

  it("injects custom headers from auth provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = createClient({
      baseUrl: "https://iam.example.com",
      auth: {
        type: "headers",
        headers: async () => ({ "x-api-key": "key-123" })
      },
      fetch: fetchMock as unknown as typeof fetch
    });

    await client.get("/api/ping");

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get("x-api-key")).toBe("key-123");
  });
});
