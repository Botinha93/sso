import { Worker } from "node:worker_threads";
import type { AuditRepository } from "../repositories/contracts.js";
import type { PluginRecord, PluginService } from "./plugin-service.js";

type PluginHandlerEvent = {
  type: string;
  payload: Record<string, unknown>;
  sentAt: string;
};

interface LoadedPlugin {
  plugin: PluginRecord;
  worker: Worker;
}

const PLUGIN_EVENT_TIMEOUT_MS = 2_000;
const PLUGIN_LOAD_TIMEOUT_MS = 2_000;

/**
 * Worker bootstrap. Runs under `node --permission` with an empty env so a
 * sandbox escape from the plugin source cannot `require("child_process")`,
 * read the host filesystem, or inherit COOKIE_SECRET / database URLs.
 * Network is not gated by the permission model; plugins only receive the
 * event payload we pass them.
 */
const PLUGIN_WORKER_SOURCE = [
  '"use strict";',
  "const { parentPort, workerData } = require(\"node:worker_threads\");",
  "if (!parentPort) { process.exit(1); }",
  "const source = typeof workerData?.source === \"string\" ? workerData.source : \"\";",
  "if (!source || source.length > 2097152) {",
  "  parentPort.postMessage({ type: \"load-error\", message: \"Invalid plugin source\" });",
  "} else {",
  "  const exportsObject = {};",
  "  const moduleObject = { exports: exportsObject };",
  "  const runtimeConsole = {",
  "    log: function () { parentPort.postMessage({ type: \"console\", level: \"log\", args: Array.from(arguments).map(String) }); },",
  "    warn: function () { parentPort.postMessage({ type: \"console\", level: \"warn\", args: Array.from(arguments).map(String) }); },",
  "    error: function () { parentPort.postMessage({ type: \"console\", level: \"error\", args: Array.from(arguments).map(String) }); }",
  "  };",
  "  try {",
  "    const run = new Function(\"module\", \"exports\", \"console\", \"\\\"use strict\\\";\\n\" + source);",
  "    run(moduleObject, exportsObject, runtimeConsole);",
  "    const handler = moduleObject.exports.onEvent || moduleObject.exports.default;",
  "    if (typeof handler !== \"function\") {",
  "      parentPort.postMessage({ type: \"load-error\", message: \"Plugin entrypoint must export an onEvent(event, api) function\" });",
  "    } else {",
  "      parentPort.postMessage({ type: \"ready\" });",
  "      parentPort.on(\"message\", async function (msg) {",
  "        if (!msg || msg.type !== \"event\") return;",
  "        try {",
  "          await handler(msg.event, {",
  "            log: function (message, metadata) {",
  "              parentPort.postMessage({ type: \"log\", message: String(message == null ? \"\" : message), metadata: metadata });",
  "            }",
  "          });",
  "          parentPort.postMessage({ type: \"done\" });",
  "        } catch (error) {",
  "          parentPort.postMessage({ type: \"error\", message: error && error.message ? error.message : \"plugin error\" });",
  "        }",
  "      });",
  "    }",
  "  } catch (error) {",
  "    parentPort.postMessage({ type: \"load-error\", message: error && error.message ? error.message : \"load failed\" });",
  "  }",
  "}"
].join("\n");

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
    await this.terminateAll();
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

  async dispose(): Promise<void> {
    this.initialized = false;
    await this.terminateAll();
  }

  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.ensureInitialized();

    for (const loaded of [...this.loadedPlugins.values()]) {
      if (!loaded.plugin.hooks.includes(eventType)) {
        continue;
      }

      const sentAt = new Date().toISOString();
      const event: PluginHandlerEvent = { type: eventType, payload, sentAt };

      try {
        await this.dispatchToWorker(loaded, event);

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

  private async dispatchToWorker(loaded: LoadedPlugin, event: PluginHandlerEvent): Promise<void> {
    const result = this.waitForWorkerMessage(
      loaded.worker,
      (message) => message?.type === "done" || message?.type === "error",
      PLUGIN_EVENT_TIMEOUT_MS,
      `Plugin ${loaded.plugin.id} did not finish handling ${event.type} within ${PLUGIN_EVENT_TIMEOUT_MS}ms`
    );

    loaded.worker.postMessage({ type: "event", event });

    try {
      const message = await result;
      if (message.type === "error") {
        throw new Error(typeof message.message === "string" ? message.message : "plugin error");
      }
    } catch (error) {
      await this.killPlugin(loaded.plugin.id);
      throw error;
    }
  }

  private async loadPlugin(pluginId: string): Promise<LoadedPlugin> {
    const { plugin, source } = await this.pluginService.loadEntrypointSource(pluginId);
    const worker = new Worker(PLUGIN_WORKER_SOURCE, {
      eval: true,
      workerData: { source },
      env: {},
      execArgv: ["--permission"],
      resourceLimits: {
        maxOldGenerationSizeMb: 32,
        maxYoungGenerationSizeMb: 8
      }
    });

    const ready = this.waitForWorkerMessage(
      worker,
      (value) => value?.type === "ready" || value?.type === "load-error",
      PLUGIN_LOAD_TIMEOUT_MS,
      `Plugin ${plugin.id} did not become ready within ${PLUGIN_LOAD_TIMEOUT_MS}ms`
    );

    worker.on("message", (message: { type?: string; level?: string; args?: unknown[]; message?: unknown; metadata?: unknown }) => {
      if (message?.type === "console") {
        void this.auditRepository.log({
          type: "plugin_runtime_console",
          actorType: "system",
          metadata: {
            pluginId: plugin.id,
            level: message.level ?? "log",
            args: Array.isArray(message.args) ? message.args : []
          }
        });
        return;
      }

      if (message?.type === "log") {
        const extra = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
          ? message.metadata as Record<string, unknown>
          : {};
        void this.auditRepository.log({
          type: "plugin_runtime_log",
          actorType: "system",
          metadata: {
            ...extra,
            pluginId: plugin.id,
            version: plugin.version,
            message: String(message.message ?? "")
          }
        });
      }
    });

    worker.on("error", () => {
      void this.killPlugin(plugin.id);
    });

    worker.on("exit", () => {
      if (this.loadedPlugins.get(plugin.id)?.worker === worker) {
        this.loadedPlugins.delete(plugin.id);
      }
    });

    try {
      const message = await ready;
      if (message.type === "load-error") {
        throw new Error(typeof message.message === "string" ? message.message : "Plugin failed to load");
      }
    } catch (error) {
      await this.terminateWorker(worker);
      throw error;
    }

    return { plugin, worker };
  }

  private waitForWorkerMessage(
    worker: Worker,
    matches: (message: { type?: string; message?: unknown }) => boolean,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<{ type?: string; message?: unknown }> {
    return new Promise((resolve, reject) => {
      const onMessage = (message: { type?: string; message?: unknown }) => {
        if (!matches(message)) {
          return;
        }
        cleanup();
        resolve(message);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onExit = (code: number) => {
        cleanup();
        reject(new Error(`Plugin worker exited (${code}) before completing`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };
      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.on("exit", onExit);
    });
  }

  private async killPlugin(pluginId: string): Promise<void> {
    const loaded = this.loadedPlugins.get(pluginId);
    this.loadedPlugins.delete(pluginId);
    if (loaded) {
      await this.terminateWorker(loaded.worker);
    }
  }

  private async terminateAll(): Promise<void> {
    const workers = [...this.loadedPlugins.values()].map((loaded) => loaded.worker);
    this.loadedPlugins.clear();
    await Promise.all(workers.map((worker) => this.terminateWorker(worker)));
  }

  private async terminateWorker(worker: Worker): Promise<void> {
    try {
      await worker.terminate();
    } catch {
      // Worker may already have exited.
    }
  }
}
