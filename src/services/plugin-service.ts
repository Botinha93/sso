import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ENTRYPOINT_PATTERN = /^[A-Za-z0-9._/-]{1,160}$/;
const execFileAsync = promisify(execFile);

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entrypoint: string;
  permissions: string[];
  hooks: string[];
  homepage?: string;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  entrypoint: string;
  permissions: string[];
  hooks: string[];
  homepage?: string;
  status: "uploaded" | "active";
  uploadedAt: string;
  updatedAt: string;
  bundleChecksum: string;
  bundleBytes: number;
}

interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface RegistryFile {
  plugins: PluginRecord[];
}

export class PluginService {
  private readonly registryPath: string;
  private readonly packagesDir: string;

  constructor(private readonly storageRoot: string) {
    this.registryPath = join(storageRoot, "registry.json");
    this.packagesDir = join(storageRoot, "packages");
  }

  async listPlugins(): Promise<PluginRecord[]> {
    const registry = await this.readRegistry();
    return [...registry.plugins].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listActivePlugins(): Promise<PluginRecord[]> {
    const plugins = await this.listPlugins();
    return plugins.filter((plugin) => plugin.status === "active");
  }

  async validate(input: {
    manifest: PluginManifest;
    bundleBase64?: string;
  }): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateManifest(input.manifest, errors, warnings);

    if (input.bundleBase64) {
      const decoded = this.tryDecodeBundle(input.bundleBase64);
      if (!decoded.ok) {
        errors.push(decoded.error);
      }
    } else {
      warnings.push("No plugin bundle provided. Manifest validation only.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async upload(input: {
    manifest: PluginManifest;
    bundleBase64: string;
    activate: boolean;
  }): Promise<PluginRecord> {
    const validation = await this.validate({ manifest: input.manifest, bundleBase64: input.bundleBase64 });
    if (!validation.valid) {
      const error = new Error("Plugin validation failed");
      (error as any).details = validation;
      throw error;
    }

    const decoded = this.tryDecodeBundle(input.bundleBase64);
    if (!decoded.ok) {
      throw new Error(decoded.error);
    }

    await mkdir(this.packagesDir, { recursive: true });

    const pluginDir = join(this.packagesDir, input.manifest.id);
    await mkdir(pluginDir, { recursive: true });

    await writeFile(join(pluginDir, "manifest.json"), `${JSON.stringify(input.manifest, null, 2)}\n`, "utf8");
    await writeFile(join(pluginDir, "bundle.zip"), decoded.data);

    const now = new Date().toISOString();
    const checksum = createHash("sha256").update(decoded.data).digest("hex");

    const registry = await this.readRegistry();
    const existing = registry.plugins.find((plugin) => plugin.id === input.manifest.id);

    const record: PluginRecord = {
      id: input.manifest.id,
      name: input.manifest.name,
      version: input.manifest.version,
      description: input.manifest.description,
      entrypoint: input.manifest.entrypoint,
      permissions: input.manifest.permissions,
      hooks: input.manifest.hooks,
      homepage: input.manifest.homepage,
      status: input.activate ? "active" : "uploaded",
      uploadedAt: existing?.uploadedAt ?? now,
      updatedAt: now,
      bundleChecksum: checksum,
      bundleBytes: decoded.data.byteLength
    };

    const next = registry.plugins.filter((plugin) => plugin.id !== record.id);
    next.push(record);
    await this.writeRegistry({ plugins: next });

    return record;
  }

  async remove(pluginId: string): Promise<boolean> {
    const registry = await this.readRegistry();
    const exists = registry.plugins.some((plugin) => plugin.id === pluginId);
    if (!exists) {
      return false;
    }

    await rm(join(this.packagesDir, pluginId), { recursive: true, force: true });
    await this.writeRegistry({
      plugins: registry.plugins.filter((plugin) => plugin.id !== pluginId)
    });

    return true;
  }

  async loadEntrypointSource(pluginId: string): Promise<{ plugin: PluginRecord; source: string }> {
    const plugins = await this.listPlugins();
    const plugin = plugins.find((item) => item.id === pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const bundlePath = join(this.packagesDir, pluginId, "bundle.zip");
    try {
      const { stdout } = await execFileAsync("unzip", ["-p", bundlePath, plugin.entrypoint], { maxBuffer: 2 * 1024 * 1024 });
      if (!stdout || stdout.trim().length === 0) {
        throw new Error("Plugin entrypoint source is empty");
      }
      return { plugin, source: stdout };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown unzip failure";
      throw new Error(`Failed to load plugin entrypoint ${plugin.entrypoint}: ${message}`);
    }
  }

  private validateManifest(manifest: PluginManifest, errors: string[], warnings: string[]) {
    if (!PLUGIN_ID_PATTERN.test(manifest.id)) {
      errors.push("manifest.id must use lowercase letters, numbers, dots, dashes, or underscores (3-64 chars)");
    }

    if (!VERSION_PATTERN.test(manifest.version)) {
      errors.push("manifest.version must use semantic versioning, for example 1.0.0");
    }

    if (!ENTRYPOINT_PATTERN.test(manifest.entrypoint) || manifest.entrypoint.includes("..")) {
      errors.push("manifest.entrypoint contains unsupported path characters");
    }

    const duplicatePermissions = this.findDuplicates(manifest.permissions);
    if (duplicatePermissions.length > 0) {
      warnings.push(`manifest.permissions contains duplicates: ${duplicatePermissions.join(", ")}`);
    }

    const duplicateHooks = this.findDuplicates(manifest.hooks);
    if (duplicateHooks.length > 0) {
      warnings.push(`manifest.hooks contains duplicates: ${duplicateHooks.join(", ")}`);
    }

    if (manifest.permissions.length === 0) {
      warnings.push("manifest.permissions is empty; plugin will not be able to request scoped capabilities");
    }

    if (manifest.hooks.length === 0) {
      warnings.push("manifest.hooks is empty; plugin has no declared integration hooks");
    }
  }

  private tryDecodeBundle(bundleBase64: string): { ok: true; data: Buffer } | { ok: false; error: string } {
    try {
      const raw = bundleBase64.includes(",") ? bundleBase64.split(",").pop() ?? "" : bundleBase64;
      const data = Buffer.from(raw, "base64");
      if (data.byteLength === 0) {
        return { ok: false, error: "bundleBase64 decoded to an empty payload" };
      }
      if (data.byteLength > 5 * 1024 * 1024) {
        return { ok: false, error: "bundleBase64 exceeds 5MB size limit" };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, error: "bundleBase64 is not valid base64" };
    }
  }

  private findDuplicates(items: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of items) {
      if (seen.has(item)) {
        duplicates.add(item);
      }
      seen.add(item);
    }
    return [...duplicates];
  }

  private async readRegistry(): Promise<RegistryFile> {
    try {
      const raw = await readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(raw) as RegistryFile;
      if (!parsed || !Array.isArray(parsed.plugins)) {
        return { plugins: [] };
      }
      return parsed;
    } catch {
      return { plugins: [] };
    }
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(this.registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  }
}
