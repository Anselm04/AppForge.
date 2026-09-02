import { describe, expect, it } from "vitest";
import {
  resolveForgeChatCompletionsUrl,
  resolveForgeModelsUrl,
} from "../_core/llm.js";

describe("resolveForgeChatCompletionsUrl", () => {
  it("does not double /v1 when base already ends with /v1", () => {
    expect(resolveForgeChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });
  it("keeps a full chat completions URL", () => {
    expect(
      resolveForgeChatCompletionsUrl(
        "https://api.openai.com/v1/chat/completions",
      ),
    ).toBe("https://api.openai.com/v1/chat/completions");
  });
  it("appends /v1/chat/completions to a host-only base", () => {
    expect(resolveForgeChatCompletionsUrl("https://forge.example")).toBe(
      "https://forge.example/v1/chat/completions",
    );
  });
});

describe("resolveForgeModelsUrl", () => {
  it("does not double /v1 when base already ends with /v1", () => {
    expect(resolveForgeModelsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/models",
    );
  });
});
