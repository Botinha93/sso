import { createServer, type IncomingMessage } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient, createAuthAPI, createClient } from "../../src/index.js";

const readJsonBody = async (req: IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

describe("SDK contract tests against fixture server", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (method === "POST" && path === "/oauth/token") {
        const body = await readJsonBody(req);
        if (body.grant_type !== "client_credentials") {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant_type" }));
          return;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          access_token: "fixture-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: body.scope
        }));
        return;
      }

      if (method === "GET" && path === "/api/admin/apps") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([
          { id: "app-1", name: "Support", description: "Support app", createdAt: new Date().toISOString() },
          { id: "app-2", name: "Billing", description: "Billing app", createdAt: new Date().toISOString() }
        ]));
        return;
      }

      if (method === "POST" && path === "/api/admin/access-requests") {
        const body = await readJsonBody(req);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "ar-1",
          requesterId: "admin-user",
          subjectUserId: body.subjectUserId,
          entitlementType: body.entitlementType,
          entitlementValue: body.entitlementValue,
          justification: body.justification,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (method === "POST" && path === "/api/admin/access-requests/ar-1/approve") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "ar-1",
          requesterId: "admin-user",
          subjectUserId: "user-1",
          entitlementType: "role",
          entitlementValue: "role-1",
          justification: "incident",
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (method === "POST" && path === "/api/admin/elevations") {
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "el-1",
          correlationId: "corr-1",
          requesterId: "admin-user",
          justification: "contract test",
          resource: "connectors",
          action: "sync",
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (method === "POST" && path === "/api/admin/elevations/el-1/approve") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "el-1",
          correlationId: "corr-1",
          requesterId: "admin-user",
          justification: "contract test",
          resource: "connectors",
          action: "sync",
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (method === "POST" && path === "/api/admin/elevations/el-1/activate") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "el-1",
          correlationId: "corr-1",
          requesterId: "admin-user",
          justification: "contract test",
          resource: "connectors",
          action: "sync",
          status: "active",
          activatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (method === "GET" && path === "/api/admin/connectors/conn-1/runs") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          data: [
            {
              id: "run-1",
              connectorId: "conn-1",
              status: "succeeded",
              recordsImported: 24,
              recordsFailed: 0,
              createdAt: new Date().toISOString()
            }
          ]
        }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", method, path }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("auth client credentials contract", async () => {
    const client = createClient({ baseUrl });
    const auth = createAuthAPI(client);

    const token = await auth.exchangeClientCredentials({
      clientId: "fixture-client",
      clientSecret: "fixture-secret",
      scope: ["tickets.read", "tickets.write"]
    });

    expect(token.access_token).toBe("fixture-access-token");
    expect(token.token_type).toBe("Bearer");
  });

  it("admin governance workflow contract", async () => {
    const admin = createAdminClient({
      baseUrl,
      auth: { type: "bearer", token: "admin-token" }
    });

    const request = await admin.accessRequests.create({
      subjectUserId: "user-1",
      entitlementType: "role",
      entitlementValue: "role-1",
      justification: "incident"
    });

    const approved = await admin.accessRequests.approve(request.id, {
      rationale: "approved"
    });

    const elevation = await admin.elevations.create({
      resource: "connectors",
      action: "sync",
      justification: "contract test"
    });

    const elevationApproved = await admin.elevations.approve(elevation.id);
    const elevationActive = await admin.elevations.activate(elevationApproved.id);

    expect(request.status).toBe("pending");
    expect(approved.status).toBe("approved");
    expect(elevation.status).toBe("pending");
    expect(elevationActive.status).toBe("active");
  });

  it("admin connectors run-list contract", async () => {
    const admin = createAdminClient({
      baseUrl,
      auth: { type: "bearer", token: "admin-token" }
    });

    const runs = await admin.connectors.listRuns("conn-1", { limit: 10 });

    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("run-1");
    expect(runs[0].status).toBe("succeeded");
  });
});
