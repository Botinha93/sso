import { appendFile, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const sdkPackagePath = path.join(root, "sdk", "package.json");
const changelogPath = path.join(root, "sdk", "CHANGELOG.md");

const run = (cmd, dryRun) => {
  console.log(`$ ${cmd}`);
  if (!dryRun) {
    execSync(cmd, { stdio: "inherit" });
  }
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const versionArg = args.find((arg) => arg.startsWith("--version="));
  const version = versionArg ? versionArg.replace("--version=", "") : null;

  if (!version) {
    throw new Error("Missing required --version=<x.y.z> argument");
  }

  return { dryRun, version };
};

const updateSdkVersion = async (version, dryRun) => {
  const raw = await readFile(sdkPackagePath, "utf8");
  const pkg = JSON.parse(raw);
  const previousVersion = pkg.version;
  pkg.version = version;

  if (!dryRun) {
    await writeFile(sdkPackagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  return { previousVersion, nextVersion: version };
};

const ensureChangelogEntry = async (version, dryRun) => {
  const today = new Date().toISOString().slice(0, 10);
  const heading = `## [${version}] - ${today}`;

  const raw = await readFile(changelogPath, "utf8");
  if (raw.includes(heading)) {
    return;
  }

  const entry = `\n${heading}\n\n### Added\n\n- TBD\n\n### Changed\n\n- TBD\n\n### Fixed\n\n- TBD\n`;

  if (!dryRun) {
    await appendFile(changelogPath, entry, "utf8");
  }
};

const main = async () => {
  const { dryRun, version } = parseArgs();

  run("npm run check:sdk", dryRun);
  run("npm run test:sdk", dryRun);
  run("npm run docs:sdk", dryRun);

  const { previousVersion, nextVersion } = await updateSdkVersion(version, dryRun);
  await ensureChangelogEntry(version, dryRun);

  console.log(`SDK release prepared: ${previousVersion} -> ${nextVersion}`);
  if (dryRun) {
    console.log("Dry run mode: no files changed.");
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
