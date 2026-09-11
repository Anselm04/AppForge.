import { ENV } from "./env.js";
import {
  assertAnyLlmProviderConfigured,
  chatCompletionsUrl,
  listConfiguredLlmProviders,
  modelsUrl,
  shouldFailoverStatus,
  type LlmProvider,
} from "../lib/llmProviders.js";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
  /** Prefer this provider id first (failover still tries the rest). */
  preferredProviderId?: string;
  /** Rotate provider list so this index is tried first (never-give-up escalate). */
  startProviderIndex?: number;
  /** Abort in-flight provider requests and retry backoff when the caller cancels. */
  signal?: AbortSignal;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[],
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent,
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured",
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly",
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

/** Join OpenAI-compatible chat URL. Bases that already end in /v1 must not get another /v1. */
export function resolveForgeChatCompletionsUrl(forgeApiUrl: string): string {
  const raw = (forgeApiUrl || "").trim();
  if (!raw) return "https://forge.manus.im/v1/chat/completions";
  const base = raw.replace(/\/$/, "");
  if (/\/v1\/chat\/completions$/i.test(base)) return base;
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export function resolveForgeModelsUrl(forgeApiUrl: string): string {
  const raw = (forgeApiUrl || "").trim();
  if (!raw) return "https://forge.manus.im/v1/models";
  const base = raw.replace(/\/$/, "");
  if (/\/v1\/models$/i.test(base)) return base;
  if (/\/models$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/models`;
  return `${base}/v1/models`;
}

const resolveApiUrl = () => resolveForgeChatCompletionsUrl(ENV.forgeApiUrl);

/** @deprecated Prefer provider.defaultModel from llmProviders */
const DEFAULT_CHAT_MODEL =
  (process.env.LLM_MODEL_DEFAULT ?? "").trim() || "gpt-4o-mini";

const assertApiKey = () => {
  // Multi-provider: any configured key is enough. Throws clear error if zero.
  assertAnyLlmProviderConfigured();
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object",
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const abortError = () => {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number,
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

const fetchWithBackoff = async (
  url: string,
  init: FetchInit,
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    if (init.signal?.aborted) throw abortError();
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`,
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs), init.signal ?? undefined);
    } catch (error) {
      lastError = error;
      if (init.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw error;
      }
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`,
      );
      await sleep(computeBackoffDelay(attempt), init.signal ?? undefined);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

function orderProviders(
  providers: LlmProvider[],
  preferredProviderId?: string,
  startProviderIndex?: number,
): LlmProvider[] {
  if (providers.length === 0) return providers;
  let list = [...providers];
  if (typeof startProviderIndex === "number" && startProviderIndex > 0) {
    const i = ((startProviderIndex % list.length) + list.length) % list.length;
    list = [...list.slice(i), ...list.slice(0, i)];
  }
  if (preferredProviderId) {
    const idx = list.findIndex((p) => p.id === preferredProviderId);
    if (idx > 0) {
      const [hit] = list.splice(idx, 1);
      list.unshift(hit);
    }
  }
  return list;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const providers = orderProviders(
    assertAnyLlmProviderConfigured(),
    params.preferredProviderId,
    params.startProviderIndex,
  );

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    signal,
  } = params;

  const basePayload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    basePayload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools,
  );
  if (normalizedToolChoice) {
    basePayload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    basePayload.max_tokens = resolvedMaxTokens;
  }

  if (thinking) {
    basePayload.thinking = thinking;
  }
  if (reasoning) {
    basePayload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    basePayload.response_format = normalizedResponseFormat;
  }

  const explicitModel = (model && model.trim()) || "";
  const errors: string[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const payload = {
      ...basePayload,
      model: explicitModel || provider.defaultModel || DEFAULT_CHAT_MODEL,
    };
    const url = chatCompletionsUrl(provider.baseUrl);
    try {
      const response = await fetchWithBackoff(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${provider.apiKey}`,
          ...(provider.headers ?? {}),
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (response.ok) {
        if (i > 0) {
          console.warn(`LLM failover succeeded with provider=${provider.id}`);
        }
        return (await response.json()) as InvokeResult;
      }

      const errorText = await response.text();
      const detail = `${provider.id} ${response.status} ${response.statusText} – ${errorText.slice(0, 400)}`;
      errors.push(detail);

      if (shouldFailoverStatus(response.status) && i < providers.length - 1) {
        console.warn(
          `LLM provider ${provider.id} failed (${response.status}); trying next`,
        );
        continue;
      }

      throw new Error(`LLM invoke failed: ${detail}`);
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("LLM invoke failed:")) throw err;
      errors.push(`${provider.id} network: ${msg}`);
      if (i < providers.length - 1) {
        console.warn(`LLM provider ${provider.id} network error; trying next`);
        continue;
      }
      throw new Error(
        `LLM invoke failed after all providers: ${errors.join(" | ")}`,
      );
    }
  }

  throw new Error(
    `LLM invoke failed after all providers: ${errors.join(" | ") || "unknown"}`,
  );
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  const providers = assertAnyLlmProviderConfigured();
  const errors: string[] = [];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const url = modelsUrl(provider.baseUrl);
    try {
      const response = await fetchWithBackoff(url, {
        headers: {
          authorization: `Bearer ${provider.apiKey}`,
          ...(provider.headers ?? {}),
        },
      });
      if (response.ok) {
        return (await response.json()) as ModelsResponse;
      }
      const errorText = await response.text();
      errors.push(
        `${provider.id} ${response.status}: ${errorText.slice(0, 200)}`,
      );
      if (shouldFailoverStatus(response.status) && i < providers.length - 1) {
        continue;
      }
      throw new Error(
        `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("List LLM models failed:")) throw err;
      errors.push(`${provider.id}: ${msg}`);
      if (i < providers.length - 1) continue;
      throw new Error(`List LLM models failed: ${errors.join(" | ")}`);
    }
  }

  throw new Error(`List LLM models failed: ${errors.join(" | ") || "unknown"}`);
}

/** Expose configured providers for diagnostics (ids only — no keys). */
export function configuredLlmProviderIds(): string[] {
  return listConfiguredLlmProviders().map((p: LlmProvider) => p.id);
}
