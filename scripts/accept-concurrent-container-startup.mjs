import { randomBytes } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NEXUSID_CONCURRENT_STARTUP_ACCEPTANCE !== "1") {
  process.stderr.write("Refusing to run: set NEXUSID_CONCURRENT_STARTUP_ACCEPTANCE=1 to create a disposable PostgreSQL container and start concurrent NexusID entrypoints.\n");
  process.exit(2);
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nonce = randomBytes(6).toString("hex");
const containerName = `nexusid-concurrent-startup-${nonce}`;
const password = randomBytes(20).toString("hex");
const database = `nexusid_${nonce}`;
const resources = [];
const docker = (args) => {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  return result.stdout.trim();
};
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function reservePort() {
  const net = await import("node:net");
  const server = net.createServer();
  await new Promise((resolveListen, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolveListen()));
  const address = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function startEntrypoint(label, workspace, databaseUrl, port) {
  await mkdir(join(workspace, "data"), { recursive: true });
  await writeFile(join(workspace, "data", "database-config.json"), `${JSON.stringify({ databaseProvider: "postgresql", databasePath: "./data/sso.sqlite", externalDatabaseUrl: databaseUrl }, null, 2)}\n`, { mode: 0o600 });
  const child = spawn(process.execPath, ["--import", join(root, "node_modules/tsx/dist/loader.mjs"), join(root, "src/container/entrypoint.ts")], {
    cwd: workspace,
    env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), AUTO_SETUP: "false", DATABASE_PROVIDER: "postgresql", DATABASE_URL: databaseUrl, COOKIE_SECRET: randomBytes(32).toString("hex") },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const exit = new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal })));
  resources.push({ child, exit, label });
  return { child, exit, getLogs: () => logs, port };
}

async function waitHealthy(processInfo, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) throw new Error(`${processInfo.label} exited early:\n${processInfo.getLogs().slice(-6000)}`);
    try {
      const response = await fetch(`http://127.0.0.1:${processInfo.port}/health`);
      if (response.ok) return;
    } catch { /* startup still in progress */ }
    await sleep(250);
  }
  throw new Error(`${processInfo.label} did not become healthy:\n${processInfo.getLogs().slice(-6000)}`);
}

async function stop(processInfo) {
  if (processInfo.child.exitCode !== null) return;
  processInfo.child.kill("SIGTERM");
  await Promise.race([processInfo.exit, sleep(5000)]);
  if (processInfo.child.exitCode === null) {
    processInfo.child.kill("SIGKILL");
    await processInfo.exit;
  }
}

let workspaceRoot;
try {
  const id = docker(["run", "-d", "--name", containerName, "--label", `org.nexusid.acceptance=${containerName}`, "-e", "POSTGRES_USER=nhid_accept", "-e", `POSTGRES_PASSWORD=${password}`, "-e", `POSTGRES_DB=${database}`, "-p", "127.0.0.1::5432", "postgres:17-alpine"]);
  resources.push({ container: id });
  const hostPort = docker(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', id]);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { docker(["exec", id, "pg_isready", "-U", "nhid_accept", "-d", database]); break; }
    catch { if (attempt === 119) throw new Error("Disposable PostgreSQL did not become ready"); await sleep(500); }
  }
  const databaseUrl = `postgresql://nhid_accept:${encodeURIComponent(password)}@127.0.0.1:${hostPort}/${database}`;
  workspaceRoot = await mkdtemp(join(tmpdir(), "nexusid-concurrent-container-startup-"));
  const first = await startEntrypoint("entrypoint-A", join(workspaceRoot, "a"), databaseUrl, await reservePort());
  const second = await startEntrypoint("entrypoint-B", join(workspaceRoot, "b"), databaseUrl, await reservePort());
  await Promise.all([waitHealthy(first), waitHealthy(second)]);
  process.stdout.write("Both independently started container entrypoints reached /health against the same initially empty PostgreSQL database.\n");
  await Promise.all([stop(first), stop(second)]);

  const third = await startEntrypoint("entrypoint-restart", join(workspaceRoot, "restart"), databaseUrl, await reservePort());
  await waitHealthy(third);
  process.stdout.write("A subsequent installer-entrypoint restart reached /health on the concurrently initialized schema.\n");
  await stop(third);

  const uniqueIndexCount = docker(["exec", id, "psql", "-U", "nhid_accept", "-d", database, "-tAc", "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='users_username_key'"]).trim();
  if (uniqueIndexCount !== "1") throw new Error(`Expected exactly one users_username_key unique index, found ${uniqueIndexCount}`);
  process.stdout.write("The required username unique index exists exactly once; schema constraints remained enabled.\n");
} finally {
  for (const resource of resources) {
    if (resource.child) await stop(resource);
  }
  const container = resources.find((resource) => resource.container);
  if (container) {
    try { docker(["rm", "-f", container.container]); } catch { /* already removed */ }
  }
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
}
