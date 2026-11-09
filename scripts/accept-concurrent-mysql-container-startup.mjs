import { randomBytes } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NEXUSID_CONCURRENT_MYSQL_STARTUP_ACCEPTANCE !== "1") {
  process.stderr.write("Refusing to run: set NEXUSID_CONCURRENT_MYSQL_STARTUP_ACCEPTANCE=1 to create a disposable MySQL container and start concurrent NexusID entrypoints.\n");
  process.exit(2);
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const engine = process.env.CONTAINER_ENGINE || (spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0 ? "docker" : "podman");
const nonce = randomBytes(6).toString("hex");
const containerName = `nexusid-concurrent-mysql-startup-${nonce}`;
const password = randomBytes(20).toString("hex");
const database = `nexusid_${nonce}`;
const resources = [];
const container = (args) => {
  const result = spawnSync(engine, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${engine} ${args[0]} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
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
  await writeFile(join(workspace, "data", "database-config.json"), `${JSON.stringify({ databaseProvider: "mysql", databasePath: "./data/sso.sqlite", externalDatabaseUrl: databaseUrl }, null, 2)}\n`, { mode: 0o600 });
  const child = spawn(process.execPath, ["--import", join(root, "node_modules/tsx/dist/loader.mjs"), join(root, "src/container/entrypoint.ts")], {
    cwd: workspace,
    env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), AUTO_SETUP: "false", DATABASE_PROVIDER: "mysql", DATABASE_URL: databaseUrl, COOKIE_SECRET: randomBytes(32).toString("hex") },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const exit = new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal })));
  resources.push({ child, exit, label });
  return { child, exit, getLogs: () => logs, port };
}

async function waitHealthy(processInfo, timeoutMs = 180_000) {
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
  const id = container(["run", "-d", "--name", containerName, "--label", `org.nexusid.acceptance=${containerName}`, "-e", "MYSQL_ROOT_PASSWORD=root_accept_only", "-e", `MYSQL_DATABASE=${database}`, "-e", "MYSQL_USER=nhid_accept", "-e", `MYSQL_PASSWORD=${password}`, "-p", "127.0.0.1::3306", "mysql:8.4"]);
  resources.push({ container: id });
  const hostPort = container(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}', id]);
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try { container(["exec", id, "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-proot_accept_only", "--silent"]); break; }
    catch { if (attempt === 179) throw new Error("Disposable MySQL did not become ready"); await sleep(500); }
  }
  const databaseUrl = `mysql://nhid_accept:${encodeURIComponent(password)}@127.0.0.1:${hostPort}/${database}`;
  workspaceRoot = await mkdtemp(join(tmpdir(), "nexusid-concurrent-mysql-container-startup-"));
  const first = await startEntrypoint("entrypoint-A", join(workspaceRoot, "a"), databaseUrl, await reservePort());
  const second = await startEntrypoint("entrypoint-B", join(workspaceRoot, "b"), databaseUrl, await reservePort());
  await Promise.all([waitHealthy(first), waitHealthy(second)]);
  process.stdout.write("Both actual NexusID container entrypoints reached /health while concurrently initializing the same initially empty disposable MySQL schema.\n");
  await Promise.all([stop(first), stop(second)]);

  const third = await startEntrypoint("entrypoint-restart", join(workspaceRoot, "restart"), databaseUrl, await reservePort());
  await waitHealthy(third);
  process.stdout.write("A subsequent installer-entrypoint restart reached /health against the concurrently initialized MySQL schema.\n");
  await stop(third);

  const uniqueIndexCount = container(["exec", id, "mysql", "-N", "-B", "-uroot", "-proot_accept_only", database, "-e", "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='users_username_key'"]).trim();
  if (uniqueIndexCount !== "1") throw new Error(`Expected exactly one users_username_key unique index, found ${uniqueIndexCount}`);
  const uniqueFlag = container(["exec", id, "mysql", "-N", "-B", "-uroot", "-proot_accept_only", database, "-e", "SELECT MIN(non_unique) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='users_username_key'"]).trim();
  if (uniqueFlag !== "0") throw new Error(`Expected users_username_key to remain unique, non_unique=${uniqueFlag}`);
  process.stdout.write("The MySQL users_username_key index exists exactly once and remains unique.\n");
} finally {
  for (const resource of resources) if (resource.child) await stop(resource);
  const db = resources.find((resource) => resource.container);
  if (db) { try { container(["rm", "-f", db.container]); } catch { /* already removed */ } }
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
}
