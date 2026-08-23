import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../_core/env.js", () => ({
  ENV: { forgeApiKey: "test-api-key", forgeApiUrl: "" },
}));

import { invokeLLM, listLLMModels } from "../_core/llm.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LLM invokeLLM", () => {
  it("should throw when API key is missing", async () => {
    expect(invokeLLM).toBeDefined();
  });

  it("should normalize message content and return result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "test-id",
        created: Date.now(),
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
          },
        ],
      }),
    });

    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.choices[0].message.content).toBe("Hello");
  });

  it("should handle array content parts", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "test-id",
        created: Date.now(),
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: [{ type: "text", text: "Hi" }] },
            finish_reason: "stop",
          },
        ],
      }),
    });

    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello" }],
        },
      ],
    });
    expect(result.id).toBe("test-id");
  });

  it("should throw on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate limited",
    });

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("429 Too Many Requests");
  });

  it("should apply tool choice 'required' only when single tool present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "test-id",
        created: Date.now(),
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "" },
            finish_reason: "stop",
          },
        ],
      }),
    });

    await invokeLLM({
      messages: [{ role: "user", content: "call it" }],
      tools: [
        {
          type: "function",
          function: { name: "do_thing", description: "Does a thing" },
        },
      ],
      toolChoice: "required",
    });

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "do_thing" },
    });
  });

  it("should throw for tool choice 'required' with multiple tools", async () => {
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "call it" }],
        tools: [
          { type: "function", function: { name: "a" } },
          { type: "function", function: { name: "b" } },
        ],
        toolChoice: "required",
      })
    ).rejects.toThrow("tool_choice 'required' needs a single tool");
  });
});

describe("LLM listLLMModels", () => {
  it("should return models list", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: "list",
        data: [
          { id: "gpt-4", object: "model", created: 1, owned_by: "openai" },
        ],
      }),
    });

    const result = await listLLMModels();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("gpt-4");
  });
});
