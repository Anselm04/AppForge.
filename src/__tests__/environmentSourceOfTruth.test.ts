import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasConfiguredLlmProvider } from "../lib/llmProviderConfig.js";

const schema = JSON.parse(readFileSync(".env.schema.json", "utf8"));
const example = readFileSync(".env.example", "utf8");

describe("environment source-of-truth contracts", () => {
  it("keeps the schema timeout aligned with the runtime production validator", () => {
    expect(schema.properties.REQUEST_TIMEOUT_MS.minimum).toBe(5000);
    expect(schema.properties.REQUEST_TIMEOUT_MS.maximum).toBe(360000);
  });

  it("does not advertise providers the runtime readiness rule cannot use", () => {
    expect(example).not.toContain("ANTHROPIC_API_KEY=");
  });

  it.each([
    "GROQ_API_KEY",
    "DEEPSEEK_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CEREBRAS_API_KEY",
    "MISTRAL_API_KEY",
    "TOGETHER_API_KEY",
    "FIREWORKS_API_KEY",
    "HF_TOKEN",
    "OPENAI_API_KEY",
  ])("documents supported provider %s", (key) => {
    expect(example).toContain(`${key}=`);
    expect(schema.properties[key]).toBeTruthy();
    expect(hasConfiguredLlmProvider({ [key]: "configured" })).toBe(true);
  });

  it("recognizes keyless/self-hosted provider configuration", () => {
    expect(
      hasConfiguredLlmProvider({ OPENAI_COMPAT_BASE_URL: "https://llm.example.com/v1" }),
    ).toBe(true);
    expect(hasConfiguredLlmProvider({ OLLAMA_ENABLED: "true" })).toBe(true);
  });
});
