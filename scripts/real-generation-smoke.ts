import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { invokeLLM } from "../src/_core/llm.js";
import { listConfiguredLlmProviders } from "../src/lib/llmProviders.js";

/**
 * User-invoked live provider + source-validation smoke; never runs in CI.
 * Requires an already configured runtime secret and an explicit opt-in.
 * No customer database, balances, Stripe, deployment, or real projects touched.
 */
const confirm = "YES_I_AUTHORIZE_ONE_TEST_WITH_POSSIBLE_RETRIES";
if (process.env.APPFORGE_REAL_GENERATION_SMOKE_CONFIRM !== confirm) {
  throw new Error(
    "Live generation test refused. Set APPFORGE_REAL_GENERATION_SMOKE_CONFIRM=" +
      confirm +
      " only when you intend to call your configured provider (retries/failover may cost money).",
  );
}
if (process.env.NODE_ENV === "production" || process.env.CI) {
  throw new Error("Real generation smoke is local-only; production/CI execution refused.");
}
const providers = listConfiguredLlmProviders();
if (providers.length === 0) {
  throw new Error(
    "No model provider configured in the local runtime environment. " +
      "The smoke test did not call an external service.",
  );
}
const chosen = providers[0];
const request = [
  "Create an original minimum RUNNABLE Flutter client and Node.js TypeScript backend.",
  "Return only valid JSON with a files object.",
  'Required keys: "lib/main.dart" and "server/src/server.ts".',
  "Flutter main.dart must define main() with a MaterialApp and a screen.",
  "Node TypeScript server must export a createServer function implementing GET /health/live.",
  "No pseudocode, ellipses, TODO, placeholders, secrets, API calls, or extra files.",
].join("\n");
console.log(`Provider smoke started (provider=${chosen.id}; one request with retry policy). No customer credits will be charged.`);
const result = await invokeLLM({
  preferredProviderId: chosen.id,
  messages: [{ role: "user", content: request }],
  responseFormat: { type: "json_object" },
  maxTokens: 2500,
});
const response = result.choices?.[0]?.message?.content;
if (typeof response !== "string") {
  throw new Error("Generation response did not contain a text JSON object");
}
let files: Record<string, unknown>;
try {
  const parsed = JSON.parse(response) as { files?: Record<string, unknown> };
  files = parsed.files ?? {};
} catch {
  throw new Error("Generation response did not contain valid JSON");
}
const expected = ["lib/main.dart", "server/src/server.ts"] as const;
for (const path of expected) {
  const source = files[path];
  if (typeof source !== "string" || source.length < 60) {
    throw new Error(`Generated product missing substantive file: ${path}`);
  }
  if (/\bTODO\b|\bplaceholder\b|\.\.\./i.test(source)) {
    throw new Error(`Generated product contains incomplete source: ${path}`);
  }
}
if (!/void\s+main\s*\(/.test(files["lib/main.dart"] as string)) {
  throw new Error("Generated Flutter entrypoint is missing main()");
}
const backend = files["server/src/server.ts"] as string;
if (!/createServer/.test(backend) || !/\/health\/live/.test(backend)) {
  throw new Error("Generated Node backend is missing runnable liveness route");
}
const transpile = ts.transpileModule(backend, {
  fileName: "server.ts",
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  },
  reportDiagnostics: true,
});
if (transpile.diagnostics?.some((item) => item.category === ts.DiagnosticCategory.Error)) {
  throw new Error("Generated Node source failed TypeScript syntax validation");
}
const root = await mkdtemp(join(tmpdir(), "appforge-provider-smoke-"));
for (const path of expected) {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, files[path] as string, "utf8");
}
console.log(`Provider responded and mandatory source was saved to ${root}`);
console.log("Scope: REAL provider response and basic syntax check; NOT a full product build, Flutter compile, paid-customer charge, or deployment qualification.");
