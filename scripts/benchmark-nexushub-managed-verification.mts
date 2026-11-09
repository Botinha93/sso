import os from "node:os";
import { performance } from "node:perf_hooks";
import { makeSecretVerifier, verifySecret } from "../src/security/managed-profile-secret.js";

// Synthetic-only microbenchmark. It deliberately avoids DB, HTTP, and all
// credentials/configuration from the local environment.
const configuredIterations = Number(process.env.NEXUSHUB_BENCH_ITERATIONS ?? 10);
if (!Number.isInteger(configuredIterations) || configuredIterations < 1 || configuredIterations > 50) {
  throw new Error("NEXUSHUB_BENCH_ITERATIONS must be an integer from 1 to 50");
}
const WARMUP = 2;
const activeSecret = "synthetic-active-secret-for-local-benchmark";
const pendingSecret = "synthetic-pending-secret-for-local-benchmark";
const wrongSecret = "synthetic-wrong-secret-for-local-benchmark";
const active = await makeSecretVerifier(activeSecret);
const pending = await makeSecretVerifier(pendingSecret);

const scenarios = [
  {
    name: "active_match",
    description: "active verifier matches; pending state is irrelevant",
    check: () => verifySecret(activeSecret, active.salt, active.verifier)
  },
  {
    name: "pending_match",
    description: "active verifier misses, live pending verifier matches (two scrypt derivations)",
    check: async () => {
      if (await verifySecret(pendingSecret, active.salt, active.verifier)) return true;
      return verifySecret(pendingSecret, pending.salt, pending.verifier);
    }
  },
  {
    name: "expired_pending_reject",
    description: "active verifier misses; expired pending state is rejected before pending scrypt",
    check: async () => {
      const expiresAt = Date.now() - 1;
      if (await verifySecret(pendingSecret, active.salt, active.verifier)) return true;
      if (expiresAt <= Date.now()) return false;
      return verifySecret(pendingSecret, pending.salt, pending.verifier);
    }
  }
];

const percentile = (sorted: number[], fraction: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
const results = [];
for (const scenario of scenarios) {
  for (let i = 0; i < WARMUP; i++) await scenario.check();
  const samples: number[] = [];
  for (let i = 0; i < configuredIterations; i++) {
    const started = performance.now();
    const accepted = await scenario.check();
    samples.push(performance.now() - started);
    const expected = scenario.name !== "expired_pending_reject";
    if (accepted !== expected) throw new Error(`scenario correctness check failed: ${scenario.name}`);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const meanMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  results.push({ name: scenario.name, description: scenario.description, iterations: configuredIterations,
    meanMs: Number(meanMs.toFixed(2)), p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(2)), throughputPerSecond: Number((1000 / meanMs).toFixed(2)) });
}

console.log(JSON.stringify({ benchmark: "nexushub-managed-profile-verifier", mode: "sequential-local-microbenchmark",
  runtime: process.version, platform: `${process.platform}/${process.arch}`, cpu: os.cpus()[0]?.model ?? "unknown",
  scrypt: { N: 1 << 15, r: 8, p: 1, keyLength: 32, maxmemMiB: 64 }, warmupPerScenario: WARMUP,
  iterationsPerScenario: configuredIterations, results }, null, 2));
