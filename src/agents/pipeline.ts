import {
  appendAgentLog,
  markAgentLogComplete,
  updateProjectFiles,
  updateProjectStatus,
} from "../db.js";
import { invokeLLM } from "../_core/llm.js";
import { injectComplianceScaffolding } from "../services/compliance-template.js";
import {
  parseGeneratedFiles,
  ensureEssentialFiles,
} from "../services/multiFileCoder.js";
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "../services/stackScaffolds.js";
import { validateGeneratedBuild, ValidationResult } from "./buildValidator.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { getValidationMode } from "../lib/validationMode.js";
import { modelForAgent } from "../lib/llmModels.js";
import { LOCALE_UI_HINT, designSystemPrompt } from "../lib/componentLibrary.js";
import {
  normalizeCapabilities,
  type BuildCapabilityId,
} from "../lib/buildCapabilities.js";
import { capabilityHintsForPipeline } from "./capabilityHints.js";
import { runResearchAgent } from "./researchAgent.js";
import { attachGeneratedTests } from "./testingAgent.js";
import { plannerLocaleHint } from "../lib/localePlanner.js";
import type { TripleAuditResult } from "./tripleAudit.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

// Maximum retry attempts for the error-recovery loop
const MAX_FIX_RETRIES = 2;

// Supported tech stacks including games, agents, native, and tools
const SUPPORTED_TECH_STACKS = [
  // Web apps
  "react-node",
  "react-python",
  "vue-node",
  "svelte-node",
  "next-node",
  "angular-node",
  "vanilla-node",
  "react-django",
  "react-supabase",
  "remix-node",
  "astro-node",
  // Games
  "phaser-html5",
  "three-js-3d",
  "babylon-js-3d",
  "unity-webgl",
  "godot-html5",
  "react-native-game",
  "flutter-game",
  // AI / Agents
  "ai-agent-python",
  "ai-agent-node",
  "openai-tool",
  "langchain-tool",
  "crewai-agent",
  "autogen-agent",
  // Desktop / Mobile
  "electron-react",
  "tauri-rust",
  "react-native-expo",
  "flutter-firebase",
  "capacitor-ionic",
  // Specialized
  "chrome-extension",
  "vscode-extension",
  "discord-bot",
  "telegram-bot",
  "slack-bot",
  "browser-automation",
  "web-scraper",
  "data-visualization",
  "api-service",
  "serverless-aws",
  "serverless-vercel",
] as const;

export type TechStack = (typeof SUPPORTED_TECH_STACKS)[number];

export function isValidTechStack(stack: string): stack is TechStack {
  return SUPPORTED_TECH_STACKS.includes(stack as TechStack);
}

export function getTechStackDescription(stack: TechStack): string {
  const descriptions: Record<TechStack, string> = {
    "react-node": "React 18 + Vite + TypeScript + Express + PostgreSQL",
    "react-python": "React 18 + Vite + FastAPI + PostgreSQL",
    "vue-node": "Vue 3 + Vite + Express + PostgreSQL",
    "svelte-node": "SvelteKit + Node.js + PostgreSQL",
    "next-node": "Next.js 14 App Router + tRPC + PostgreSQL",
    "angular-node": "Angular 17 + Express + PostgreSQL",
    "vanilla-node": "Vanilla JS + Vite + Express + PostgreSQL",
    "react-django": "React + Django REST + PostgreSQL",
    "react-supabase": "React + Supabase (backend as a service)",
    "remix-node": "Remix + Express + PostgreSQL",
    "astro-node": "Astro Islands + React islands + Node API",
    "phaser-html5": "Phaser 3 HTML5 Canvas/WebGL game engine",
    "three-js-3d": "Three.js WebGL 3D app/game + React UI",
    "babylon-js-3d": "Babylon.js WebGL 3D engine + React UI",
    "unity-webgl": "Unity WebGL export + HTML wrapper",
    "godot-html5": "Godot 4 Web export + HTML5 shell",
    "react-native-game": "React Native + game loop (Expo or bare)",
    "flutter-game": "Flutter + Flame game engine",
    "ai-agent-python": "Python AI agent (OpenAI/Claude + tools)",
    "ai-agent-node": "Node.js AI agent (OpenAI SDK + function calling)",
    "openai-tool": "OpenAI GPTs / Assistants API custom tool",
    "langchain-tool": "LangChain/LangGraph agent with RAG",
    "crewai-agent": "CrewAI multi-agent orchestration",
    "autogen-agent": "AutoGen conversational agent swarm",
    "electron-react": "Electron + React desktop app",
    "tauri-rust": "Tauri (Rust core) + React/Vue frontend",
    "react-native-expo": "React Native + Expo (iOS/Android)",
    "flutter-firebase": "Flutter + Firebase backend",
    "capacitor-ionic": "Ionic + Capacitor (hybrid mobile)",
    "chrome-extension": "Chrome Extension MV3 + React popup",
    "vscode-extension": "VS Code Extension API + TypeScript",
    "discord-bot": "Discord.js bot + Node.js",
    "telegram-bot": "Telegraf.js / python-telegram-bot",
    "slack-bot": "Bolt.js Slack app/bot",
    "browser-automation": "Playwright/Puppeteer automation script",
    "web-scraper": "Scrapy (Python) or Cheerio (Node) scraper",
    "data-visualization": "D3.js + React or Observable Plot",
    "api-service": "Standalone REST/GraphQL API service",
    "serverless-aws": "AWS Lambda + API Gateway + DynamoDB",
    "serverless-vercel": "Vercel Serverless Functions + Edge",
  };
  return descriptions[stack] ?? "Custom stack";
}

type AgentRole =
  | "Planner"
  | "Coder"
  | "Reviewer"
  | "Validator"
  | "Cosine"
  | "Testing"
  | "Research"
  | "System";

type SSEWriter = (event: string, data: unknown) => void;
type CreditChecker = () => Promise<boolean>;

/** Emit LLM text in progressive chunks for live build UX. */
function emitProgressive(text: string, onChunk: (chunk: string) => void): void {
  if (!text) return;
  const parts = text.match(/\S+\s*|\s+/g) ?? [text];
  let buffer = "";
  for (const part of parts) {
    buffer += part;
    if (buffer.length >= 32 || part.includes("\n")) {
      onChunk(buffer);
      buffer = "";
    }
  }
  if (buffer) onChunk(buffer);
}

/** Stream a single LLM call and accumulate the full text */
async function streamLLM(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  modelRole?: "planner" | "coder" | "reviewer",
): Promise<string> {
  const result = await invokeLLM({
    messages: messages as any,
    model: modelRole ? modelForAgent(modelRole) : undefined,
  });

  let fullText = "";
  if (result.choices[0]?.message?.content) {
    fullText =
      typeof result.choices[0].message.content === "string"
        ? result.choices[0].message.content
        : result.choices[0].message.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");
    emitProgressive(fullText, onChunk);
  }
  return fullText;
}

export interface PlanTask {
  id: string;
  module: string;
  description: string;
}

export interface PipelineOptions {
  locale?: string;
  buildCapabilities?: BuildCapabilityId[];
}

/** Run the full multi-agent pipeline for a project, emitting SSE events */
export async function runAgentPipeline(
  projectId: number,
  description: string,
  techStack: string,
  write: SSEWriter,
  signal?: AbortSignal,
  creditCheck?: CreditChecker,
  options?: PipelineOptions,
): Promise<void> {
  const locale = options?.locale ?? "en";
  const localeHint =
    `${LOCALE_UI_HINT(locale)}\n${plannerLocaleHint(locale)}`.trim();
  const capabilities = normalizeCapabilities(options?.buildCapabilities ?? []);
  const capabilityHints = capabilityHintsForPipeline(capabilities);

  const projectRow = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { buildCapabilities: true },
  });
  const storedCaps = normalizeCapabilities(projectRow?.buildCapabilities ?? []);
  const activeCapabilities =
    capabilities.length > 0 ? capabilities : storedCaps;

  const assetRows = await db.query.projectAssets.findMany({
    where: eq(schema.projectAssets.projectId, projectId),
    columns: { filename: true },
  });
  const assetPaths = assetRows.map((a) => `public/assets/${a.filename}`);
  const designHints = designSystemPrompt({
    assetPaths,
    locale,
    stack: techStack,
  });

  const emit = (agent: AgentRole, type: string, payload: unknown) => {
    write("agent", { agent, type, payload });
  };

  const validationMode = getValidationMode(techStack);
  emit("System", "info", {
    message: `Validation mode: ${validationMode === "full" ? "full compile sandbox" : "structure check only"}`,
    validationMode,
  });

  try {
    await updateProjectStatus(projectId, "running");

    let researchBrief = "";
    const researchFocus = activeCapabilities.includes("patent")
      ? "patent"
      : activeCapabilities.includes("architecture")
        ? "architecture"
        : activeCapabilities.includes("education")
          ? "education"
          : "general";

    if (creditCheck) {
      const ok = await creditCheck();
      if (!ok) {
        write("pause", {
          reason: "credits_exhausted",
          agent: "Research",
          message: "Build paused: insufficient credits.",
        });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }
    }
    researchBrief = await runResearchAgent(
      projectId,
      description,
      techStack,
      (type, payload) => emit("Research", type, payload),
      { focus: researchFocus },
    );

    // ── PLANNER ──────────────────────────────────────────────────────────────
    if (creditCheck) {
      const ok = await creditCheck();
      if (!ok) {
        write("pause", {
          reason: "credits_exhausted",
          agent: "Planner",
          message: "Build paused: insufficient credits.",
        });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }
    }

    emit("Planner", "start", {
      message: "Analyzing your request and creating an architecture plan…",
    });
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
Include 4-8 tasks covering: data models, API routes, frontend components, auth, and any special features.
The tech stack is: ${techStack} (${getTechStackDescription(techStack as TechStack)}).
${designHints}
${capabilityHints}
${researchBrief ? `\nRESEARCH BRIEF:\n${researchBrief}\n` : ""}
${localeHint}`,
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
      signal,
      "planner",
    );
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
      tasks = [{ id: "1", module: "Core App", description: description }];
    }

    // ── CODER ────────────────────────────────────────────────────────────────
    if (creditCheck) {
      const ok = await creditCheck();
      if (!ok) {
        write("pause", {
          reason: "credits_exhausted",
          agent: "Coder",
          message: "Build paused: insufficient credits.",
        });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }
    }

    emit("Coder", "start", {
      message: `Writing code for ${tasks.length} modules…`,
    });

    let generatedFiles: Record<string, string> = {};

    // ═══════════════════════════════════════════════════════════════════════
    // ERROR RECOVERY LOOP: If compilation fails, feed errors back to LLM
    // and retry up to MAX_FIX_RETRIES times.
    // ═══════════════════════════════════════════════════════════════════════
    let validationResult: ValidationResult | null = null;
    let lastAuditResult: TripleAuditResult | null = null;
    let fixAttempt = 0;
    const testsBlocking = validationMode === "full";

    do {
      if (fixAttempt > 0) {
        emit("Coder", "fix_start", {
          message: `Auto-fix attempt ${fixAttempt}/${MAX_FIX_RETRIES} based on ${validationResult?.errors.length ?? 0} compilation errors…`,
          errors: validationResult?.errors ?? [],
        });
      }

      generatedFiles = {}; // Reset on retry

      for (const task of tasks) {
        if (signal?.aborted) break;
        emit("Coder", "task_start", {
          module: task.module,
          description: task.description,
        });

        const coderLogId = await appendAgentLog({
          projectId,
          agent: "Coder",
          content: `# ${task.module}\n`,
          isComplete: false,
        });

        const fixContext =
          fixAttempt > 0 && validationResult
            ? `\n\nPREVIOUS BUILD FAILED WITH THESE ERRORS — FIX THEM:\n${validationResult.errors.slice(0, 5).join("\n")}`
            : "";

        let fileContent = "";
        await streamLLM(
          [
            {
              role: "system",
              content: `You are the Coder agent in a multi-agent app builder.
Generate production-quality code for the given module.
Use ${techStack} conventions. Output the full file content with a comment header showing the filename.
Format: start with // filename: <path/filename.ext> then the complete code.

MANDATORY VANTA-COMPLIANT SCAFFOLDING (include regardless of app type):
- All API routes must validate inputs with Zod schemas
- All auth endpoints must use secure HTTPOnly cookies with SameSite=Strict
- All user PII fields must be encrypted at rest (bcrypt for passwords)
- All endpoints must have rate limiting (express-rate-limit) and Helmet security headers
- All errors must be caught and sanitized (no stack traces leaked to client)
- All access to user data must be logged with timestamp, userId, action for audit trail
- Include a /health endpoint with DB connectivity check
- Include Terms of Service and Privacy Policy pages
- All DB queries must use parameterized statements (Drizzle ORM)
- Include a content moderation check function
- Force HTTPS redirect in production middleware
- Add a clear cookie consent banner component in the UI

${fixAttempt > 0 ? "THIS IS A FIX RETRY — focus on fixing the reported TypeScript/build errors. Keep all other code intact." : ""}
${designHints}
${capabilityHints}
${researchBrief ? `\nRESEARCH BRIEF:\n${researchBrief}\n` : ""}
${localeHint}`,
            },
            {
              role: "user",
              content: `App: ${appTitle}\nModule: ${task.module}\nTask: ${task.description}\nTech stack: ${techStack}${fixContext}`,
            },
          ],
          (chunk) => {
            fileContent += chunk;
            emit("Coder", "chunk", { module: task.module, text: chunk });
          },
          signal,
          "coder",
        );

        // Parse multi-file LLM output; fall back to single-file extraction
        const parsedFiles = parseGeneratedFiles(fileContent);
        if (Object.keys(parsedFiles).length > 0) {
          Object.assign(generatedFiles, parsedFiles);
          for (const filename of Object.keys(parsedFiles)) {
            emit("Coder", "task_complete", { module: task.module, filename });
          }
        } else {
          const filenameMatch = fileContent.match(/\/\/\s*filename:\s*(.+)/);
          const filename = filenameMatch
            ? filenameMatch[1].trim()
            : `src/${task.module.toLowerCase().replace(/\s+/g, "-")}.ts`;
          generatedFiles[filename] = fileContent;
          emit("Coder", "task_complete", { module: task.module, filename });
        }

        if (Object.keys(generatedFiles).length > 0) {
          await updateProjectFiles(projectId, { ...generatedFiles });
          write("files_partial", {
            fileCount: Object.keys(generatedFiles).length,
          });
        }
      }

      emit("Coder", "complete", {
        message: `Generated ${Object.keys(generatedFiles).length} files.`,
      });

      try {
        generatedFiles = mergeScaffoldWithGenerated(
          getStackScaffold(techStack),
          generatedFiles,
        );
        generatedFiles = ensureEssentialFiles(generatedFiles, techStack);
      } catch {
        /* non-fatal scaffold merge */
      }

      emit("Testing", "start", {
        message: "Generating unit tests before validation…",
      });
      const testFiles = await attachGeneratedTests(generatedFiles, techStack);
      Object.assign(generatedFiles, testFiles);
      emit("Testing", "complete", {
        message: `Prepared ${Object.keys(testFiles).length} test file(s) for validation.`,
      });

      // ── VALIDATOR (Build + Type Check + Test) ──────────────────────────────
      if (creditCheck) {
        const ok = await creditCheck();
        if (!ok) {
          write("pause", {
            reason: "credits_exhausted",
            agent: "Validator",
            message: "Build paused: insufficient credits.",
          });
          await updateProjectStatus(projectId, "paused", "credits_exhausted");
          return;
        }
      }

      emit("Validator", "start", {
        message: "Compiling and testing generated code in sandbox…",
      });
      validationResult = await validateGeneratedBuild(
        generatedFiles,
        techStack,
        { testsBlocking },
      );

      // ── Triple Audit (a11y + security + perf) ──────────────────────────────
      const { runTripleAudit } = await import("./tripleAudit.js");
      lastAuditResult = await runTripleAudit(generatedFiles);
      emit("Validator", "audit", {
        passed: lastAuditResult.passed,
        overallScore: lastAuditResult.overallScore,
        a11y: lastAuditResult.a11y.score,
        security: lastAuditResult.security.score,
        perf: lastAuditResult.perf.score,
        findings: [
          ...lastAuditResult.a11y.findings,
          ...lastAuditResult.security.findings,
          ...lastAuditResult.perf.findings,
        ].slice(0, 10),
      });

      const criticalSecurity = lastAuditResult.security.findings.filter(
        (f) => f.severity === "critical",
      );
      if (criticalSecurity.length > 0 && validationResult.passed) {
        validationResult = {
          ...validationResult,
          passed: false,
          stage: "audit",
          errors: [
            ...validationResult.errors,
            ...criticalSecurity.map((f) => `Security: ${f.message}`),
          ],
        };
      }

      emit("Validator", "complete", {
        passed: validationResult.passed,
        stage: validationResult.stage,
        errors: validationResult.errors,
        durationMs: validationResult.durationMs,
        warning: validationResult.warning,
      });

      fixAttempt++;
    } while (
      !validationResult.passed &&
      fixAttempt <= MAX_FIX_RETRIES &&
      !signal?.aborted
    );

    // If validation still fails after retries, mark build as FAILED with a warning
    if (!validationResult.passed) {
      emit("Validator", "failed", {
        message: `Build could not be auto-fixed after ${MAX_FIX_RETRIES} attempts. Manual developer review required.`,
        errors: validationResult.errors,
        stage: validationResult.stage,
      });
      // Still save files so the user can download and fix manually
    }

    // ── REVIEWER ─────────────────────────────────────────────────────────────
    let reviewOutput = "";
    if (validationResult.passed) {
      if (creditCheck) {
        const ok = await creditCheck();
        if (!ok) {
          write("pause", {
            reason: "credits_exhausted",
            agent: "Reviewer",
            message: "Build paused: insufficient credits.",
          });
          await updateProjectStatus(projectId, "paused", "credits_exhausted");
          return;
        }
      }

      emit("Reviewer", "start", {
        message: "Reviewing generated code for errors and improvements…",
      });
      const reviewerLogId = await appendAgentLog({
        projectId,
        agent: "Reviewer",
        content: "",
        isComplete: false,
      });

      const filesSummary = Object.entries(generatedFiles)
        .map(([name]) => `- ${name}`)
        .join("\n");

      const reviewContext = validationResult
        ? `\nValidation result: PASSED\nStage: ${validationResult.stage}`
        : "";

      await streamLLM(
        [
          {
            role: "system",
            content: `You are the Reviewer agent in a multi-agent app builder.
Review the generated file list and provide a concise quality report.
Cover: potential bugs, missing error handling, security concerns, and improvement suggestions.
Format as markdown with sections: ## Summary, ## Validation Status, ## Issues Found, ## Recommendations.
${designHints}
${capabilityHints}
${localeHint}`,
          },
          {
            role: "user",
            content: `App: ${appTitle}\nGenerated files:\n${filesSummary}\nTech stack: ${techStack}${reviewContext}`,
          },
        ],
        (chunk) => {
          reviewOutput += chunk;
          emit("Reviewer", "chunk", { text: chunk });
        },
        signal,
        "reviewer",
      );

      await markAgentLogComplete(reviewerLogId);
      emit("Reviewer", "complete", { message: "Code review complete." });
    } else {
      reviewOutput = `# Build review skipped\n\nValidation failed after ${MAX_FIX_RETRIES} auto-fix attempts.\n\n## Errors\n${(validationResult.errors ?? []).map((e) => `- ${e}`).join("\n")}\n\nFix issues in the Code tab or re-run the build.`;
      emit("Reviewer", "skipped", {
        message: "Review skipped — validation did not pass.",
      });
    }

    // Add review + compliance scaffolding to generated files
    generatedFiles["REVIEW.md"] = reviewOutput;
    generatedFiles["README.md"] =
      `# ${appTitle}\n\nGenerated by AppForge multi-agent pipeline.\n\n**Tech Stack:** ${techStack} (${getTechStackDescription(techStack as TechStack)})\n\n**Validation:** ${validationResult?.passed ? "Compiled and passed basic checks" : "FAILED — manual fixes required"}\n\n**Warning:** LLM-generated code is a starting point, not production-ready without review.\n\n## Modules\n${tasks.map((t) => `- **${t.module}**: ${t.description}`).join("\n")}\n\n## How to run\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;

    injectComplianceScaffolding(generatedFiles);

    // Persist files incrementally so disconnect/deploy still have a usable tree
    await updateProjectFiles(projectId, generatedFiles);

    // ── Snapshot + Audit + Cost at end of build ────────────────────────────
    const { logger } = await import("../_core/logger.js");
    const {
      createBuildSnapshot,
      getNextVersion,
      getProjectById,
      markSnapshotAsCurrent,
    } = await import("../db.js");
    const { estimateLicenseAndCost } =
      await import("./licenseCostEstimator.js");
    const nextVersion = await getNextVersion(projectId);
    const userId = (await getProjectById(projectId))?.userId ?? 0;
    const pkgJson = generatedFiles["package.json"];
    const parsedDeps = pkgJson ? (JSON.parse(pkgJson).dependencies ?? {}) : {};
    const estBundleKB = Math.round(
      Object.values(generatedFiles)
        .filter(
          (f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js"),
        )
        .join("").length /
        3 /
        1024,
    );
    const costReport = estimateLicenseAndCost(
      parsedDeps,
      techStack,
      estBundleKB,
      true,
    );
    const snapshotId = await createBuildSnapshot({
      projectId,
      userId,
      version: nextVersion,
      label: appTitle ? `v${nextVersion} — ${appTitle}` : `v${nextVersion}`,
      files: generatedFiles,
      fileCount: Object.keys(generatedFiles).length,
      techStack,
      validationResult,
      auditScores: lastAuditResult
        ? {
            overall: lastAuditResult.overallScore,
            a11y: lastAuditResult.a11y.score,
            security: lastAuditResult.security.score,
            perf: lastAuditResult.perf.score,
            passed: lastAuditResult.passed,
          }
        : null,
      costEstimate: costReport,
    });
    logger.info(
      { projectId, snapshotId, version: nextVersion },
      "build_snapshot_saved",
    );

    await markSnapshotAsCurrent(snapshotId, projectId);

    // Final status: done
    await updateProjectStatus(
      projectId,
      validationResult?.passed ? "completed" : "failed",
    );
    write("done", {
      projectId,
      snapshotId,
      title: appTitle,
      fileCount: Object.keys(generatedFiles).length,
      creditsSpent: BUILD_CREDIT_COST,
      creditsReserved: BUILD_CREDIT_COST,
      validationPassed: validationResult?.passed ?? false,
      validationStage: validationResult?.stage ?? "unknown",
      validationErrors: validationResult?.errors ?? [],
      manualReviewRequired: !validationResult?.passed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted")) {
      await updateProjectStatus(
        projectId,
        "failed",
        "Build cancelled by user.",
      );
      write("error", { message: "Build cancelled." });
    } else {
      await updateProjectStatus(projectId, "failed", message);
      write("error", { message });
    }
  }
}
