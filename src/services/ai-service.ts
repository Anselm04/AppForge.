import { invokeLLM } from "../_core/llm.js";

export interface RequirementExtraction {
  appName: string;
  description: string;
  features: string[];
  targetAudience: string;
  technicalRequirements: string[];
  integrations: string[];
  dataModels: string[];
  userRoles: string[];
}

export interface ClarificationQuestion {
  question: string;
  category: "feature" | "design" | "technical" | "business";
  priority: "high" | "medium" | "low";
}

/**
 * Extract the assistant text content from an invokeLLM result, tolerating both
 * the collapsed-string form and the array-of-parts form.
 */
function readContent(result: Awaited<ReturnType<typeof invokeLLM>>): string {
  const message = result.choices?.[0]?.message;
  if (!message) return "";
  const { content } = message;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string" ? part : part.type === "text" ? part.text : "",
      )
      .join("");
  }
  return "";
}

/** Parse JSON from a model response, stripping ``` fences if present. */
function parseJson<T>(raw: string): T {
  const trimmed = (raw || "").trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence) as T;
  } catch {
    // Best-effort: extract the first JSON object/array from the text.
    const match = withoutFence.match(/[[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Model did not return valid JSON");
  }
}

const OPTIONAL_MODEL =
  (process.env.AI_MODEL ?? process.env.LLM_MODEL_DEFAULT ?? "").trim() ||
  undefined;

/**
 * Lightweight requirement/clarification helper.
 *
 * Delegates to the canonical multi-provider {@link invokeLLM} router so these
 * endpoints work with ANY configured provider (Groq, Gemini, OpenRouter,
 * OpenAI, etc.) with automatic failover — instead of hardcoding OpenAI.
 */
export class AIService {
  async extractRequirements(prompt: string): Promise<RequirementExtraction> {
    const result = await invokeLLM({
      ...(OPTIONAL_MODEL ? { model: OPTIONAL_MODEL } : {}),
      responseFormat: { type: "json_object" },
      maxTokens: 4000,
      messages: [
        {
          role: "system",
          content: `You are an expert software architect. Extract requirements from the user's app description. Return ONLY a JSON object with these keys:
- appName: string
- description: string
- features: string[]
- targetAudience: string
- technicalRequirements: string[]
- integrations: string[]
- dataModels: string[]
- userRoles: string[]`,
        },
        { role: "user", content: prompt },
      ],
    });
    return parseJson<RequirementExtraction>(readContent(result));
  }

  async generateClarificationQuestions(
    requirements: RequirementExtraction | string[] | Record<string, unknown>,
  ): Promise<ClarificationQuestion[]> {
    const result = await invokeLLM({
      ...(OPTIONAL_MODEL ? { model: OPTIONAL_MODEL } : {}),
      responseFormat: { type: "json_object" },
      maxTokens: 2000,
      messages: [
        {
          role: "system",
          content: `Generate 3-5 clarification questions to better understand the app requirements. Return ONLY a JSON object of the form { "questions": ClarificationQuestion[] } where each ClarificationQuestion has:
- question: string
- category: 'feature' | 'design' | 'technical' | 'business'
- priority: 'high' | 'medium' | 'low'`,
        },
        {
          role: "user",
          content: `Based on these requirements: ${JSON.stringify(requirements)}`,
        },
      ],
    });
    const parsed = parseJson<
      ClarificationQuestion[] | { questions: ClarificationQuestion[] }
    >(readContent(result));
    return Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
  }

  async generateAppArchitecture(requirements: RequirementExtraction) {
    const result = await invokeLLM({
      ...(OPTIONAL_MODEL ? { model: OPTIONAL_MODEL } : {}),
      responseFormat: { type: "json_object" },
      maxTokens: 4000,
      messages: [
        {
          role: "system",
          content: `Generate a complete app architecture. Return ONLY a JSON object with:
- frontend: { framework: string, components: string[], pages: string[] }
- backend: { framework: string, endpoints: string[], services: string[] }
- database: { type: string, tables: string[], relationships: string[] }
- infrastructure: { deployment: string, monitoring: string, backups: string }
- security: { auth: string, rateLimiting: string, encryption: string }`,
        },
        {
          role: "user",
          content: `Create architecture for: ${JSON.stringify(requirements)}`,
        },
      ],
    });
    return parseJson<Record<string, unknown>>(readContent(result));
  }
}

export default AIService;
