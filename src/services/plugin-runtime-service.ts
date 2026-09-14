import { Script, createContext } from "node:vm";
import type { AuditRepository } from "../repositories/contracts.js";
import type { PluginRecord, PluginService } from "./plugin-service.js";

type PluginHandler = (event: {
  type: string;
  payload: Record<string, unknown>;
  sentAt: string;
}, api: {
  log: (message: string, metadata?: Record<string, unknown>) => void;
}) => unknown | Promise<unknown>;

interface LoadedPlugin {
  plugin: PluginRecord;
  onEvent: PluginHandler;
}

const PLUGIN_EVENT_TIMEOUT_MS = 2_000;

const withTimeout = async <T>(work: Promise<T> | T, timeoutMs: number, message: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export class PluginRuntimeService {
  private readonly loadedPlugins = new Map<string, LoadedPlugin>();
  private initialized = false;

  constructor(
    private readonly pluginService: PluginService,
    private readonly auditRepository: AuditRepository
  ) {}

  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.reload();
    this.initialized = true;
  }

  async reload(): Promise<void> {
    this.loadedPlugins.clear();
    const plugins = await this.pluginService.listActivePlugins();

    for (const plugin of plugins) {
      try {
        const loaded = await this.loadPlugin(plugin.id);
        this.loadedPlugins.set(plugin.id, loaded);
      } catch (error) {
        await this.auditRepository.log({
          type: "plugin_runtime_load_failed",
          actorType: "system",
          metadata: {
            pluginId: plugin.id,
            version: plugin.version,
            error: error instanceof Error ? error.message : "Unknown runtime load error"
          }
        });
      }
    }
  }

  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.ensureInitialized();

    for (const loaded of this.loadedPlugins.values()) {
      if (!loaded.plugin.hooks.includes(eventType)) {
        continue;
      }

      const sentAt = new Date().toISOString();
      try {
        // Note: node:vm is not a security boundary. Plugin upload is therefore
        // restricted to the plugins:* / *:* permission. The timeout below stops
        // an asynchronous handler from stalling event delivery indefinitely;
        // a synchronous infinite loop can only be interrupted by a worker.
        await withTimeout(loaded.onEvent(
          {
            type: eventType,
            payload,
            sentAt
          },
          {
            log: (message, metadata) => {
              void this.auditRepository.log({
                type: "plugin_runtime_log",
                actorType: "system",
                metadata: {
                  pluginId: loaded.plugin.id,
                  version: loaded.plugin.version,
                  message,
                  ...(metadata ?? {})
                }
              });
            }
          }
        ), PLUGIN_EVENT_TIMEOUT_MS, `Plugin ${loaded.plugin.id} did not finish handling ${eventType} within ${PLUGIN_EVENT_TIMEOUT_MS}ms`);

        await this.auditRepository.log({
          type: "plugin_runtime_executed",
          actorType: "system",
          metadata: {
            pluginId: loaded.plugin.id,
            version: loaded.plugin.version,
            eventType
          }
        });
      } catch (error) {
        await this.auditRepository.log({
          type: "plugin_runtime_failed",
          actorType: "system",
          metadata: {
            pluginId: loaded.plugin.id,
            version: loaded.plugin.version,
            eventType,
            error: error instanceof Error ? error.message : "Unknown plugin execution error"
          }
        });
      }
    }
  }

  private async loadPlugin(pluginId: string): Promise<LoadedPlugin> {
    const { plugin, source } = await this.pluginService.loadEntrypointSource(pluginId);
    const exportsObject: Record<string, unknown> = {};
    const moduleObject: { exports: Record<string, unknown> } = { exports: exportsObject };

    const runtimeConsole = {
      log: (...args: unknown[]) => {
        void this.auditRepository.log({
          type: "plugin_runtime_console",
          actorType: "system",
          metadata: {
            pluginId: plugin.id,
            level: "log",
            args: args.map((value) => this.toSerializable(value))
          }
        });
      },
      warn: (...args: unknown[]) => {
        void this.auditRepository.log({
          type: "plugin_runtime_console",
          actorType: "system",
          metadata: {
            pluginId: plugin.id,
            level: "warn",
            args: args.map((value) => this.toSerializable(value))
          }
        });
      },
      error: (...args: unknown[]) => {
        void this.auditRepository.log({
          type: "plugin_runtime_console",
          actorType: "system",
          metadata: {
            pluginId: plugin.id,
            level: "error",
            args: args.map((value) => this.toSerializable(value))
          }
        });
      }
    };

    const context = createContext({
      module: moduleObject,
      exports: exportsObject,
      console: runtimeConsole,
      setTimeout: undefined,
      setInterval: undefined,
      Buffer: undefined,
      process: undefined,
      require: undefined,
      global: undefined,
      globalThis: undefined
    });

    const wrapped = `"use strict";\n${source}`;
    const script = new Script(wrapped, {
      filename: `${plugin.id}:${plugin.entrypoint}`
    });

    script.runInContext(context, { timeout: 1000 });

    const candidate = moduleObject.exports.onEvent ?? (moduleObject.exports.default as unknown);
    if (typeof candidate !== "function") {
      throw new Error("Plugin entrypoint must export an onEvent(event, api) function");
    }

    return {
      plugin,
      onEvent: candidate as PluginHandler
    };
  }

  private toSerializable(value: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
}
