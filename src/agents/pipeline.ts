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

const MAX_FIX_RETRIES = 2;

const SUPPORTED_TECH_STACKS = [
  "react-node", "react-python", "vue-node", "svelte-node", "next-node",
  "angular-node", "vanilla-node", "react-django", "react-supabase",
  "remix-node", "astro-node", "phaser-html5", "three-js-3d", "babylon-js-3d",
  "unity-webgl", "godot-html5", "react-native-game", "flutter-game",
  "ai-agent-python", "ai-agent-node", "openai-tool", "langchain-tool",
  "crewai-agent", "autogen-agent", "electron-react", "tauri-rust",
  "react-native-expo", "flutter-firebase", "capacitor-ionic",
  "chrome-extension", "vscode-extension", "discord-bot", "telegram-bot",
  "slack-bot", "browser-automation", "web-scraper", "data-visualization",
  "api-service", "serverless-aws", "serverless-vercel",
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

type AgentRole = "Planner" | "Coder" | "Reviewer" | "Validator" | "Cosine" | "Testing" | "System";
type SSEWriter = (event: string, data: unknown) => void;
type CreditChecker = () => Promise<boolean>;

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
    fullText = typeof result.choices[0].message.content === "string"
      ? result.choices[0].message.content
      : result.choices[0].message.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    onChunk(fullText);
  }
  return fullText;
}

export interface PlanTask { id: string; module: string; description: string; }
export interface PipelineOptions { locale?: string; }

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
  const localeHint = locale !== "en" ? ` Generate user-facing UI copy in locale "${locale}" when writing frontend strings.` : "";
  const emit = (agent: AgentRole, type: string, payload: unknown) => { write("agent", { agent, type, payload }); };
  const validationMode = getValidationMode(techStack);
  emit("System", "info", { message: `Validation mode: ${validationMode === "full" ? "full compile sandbox" : "structure check only"}`, validationMode });
  try {
    await updateProjectStatus(projectId, "running");
    if (creditCheck) { const ok = await creditCheck(); if (!ok) { write("pause", { reason: "credits_exhausted", agent: "Planner", message: "Build paused: insufficient credits." }); await updateProjectStatus(projectId, "paused", "credits_exhausted"); return; } }
    emit("Planner", "start", { message: "Analyzing your request and creating an architecture plan…" });
    await appendAgentLog({ projectId, agent: "Planner", content: "", isComplete: false });
    let plannerOutput = "";
    await streamLLM([{ role: "system", content: `You are the Planner agent...` }, { role: "user", content: `App description: ${description}\nTech stack: ${techStack}` }], (chunk) => { plannerOutput += chunk; emit("Planner", "chunk", { text: chunk }); }, signal, "planner");
    emit("Planner", "complete", { message: "Architecture plan complete." });
    let tasks: PlanTask[] = [];
    let appTitle = description.slice(0, 60);
    try { const jsonMatch = plannerOutput.match(/\{[\s\S]*\}/); if (jsonMatch) { const parsed = JSON.parse(jsonMatch[0]); tasks = parsed.tasks ?? []; appTitle = parsed.title ?? appTitle; } } catch { tasks = [{ id: "1", module: "Core App", description: description }]; }
    if (creditCheck) { const ok = await creditCheck(); if (!ok) { write("pause", { reason: "credits_exhausted", agent: "Coder", message: "Build paused: insufficient credits." }); await updateProjectStatus(projectId, "paused", "credits_exhausted"); return; } }
    emit("Coder", "start", { message: `Writing code for ${tasks.length} modules…` });
    let generatedFiles: Record<string, string> = {};
    let validationResult: ValidationResult | null = null;
    let fixAttempt = 0;
    do {
      if (fixAttempt > 0) emit("Coder", "fix_start", { message: `Auto-fix attempt ${fixAttempt}/${MAX_FIX_RETRIES}...`, errors: validationResult?.errors ?? [] });
      generatedFiles = {};
      for (const task of tasks) {
        if (signal?.aborted) break;
        emit("Coder", "task_start", { module: task.module, description: task.description });
        await appendAgentLog({ projectId, agent: "Coder", content: `# ${task.module}\n`, isComplete: false });
        let fileContent = "";
        await streamLLM([{ role: "system", content: `You are the Coder agent...` }, { role: "user", content: `App: ${appTitle}\nModule: ${task.module}\nTask: ${task.description}\nTech stack: ${techStack}` }], (chunk) => { fileContent += chunk; emit("Coder", "chunk", { module: task.module, text: chunk }); }, signal, "coder");
        const parsedFiles = parseGeneratedFiles(fileContent);
        if (Object.keys(parsedFiles).length > 0) { Object.assign(generatedFiles, parsedFiles); for (const filename of Object.keys(parsedFiles)) emit("Coder", "task_complete", { module: task.module, filename }); }
        else { const filenameMatch = fileContent.match(/\/\/\s*filename:\s*(.+)/); const filename = filenameMatch ? filenameMatch[1].trim() : `src/${task.module.toLowerCase().replace(/\s+/g, "-")}.ts`; generatedFiles[filename] = fileContent; emit("Coder", "task_complete", { module: task.module, filename }); }
      }
      emit("Coder", "complete", { message: `Generated ${Object.keys(generatedFiles).length} files.` });
      if (creditCheck) { const ok = await creditCheck(); if (!ok) { write("pause", { reason: "credits_exhausted", agent: "Validator", message: "Build paused: insufficient credits." }); await updateProjectStatus(projectId, "paused", "credits_exhausted"); return; } }
      emit("Validator", "start", { message: "Compiling and testing generated code in sandbox…" });
      validationResult = await validateGeneratedBuild(generatedFiles, techStack);
      const { runTripleAudit } = await import("./tripleAudit.js");
      const auditResult = await runTripleAudit(generatedFiles);
      emit("Validator", "audit", { passed: auditResult.passed, overallScore: auditResult.overallScore, a11y: auditResult.a11y.score, security: auditResult.security.score, perf: auditResult.perf.score, findings: [...auditResult.a11y.findings, ...auditResult.security.findings, ...auditResult.perf.findings].slice(0, 10) });
      emit("Validator", "complete", { passed: validationResult.passed, stage: validationResult.stage, errors: validationResult.errors, durationMs: validationResult.durationMs, warning: validationResult.warning });
      fixAttempt++;
    } while (!validationResult.passed && fixAttempt <= MAX_FIX_RETRIES && !signal?.aborted);
    if (!validationResult.passed) emit("Validator", "failed", { message: `Build could not be auto-fixed after ${MAX_FIX_RETRIES} attempts.`, errors: validationResult.errors, stage: validationResult.stage });
    if (creditCheck) { const ok = await creditCheck(); if (!ok) { write("pause", { reason: "credits_exhausted", agent: "Reviewer", message: "Build paused: insufficient credits." }); await updateProjectStatus(projectId, "paused", "credits_exhausted"); return; } }
    emit("Reviewer", "start", { message: "Reviewing generated code for errors and improvements…" });
    const reviewerLogId = await appendAgentLog({ projectId, agent: "Reviewer", content: "", isComplete: false });
    let reviewOutput = "";
    await streamLLM([{ role: "system", content: `You are the Reviewer agent...` }, { role: "user", content: `App: ${appTitle}\nTech stack: ${techStack}` }], (chunk) => { reviewOutput += chunk; emit("Reviewer", "chunk", { text: chunk }); }, signal, "reviewer");
    await markAgentLogComplete(reviewerLogId);
    emit("Reviewer", "complete", { message: "Code review complete." });
    generatedFiles["REVIEW.md"] = reviewOutput;
    injectComplianceScaffolding(generatedFiles);
    const { generateTestsForModule } = await import("./testingAgent.js");
    const testFiles: Record<string, string> = {};
    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx") || filename.endsWith(".md") || filename.endsWith(".json")) continue;
      const moduleName = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? filename;
      const testResult = await generateTestsForModule(moduleName, content, techStack);
      if (testResult) testFiles[testResult.filename] = testResult.testFile;
    }
    Object.assign(generatedFiles, testFiles);
    emit("Testing", "complete", { message: `Generated ${Object.keys(testFiles).length} test files.` });
    const { logger } = await import("../_core/logger.js");
    try { generatedFiles = mergeScaffoldWithGenerated(getStackScaffold(techStack), generatedFiles); generatedFiles = ensureEssentialFiles(generatedFiles, techStack); } catch (scaffoldErr) { logger.warn({ projectId, err: scaffoldErr instanceof Error ? scaffoldErr.message : scaffoldErr }, "stack_scaffold_merge_failed"); }
    await updateProjectFiles(projectId, generatedFiles);
    const { createBuildSnapshot, getNextVersion, getProjectById, markSnapshotAsCurrent } = await import("../db.js");
    const { estimateLicenseAndCost } = await import("./licenseCostEstimator.js");
    const nextVersion = await getNextVersion(projectId);
    const userId = (await getProjectById(projectId))?.userId ?? 0;
    const snapshotId = await createBuildSnapshot({ projectId, userId, version: nextVersion, label: appTitle ? `v${nextVersion} — ${appTitle}` : `v${nextVersion}`, files: generatedFiles, fileCount: Object.keys(generatedFiles).length, techStack, validationResult, auditScores: null, costEstimate: estimateLicenseAndCost({}, techStack, 0, true) });
    await markSnapshotAsCurrent(snapshotId, projectId);
    await updateProjectStatus(projectId, validationResult?.passed ? "completed" : "failed");
    write("done", { projectId, snapshotId, title: appTitle, fileCount: Object.keys(generatedFiles).length, creditsSpent: BUILD_CREDIT_COST, creditsReserved: BUILD_CREDIT_COST, validationPassed: validationResult?.passed ?? false, validationStage: validationResult?.stage ?? "unknown", validationErrors: validationResult?.errors ?? [], manualReviewRequired: !validationResult?.passed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted")) { await updateProjectStatus(projectId, "failed", "Build cancelled by user."); write("error", { message: "Build cancelled." }); }
    else { await updateProjectStatus(projectId, "failed", message); write("error", { message }); }
  }
}
