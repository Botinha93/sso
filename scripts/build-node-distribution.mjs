import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const bundleRoot = join(projectRoot, "bundle", "node");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const runNpm = (args, cwd = projectRoot) => {
  execFileSync(npmCommand, args, {
    cwd,
    stdio: "inherit",
    env: process.env
  });
};

const copyIfExists = (source, destination) => {
  if (!existsSync(source)) {
    return;
  }

  cpSync(source, destination, { recursive: true });
};

const ensurePrismaRuntimeLayout = () => {
  const generatedDir = join(bundleRoot, "src", "generated");
  const linkPath = join(generatedDir, "prisma");
  const targetPath = join(bundleRoot, "dist", "generated", "prisma");

  mkdirSync(generatedDir, { recursive: true });

  try {
    symlinkSync(targetPath, linkPath, "dir");
  } catch {
    // Fallback for filesystems where symlink creation is restricted.
    copyIfExists(targetPath, linkPath);
  }
};

console.log("[bundle:node] Generating Prisma clients");
runNpm(["run", "prisma:generate"]);

console.log("[bundle:node] Building API and frontend assets");
runNpm(["run", "build"]);
runNpm(["run", "build:admin"]);
runNpm(["run", "build:portal"]);

console.log("[bundle:node] Preparing bundle directory");
rmSync(bundleRoot, { recursive: true, force: true });
mkdirSync(bundleRoot, { recursive: true });

copyIfExists(join(projectRoot, "package.json"), join(bundleRoot, "package.json"));
copyIfExists(join(projectRoot, "package-lock.json"), join(bundleRoot, "package-lock.json"));
copyIfExists(join(projectRoot, "dist"), join(bundleRoot, "dist"));
copyIfExists(join(projectRoot, "prisma"), join(bundleRoot, "prisma"));
copyIfExists(join(projectRoot, ".env.example"), join(bundleRoot, ".env.example"));
copyIfExists(join(projectRoot, "README.md"), join(bundleRoot, "README.md"));

console.log("[bundle:node] Installing production dependencies");
runNpm(["ci", "--omit=dev"], bundleRoot);

ensurePrismaRuntimeLayout();

console.log(`[bundle:node] Distribution ready at ${bundleRoot}`);
console.log("[bundle:node] Start with: node bundle/node/dist/container/entrypoint.js");
