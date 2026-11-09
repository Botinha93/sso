import { randomBytes } from "node:crypto";
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NEXUSID_RESOURCE_PROCESS_ACCEPTANCE !== "1") {
  process.stderr.write("Refusing to run: set NEXUSID_RESOURCE_PROCESS_ACCEPTANCE=1 to create disposable local databases and start NexusID.\n");
  process.exit(2);
}
const runHubInstallerAcceptance = process.env.NEXUSID_HUB_INSTALLER_PROCESS_ACCEPTANCE === "1";
const runHubInstallerWizardBrowserAcceptance = process.env.NEXUSID_HUB_INSTALLER_WIZARD_BROWSER_ACCEPTANCE === "1";
const runContextAcceptance = process.env.NEXUSHUB_CONTEXT_ACCEPTANCE === "1";
const runGoldenIdentitySeparationAcceptance = runContextAcceptance && process.env.NEXUSHUB_GOLDEN_SPACES_ACCEPTANCE === "1";
const runContextBrowserAcceptance = process.env.NEXUSHUB_CONTEXT_BROWSER_ACCEPTANCE === "1";
const runGitFlowSearchAcceptance = process.env.NEXUSHUB_GITFLOW_SEARCH_ACCEPTANCE === "1";
const runVoxChatActionHostAcceptance = process.env.NEXUSHUB_VOXCHAT_ACTION_HOST_ACCEPTANCE === "1";
if (runHubInstallerAcceptance && !process.env.NEXUSHUB_SOURCE_ROOT) {
  process.stderr.write("Refusing to run Hub installer acceptance: set NEXUSHUB_SOURCE_ROOT to the NexusHub source checkout.\n");
  process.exit(2);
}
if (runContextAcceptance && (!process.env.NEXUSHUB_SOURCE_ROOT || !process.env.NEXUSHUB_CONTEXT_ROOT)) {
  process.stderr.write("Refusing combined Context acceptance: set NEXUSHUB_SOURCE_ROOT and NEXUSHUB_CONTEXT_ROOT.\n");
  process.exit(2);
}
if (runContextBrowserAcceptance && (!runContextAcceptance || !process.env.NEXUSHUB_SOURCE_ROOT || !process.env.NEXUSHUB_CONTEXT_ROOT)) {
  process.stderr.write("Refusing joined Context browser acceptance: enable NEXUSHUB_CONTEXT_ACCEPTANCE and set both source roots.\n");
  process.exit(2);
}
if (runGitFlowSearchAcceptance && (!process.env.NEXUSHUB_SOURCE_ROOT || !process.env.NEXUSHUB_GITFLOW_REPO_DIR)) {
  process.stderr.write("Refusing joined GitFlow search acceptance: set NEXUSHUB_SOURCE_ROOT and NEXUSHUB_GITFLOW_REPO_DIR.\n");
  process.exit(2);
}
if (runVoxChatActionHostAcceptance && (!runGitFlowSearchAcceptance || !process.env.NEXUSHUB_VOXCHAT_REPO_DIR)) {
  process.stderr.write("Refusing VoxChat action-host acceptance: also enable GitFlow search acceptance and set NEXUSHUB_VOXCHAT_REPO_DIR.\n");
  process.exit(2);
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nonce = randomBytes(6).toString("hex");
const label = `nexusid-resource-process-${nonce}`;
const dbName = `nhid_resource_test_${nonce}`;
const resources = [];
const scratchPaths = [];
const docker = (args) => {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  return result.stdout.trim();
};
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitForPostgres(id, user, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      docker(["exec", id, "psql", "-U", user, "-d", "postgres", "-tAc", "SELECT 1"]);
      return;
    } catch (error) {
      lastError = error;
      if (docker(["inspect", "--format", "{{.State.Status}}", id]) !== "running") throw error;
      await sleep(300);
    }
  }
  throw new Error(`PostgreSQL accepted readiness probes but did not accept SQL connections: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
async function createPostgresDatabase(id, user, name) {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await waitForPostgres(id, user);
      const exists = docker(["exec", id, "psql", "-U", user, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${name}'`]);
      if (exists === "1") return;
      docker(["exec", id, "createdb", "-U", user, name]);
      return;
    } catch (error) {
      lastError = error;
      if (docker(["inspect", "--format", "{{.State.Status}}", id]) !== "running") throw error;
      await sleep(500);
    }
  }
  throw new Error(`Could not create disposable database ${name}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

try {
  const requestedProviders = (process.env.NEXUSID_RESOURCE_PROCESS_PROVIDERS ?? "postgresql").split(",").map((value) => value.trim()).filter(Boolean);
  if (requestedProviders.some((provider) => provider !== "postgresql" && provider !== "mysql")) throw new Error("NEXUSID_RESOURCE_PROCESS_PROVIDERS must contain postgresql and/or mysql");
  if (runGitFlowSearchAcceptance && requestedProviders.some((provider) => provider !== "postgresql")) throw new Error("joined GitFlow search acceptance requires NEXUSID_RESOURCE_PROCESS_PROVIDERS=postgresql");
  if (runHubInstallerAcceptance && requestedProviders.some((provider) => provider !== "postgresql")) throw new Error("Hub installer process acceptance currently requires NEXUSID_RESOURCE_PROCESS_PROVIDERS=postgresql");
  for (const target of [
    // pg_isready also reports success during the temporary PostgreSQL server
    // that the image starts while initializing POSTGRES_DB. Require an actual
    // query against the acceptance database so schema push cannot race the
    // entrypoint's shutdown/restart between initialization and steady state.
    { provider: "postgresql", image: runVoxChatActionHostAcceptance ? "pgvector/pgvector:pg17" : "postgres:17-alpine", port: 5432, user: "nhid_accept", password: randomBytes(18).toString("hex"), ready: (id) => docker(["exec", id, "psql", "-U", "nhid_accept", "-d", dbName, "-tAc", "SELECT 1"]) },
    { provider: "mysql", image: "mysql:8.0", port: 3306, user: "root", password: randomBytes(18).toString("hex"), ready: (id, password) => docker(["exec", id, "mysqladmin", "ping", "-h127.0.0.1", "-uroot", `-p${password}`, "--silent"]) }
  ].filter((target) => requestedProviders.includes(target.provider))) {
    if (runContextBrowserAcceptance && target.provider !== "postgresql") throw new Error("joined Context browser acceptance requires PostgreSQL");
    const containerName = `${label}-${target.provider}`;
    const envArgs = target.provider === "postgresql"
      ? ["-e", `POSTGRES_USER=${target.user}`, "-e", `POSTGRES_PASSWORD=${target.password}`, "-e", `POSTGRES_DB=${dbName}`]
      : ["-e", `MYSQL_ROOT_PASSWORD=${target.password}`, "-e", `MYSQL_DATABASE=${dbName}`];
    const id = docker(["run", "-d", "--name", containerName, "--label", `org.nexusid.acceptance=${label}`, ...envArgs, "-p", `127.0.0.1::${target.port}`, target.image]);
    resources.push({ id, containerName });
    const hostPort = docker(["inspect", "--format", `{{(index (index .NetworkSettings.Ports "${target.port}/tcp") 0).HostPort}}`, id]);
    let ready = false;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && !ready) {
      if (docker(["inspect", "--format", "{{.State.Status}}", id]) !== "running") throw new Error(`${target.provider} container exited before readiness`);
      try { target.ready(id, target.password); ready = true; }
      catch (error) { if (Date.now() + 750 >= deadline) throw error; await sleep(750); }
    }
    if (!ready) throw new Error(`${target.provider} disposable database did not become ready`);
    const encodedPassword = encodeURIComponent(target.password);
    const databaseUrl = target.provider === "postgresql"
      ? `postgresql://${target.user}:${encodedPassword}@127.0.0.1:${hostPort}/${dbName}`
      : `mysql://${target.user}:${encodedPassword}@127.0.0.1:${hostPort}/${dbName}`;
    let contextDatabaseUrl;
    let contextAppDatabaseUrl;
    let hubDatabaseUrl;
    let gitflowDatabaseUrl;
    let voxChatActionDatabaseUrl;
    if (runContextAcceptance) {
      if (target.provider !== "postgresql") throw new Error("combined NexusContext acceptance requires the PostgreSQL provider");
      const contextDbName = `nexuscontext_test_${nonce}`;
      const contextUser = "context_accept";
      const contextPassword = randomBytes(18).toString("hex");
      const contextContainerName = `${label}-nexuscontext-postgresql`;
      const contextId = docker(["run", "-d", "--name", contextContainerName, "--label", `org.nexusid.acceptance=${label}`,
        "-e", `POSTGRES_USER=${contextUser}`, "-e", `POSTGRES_PASSWORD=${contextPassword}`, "-e", `POSTGRES_DB=${contextDbName}`,
        "-p", "127.0.0.1::5432", "pgvector/pgvector:pg17"]);
      resources.push({ id: contextId, containerName: contextContainerName });
      const contextHostPort = docker(["inspect", "--format", "{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", contextId]);
      let contextReady = false;
      const contextDeadline = Date.now() + 120_000;
      while (Date.now() < contextDeadline && !contextReady) {
        if (docker(["inspect", "--format", "{{.State.Status}}", contextId]) !== "running") throw new Error("NexusContext PostgreSQL container exited before readiness");
        try { docker(["exec", contextId, "pg_isready", "-U", contextUser, "-d", contextDbName]); contextReady = true; }
        catch { await sleep(750); }
      }
      if (!contextReady) throw new Error("NexusContext disposable PostgreSQL did not become ready");
      const contextBase = `127.0.0.1:${contextHostPort}/${contextDbName}`;
      contextDatabaseUrl = `postgresql+psycopg://${contextUser}:${encodeURIComponent(contextPassword)}@${contextBase}`;
      contextAppDatabaseUrl = `postgresql+psycopg://nexus_app:test-only@${contextBase}`;
    }
    if (runContextAcceptance || runGitFlowSearchAcceptance) {
      if (target.provider !== "postgresql") throw new Error("combined NexusHub acceptance requires the PostgreSQL provider");
      const hubDbName = `nexushub_test_${nonce}`;
      await createPostgresDatabase(id, target.user, hubDbName);
      hubDatabaseUrl = `postgresql://${target.user}:${encodedPassword}@127.0.0.1:${hostPort}/${hubDbName}`;
      const gitflowDbName = `gitflow_test_${nonce}`;
      await createPostgresDatabase(id, target.user, gitflowDbName);
      gitflowDatabaseUrl = `postgresql://${target.user}:${encodedPassword}@127.0.0.1:${hostPort}/${gitflowDbName}`;
      if (runVoxChatActionHostAcceptance) {
        const voxChatDbName = `voxchat_test_${nonce}`;
        await createPostgresDatabase(id, target.user, voxChatDbName);
        voxChatActionDatabaseUrl = `postgresql://${target.user}:${encodedPassword}@127.0.0.1:${hostPort}/${voxChatDbName}`;
      }
    }
    const schema = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", "import { ensureExternalDatabaseSchema } from './src/core/runtime-database-config.ts'; await ensureExternalDatabaseSchema({ databaseProvider: process.env.NEXUSID_ACCEPT_PROVIDER, databasePath: './data/sso.sqlite', externalDatabaseUrl: process.env.NEXUSID_ACCEPT_DATABASE_URL });"], {
      cwd: root, encoding: "utf8", stdio: "inherit",
      env: { ...process.env, NEXUSID_ACCEPT_PROVIDER: target.provider, NEXUSID_ACCEPT_DATABASE_URL: databaseUrl }
    });
    if (schema.status !== 0) throw new Error(`${target.provider} schema push failed`);
    const workspace = await mkdtemp(join(tmpdir(), "nexusid-resource-process-"));
    try {
      await mkdir(join(workspace, "data"), { recursive: true });
      await writeFile(join(workspace, "data", "database-config.json"), `${JSON.stringify({ databaseProvider: target.provider, databasePath: "./data/sso.sqlite", externalDatabaseUrl: databaseUrl }, null, 2)}\n`);
      const port = await reservePort();
      let issuer = `http://127.0.0.1:${port}`;
      let issuerTlsProxy;
      let browserTopology = {};
      if (runContextBrowserAcceptance) {
        const tlsScratch = await mkdtemp(join(tmpdir(), "nexushub-context-browser-tls-"));
        scratchPaths.push(tlsScratch);
        const browserHome = join(tlsScratch, "browser-home");
        const nssDb = join(browserHome, ".pki", "nssdb");
        await mkdir(nssDb, { recursive: true });
        const caKey = join(tlsScratch, "ca.key"), caCert = join(tlsScratch, "ca.crt");
        const hostSuffix = randomBytes(5).toString("hex");
        const issuerHost = `id-${hostSuffix}.localhost`, hubHost = `hub-${hostSuffix}.localhost`, webHost = `context-${hostSuffix}.localhost`;
        const leafKey = join(tlsScratch, "localhost.key"), csr = join(tlsScratch, "localhost.csr");
        const leafCert = join(tlsScratch, "localhost.crt"), ext = join(tlsScratch, "localhost.ext");
        execFileSync("certutil", ["-N", "-d", `sql:${nssDb}`, "--empty-password"], { stdio: "ignore" });
        execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", caCert,
          "-days", "1", "-subj", "/CN=NexusHub joined browser acceptance CA", "-addext", "basicConstraints=critical,CA:TRUE",
          "-addext", "keyUsage=critical,keyCertSign,cRLSign"], { stdio: "ignore" });
        execFileSync("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", leafKey, "-out", csr, "-subj", `/CN=${issuerHost}`], { stdio: "ignore" });
        await writeFile(ext, `subjectAltName=DNS:${issuerHost},DNS:${hubHost},DNS:${webHost}\nextendedKeyUsage=serverAuth\n`);
        execFileSync("openssl", ["x509", "-req", "-in", csr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", leafCert,
          "-days", "1", "-extfile", ext], { stdio: "ignore" });
        execFileSync("certutil", ["-A", "-d", `sql:${nssDb}`, "-n", "NexusHub joined browser acceptance CA", "-t", "C,,", "-i", caCert], { stdio: "ignore" });
        const issuerTlsPort = await reservePort();
        issuer = `https://${issuerHost}:${issuerTlsPort}`;
        browserTopology = { NEXUSHUB_CONTEXT_BROWSER_ACCEPTANCE: "1", NEXUSHUB_CONTEXT_BROWSER_ISSUER_ORIGIN: issuer,
          NEXUSHUB_CONTEXT_BROWSER_ISSUER_HTTP_PORT: String(port), NEXUSHUB_CONTEXT_BROWSER_ISSUER_HOST: issuerHost,
          NEXUSHUB_CONTEXT_BROWSER_HUB_HOST: hubHost, NEXUSHUB_CONTEXT_BROWSER_WEB_HOST: webHost,
          NEXUSHUB_CONTEXT_BROWSER_HOST_RESOLVER_RULES: `MAP ${issuerHost} 127.0.0.1,MAP ${hubHost} 127.0.0.1,MAP ${webHost} 127.0.0.1`,
          NEXUSHUB_CONTEXT_BROWSER_TLS_KEY: leafKey, NEXUSHUB_CONTEXT_BROWSER_TLS_CERT: leafCert,
          NEXUSHUB_CONTEXT_BROWSER_CA_CERT: caCert, NEXUSHUB_CONTEXT_BROWSER_HOME: browserHome,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-openssl-ca"].filter(Boolean).join(" "),
          NODE_EXTRA_CA_CERTS: caCert };
        issuerTlsProxy = await tlsProxy(leafKey, leafCert, issuerTlsPort, port);
        resources.push({ cleanup: async () => { if (issuerTlsProxy?.listening) await new Promise(resolveClose => issuerTlsProxy.close(resolveClose)); } });
      }
      const child = spawn(process.execPath, ["--import", join(root, "node_modules/tsx/dist/loader.mjs"), join(root, "src/server.ts")], {
        cwd: workspace,
        env: { ...process.env, NODE_ENV: process.env.NEXUSID_RESOURCE_PROCESS_LOG_ERRORS === "1" ? "development" : "test", HOST: "127.0.0.1", PORT: String(port), ISSUER: issuer, COOKIE_SECRET: randomBytes(32).toString("hex"), DATABASE_PROVIDER: target.provider, DATABASE_URL: databaseUrl, DYNAMIC_CLIENT_REGISTRATION: "admin", NEXUSID_NEXUSHUB_PROVISIONING_ENABLED: runHubInstallerAcceptance || runHubInstallerWizardBrowserAcceptance ? "true" : "false", ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: "Disposable-Admin-Pass-42" },
        stdio: ["ignore", "pipe", "pipe"]
      });
      const childExit = new Promise((resolveExit) => child.once("exit", resolveExit));
      resources.push({ child, childExit, workspace, provider: target.provider });
      let logs = "";
      child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
      child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
      try {
        await waitForHealth(runContextBrowserAcceptance ? `http://127.0.0.1:${port}` : issuer, child, () => logs);
        let customerIssuerOrigin;
        if (runGoldenIdentitySeparationAcceptance) {
          const customerPort = await reservePort();
          customerIssuerOrigin = `http://127.0.0.1:${customerPort}`;
          const customerWorkspace = await mkdtemp(join(tmpdir(), "nexusid-customer-issuer-process-"));
          scratchPaths.push(customerWorkspace);
          await mkdir(join(customerWorkspace, "data"), { recursive: true });
          await writeFile(join(customerWorkspace, "data", "database-config.json"), `${JSON.stringify({ databaseProvider: target.provider, databasePath: "./data/sso.sqlite", externalDatabaseUrl: databaseUrl }, null, 2)}\n`);
          const customerChild = spawn(process.execPath, ["--import", join(root, "node_modules/tsx/dist/loader.mjs"), join(root, "src/server.ts")], {
            cwd: customerWorkspace,
            env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(customerPort), ISSUER: customerIssuerOrigin,
              COOKIE_SECRET: randomBytes(32).toString("hex"), DATABASE_PROVIDER: target.provider, DATABASE_URL: databaseUrl,
              DYNAMIC_CLIENT_REGISTRATION: "admin", ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: "Disposable-Admin-Pass-42" },
            stdio: ["ignore", "pipe", "pipe"],
          });
          const customerChildExit = new Promise((resolveExit) => customerChild.once("exit", resolveExit));
          let customerLogs = "";
          customerChild.stdout.on("data", (chunk) => { customerLogs += chunk.toString(); });
          customerChild.stderr.on("data", (chunk) => { customerLogs += chunk.toString(); });
          resources.push({ child: customerChild, childExit: customerChildExit, workspace: customerWorkspace, provider: target.provider });
          await waitForHealth(customerIssuerOrigin, customerChild, () => customerLogs);
          process.stdout.write(`Running a second live NexusID issuer for golden customer identity separation (${containerName})…\n`);
        }
        process.stdout.write(`Running real HTTP/resource-token acceptance against ${target.provider} (${containerName})…\n`);
        const acceptanceTests = ["tests/integration/nexushub-resource-process.acceptance.test.ts"];
        if (target.provider === "mysql") acceptanceTests.push("tests/integration/mysql-prisma-write-readback.acceptance.test.ts");
        if (runHubInstallerAcceptance) acceptanceTests.push("tests/integration/nexushub-installer-process.acceptance.test.ts");
        if (runHubInstallerWizardBrowserAcceptance) acceptanceTests.push("tests/browser/nexushub-installer-wizard-live.test.mjs");
        if (runGitFlowSearchAcceptance) acceptanceTests.push(`${process.env.NEXUSHUB_GITFLOW_REPO_DIR}/tests/nexushub-search.real-hub-process.acceptance.test.mjs`);
        if (runVoxChatActionHostAcceptance) acceptanceTests.push(`${process.env.NEXUSHUB_SOURCE_ROOT}/services/hub-api/test/voxchat-gitflow-local-process.integration.test.ts`);
        let prismaBackup;
        let gitflowRoot;
        let gitflowSchema;
        let prismaClientBackup;
        try {
        if (runGitFlowSearchAcceptance) {
          gitflowRoot = resolve(process.env.NEXUSHUB_GITFLOW_REPO_DIR);
          gitflowSchema = await readFile(join(gitflowRoot, "prisma/schema.prisma"));
          prismaBackup = await mkdtemp(join(tmpdir(), "gitflow-prisma-restore-"));
          prismaClientBackup = join(prismaBackup, "client");
          await cp(join(gitflowRoot, "node_modules/.prisma/client"), prismaClientBackup, { recursive: true });
          const generation = spawnSync("npm", ["run", "prisma:generate"], {
            cwd: gitflowRoot, encoding: "utf8", stdio: "inherit",
            env: { ...process.env, PRISMA_PROVIDER: "postgresql", DATABASE_URL: gitflowDatabaseUrl },
          });
          if (generation.status !== 0) throw new Error(`GitFlow PostgreSQL Prisma generation failed (${generation.status})`);
        }
        if (runContextBrowserAcceptance) {
          // These listeners are only needed by the joined browser test. Allocate
          // them immediately before the child starts so the values are not left
          // unbound during database setup, user provisioning, and NexusID boot.
          // Hold every reservation until the whole set is chosen to prevent the
          // kernel from reissuing one of these ephemeral ports within the set.
          const [hubTlsPort, hubHttpPort, webPort, contextApiPort] = await reservePorts(4);
          Object.assign(browserTopology, {
            NEXUSHUB_CONTEXT_BROWSER_HUB_ORIGIN: `https://${browserTopology.NEXUSHUB_CONTEXT_BROWSER_HUB_HOST}:${hubTlsPort}`,
            NEXUSHUB_CONTEXT_BROWSER_HUB_TLS_PORT: String(hubTlsPort),
            NEXUSHUB_CONTEXT_BROWSER_HUB_HTTP_PORT: String(hubHttpPort),
            NEXUSHUB_CONTEXT_BROWSER_WEB_ORIGIN: `https://${browserTopology.NEXUSHUB_CONTEXT_BROWSER_WEB_HOST}:${webPort}`,
            NEXUSHUB_CONTEXT_BROWSER_WEB_PORT: String(webPort),
            NEXUSHUB_CONTEXT_BROWSER_API_PORT: String(contextApiPort),
          });
        }
        const testArgs = ["--import", "tsx", "--test-concurrency=1", "--test", ...acceptanceTests];
        const testEnv = { ...process.env, ...((runContextBrowserAcceptance || runHubInstallerWizardBrowserAcceptance) ? { NODE_ENV: "test" } : {}), DATABASE_PROVIDER: target.provider, DATABASE_URL: databaseUrl, COOKIE_SECRET: randomBytes(32).toString("hex"), NEXUSID_RESOURCE_PROCESS_ACCEPTANCE: "1", NEXUSID_RESOURCE_PROCESS_ISSUER: issuer, NEXUSID_RESOURCE_PROCESS_DB_NAME: dbName, NEXUSID_RESOURCE_PROCESS_PROVIDER: target.provider, NEXUSID_RESOURCE_PROCESS_DATABASE_URL: databaseUrl, NEXUSID_RESOURCE_PROCESS_PORT: String(port), ...(customerIssuerOrigin ? { NEXUSID_CUSTOMER_ISSUER_ORIGIN: customerIssuerOrigin, NEXUSHUB_GOLDEN_IDENTITY_SEPARATION_ACCEPTANCE: "1" } : {}), ...(target.provider === "mysql" ? { NEXUSID_MYSQL_WRITE_READBACK_ACCEPTANCE: "1" } : {}), ...(runHubInstallerAcceptance ? { NEXUSHUB_INSTALLER_PROCESS_ACCEPTANCE: "1" } : {}), ...(runHubInstallerWizardBrowserAcceptance ? { NEXUSID_HUB_INSTALLER_WIZARD_BROWSER_ACCEPTANCE: "1" } : {}), ...(runContextAcceptance ? { NEXUSHUB_CONTEXT_ACCEPTANCE: "1", NEXUSHUB_CONTEXT_DATABASE_URL: contextDatabaseUrl, NEXUSHUB_CONTEXT_APP_DATABASE_URL: contextAppDatabaseUrl } : {}), ...((runContextAcceptance || runGitFlowSearchAcceptance) ? { NEXUSHUB_HUB_DATABASE_URL: hubDatabaseUrl, NEXUSHUB_GITFLOW_DATABASE_URL: gitflowDatabaseUrl } : {}), ...(runGitFlowSearchAcceptance ? { NEXUSHUB_GITFLOW_SEARCH_ACCEPTANCE: "1", NEXUSHUB_SOURCE_ROOT: process.env.NEXUSHUB_SOURCE_ROOT, NEXUSHUB_GITFLOW_REPO_DIR: gitflowRoot, GITFLOW_NEXUSHUB_SEARCH_DATABASE_URL: gitflowDatabaseUrl } : {}), ...(runVoxChatActionHostAcceptance ? { NEXUSHUB_VOXCHAT_ACTION_HOST_ACCEPTANCE: "1", NEXUSHUB_VOXCHAT_ACTION_TEST_DATABASE_URL: hubDatabaseUrl, GITFLOW_ACTION_TEST_DATABASE_URL: gitflowDatabaseUrl, NEXUSHUB_VOXCHAT_ACTION_HOST_DATABASE_URL: voxChatActionDatabaseUrl, NEXUSHUB_VOXCHAT_REPO_DIR: process.env.NEXUSHUB_VOXCHAT_REPO_DIR } : {}), ...browserTopology };
        let acceptanceStatus;
        if (runContextBrowserAcceptance || runHubInstallerWizardBrowserAcceptance) {
          // Keep this runner's issuer TLS proxy event loop live while Chromium and
          // the test worker call the HTTPS origins. spawnSync deadlocks TLS I/O.
          const childTest = spawn(process.execPath, testArgs, { cwd: root, stdio: "inherit", env: testEnv });
          const [code] = await new Promise(resolveExit => childTest.once("exit", (...values) => resolveExit(values)));
          acceptanceStatus = code ?? 1;
        } else {
          acceptanceStatus = spawnSync(process.execPath, testArgs, { cwd: root, encoding: "utf8", stdio: "inherit", env: testEnv }).status ?? 1;
        }
        if (acceptanceStatus !== 0) {
          process.exitCode = 1;
          process.stderr.write(`${target.provider} resource/Hub installer process acceptance failed with status ${acceptanceStatus}.\n`);
        }
        if (acceptanceStatus === 0 && runHubInstallerWizardBrowserAcceptance) {
          process.stdout.write("Restarting NexusID against the same PostgreSQL database to verify installer identity persistence…\n");
          child.kill("SIGTERM");
          await waitChild(child, childExit);
          const restarted = spawn(process.execPath, ["--import", join(root, "node_modules/tsx/dist/loader.mjs"), join(root, "src/server.ts")], {
            cwd: workspace,
            env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), ISSUER: issuer,
              COOKIE_SECRET: randomBytes(32).toString("hex"), DATABASE_PROVIDER: target.provider, DATABASE_URL: databaseUrl,
              DYNAMIC_CLIENT_REGISTRATION: "admin", NEXUSID_NEXUSHUB_PROVISIONING_ENABLED: "true",
              ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: "Disposable-Admin-Pass-42" },
            stdio: ["ignore", "pipe", "pipe"],
          });
          const restartedExit = new Promise((resolveExit) => restarted.once("exit", resolveExit));
          let restartedLogs = "";
          restarted.stdout.on("data", (chunk) => { restartedLogs += chunk.toString(); });
          restarted.stderr.on("data", (chunk) => { restartedLogs += chunk.toString(); });
          try {
            await waitForHealth(issuer, restarted, () => restartedLogs);
            const restartEnv = { ...testEnv, NEXUSID_HUB_INSTALLER_WIZARD_RESTART_ACCEPTANCE: "1" };
            const restartStatus = spawnSync(process.execPath, ["--test", "tests/browser/nexushub-installer-wizard-restart.acceptance.test.mjs"], {
              cwd: root, encoding: "utf8", stdio: "inherit", env: restartEnv,
            }).status ?? 1;
            if (restartStatus !== 0) {
              process.exitCode = 1;
              process.stderr.write(`NexusID installer persistence after restart acceptance failed with status ${restartStatus}.\n`);
            }
          } finally {
            restarted.kill("SIGTERM");
            await waitChild(restarted, restartedExit);
            if (restarted.exitCode && restarted.exitCode !== 0) process.stderr.write(`Restarted NexusID process exited ${restarted.exitCode}:\n${restartedLogs.slice(-3000)}\n`);
          }
        }
        } finally {
          if (runGitFlowSearchAcceptance && gitflowRoot && prismaBackup && gitflowSchema) {
            await writeFile(join(gitflowRoot, "prisma/schema.prisma"), gitflowSchema);
            await rm(join(gitflowRoot, "node_modules/.prisma/client"), { recursive: true, force: true });
            await cp(prismaClientBackup, join(gitflowRoot, "node_modules/.prisma/client"), { recursive: true });
            await rm(prismaBackup, { recursive: true, force: true });
          }
        }
      } finally {
        child.kill("SIGTERM");
        await waitChild(child, childExit);
        if ((logs.includes("Error") && child.exitCode && child.exitCode !== 0) || process.exitCode !== 0) {
          const safeLogs = logs.slice(-4000).replaceAll(target.password, "[redacted]");
          if (safeLogs.trim()) process.stderr.write(`NexusID ${target.provider} process log tail:\n${safeLogs}\n`);
        }
        await rm(workspace, { recursive: true, force: true });
      }
    } catch (error) {
      await rm(workspace, { recursive: true, force: true });
      throw error;
    }
  }
} finally {
  for (const resource of resources.reverse()) {
    if (resource.cleanup) {
      try { await resource.cleanup(); } catch (error) { process.stderr.write(`Cleanup failure: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
    } else if (resource.child) {
      if (!resource.child.killed) resource.child.kill("SIGTERM");
      await waitChild(resource.child, resource.childExit);
      await rm(resource.workspace, { recursive: true, force: true });
    } else if (resource.id) {
      try {
        docker(["rm", "--force", "--volumes", resource.id]);
        try { docker(["inspect", resource.id]); throw new Error(`cleanup verification failed: ${resource.containerName} remains`); }
        catch (error) { if (String(error).includes("cleanup verification failed")) throw error; }
        process.stdout.write(`Removed and verified disposable container ${resource.containerName}.\n`);
      } catch (error) { process.stderr.write(`Cleanup failure for ${resource.containerName}: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
    }
  }
  for (const scratch of scratchPaths) await rm(scratch, { recursive: true, force: true });
}

async function reservePort() {
  return (await reservePorts(1))[0];
}

async function reservePorts(count) {
  const net = await import("node:net");
  const reservations = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = net.createServer();
      await new Promise((resolveListen, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolveListen()));
      reservations.push(server);
    }
    return reservations.map((server) => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Could not inspect reserved acceptance port");
      return address.port;
    });
  } finally {
    await Promise.all(reservations.map((server) => new Promise((resolveClose, reject) =>
      server.close((error) => error ? reject(error) : resolveClose()))));
  }
}

async function waitForHealth(issuer, child, getLogs) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`NexusID process exited early:\n${getLogs().slice(-4000)}`);
    try { const response = await fetch(`${issuer}/health`); if (response.ok) return; }
    catch { /* process is still starting */ }
    await sleep(250);
  }
  throw new Error(`NexusID did not become healthy:\n${getLogs().slice(-4000)}`);
}

async function waitChild(child, childExit) {
  if (child.exitCode !== null) return;
  await Promise.race([childExit, sleep(5000)]);
  if (child.exitCode === null) { child.kill("SIGKILL"); await childExit; }
}

async function tlsProxy(keyPath, certPath, tlsPort, upstreamPort) {
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
  const server = createHttpsServer({ key, cert }, (request, response) => {
    const upstream = httpRequest({ hostname: "127.0.0.1", port: upstreamPort, method: request.method,
      path: request.url, headers: { ...request.headers, host: `127.0.0.1:${upstreamPort}` } }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  await new Promise((resolveListen, reject) => server.once("error", reject).listen(tlsPort, "127.0.0.1", resolveListen));
  return server;
}
