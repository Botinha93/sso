import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

if (process.env.NEXUSID_MANAGED_ROTATION_DB_ACCEPTANCE !== "1") {
  process.stderr.write("Refusing to run: set NEXUSID_MANAGED_ROTATION_DB_ACCEPTANCE=1 to start isolated disposable Docker databases.\n");
  process.exit(2);
}

const nonce = randomBytes(6).toString("hex");
const databaseName = `nhid_rotation_test_${nonce}`;
const label = `nexusid-managed-rotation-${nonce}`;
const resources = [];
const docker = (args, options = {}) => {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  return result.stdout.trim();
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  for (const target of [
    { provider: "postgresql", image: "postgres:17-alpine", internalPort: 5432, user: "nhid_accept", password: randomBytes(18).toString("hex"), ready: (id) => docker(["exec", id, "psql", "-U", "nhid_accept", "-d", databaseName, "-tAc", "SELECT 1"]) },
    { provider: "mysql", image: "mysql:8.0", internalPort: 3306, user: "root", password: randomBytes(18).toString("hex"), ready: (id, password) => docker(["exec", id, "mysql", "-h127.0.0.1", "-uroot", `-p${password}`, databaseName, "-Nse", "SELECT 1"]) }
  ]) {
    const containerName = `${label}-${target.provider}`;
    const providerEnv = target.provider === "postgresql"
      ? ["-e", `POSTGRES_USER=${target.user}`, "-e", `POSTGRES_PASSWORD=${target.password}`, "-e", `POSTGRES_DB=${databaseName}`]
      : ["-e", `MYSQL_ROOT_PASSWORD=${target.password}`, "-e", `MYSQL_DATABASE=${databaseName}`];
    const id = docker(["run", "-d", "--name", containerName, "--label", `org.nexusid.acceptance=${label}`, ...providerEnv, "-p", `127.0.0.1::${target.internalPort}`, target.image]);
    resources.push({ id, containerName });
    const hostPort = docker(["inspect", "--format", `{{(index (index .NetworkSettings.Ports "${target.internalPort}/tcp") 0).HostPort}}`, id]);
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline && !ready) {
      const status = docker(["inspect", "--format", "{{.State.Status}}", id]);
      if (status !== "running") throw new Error(`${target.provider} container exited before readiness`);
      try { target.ready(id, target.password); ready = true; }
      catch (error) { if (Date.now() >= deadline) throw error; await sleep(750); }
    }
    if (!ready) throw new Error(`${target.provider} disposable container did not become ready`);
    const databaseUrl = target.provider === "postgresql"
      ? `postgresql://${target.user}:${encodeURIComponent(target.password)}@127.0.0.1:${hostPort}/${databaseName}`
      : `mysql://${target.user}:${encodeURIComponent(target.password)}@127.0.0.1:${hostPort}/${databaseName}`;
    const schema = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", "import { loadConfig } from './src/core/config.ts'; import { ensureExternalDatabaseSchema } from './src/core/runtime-database-config.ts'; await ensureExternalDatabaseSchema({ ...loadConfig(), databaseProvider: process.env.NEXUSID_ACCEPT_PROVIDER, externalDatabaseUrl: process.env.NEXUSID_ACCEPT_DATABASE_URL });"], {
      cwd: new URL("..", import.meta.url), encoding: "utf8", stdio: "inherit",
      env: { ...process.env, NEXUSID_ACCEPT_PROVIDER: target.provider, NEXUSID_ACCEPT_DATABASE_URL: databaseUrl }
    });
    if (schema.status !== 0) {
      process.stderr.write(`Schema bootstrap failed for ${target.provider}; disposable container log follows:\n${docker(["logs", id])}\n`);
      throw new Error(`${target.provider} schema push failed`);
    }
    process.stdout.write(`Running managed rotation acceptance against ${target.provider} (${containerName}, database ${databaseName})…\n`);
    const test = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/integration/nexushub-managed-client-credential-db.acceptance.test.ts"], {
      cwd: new URL("..", import.meta.url), encoding: "utf8", stdio: "inherit",
      env: { ...process.env, NEXUSID_MANAGED_ROTATION_DB_ACCEPTANCE: "1", NEXUSID_ROTATION_ACCEPTANCE_PROVIDER: target.provider, NEXUSID_ROTATION_ACCEPTANCE_DATABASE_URL: databaseUrl, NEXUSID_ROTATION_ACCEPTANCE_DB_NAME: databaseName }
    });
    if (test.status !== 0) {
      process.exitCode = 1;
      process.stderr.write(`${target.provider} acceptance failed with status ${test.status}; continuing to the next provider for independent evidence.\n`);
    }
  }
} finally {
  for (const resource of resources.reverse()) {
    try {
      docker(["rm", "--force", "--volumes", resource.id]);
      let remains = false;
      try { docker(["inspect", resource.id]); remains = true; } catch { /* expected: our container ID is gone */ }
      if (remains) throw new Error(`cleanup verification failed; container remains: ${resource.containerName}`);
      process.stdout.write(`Removed and verified disposable container ${resource.containerName}.\n`);
    } catch (error) {
      process.stderr.write(`Cleanup failure for ${resource.containerName}: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
