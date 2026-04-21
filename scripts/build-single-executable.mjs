import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const bundleRoot = join(projectRoot, "bundle", "node");
const executableDir = join(projectRoot, "bundle", "executable");
const buildTempDir = join(projectRoot, "bundle", ".sea-build");
const seaConfigPath = join(buildTempDir, "sea-config.json");
const outputBinaryPath = join(executableDir, "sso-platform");
const nodeBinaryPath = process.execPath;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (command, args, cwd = projectRoot, env = process.env) => {
  execFileSync(command, args, { cwd, stdio: "inherit", env });
};

const collectFiles = (rootDir) => {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(relative(rootDir, fullPath).replaceAll("\\", "/"));
      }
    }
  };

  walk(rootDir);
  return files;
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

const buildSeaConfig = (files) => {
  const manifest = {
    entrypoint: "dist/container/entrypoint.js",
    files: files.map((file) => ({
      path: file,
      key: file
    }))
  };

  const assets = {
    "__manifest.json": join(buildTempDir, "manifest.json")
  };

  for (const file of files) {
    assets[file] = join(bundleRoot, file);
  }

  writeFileSync(join(buildTempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        executable: nodeBinaryPath,
        main: "scripts/sea-bootstrap.mjs",
        mainFormat: "module",
        output: outputBinaryPath,
        disableExperimentalSEAWarning: true,
        assets
      },
      null,
      2
    ),
    "utf8"
  );
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

console.log("[bundle:exe] Collecting runtime files");
const files = collectFiles(bundleRoot);
if (!files.length) {
  throw new Error("No files found in bundle/node to embed in executable.");
}

rmSync(buildTempDir, { recursive: true, force: true });
mkdirSync(buildTempDir, { recursive: true });
mkdirSync(executableDir, { recursive: true });

buildSeaConfig(files);

console.log("[bundle:exe] Generating SEA blob");
run(nodeBinaryPath, ["--build-sea", seaConfigPath]);

if (process.platform !== "win32") {
  run("chmod", ["+x", outputBinaryPath]);
}

const sizeInMb = (statSync(outputBinaryPath).size / (1024 * 1024)).toFixed(1);
console.log(`[bundle:exe] Executable ready at ${outputBinaryPath} (${sizeInMb} MB)`);
console.log("[bundle:exe] Run it directly: ./bundle/executable/sso-platform");
