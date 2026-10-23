import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/nexushub-register-client.mjs", import.meta.url));

async function withIssuer(run: (input: { issuer: string; calls: string[]; temp: string }) => Promise<void>, options: { registrationStatus?: number } = {}) {
  const calls: string[] = [];
  let registrationBody: Record<string, unknown> | undefined;
  const server: Server = createServer(async (request, response) => {
    calls.push(`${request.method} ${request.url}`);
    if (request.url === "/.well-known/openid-configuration") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        issuer: `http://127.0.0.1:${(server.address() as any).port}`,
        authorization_endpoint: `http://127.0.0.1:${(server.address() as any).port}/authorize`,
        token_endpoint: `http://127.0.0.1:${(server.address() as any).port}/token`,
        jwks_uri: `http://127.0.0.1:${(server.address() as any).port}/jwks`,
        registration_endpoint: `http://127.0.0.1:${(server.address() as any).port}/connect/register`,
        token_endpoint_auth_methods_supported: ["client_secret_post"]
      }));
      return;
    }
    if (request.url === "/connect/register") {
      let body = "";
      for await (const chunk of request) body += chunk;
      registrationBody = JSON.parse(body);
      response.setHeader("content-type", "application/json");
      if (options.registrationStatus) {
        response.writeHead(options.registrationStatus);
        response.end(JSON.stringify({ error: "temporarily_unavailable" }));
        return;
      }
      response.end(JSON.stringify({ client_id: "hub-client", client_secret: "test-secret", token_endpoint_auth_method: "client_secret_post" }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const issuer = `http://127.0.0.1:${(server.address() as any).port}`;
  const temp = await mkdtemp(path.join(os.tmpdir(), "nexushub-adoption-"));
  try {
    await run({ issuer, calls, temp });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(temp, { recursive: true, force: true });
  }
  return registrationBody;
}

function invoke(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

test("NexusHub preflight performs discovery only and needs no admin credential or output path", async () => {
  await withIssuer(async ({ issuer, calls, temp }) => {
    const result = await invoke(["--preflight"], {
      NEXUSID_ISSUER: issuer,
      NEXUS_PUBLIC_ORIGIN: "http://127.0.0.1:4500",
      NEXUSID_ADMIN_ACCESS_TOKEN: "",
      NEXUSHUB_OIDC_CONFIG_OUT: ""
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /No operator credential was read/);
    assert.deepEqual(calls, ["GET /.well-known/openid-configuration"]);
    assert.deepEqual(await (await import("node:fs/promises")).readdir(temp), []);
  });
});

test("NexusHub adoption registers the reviewed scope set and stores credentials privately", async () => {
  const registration = await withIssuer(async ({ issuer, calls, temp }) => {
    const output = path.join(temp, "client.json");
    const result = await invoke([], {
      NEXUSID_ISSUER: issuer,
      NEXUS_PUBLIC_ORIGIN: "http://127.0.0.1:4500",
      NEXUSID_ADMIN_ACCESS_TOKEN: "operator-secret",
      NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD: "true",
      NEXUSHUB_OIDC_CONFIG_OUT: output
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.includes("test-secret"), false);
    assert.deepEqual(calls, ["GET /.well-known/openid-configuration", "POST /connect/register"]);
    const config = JSON.parse(await readFile(output, "utf8"));
    assert.equal(config.clientSecret, "test-secret");
    assert.equal(config.redirectUri, "http://127.0.0.1:4500/auth/callback");
    assert.equal((await stat(output)).mode & 0o777, 0o600);
  });

  assert.deepEqual(registration?.grant_types, ["authorization_code", "refresh_token", "token_exchange"]);
  assert.deepEqual(registration?.response_types, ["code"]);
  assert.deepEqual(registration?.scope, [
    "openid", "profile", "email",
    "nexushub.installations:write", "nexushub.operations:read", "nexushub.operations:resume",
    "nexushub.organizations:read", "nexushub.organizations:write",
    "nexushub.projects:read", "nexushub.projects:write",
    "nexushub.applications:read", "nexushub.applications:write"
  ].join(" "));
});

test("mutating adoption refuses broad clients:add registration without explicit acknowledgement", async () => {
  await withIssuer(async ({ issuer, calls, temp }) => {
    const result = await invoke([], {
      NEXUSID_ISSUER: issuer,
      NEXUS_PUBLIC_ORIGIN: "http://127.0.0.1:4500",
      NEXUSID_ADMIN_ACCESS_TOKEN: "operator-secret",
      NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD: "false",
      NEXUSHUB_OIDC_CONFIG_OUT: path.join(temp, "client.json")
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD=true/);
    assert.deepEqual(calls, ["GET /.well-known/openid-configuration"]);
    assert.deepEqual(await (await import("node:fs/promises")).readdir(temp), []);
  });
});

test("ambiguous registration failure retains reservation and prevents an unsafe duplicate retry", async () => {
  await withIssuer(async ({ issuer, calls, temp }) => {
    const output = path.join(temp, "client.json");
    const env = {
      NEXUSID_ISSUER: issuer,
      NEXUS_PUBLIC_ORIGIN: "http://127.0.0.1:4500",
      NEXUSID_ADMIN_ACCESS_TOKEN: "operator-secret",
      NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD: "true",
      NEXUSHUB_OIDC_CONFIG_OUT: output
    };

    const first = await invoke([], env);
    assert.equal(first.code, 1);
    assert.match(first.stderr, /outcome may be ambiguous/);
    assert.match(first.stderr, /reservation retained/);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), { status: "registration_in_progress" });

    const retry = await invoke([], env);
    assert.equal(retry.code, 1);
    assert.match(retry.stderr, /existing file is never overwritten/);
    assert.match(retry.stderr, /check NexusID Admin/);
    assert.deepEqual(calls, [
      "GET /.well-known/openid-configuration",
      "POST /connect/register",
      "GET /.well-known/openid-configuration"
    ]);
  }, { registrationStatus: 500 });
});
