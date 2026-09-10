import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import { searchWeb } from "../services/webSearch.js";

const researchInput = z.object({
  topic: z.string().trim().min(3).max(1_000),
  objective: z.string().trim().max(2_000).optional(),
  maxSources: z.number().int().min(3).max(18).default(12),
});

export const deepResearchRouter = router({
  run: protectedProcedure.input(researchInput).mutation(async ({ input }) => {
    const queries = [
      input.topic,
      `${input.topic} latest developments evidence`,
      `${input.topic} risks alternatives comparison`,
    ];

    const searches = await Promise.all(
      queries.map((query) => searchWeb(query, Math.ceil(input.maxSources / 3))),
    );

    const sourceMap = new Map<
      string,
      { title: string; url: string; snippet: string; source: string }
    >();
    for (const search of searches) {
      for (const result of search.results) {
        if (!sourceMap.has(result.url)) {
          sourceMap.set(result.url, result);
        }
      }
    }

    const sources = Array.from(sourceMap.values()).slice(0, input.maxSources);
    if (sources.length === 0) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Research sources are currently unavailable",
      });
    }

    const evidence = sources
      .map(
        (source, index) =>
          `[${index + 1}] ${source.title}\nURL: ${source.url}\nEvidence: ${source.snippet}`,
      )
      .join("\n\n");

    const result = await invokeLLM({
      model: modelForAgent("planner"),
      messages: [
        {
          role: "system",
          content: `You are AppForge Deep Research. Produce a careful research report using only the supplied evidence. Cite factual claims inline using source numbers such as [1] or [2]. Clearly identify uncertainty and disagreements. Return valid JSON with this shape: {"executiveSummary":"string","findings":[{"claim":"string","evidence":[1],"confidence":"high|medium|low"}],"risks":["string"],"recommendations":["string"],"openQuestions":["string"]}. Do not invent sources or facts not supported by the evidence.`,
        },
        {
          role: "user",
          content: `Topic: ${input.topic}\nObjective: ${input.objective ?? "Develop a decision-useful research report."}\n\nEvidence:\n${evidence}`,
        },
      ],
    });

    const content = result.choices[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    let report: unknown = { executiveSummary: text };
    try {
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (json) report = JSON.parse(json);
    } catch {
      report = { executiveSummary: text };
    }

    return {
      topic: input.topic,
      objective: input.objective ?? null,
      researchedAt: new Date().toISOString(),
      report,
      sources: sources.map((source, index) => ({
        id: index + 1,
        ...source,
      })),
    };
  }),
});
