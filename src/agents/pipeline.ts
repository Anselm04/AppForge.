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

// Credit cost per agent phase
const PHASE_COSTS: Record<string, number> = {
  Planner: 2,
  Coder: 3,
  Reviewer: 1,
  Validator: 2,
};

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
  "Planner" | "Coder" | "Reviewer" | "Validator" | "Cosine" | "Testing";

type SSEWriter = (event: string, data: unknown) => void;
type CreditChecker = () => Promise<boolean>;

/** Stream a single LLM call and accumulate the full text */
async function streamLLM(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const result = await invokeLLM({
    messages: messages as any,
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
  signal?: AbortSignal,
  creditCheck?: CreditChecker,
): Promise<void> {
  const emit = (agent: AgentRole, type: string, payload: unknown) => {
    write("agent", { agent, type, payload });
  };

  let totalCreditsSpent = 0;

  const checkAndDeduct = async (agent: AgentRole) => {
    const cost = PHASE_COSTS[agent] || 0;
    if (cost === 0) return true;
    if (creditCheck) {
      const ok = await creditCheck();
      if (!ok) return false;
    }
    totalCreditsSpent += cost;
    return true;
  };

  try {
    await updateProjectStatus(projectId, "running");

    // ── PLANNER ──────────────────────────────────────────────────────────────
    if (!(await checkAndDeduct("Planner"))) {
      write("pause", {
        reason: "credits_exhausted",
        agent: "Planner",
        message: "Build paused: insufficient credits to start planning phase.",
      });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
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
The tech stack is: ${techStack} (${getTechStackDescription(techStack as TechStack)}).`,
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
      tasks = [{ id: "1", module: "Core App", description: description }];
    }

    // ── CODER ────────────────────────────────────────────────────────────────
    if (!(await checkAndDeduct("Coder"))) {
      write("pause", {
        reason: "credits_exhausted",
        agent: "Coder",
        message:
          "Build paused: insufficient credits for code generation phase.",
      });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
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
    let fixAttempt = 0;

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

${fixAttempt > 0 ? "THIS IS A FIX RETRY — focus on fixing the reported TypeScript/build errors. Keep all other code intact." : ""}`,
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
        );

        await markAgentLogComplete(coderLogId);

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
      }

      emit("Coder", "complete", {
        message: `Generated ${Object.keys(generatedFiles).length} files.`,
      });

      // ── VALIDATOR (Build + Type Check + Test) ──────────────────────────────
      if (!(await checkAndDeduct("Validator"))) {
        write("pause", {
          reason: "credits_exhausted",
          agent: "Validator",
          message: "Build paused: insufficient credits for validation phase.",
        });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }

      emit("Validator", "start", {
        message: "Compiling and testing generated code in sandbox…",
      });
      validationResult = await validateGeneratedBuild(
        generatedFiles,
        techStack,
      );

      // ── Triple Audit (a11y + security + perf) ──────────────────────────────
      const { runTripleAudit } = await import("./tripleAudit.js");
      const auditResult = await runTripleAudit(generatedFiles);
      emit("Validator", "audit", {
        passed: auditResult.passed,
        overallScore: auditResult.overallScore,
        a11y: auditResult.a11y.score,
        security: auditResult.security.score,
        perf: auditResult.perf.score,
        findings: [
          ...auditResult.a11y.findings,
          ...auditResult.security.findings,
          ...auditResult.perf.findings,
        ].slice(0, 10),
      });

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
    if (!(await checkAndDeduct("Reviewer"))) {
      write("pause", {
        reason: "credits_exhausted",
        agent: "Reviewer",
        message: "Build paused: insufficient credits for review phase.",
      });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
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
      ? `\nValidation result: ${validationResult.passed ? "PASSED" : "FAILED after " + MAX_FIX_RETRIES + " auto-fix attempts"}\nStage: ${validationResult.stage}\nErrors: ${validationResult.errors.slice(0, 5).join("; ")}`
      : "";

    let reviewOutput = "";
    await streamLLM(
      [
        {
          role: "system",
          content: `You are the Reviewer agent in a multi-agent app builder.
Review the generated file list and provide a concise quality report.
Cover: potential bugs, missing error handling, security concerns, and improvement suggestions.
Also assess whether the build validation passed or failed, and what manual fixes are still needed.
Format as markdown with sections: ## Summary, ## Validation Status, ## Issues Found, ## Manual Fixes Needed, ## Recommendations.`,
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
    );

    await markAgentLogComplete(reviewerLogId);
    emit("Reviewer", "complete", { message: "Code review complete." });

    // Add review + compliance scaffolding to generated files
    generatedFiles["REVIEW.md"] = reviewOutput;
    generatedFiles["README.md"] =
      `# ${appTitle}\n\nGenerated by AppForge multi-agent pipeline.\n\n**Tech Stack:** ${techStack} (${getTechStackDescription(techStack as TechStack)})\n\n**Validation:** ${validationResult?.passed ? "Compiled and passed basic checks" : "FAILED — manual fixes required"}\n\n**Warning:** LLM-generated code is a starting point, not production-ready without review.\n\n## Modules\n${tasks.map((t) => `- **${t.module}**: ${t.description}`).join("\n")}\n\n## How to run\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;

    injectComplianceScaffolding(generatedFiles);

    // ── TESTING AGENT ────────────────────────────────────────────────────────
    // Generate unit tests for each code module
    const { generateTestsForModule } = await import("./testingAgent.js");
    const testFiles: Record<string, string> = {};
    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (
        filename.endsWith(".test.ts") ||
        filename.endsWith(".test.tsx") ||
        filename.endsWith(".md") ||
        filename.endsWith(".json")
      )
        continue;
      const moduleName =
        filename
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? filename;
      const testResult = await generateTestsForModule(
        moduleName,
        content,
        techStack,
      );
      if (testResult) {
        testFiles[testResult.filename] = testResult.testFile;
      }
    }
    if (!generatedFiles["vitest.config.ts"] && !testFiles["vitest.config.ts"]) {
      testFiles["vitest.config.ts"] =
        `// filename: vitest.config.ts\nimport { defineConfig } from 'vitest/config';\nimport react from '@vitejs/plugin-react';\nimport path from 'path';\nexport default defineConfig({\n  plugins: [react()],\n  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/__tests__/setup.ts'] },\n  resolve: { alias: { '@': path.resolve(__dirname, './src') } },\n});\n`;
    }
    if (
      !generatedFiles["src/__tests__/setup.ts"] &&
      !testFiles["src/__tests__/setup.ts"]
    ) {
      testFiles["src/__tests__/setup.ts"] =
        `// filename: src/__tests__/setup.ts\nimport '@testing-library/jest-dom';\nimport { cleanup } from '@testing-library/react';\nimport { afterEach, vi } from 'vitest';\nafterEach(() => cleanup());\nwindow.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addListener: vi.fn(), removeListener: vi.fn() }));\nwindow.scrollTo = vi.fn();\nwindow.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));\nglobal.fetch = vi.fn();
`;
    }
    Object.assign(generatedFiles, testFiles);
    emit("Testing", "complete", {
      message: `Generated ${Object.keys(testFiles).length} test files.`,
    });

    // Merge stack scaffold + ensure essentials BEFORE snapshot (non-fatal)
    const { logger } = await import("../_core/logger.js");
    try {
      generatedFiles = mergeScaffoldWithGenerated(
        getStackScaffold(techStack),
        generatedFiles,
      );
      generatedFiles = ensureEssentialFiles(generatedFiles, techStack);
    } catch (scaffoldErr) {
      logger.warn(
        {
          projectId,
          err: scaffoldErr instanceof Error ? scaffoldErr.message : scaffoldErr,
        },
        "stack_scaffold_merge_failed",
      );
    }

    // Persist files incrementally so disconnect/deploy still have a usable tree
    await updateProjectFiles(projectId, generatedFiles);

    // ── Snapshot + Audit + Cost at end of build ────────────────────────────
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
      auditScores: null, // pipeline audit result goes here if available
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
      creditsSpent: totalCreditsSpent,
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
