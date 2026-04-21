import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const bundleRoot = join(projectRoot, "bundle", "node");
const executableDir = join(projectRoot, "bundle", "executable");
const buildTempDir = join(projectRoot, "bundle", ".exe-build");
const archivePath = join(buildTempDir, "payload.tar.gz");
const outputBinaryPath = join(executableDir, "sso-platform");
const nodeBinaryPath = process.execPath;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, cwd = projectRoot, env = process.env) => {
  execFileSync(command, args, { cwd, stdio: "inherit", env });
};

const copyIfExists = (source, destination) => {
  if (!existsSync(source)) {
    return;
  }

  cpSync(source, destination, { recursive: true });
};

const prepareNodeBundleFromCurrentBuild = () => {
  console.log("[bundle:exe] Preparing Node bundle from existing build artifacts");

  rmSync(bundleRoot, { recursive: true, force: true });
  mkdirSync(bundleRoot, { recursive: true });

  copyIfExists(join(projectRoot, "package.json"), join(bundleRoot, "package.json"));
  copyIfExists(join(projectRoot, "package-lock.json"), join(bundleRoot, "package-lock.json"));
  copyIfExists(join(projectRoot, "dist"), join(bundleRoot, "dist"));
  copyIfExists(join(projectRoot, "prisma"), join(bundleRoot, "prisma"));
  copyIfExists(join(projectRoot, ".env.example"), join(bundleRoot, ".env.example"));
  copyIfExists(join(projectRoot, "README.md"), join(bundleRoot, "README.md"));

  if (!existsSync(join(bundleRoot, "dist", "container", "entrypoint.js"))) {
    throw new Error("Missing dist/container/entrypoint.js. Build artifacts are required before bundling executable.");
  }

  run(npmCommand, ["ci", "--omit=dev"], bundleRoot);

  const bundledNodePath = join(bundleRoot, "bin", "node");
  mkdirSync(dirname(bundledNodePath), { recursive: true });
  cpSync(nodeBinaryPath, bundledNodePath);

  const generatedDir = join(bundleRoot, "src", "generated");
  const linkPath = join(generatedDir, "prisma");
  const targetPath = join(bundleRoot, "dist", "generated", "prisma");

  mkdirSync(generatedDir, { recursive: true });
  try {
    symlinkSync(targetPath, linkPath, "dir");
  } catch {
    copyIfExists(targetPath, linkPath);
  }
};

const buildSelfExtractingExecutable = () => {
  console.log("[bundle:exe] Creating payload archive");
  run("tar", ["-czf", archivePath, "-C", bundleRoot, "."]);

  const digest = createHash("sha256").update(readFileSync(archivePath)).digest("hex").slice(0, 16);
  const launcherTemplate = `#!/bin/sh
set -e

SELF=\"$0\"
CACHE_ROOT=\"\${XDG_CACHE_HOME:-$HOME/.cache}/sso-platform\"
RUNTIME_DIR=\"$CACHE_ROOT/runtime-${digest}\"
MARKER=\"$RUNTIME_DIR/.ready\"

if [ ! -f \"$MARKER\" ]; then
  mkdir -p \"$RUNTIME_DIR\"
  ARCHIVE_LINE=__ARCHIVE_LINE__
  tail -n +\"$ARCHIVE_LINE\" \"$SELF\" | tar -xz -C \"$RUNTIME_DIR\"
  touch \"$MARKER\"
fi

cd \"$RUNTIME_DIR\"
exec \"$RUNTIME_DIR/bin/node\" \"$RUNTIME_DIR/dist/container/entrypoint.js\" \"$@\"
`;

  const archiveLine = launcherTemplate.split("\n").length;
  const launcher = launcherTemplate.replace("__ARCHIVE_LINE__", String(archiveLine));

  writeFileSync(outputBinaryPath, launcher, "utf8");
  appendFileSync(outputBinaryPath, readFileSync(archivePath));
};

if (process.env.EXE_REBUILD === "true") {
  console.log("[bundle:exe] Preparing Node distribution bundle (full rebuild)");
  run(npmCommand, ["run", "bundle:node"]);
} else {
  prepareNodeBundleFromCurrentBuild();
}

if (!statSync(bundleRoot, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error("Node bundle directory was not created. Run npm run bundle:node and retry.");
}

rmSync(buildTempDir, { recursive: true, force: true });
mkdirSync(buildTempDir, { recursive: true });
mkdirSync(executableDir, { recursive: true });

buildSelfExtractingExecutable();

if (process.platform !== "win32") {
  run("chmod", ["+x", outputBinaryPath]);
}

const sizeInMb = (statSync(outputBinaryPath).size / (1024 * 1024)).toFixed(1);
console.log(`[bundle:exe] Executable ready at ${outputBinaryPath} (${sizeInMb} MB)`);
console.log("[bundle:exe] Run it directly: ./bundle/executable/sso-platform");
