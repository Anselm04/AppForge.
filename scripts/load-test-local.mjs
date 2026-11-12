#!/usr/bin/env node
// Local HTTP capacity baseline. Never executes builds, spends AI credits,
// provisions infrastructure, or requests remote endpoints.
import { performance } from "node:perf_hooks";

const MAX_REQUESTS = 10000;
const MAX_CONCURRENCY = 128;
const allowedPaths = new Set(["/api/health/live", "/api/health/ready"]);

function numberEnv(name, fallback, maximum) {
  const raw = process.env[name] ?? String(fallback);
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} exceeds safe local maximum ${maximum}`);
  }
  return value;
}

export function safeLoadTarget(value) {
  const target = new URL(value);
  if (target.protocol !== "http:") {
    throw new Error("Local load tests only support non-TLS HTTP loopback.");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    throw new Error("Refusing remote load testing. Use a local loopback host.");
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error("No credentials, query strings or fragments allowed.");
  }
  if (!allowedPaths.has(target.pathname)) {
    throw new Error("Only read-only AppForge health endpoints are permitted.");
  }
  return target.toString();
}

export function percentile(sorted, rank) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(rank * sorted.length) - 1),
  )];
}

export async function runLocalHttpLoad({
  target,
  requests,
  concurrency,
  timeoutMs,
}) {
  const url = safeLoadTarget(target);
  let next = 0;
  let successes = 0;
  let failures = 0;
  let timeouts = 0;
  const statusCodes = {};
  const latencies = [];
  const started = performance.now();

  async function consumer() {
    for (;;) {
      const index = next++;
      if (index >= requests) return;
      const requestStart = performance.now();
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
          redirect: "manual",
        });
        statusCodes[response.status] = (statusCodes[response.status] ?? 0) + 1;
        if (response.status === 200) {
          successes++;
        } else {
          failures++;
        }
        await response.arrayBuffer();
      } catch (error) {
        failures++;
        if (error?.name === "TimeoutError") timeouts++;
      } finally {
        latencies.push(performance.now() - requestStart);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => consumer()));
  latencies.sort((a, b) => a - b);
  const elapsedMs = performance.now() - started;
  return {
    target: url,
    requests,
    concurrency,
    successes,
    failures,
    timeouts,
    statusCodes,
    elapsedMs: Math.round(elapsedMs),
    requestsPerSecond: Number((requests / (elapsedMs / 1000)).toFixed(2)),
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: percentile(latencies, 1),
    },
    passed: failures === 0 && successes === requests,
  };
}

async function main() {
  const result = await runLocalHttpLoad({
    target: process.env.LOAD_TARGET ??
      "http://127.0.0.1:3000/api/health/live",
    requests: numberEnv("LOAD_REQUESTS", 200, MAX_REQUESTS),
    concurrency: numberEnv("LOAD_CONCURRENCY", 10, MAX_CONCURRENCY),
    timeoutMs: numberEnv("LOAD_TIMEOUT_MS", 5000, 30000),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
