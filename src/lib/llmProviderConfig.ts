export type LlmProviderEnv = Record<string, string | undefined>;

function value(env: LlmProviderEnv, key: string): string {
  return (env[key] ?? "").trim();
}

function enabled(env: LlmProviderEnv, key: string): boolean {
  return ["1", "true", "yes", "on"].includes(value(env, key).toLowerCase());
}

/**
 * Canonical production-readiness rule for the AI provider layer.
 *
 * Keep this aligned with listConfiguredLlmProviders(). The runtime provider
 * registry remains responsible for constructing providers; environment gates
 * call this helper so they do not incorrectly require one legacy provider.
 */
export function hasConfiguredLlmProvider(env: LlmProviderEnv = process.env): boolean {
  return Boolean(
    value(env, "GROQ_API_KEY") ||
      value(env, "DEEPSEEK_API_KEY") ||
      value(env, "GEMINI_API_KEY") ||
      value(env, "GOOGLE_API_KEY") ||
      value(env, "OPENROUTER_API_KEY") ||
      value(env, "CEREBRAS_API_KEY") ||
      value(env, "MISTRAL_API_KEY") ||
      value(env, "TOGETHER_API_KEY") ||
      value(env, "FIREWORKS_API_KEY") ||
      value(env, "HF_TOKEN") ||
      value(env, "HUGGINGFACE_API_KEY") ||
      value(env, "OLLAMA_BASE_URL") ||
      value(env, "OLLAMA_API_KEY") ||
      enabled(env, "OLLAMA_ENABLED") ||
      value(env, "OPENAI_COMPAT_BASE_URL") ||
      value(env, "BUILT_IN_FORGE_API_KEY") ||
      value(env, "FORGE_API_KEY") ||
      value(env, "OPENAI_API_KEY")
  );
}

export const LLM_PROVIDER_ENV_HINT =
  "GROQ_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY, OPENROUTER_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY, HF_TOKEN/HUGGINGFACE_API_KEY, OLLAMA_BASE_URL/OLLAMA_ENABLED, OPENAI_COMPAT_BASE_URL, BUILT_IN_FORGE_API_KEY/FORGE_API_KEY, or OPENAI_API_KEY";
