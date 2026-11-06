#!/usr/bin/env node
// Offline commercial qualification: no network calls to Stripe, Twilio,
// billable model providers, deployment APIs or app stores are required.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
if (!existsSync(vitest)) {
  process.stderr.write(
    "Local dependencies are missing. Install from the lockfile using your existing approved package cache before running this offline suite.\n",
  );
  process.exit(2);
}

const tests = [
  "src/__tests__/appForgePricingGuard.test.ts",
  "src/__tests__/appForgeCommercialCutover.test.ts",
  "src/__tests__/appForgeTopUpEligibility.test.ts",
  "src/__tests__/monthlyCreditRollover.test.ts",
  "src/__tests__/appForgeTierCostLimits.test.ts",
  "src/__tests__/customerComputeLaunchGate.test.ts",
  "src/__tests__/providerCostPolicy.test.ts",
  "src/__tests__/buildProviderUsage.test.ts",
  "src/__tests__/legacyBuilderHonesty.test.ts",
];

const env = { ...process.env, NODE_ENV: "test" };
for (const name of Object.keys(env)) {
  if (/^(STRIPE_SECRET_KEY|TWILIO_|OPENAI_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|FLY_API_TOKEN|VERCEL_TOKEN)/.test(name)) {
    delete env[name];
  }
}

const assembly = spawnSync(
  process.execPath,
  ["scripts/assemble-pipeline.mjs"],
  { cwd: root, stdio: "inherit", env },
);
if (assembly.status !== 0) process.exit(assembly.status ?? 1);

const run = spawnSync(
  process.execPath,
  [vitest, "run", "--maxWorkers=2", "--minWorkers=1", ...tests],
  { cwd: root, stdio: "inherit", env },
);
process.exit(run.status ?? 1);
