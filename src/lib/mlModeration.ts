import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "./llmModels.js";

export type MlModerationResult = {
  allowed: boolean;
  category?: string;
  reason?: string;
};

/** LLM moderation layer — skipped if no API key or ML_MODERATION=false */
export async function mlModerateContent(
  text: string,
): Promise<MlModerationResult | null> {
  if (process.env.ML_MODERATION === "false") return null;
  if (!process.env.BUILT_IN_FORGE_API_KEY) return null;

  try {
    const result = await invokeLLM({
      model: modelForAgent("moderation"),
      messages: [
        {
          role: "system",
          content:
            'You are a content safety classifier. Reply ONLY with JSON: {"allowed":true} or {"allowed":false,"category":"illegal|dangerous|sexual|hate|spam|other","reason":"brief"}',
        },
        { role: "user", content: text.slice(0, 4000) },
      ],
      maxTokens: 120,
    });
    const raw =
      typeof result.choices[0]?.message.content === "string"
        ? result.choices[0].message.content
        : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as MlModerationResult;
    return parsed;
  } catch {
    return null;
  }
}
