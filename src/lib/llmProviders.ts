/**
 * Multi-provider LLM router (OpenAI-compatible chat completions).
 * Free tiers + open-source / self-hostable / OSS-friendly APIs.
 * Priority order — skip if no key/URL; failover on 429 / 5xx / auth failure.
 * Never ship template/guaranteed-green apps when zero providers are configured.
 */

export type LlmProviderId =
  | "groq"
  | "deepseek"
  | "gemini"
  | "openrouter"
  | "cerebras"
  | "mistral"
  | "together"
  | "fireworks"
  | "huggingface"
  | "ollama"
  | "openai_compat"
  | "forge"
  | "openai";

export type LlmProvider = {
  id: LlmProviderId;
  baseUrl: string;
  apiKey: string;
  /** Default chat model when caller does not pass one */
  defaultModel: string;
  /** Optional extra headers (e.g. OpenRouter referer) */
  headers?: Record<string, string>;
};

function truthy(v: string | undefined): string {
  return (v ?? "").trim();
}

function flagEnabled(v: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((v ?? "").trim().toLowerCase());
}

const GROQ_DEFAULT =
  truthy(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile";
const DEEPSEEK_DEFAULT =
  truthy(process.env.DEEPSEEK_MODEL) || "deepseek-chat";
const GEMINI_DEFAULT =
  truthy(process.env.GEMINI_MODEL) || "gemini-2.0-flash";
const OPENROUTER_FREE_DEFAULT =
  truthy(process.env.OPENROUTER_MODEL) ||
  "meta-llama/llama-3.3-70b-instruct:free";
const CEREBRAS_DEFAULT =
  truthy(process.env.CEREBRAS_MODEL) || "llama-3.3-70b";
const MISTRAL_DEFAULT =
  truthy(process.env.MISTRAL_MODEL) || "mistral-small-latest";
const TOGETHER_DEFAULT =
  truthy(process.env.TOGETHER_MODEL) ||
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
const FIREWORKS_DEFAULT =
  truthy(process.env.FIREWORKS_MODEL) ||
  "accounts/fireworks/models/llama-v3p3-70b-instruct";
const HF_DEFAULT =
  truthy(process.env.HF_MODEL) ||
  "Qwen/Qwen2.5-Coder-32B-Instruct";
const OLLAMA_DEFAULT =
  truthy(process.env.OLLAMA_MODEL) || "qwen2.5-coder";
const OPENAI_COMPAT_DEFAULT =
  truthy(process.env.OPENAI_COMPAT_MODEL) ||
  truthy(process.env.LLM_MODEL_DEFAULT) ||
  "local-model";

/**
 * Build the ordered provider list from env. Missing keys/URLs are skipped.
 * Never returns an empty list silently — callers must throw a clear error.
 *
 * Priority (skip if unset):
 * 1. Groq (free, fast coder)
 * 2. DeepSeek (strong code, open-weight lineage)
 * 3. Gemini free tier
 * 4. OpenRouter :free
 * 5. Cerebras
 * 6. Mistral
 * 7. Together / Fireworks (trial keys)
 * 8. Hugging Face Inference Providers
 * 9. Ollama (local / self-host)
 * 10. Generic OpenAI-compatible server (vLLM, LM Studio, LocalAI, OpenWebUI)
 * 11. Built-in Forge / OpenAI last
 */
export function listConfiguredLlmProviders(): LlmProvider[] {
  const providers: LlmProvider[] = [];

  const groq = truthy(process.env.GROQ_API_KEY);
  if (groq) {
    providers.push({
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      defaultModel: GROQ_DEFAULT,
    });
  }

  const deepseek = truthy(process.env.DEEPSEEK_API_KEY);
  if (deepseek) {
    providers.push({
      id: "deepseek",
      baseUrl:
        truthy(process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com/v1",
      apiKey: deepseek,
      defaultModel: DEEPSEEK_DEFAULT,
    });
  }

  const gemini =
    truthy(process.env.GEMINI_API_KEY) || truthy(process.env.GOOGLE_API_KEY);
  if (gemini) {
    providers.push({
      id: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      defaultModel: GEMINI_DEFAULT,
    });
  }

  const openrouter = truthy(process.env.OPENROUTER_API_KEY);
  if (openrouter) {
    const headers: Record<string, string> = {};
    const referer =
      truthy(process.env.OPENROUTER_HTTP_REFERER) || truthy(process.env.APP_URL);
    const title = truthy(process.env.OPENROUTER_APP_TITLE) || "AppForge";
    if (referer) headers["HTTP-Referer"] = referer;
    if (title) headers["X-Title"] = title;
    providers.push({
      id: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      defaultModel: OPENROUTER_FREE_DEFAULT,
      headers,
    });
  }

  const cerebras = truthy(process.env.CEREBRAS_API_KEY);
  if (cerebras) {
    providers.push({
      id: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKey: cerebras,
      defaultModel: CEREBRAS_DEFAULT,
    });
  }

  const mistral = truthy(process.env.MISTRAL_API_KEY);
  if (mistral) {
    providers.push({
      id: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      apiKey: mistral,
      defaultModel: MISTRAL_DEFAULT,
    });
  }

  const together = truthy(process.env.TOGETHER_API_KEY);
  if (together) {
    providers.push({
      id: "together",
      baseUrl: "https://api.together.xyz/v1",
      apiKey: together,
      defaultModel: TOGETHER_DEFAULT,
    });
  }

  const fireworks = truthy(process.env.FIREWORKS_API_KEY);
  if (fireworks) {
    providers.push({
      id: "fireworks",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      apiKey: fireworks,
      defaultModel: FIREWORKS_DEFAULT,
    });
  }

  const hf =
    truthy(process.env.HF_TOKEN) || truthy(process.env.HUGGINGFACE_API_KEY);
  if (hf) {
    providers.push({
      id: "huggingface",
      baseUrl:
        truthy(process.env.HF_BASE_URL) ||
        "https://router.huggingface.co/v1",
      apiKey: hf,
      defaultModel: HF_DEFAULT,
    });
  }

  // Ollama: enable when URL/key/flag set (do not always hit localhost on Fly).
  const ollamaUrl = truthy(process.env.OLLAMA_BASE_URL);
  const ollamaKey = truthy(process.env.OLLAMA_API_KEY);
  const ollamaOn = flagEnabled(process.env.OLLAMA_ENABLED) || !!ollamaUrl || !!ollamaKey;
  if (ollamaOn) {
    providers.push({
      id: "ollama",
      baseUrl:
        ollamaUrl ||
        // Docker Desktop / Compose often need host.docker.internal
        truthy(process.env.OLLAMA_DOCKER_URL) ||
        "http://127.0.0.1:11434/v1",
      // Ollama ignores auth locally; send a placeholder Bearer if none set.
      apiKey: ollamaKey || "ollama",
      defaultModel: OLLAMA_DEFAULT,
    });
  }

  // Generic OpenAI-compatible server (vLLM, LM Studio, LocalAI, OpenWebUI, etc.)
  const compatUrl = truthy(process.env.OPENAI_COMPAT_BASE_URL);
  const compatKey = truthy(process.env.OPENAI_COMPAT_API_KEY);
  if (compatUrl) {
    providers.push({
      id: "openai_compat",
      baseUrl: compatUrl,
      apiKey: compatKey || "local",
      defaultModel: OPENAI_COMPAT_DEFAULT,
    });
  }

  const forgeKey =
    truthy(process.env.BUILT_IN_FORGE_API_KEY) ||
    truthy(process.env.FORGE_API_KEY);
  const forgeUrl = truthy(process.env.BUILT_IN_FORGE_API_URL);
  if (forgeKey) {
    providers.push({
      id: "forge",
      baseUrl: forgeUrl || "https://forge.manus.im/v1",
      apiKey: forgeKey,
      defaultModel: truthy(process.env.LLM_MODEL_DEFAULT) || "gpt-4o-mini",
    });
  }

  const openai = truthy(process.env.OPENAI_API_KEY);
  if (openai) {
    providers.push({
      id: "openai",
      baseUrl: truthy(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
      apiKey: openai,
      defaultModel:
        truthy(process.env.OPENAI_MODEL) ||
        truthy(process.env.LLM_MODEL_DEFAULT) ||
        "gpt-4o-mini",
    });
  }

  return providers;
}

const PROVIDER_HINT =
  "GROQ_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY (or GOOGLE_API_KEY), OPENROUTER_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY, HF_TOKEN, OLLAMA_BASE_URL / OLLAMA_ENABLED, OPENAI_COMPAT_BASE_URL, BUILT_IN_FORGE_API_KEY, or OPENAI_API_KEY";

export function assertAnyLlmProviderConfigured(): LlmProvider[] {
  const providers = listConfiguredLlmProviders();
  if (providers.length === 0) {
    throw new Error(
      `No LLM providers configured. Set at least one of: ${PROVIDER_HINT}. Template/guaranteed-green apps will not be shipped as a substitute.`,
    );
  }
  return providers;
}

/** Join base + /chat/completions without duplicating path segments. */
export function chatCompletionsUrl(baseUrl: string): string {
  const raw = (baseUrl || "").trim().replace(/\/$/, "");
  if (!raw) return "https://api.openai.com/v1/chat/completions";
  if (/\/v1\/chat\/completions$/i.test(raw)) return raw;
  if (/\/chat\/completions$/i.test(raw)) return raw;
  if (/\/v1$/i.test(raw)) return `${raw}/chat/completions`;
  if (/\/openai$/i.test(raw)) return `${raw}/chat/completions`;
  if (/\/inference\/v1$/i.test(raw)) return `${raw}/chat/completions`;
  return `${raw}/v1/chat/completions`;
}

export function modelsUrl(baseUrl: string): string {
  const raw = (baseUrl || "").trim().replace(/\/$/, "");
  if (!raw) return "https://api.openai.com/v1/models";
  if (/\/v1\/models$/i.test(raw)) return raw;
  if (/\/models$/i.test(raw)) return raw;
  if (/\/v1$/i.test(raw)) return `${raw}/models`;
  if (/\/openai$/i.test(raw)) return `${raw}/models`;
  if (/\/inference\/v1$/i.test(raw)) return `${raw}/models`;
  return `${raw}/v1/models`;
}

/** Status codes that should trigger failover to the next provider. */
export function shouldFailoverStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

/**
 * Default model for the first configured free/priority provider.
 * Used by llmModels.ts when LLM_MODEL_* is unset.
 */
export function defaultModelFromProviders(): string {
  const providers = listConfiguredLlmProviders();
  if (providers[0]) return providers[0].defaultModel;
  return truthy(process.env.LLM_MODEL_DEFAULT) || "llama-3.3-70b-versatile";
}
