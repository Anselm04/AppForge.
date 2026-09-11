/**
 * Never-give-up agentic build loop configuration + quality gate.
 *
 * Customer builds keep iterating with real LLMs until validation + quality
 * pass. Hard "failed" is only for abort/cancel, credits pause (non-owner),
 * or missing AI provider keys (infra). Never treat template/guaranteed-green
 * as customer success.
 */

import {
  listConfiguredLlmProviders,
  type LlmProvider,
} from "./llmProviders.js";
import { isGoldenStack } from "./reliableBuild.js";
import type { AppRecipe } from "./appRecipes.js";

function flag(v: string | undefined, defaultOn: boolean): boolean {
  const raw = (v ?? "").trim().toLowerCase();
  if (!raw) return defaultOn;
  return ["1", "true", "yes", "on"].includes(raw);
}

function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Default true — keep building until real validation + quality pass. */
export function isNeverGiveUpEnabled(): boolean {
  return flag(process.env.BUILD_NEVER_GIVE_UP, true);
}

/**
 * Inner surgical fix attempts per plan/code cycle.
 * BUILD_MAX_FIX_RETRIES is a bounded repair burst. Default 3 so a stuck
 * implementation returns to design quickly instead of repeating the same fix.
 * Set BUILD_MAX_FIX_RETRIES=0 only to disable surgical retries for a cycle.
 */
export function resolveMaxFixRetries(techStack: string): number {
  const envRaw = (process.env.BUILD_MAX_FIX_RETRIES ?? "").trim();
  if (envRaw !== "") {
    const n = parseInt(envRaw, 10);
    if (Number.isFinite(n) && n >= 0) {
      return n;
    }
  }
  if (isNeverGiveUpEnabled()) return 3;
  return isGoldenStack(techStack) || techStack.includes("react") ? 3 : 2;
}

/**
 * Outer re-plan / provider-switch cycles.
 * Default very high when never-give-up; soft ceiling avoids infinite hung jobs
 * if every provider is dead (still not a "could not build" customer fail —
 * pipeline emits infra pause instead when providers are exhausted of keys).
 */
export function resolveMaxOuterAttempts(): number {
  const envRaw = (process.env.BUILD_MAX_OUTER_ATTEMPTS ?? "").trim();
  if (envRaw !== "") {
    const n = parseInt(envRaw, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return isNeverGiveUpEnabled() ? 100 : 1;
}

/** Background worker abort timeout — long enough for never-give-up loops. */
export function resolveBuildTimeoutMs(): number {
  const envRaw = (process.env.BUILD_SSE_TIMEOUT_MS ?? "").trim();
  if (envRaw !== "") {
    const n = parseInt(envRaw, 10);
    if (Number.isFinite(n) && n > 0) return n;
    // 0 = disabled
    if (n === 0) return 0;
  }
  // 4h never-give-up default; legacy 20m when disabled
  return isNeverGiveUpEnabled() ? 14_400_000 : 1_200_000;
}

export function configuredProviders(): LlmProvider[] {
  return listConfiguredLlmProviders();
}

export function providerAt(index: number): LlmProvider | undefined {
  const list = configuredProviders();
  if (list.length === 0) return undefined;
  return list[((index % list.length) + list.length) % list.length];
}

/**
 * Prefer stronger coder models as outer attempts escalate.
 * Attempt 0: LLM_MODEL_CODER / provider default.
 * Later: LLM_MODEL_CODER_STRONG if set, else rotate provider defaultModel.
 */
export function coderModelForAttempt(
  attempt: number,
  provider: LlmProvider | undefined,
): string | undefined {
  const strong = (process.env.LLM_MODEL_CODER_STRONG ?? "").trim();
  const coder = (process.env.LLM_MODEL_CODER ?? "").trim();
  if (attempt <= 1) {
    return coder || provider?.defaultModel || undefined;
  }
  if (strong) return strong;
  return provider?.defaultModel || coder || undefined;
}

export function plannerModelForAttempt(
  attempt: number,
  provider: LlmProvider | undefined,
): string | undefined {
  const planner = (process.env.LLM_MODEL_PLANNER ?? "").trim();
  if (attempt <= 1) return planner || provider?.defaultModel || undefined;
  return provider?.defaultModel || planner || undefined;
}

/** Rotate providers array so preferred index is tried first by invokeLLM. */
export function rotateProviders<T>(list: T[], startIndex: number): T[] {
  if (list.length === 0) return list;
  const i = ((startIndex % list.length) + list.length) % list.length;
  return [...list.slice(i), ...list.slice(0, i)];
}

export type BuildFailureDossierInput = {
  outerAttempt: number;
  techStack: string;
  stage?: string | null;
  errors?: string[];
  previousTasks?: Array<{ id?: string; module?: string; description?: string }>;
  provider?: string;
  model?: string;
};

/**
 * Compact evidence artifact passed back to the Planner when a repair burst
 * cannot get green. This prevents blind repetition of the same architecture.
 */
export function buildFailureDossier(input: BuildFailureDossierInput): string {
  const errors = (input.errors ?? []).slice(0, 12);
  const tasks = (input.previousTasks ?? []).slice(0, 8);
  return [
    `REDESIGN REQUIRED AFTER FAILED BUILD CYCLE ${input.outerAttempt}.`,
    `Stack: ${input.techStack}.`,
    input.stage
      ? `Last failing gate: ${input.stage}.`
      : `Last failing gate: unknown.`,
    input.provider ? `Provider: ${input.provider}.` : `Provider: unknown.`,
    input.model ? `Model: ${input.model}.` : `Model: unknown.`,
    `Previous plan tasks: ${tasks.length ? tasks.map((t, i) => `${i + 1}. ${t.module ?? "task"}: ${t.description ?? ""}`).join(" | ") : "none recorded"}.`,
    `Observed failures: ${errors.length ? errors.join(" | ") : "no detailed errors captured"}.`,
    `Do NOT simply return the same task breakdown. Redesign the architecture or implementation strategy where the evidence indicates the prior design was fragile. Preserve the user goal and acceptance criteria, but materially change the failed approach.`,
  ].join("\n");
}

const STUB_PATTERNS = [
  /your app is ready/i,
  /reliability-first scaffold/i,
  /replace this screen with your product ui/i,
  /coming soon/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /lorem ipsum/i,
  /placeholder component/i,
  /stub implementation/i,
  /not implemented/i,
];

/**
 * Quality bar: "passed" must mean a real working product UI, not a thin stub
 * or reliability scaffold. Soft-miss → keep looping with real AI (do not ship
 * recipe/template as success).
 */
export function assertProductQuality(
  files: Record<string, string>,
  opts: {
    description: string;
    recipe?: AppRecipe;
    title?: string;
  },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const appPath =
    [
      "src/App.tsx",
      "src/App.jsx",
      "App.tsx",
      "app/page.tsx",
      "pages/index.tsx",
    ].find((p) => files[p]) ?? null;
  const app = appPath ? files[appPath] : "";

  if (!app || app.trim().length < 400) {
    errors.push(
      `Product quality: App UI too thin (${app.trim().length} chars) — need a real interactive product, not a stub.`,
    );
  }

  for (const pat of STUB_PATTERNS) {
    if (pat.test(app)) {
      errors.push(
        `Product quality: stub/scaffold text detected (${pat.source}) — regenerate a real product UI.`,
      );
      break;
    }
  }

  // Interactive surface signals (inputs, buttons, state, lists)
  const interactive =
    /\buseState\b|\bonClick\b|\bonSubmit\b|\bonChange\b|<button\b|<input\b|<form\b|<textarea\b|\.map\s*\(/i.test(
      app,
    );
  if (app && !interactive) {
    errors.push(
      "Product quality: App lacks interactive UI (state, inputs, or actions) — keep building a working product.",
    );
  }

  // Title / description must appear somehow (branded product, not generic shell)
  const title = (opts.title ?? "").trim();
  const blob = Object.entries(files)
    .filter(([p]) => /\.(tsx?|jsx?|html|md)$/.test(p))
    .map(([, c]) => c)
    .join("\n");
  if (
    title.length >= 3 &&
    !blob
      .toLowerCase()
      .includes(title.toLowerCase().slice(0, Math.min(24, title.length)))
  ) {
    errors.push(
      `Product quality: generated UI does not mention app title "${title.slice(0, 40)}" — product feels generic.`,
    );
  }

  if (opts.recipe && opts.recipe.specKeywords.length > 0) {
    const lower = blob.toLowerCase();
    const missing = opts.recipe.specKeywords.filter(
      (k) => !lower.includes(k.toLowerCase()),
    );
    // Stricter than soft half-miss: allow at most one missing keyword
    const maxMissing = opts.recipe.specKeywords.length <= 2 ? 0 : 1;
    if (missing.length > maxMissing) {
      errors.push(
        `Product quality: recipe "${opts.recipe.id}" missing features: ${missing.join(", ")}.`,
      );
    }
  }

  // Reject pure reliability scaffold package with almost no src files of substance
  const srcFiles = Object.keys(files).filter(
    (p) => p.startsWith("src/") && /\.(tsx?|jsx?)$/.test(p),
  );
  const substantialSrc = srcFiles.filter(
    (p) => (files[p] ?? "").trim().length >= 200,
  );
  if (substantialSrc.length < 1) {
    errors.push(
      "Product quality: no substantial source files — keep iterating with the coder.",
    );
  }

  return { ok: errors.length === 0, errors };
}

export function missingLlmKeysMessage(): string {
  return (
    "No LLM providers configured. Owner must add at least one AI key " +
    "(GROQ_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, " +
    "OPENAI_API_KEY, or another supported provider). Builds cannot run without AI."
  );
}

export function isMissingLlmKeysError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /no llm providers configured/i.test(msg) || /no llm api key/i.test(msg)
  );
}

export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /aborted|AbortError|build cancelled/i.test(msg);
}

/** Env knobs documented for operators. */
export const NEVER_GIVE_UP_ENV = {
  BUILD_NEVER_GIVE_UP: "true",
  BUILD_MAX_FIX_RETRIES: "3",
  BUILD_MAX_OUTER_ATTEMPTS: "100",
  BUILD_SSE_TIMEOUT_MS: "14400000",
  LLM_MODEL_CODER_STRONG: "(optional stronger coder model on escalate)",
} as const;
