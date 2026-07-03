import { ENV } from "./env.js";
import {
  appendAgentLog,
  markAgentLogComplete,
  updateProjectFiles,
  updateProjectStatus,
} from "../db.js";
import { invokeLLM } from "./llm.js";

type AgentRole = "Planner" | "Coder" | "Reviewer" | "Cosine";

type SSEWriter = (event: string, data: unknown) => void;

/** Stream a single LLM call and accumulate the full text */
async function streamLLM(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const result = await invokeLLM({
    messages: messages as any,
  });

  let fullText = "";
  if (result.choices[0]?.message?.content) {
    fullText = typeof result.choices[0].message.content === "string"
      ? result.choices[0].message.content
      : result.choices[0].message.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
    onChunk(fullText);
  }
  return fullText;
}

export interface PlanTask {
  id: string;
  module: string;
  description: string;
}

/** Run the full multi-agent pipeline for a project, emitting SSE events */
export async function runAgentPipeline(
  projectId: number,
  description: string,
  techStack: string,
  write: SSEWriter,
  signal?: AbortSignal
): Promise<void> {
  const emit = (agent: AgentRole, type: string, payload: unknown) => {
    write("agent", { agent, type, payload });
  };

  try {
    await updateProjectStatus(projectId, "running");

    // ── PLANNER ──────────────────────────────────────────────────────────────
    emit("Planner", "start", { message: "Analyzing your request and creating an architecture plan…" });
    const plannerLogId = await appendAgentLog({
      projectId,
      agent: "Planner",
      content: "",
      isComplete: false,
    });

    let plannerOutput = "";
    await streamLLM(
      [
        {
          role: "system",
          content: `You are the Planner agent in a multi-agent app builder. 
Given a user's app description and tech stack, produce a structured JSON plan.
Output ONLY valid JSON with this shape:
{
  "title": "short app title",
  "overview": "one-sentence description",
  "tasks": [
    { "id": "1", "module": "module name", "description": "what to build" }
  ]
}
Include 4-6 tasks covering: data models, API routes, frontend components, auth, and any special features.`,
        },
        {
          role: "user",
          content: `App description: ${description}\nTech stack: ${techStack}`,
        },
      ],
      (chunk) => {
        plannerOutput += chunk;
        emit("Planner", "chunk", { text: chunk });
      },
      signal
    );

    await markAgentLogComplete(plannerLogId);
    emit("Planner", "complete", { message: "Architecture plan complete." });

    // Parse the plan
    let tasks: PlanTask[] = [];
    let appTitle = description.slice(0, 60);
    try {
      const jsonMatch = plannerOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        tasks = parsed.tasks ?? [];
        appTitle = parsed.title ?? appTitle;
      }
    } catch {
      tasks = [
        { id: "1", module: "Core App", description: description },
      ];
    }

    // ── CODER ────────────────────────────────────────────────────────────────
    emit("Coder", "start", { message: `Writing code for ${tasks.length} modules…` });

    const generatedFiles: Record<string, string> = {};

    for (const task of tasks) {
      if (signal?.aborted) break;
      emit("Coder", "task_start", { module: task.module, description: task.description });

      const coderLogId = await appendAgentLog({
        projectId,
        agent: "Coder",
        content: `# ${task.module}\n`,
        isComplete: false,
      });

      let fileContent = "";
      await streamLLM(
        [
          {
            role: "system",
            content: `You are the Coder agent in a multi-agent app builder.
Generate production-quality code for the given module.
Use ${techStack} conventions. Output the full file content with a comment header showing the filename.
Format: start with // filename: <path/filename.ext> then the complete code.
Be concise but complete. Include proper error handling and TypeScript types where applicable.`,
          },
          {
            role: "user",
            content: `App: ${appTitle}\nModule: ${task.module}\nTask: ${task.description}\nTech stack: ${techStack}`,
          },
        ],
        (chunk) => {
          fileContent += chunk;
          emit("Coder", "chunk", { module: task.module, text: chunk });
        },
        signal
      );

      await markAgentLogComplete(coderLogId);

      // Extract filename from the generated code
      const filenameMatch = fileContent.match(/\/\/\s*filename:\s*(.+)/);
      const filename = filenameMatch
        ? filenameMatch[1].trim()
        : `src/${task.module.toLowerCase().replace(/\s+/g, "-")}.ts`;
      generatedFiles[filename] = fileContent;

      emit("Coder", "task_complete", { module: task.module, filename });
    }

    emit("Coder", "complete", { message: `Generated ${Object.keys(generatedFiles).length} files.` });

    // ── REVIEWER ─────────────────────────────────────────────────────────────
    emit("Reviewer", "start", { message: "Reviewing generated code for errors and improvements…" });
    const reviewerLogId = await appendAgentLog({
      projectId,
      agent: "Reviewer",
      content: "",
      isComplete: false,
    });

    const filesSummary = Object.entries(generatedFiles)
      .map(([name]) => `- ${name}`)
      .join("\n");

    let reviewOutput = "";
    await streamLLM(
      [
        {
          role: "system",
          content: `You are the Reviewer agent in a multi-agent app builder.
Review the generated file list and provide a concise quality report.
Cover: potential bugs, missing error handling, security concerns, and improvement suggestions.
Be constructive and specific. Format as markdown with sections: ## Summary, ## Issues Found, ## Recommendations.`,
        },
        {
          role: "user",
          content: `App: ${appTitle}\nGenerated files:\n${filesSummary}\n\nTech stack: ${techStack}`,
        },
      ],
      (chunk) => {
        reviewOutput += chunk;
        emit("Reviewer", "chunk", { text: chunk });
      },
      signal
    );

    await markAgentLogComplete(reviewerLogId);
    emit("Reviewer", "complete", { message: "Code review complete." });

    // Add review to generated files
    generatedFiles["REVIEW.md"] = reviewOutput;
    generatedFiles["README.md"] = `# ${appTitle}\n\nGenerated by AppForge multi-agent pipeline.\n\n## Tech Stack\n${techStack}\n\n## Modules\n${tasks.map(t => `- **${t.module}**: ${t.description}`).join("\n")}\n`;

    await updateProjectFiles(projectId, generatedFiles);
    write("done", { projectId, title: appTitle, fileCount: Object.keys(generatedFiles).length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted")) {
      await updateProjectStatus(projectId, "failed", "Build cancelled by user.");
      write("error", { message: "Build cancelled." });
    } else {
      await updateProjectStatus(projectId, "failed", message);
      write("error", { message });
    }
  }
}
