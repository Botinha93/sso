import { Worker } from "node:worker_threads";

export interface PolicyScriptEvaluation {
  allow: boolean;
  message?: string;
  runtimeError?: boolean;
}

const DEFAULT_SCRIPT_TIMEOUT_MS = 75;
const HOST_TIMEOUT_MS = 1_000;
const WORKER_READY_TIMEOUT_MS = 3_000;
const MAX_SCRIPT_LENGTH = 64 * 1024;

/**
 * Worker bootstrap for administrator-authored policy scripts.
 *
 * `node:vm` alone is not a security boundary, so scripts run inside a worker
 * started with `--permission`, an empty environment and tight heap limits.
 * Inside the worker the script is additionally evaluated in a fresh vm
 * context with dynamic code generation disabled and a CPU timeout. Only plain
 * data crosses the thread boundary: the policy input going in, and a
 * normalised { allow, message } decision coming back.
 */
const POLICY_WORKER_SOURCE = [
  '"use strict";',
  'const { parentPort } = require("node:worker_threads");',
  'const vm = require("node:vm");',
  "if (!parentPort) { process.exit(1); }",
  "const normalize = (result) => {",
  "  if (result === false) { return { allow: false }; }",
  '  if (typeof result === "string") { return { allow: false, message: result }; }',
  '  if (typeof result === "object" && result !== null && "allow" in result) {',
  "    const allow = Boolean(result.allow);",
  '    const message = typeof result.message === "string" ? result.message : undefined;',
  "    return message === undefined ? { allow } : { allow, message };",
  "  }",
  "  return { allow: true };",
  "};",
  'parentPort.on("message", (msg) => {',
  '  if (!msg || msg.type !== "evaluate") { return; }',
  "  const sandbox = { policy: msg.policy, result: true, now: () => new Date().toISOString() };",
  "  try {",
  "    const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });",
  '    const script = new vm.Script(\'"use strict"; result = (function(policy, now) {\\n\' + String(msg.code) + \'\\n})(policy, now);\', { filename: "policy.js" });',
  '    script.runInContext(context, { timeout: Math.max(10, Number(msg.timeoutMs) || 75), microtaskMode: "afterEvaluate" });',
  '    parentPort.postMessage({ type: "result", id: msg.id, result: normalize(sandbox.result) });',
  "  } catch (error) {",
  '    parentPort.postMessage({ type: "error", id: msg.id, message: error && error.message ? String(error.message) : "Policy script execution failed" });',
  "  }",
  "});",
  'parentPort.postMessage({ type: "ready" });'
].join("\n");

type WorkerMessage = { type?: string; id?: number; result?: PolicyScriptEvaluation; message?: unknown };

const waitForMessage = (
  worker: Worker,
  matches: (message: WorkerMessage) => boolean,
  timeoutMs: number,
  timeoutMessage: string
): Promise<WorkerMessage> => new Promise((resolve, reject) => {
  const onMessage = (message: WorkerMessage) => {
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
    reject(new Error(`Policy sandbox exited (${code}) before completing`));
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

export class PolicyScriptRunner {
  private worker: Worker | undefined;
  private starting: Promise<Worker> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private sequence = 0;

  /**
   * Evaluates one policy script. Evaluations are serialised through a single
   * long-lived worker; a script that exceeds its budget kills the worker,
   * which is recreated lazily on the next call. Failures always deny.
   */
  evaluate(input: { code: string; policy: Record<string, unknown>; timeoutMs?: number }): Promise<PolicyScriptEvaluation> {
    const run = this.queue.then(() => this.evaluateExclusive(input));
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async dispose(): Promise<void> {
    await this.terminate();
  }

  private async evaluateExclusive(input: { code: string; policy: Record<string, unknown>; timeoutMs?: number }): Promise<PolicyScriptEvaluation> {
    if (input.code.length > MAX_SCRIPT_LENGTH) {
      return { allow: false, runtimeError: true, message: "Policy script exceeds the maximum length" };
    }

    let worker: Worker;
    try {
      worker = await this.getWorker();
    } catch (error) {
      return {
        allow: false,
        runtimeError: true,
        message: `Policy sandbox unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      };
    }

    const id = ++this.sequence;
    const response = waitForMessage(
      worker,
      (message) => (message?.type === "result" || message?.type === "error") && message.id === id,
      HOST_TIMEOUT_MS,
      `Policy script did not finish within ${HOST_TIMEOUT_MS}ms`
    );

    worker.postMessage({
      type: "evaluate",
      id,
      code: input.code,
      policy: input.policy,
      timeoutMs: input.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS
    });

    try {
      const message = await response;
      if (message.type === "error") {
        return {
          allow: false,
          runtimeError: true,
          message: typeof message.message === "string" ? message.message : "Policy script execution failed"
        };
      }
      const result = message.result;
      if (!result || typeof result.allow !== "boolean") {
        return { allow: false, runtimeError: true, message: "Policy script returned an invalid decision" };
      }
      return typeof result.message === "string" ? { allow: result.allow, message: result.message } : { allow: result.allow };
    } catch (error) {
      // A wedged or crashed worker is discarded; the next evaluation respawns it.
      await this.terminate(worker);
      return {
        allow: false,
        runtimeError: true,
        message: error instanceof Error ? error.message : "Policy script execution failed"
      };
    }
  }

  private getWorker(): Promise<Worker> {
    if (this.worker) {
      return Promise.resolve(this.worker);
    }
    if (!this.starting) {
      this.starting = this.spawn().finally(() => {
        this.starting = undefined;
      });
    }
    return this.starting;
  }

  private async spawn(): Promise<Worker> {
    const worker = new Worker(POLICY_WORKER_SOURCE, {
      eval: true,
      env: {},
      execArgv: ["--permission"],
      resourceLimits: {
        maxOldGenerationSizeMb: 32,
        maxYoungGenerationSizeMb: 8
      }
    });
    // Do not keep the process alive just because a sandbox is idle.
    worker.unref();

    worker.on("exit", () => {
      if (this.worker === worker) {
        this.worker = undefined;
      }
    });
    worker.on("error", () => {
      if (this.worker === worker) {
        this.worker = undefined;
      }
    });

    try {
      await waitForMessage(
        worker,
        (message) => message?.type === "ready",
        WORKER_READY_TIMEOUT_MS,
        `Policy sandbox did not become ready within ${WORKER_READY_TIMEOUT_MS}ms`
      );
    } catch (error) {
      await this.terminate(worker);
      throw error;
    }

    this.worker = worker;
    return worker;
  }

  private async terminate(target?: Worker): Promise<void> {
    const worker = target ?? this.worker;
    if (this.worker === worker) {
      this.worker = undefined;
    }
    if (!worker) {
      return;
    }
    try {
      await worker.terminate();
    } catch {
      // Worker may already have exited.
    }
  }
}
