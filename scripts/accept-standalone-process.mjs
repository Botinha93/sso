import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(new URL("..", import.meta.url).pathname);
const workspace = await mkdtemp(join(tmpdir(), "nexusid-standalone-process-"));
await mkdir(join(workspace, "data"), { recursive: true });
const port = await reservePort();
const issuer = `http://127.0.0.1:${port}`;
const cookieSecret = randomBytes(32).toString("hex");

// Deliberately whitelist the environment instead of inheriting developer or
// NexusHub installer configuration from the calling shell.
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: String(port),
  ISSUER: issuer,
  COOKIE_SECRET: cookieSecret,
  DATABASE_PATH: join(workspace, "data/sso.sqlite"),
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: "Standalone-Admin-Pass-42",
  DYNAMIC_CLIENT_REGISTRATION: "admin",
};
assert.deepEqual(Object.keys(env).filter((key) => /NEXUS|HUB|BUS/i.test(key)), []);

let logs = "";
const child = spawn(process.execPath, [
  "--import",
  join(root, "node_modules/tsx/dist/loader.mjs"),
  join(root, "src/server.ts"),
], {
  cwd: workspace,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

try {
  await waitForHealth(child, issuer, () => logs);

  const setupStatus = await fetch(`${issuer}/api/setup/status`);
  assert.equal(setupStatus.status, 200);
  assert.equal((await setupStatus.json()).requiresSetup, true, "fresh standalone install exposes its native setup flow");

  const initialized = await post(issuer, "/api/setup/initialize", {
    name: "Standalone NexusID Admin",
    email: "admin@example.test",
    username: "admin",
    password: "Standalone-Admin-Pass-42",
  });
  assert.equal(initialized.status, 201, await initialized.clone().text());

  const discoveryResponse = await fetch(`${issuer}/.well-known/openid-configuration`);
  assert.equal(discoveryResponse.status, 200);
  const discovery = await discoveryResponse.json();
  assert.equal(discovery.issuer, issuer);
  assert.equal(discovery.authorization_endpoint, `${issuer}/oauth/authorize`);
  assert.equal(discovery.token_endpoint, `${issuer}/oauth/token`);
  assert.equal(discovery.registration_endpoint, `${issuer}/connect/register`);
  assert.equal(discovery.jwks_uri, `${issuer}/.well-known/jwks.json`);

  const jwksResponse = await fetch(discovery.jwks_uri);
  assert.equal(jwksResponse.status, 200);
  assert.ok((await jwksResponse.json()).keys.length >= 1, "standalone issuer publishes its local signing key set");

  const login = await post(issuer, "/auth/login", {
    email: "admin",
    password: "Standalone-Admin-Pass-42",
    clientId: "sso-admin-ui",
    scope: ["openid", "profile", "email"],
  });
  assert.equal(login.status, 200, await login.clone().text());
  const sessionCookie = cookiePair(login.headers.get("set-cookie"), "sid");

  const csrfResponse = await fetch(`${issuer}/api/csrf-token`, { headers: { cookie: sessionCookie } });
  assert.equal(csrfResponse.status, 200);
  const csrf = await csrfResponse.json();
  const csrfCookie = cookiePair(csrfResponse.headers.get("set-cookie"), "csrf_token");
  const registered = await post(issuer, "/connect/register", {
    client_name: "Standalone Native OIDC Client",
    redirect_uris: ["http://127.0.0.1:4455/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid profile email",
  }, {
    cookie: `${sessionCookie}; ${csrfCookie}`,
    "x-csrf-token": csrf.csrf_token,
  });
  assert.equal(registered.status, 201, await registered.clone().text());
  const client = await registered.json();
  assert.equal(typeof client.client_id, "string");
  assert.ok(client.client_id.length >= 8);
  assert.deepEqual(client.redirect_uris, ["http://127.0.0.1:4455/callback"]);

  const postInstallStatus = await fetch(`${issuer}/api/setup/status`);
  assert.equal((await postInstallStatus.json()).requiresSetup, false);
  assert.doesNotMatch(logs, /NexusHub|NexusBus/i, "standalone identity setup did not call ecosystem services");
  process.stdout.write("NexusID standalone process acceptance passed: isolated SQLite setup, native admin login, OIDC discovery/JWKS, and admin-gated OIDC client registration without Hub/Bus configuration.\n");
} catch (error) {
  process.stderr.write(`${logs.slice(-5000)}\n`);
  throw error;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([onceExit(child), delay(5_000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  await rm(workspace, { recursive: true, force: true });
}

async function reservePort() {
  const { createServer } = await import("node:net");
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await new Promise((resolveListen, reject) => {
    server.once("listening", resolveListen);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function waitForHealth(process, origin, getLogs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null || process.signalCode !== null) throw new Error(`NexusID exited before readiness:\n${getLogs().slice(-5000)}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* still starting */ }
    await delay(100);
  }
  throw new Error(`NexusID did not become healthy:\n${getLogs().slice(-5000)}`);
}

async function post(origin, path, body, headers = {}) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function cookiePair(header, name) {
  const value = header?.split(/, (?=[^;,]+=)/).find((part) => part.startsWith(`${name}=`));
  assert.ok(value, `expected ${name} cookie`);
  return value.split(";", 1)[0];
}

function onceExit(process) {
  return new Promise((resolveExit) => process.once("exit", resolveExit));
}
