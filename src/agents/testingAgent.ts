// src/agents/testingAgent.ts
// ── REAL Testing Agent ─────────────────────────────────────────────────
// This agent generates actual unit test files for the code produced by
// the Coder. It uses the LLM to write vitest tests, and then the
// BuildValidator runs them. If tests fail, errors are fed back to
// both the Coder (for code fixes) and the TestingAgent (for test fixes).

import { Agent, AgentContext, AgentResult } from "./types";
import { invokeLLM } from "../_core/llm.js";

export type RequirementContractItem = {
  id: string;
  text: string;
};

export function deriveRequirementContract(
  requirementText: string,
): RequirementContractItem[] {
  const normalized = String(requirementText || "")
    .replace(/\r/g, "")
    .trim();
  if (!normalized) return [];

  const candidates = normalized
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((part) => part.length >= 8);

  const unique: string[] = [];
  for (const candidate of candidates) {
    if (!unique.includes(candidate)) unique.push(candidate);
    if (unique.length >= 8) break;
  }

  const items = unique.length > 0 ? unique : [normalized.slice(0, 1200)];
  return items.map((text, index) => ({
    id: `REQ-${String(index + 1).padStart(3, "0")}`,
    text: text.slice(0, 1200),
  }));
}

export async function generateTestsForModule(
  moduleName: string,
  fileContent: string,
  techStack: string,
  requirementContract: RequirementContractItem[] = [],
): Promise<{ testFile: string; filename: string } | null> {
  // Skip non-code files
  if (!fileContent.includes("export") && !fileContent.includes("function")) {
    return null;
  }

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Testing Agent in AppForge.
Given a source file, write a Vitest unit test file that covers:
1. Happy path (normal usage)
2. Edge cases (empty input, null, max length)
3. Error paths (invalid input, unauthorized access)
Use vitest (describe, it, expect, vi.fn).
Mock external dependencies (DB, API calls, fetch) with vi.fn().
Output ONLY the test file content, starting with // filename: <path>.test.ts or <path>.test.tsx.
If the file is a React component, use @testing-library/react (render, screen, fireEvent).
If the file is a tRPC router, test with mocked context.
If the file is a utility, test pure functions directly.
When project requirements are provided, connect assertions to those requirements and include a comment exactly like:
// appforge-requirement: REQ-001
for every requirement this test genuinely verifies. Do not add a requirement marker unless the test contains an assertion for that behavior.`,
      },
      {
        role: "user",
        content: `Module: ${moduleName}\nTech stack: ${techStack}\n\nProject requirements:\n${requirementContract.length > 0 ? requirementContract.map((item) => `${item.id}: ${item.text}`).join("\n") : "(none provided)"}\n\nSource code:\n${fileContent.slice(0, 3000)}\n\n${fileContent.length > 3000 ? "...(truncated for context)" : ""}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") return null;

  // Extract filename from the generated test
  const filenameMatch = content.match(/\/\/\s*filename:\s*(.+)/);
  const filename = filenameMatch
    ? filenameMatch[1].trim()
    : `src/__tests__/${moduleName.toLowerCase().replace(/\s+/g, "-")}.test.ts`;

  return { testFile: content, filename };
}

async function generateRequirementBehaviorTest(
  generatedFiles: Record<string, string>,
  techStack: string,
  requirementContract: RequirementContractItem[],
): Promise<string | null> {
  if (requirementContract.length === 0) return null;

  const sourceBundle = Object.entries(generatedFiles)
    .filter(([path, content]) => {
      if (typeof content !== "string") return false;
      if (/\.(test|spec)\.[jt]sx?$/i.test(path)) return false;
      if (/\.(md|json|lock|css)$/i.test(path)) return false;
      return /\.(tsx?|jsx?)$/i.test(path);
    })
    .sort(([a], [b]) => {
      const score = (path: string) =>
        /(?:^|\/)(?:App|page|index|main)\.(tsx?|jsx?)$/i.test(path) ? 0 : 1;
      return score(a) - score(b);
    })
    .slice(0, 8)
    .map(([path, content]) => `// FILE: ${path}\n${content.slice(0, 1800)}`)
    .join("\n\n");

  if (!sourceBundle.trim()) return null;

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AppForge's requirement-verification test agent.
Write ONE executable Vitest + Testing Library behavioral test file that verifies the supplied customer requirements against the generated application code.

Rules:
- Use only APIs and dependencies already available in a normal AppForge Vitest harness.
- Test observable behavior, not source-code strings.
- Every requirement must have at least one meaningful assertion.
- Immediately before the assertions that verify a requirement, include an exact traceability comment:
  // appforge-requirement: REQ-001
- Cover every supplied requirement ID. If a requirement cannot be tested from the supplied code, make the test fail clearly rather than pretending it passed.
- Output only the test file body, starting with:
  // filename: src/__tests__/requirements.behavior.test.tsx`,
      },
      {
        role: "user",
        content: `Tech stack: ${techStack}

Requirements:
${requirementContract.map((item) => `${item.id}: ${item.text}`).join("\n")}

Generated application code:
${sourceBundle}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

const VITEST_CONFIG = `// filename: vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/__tests__/setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
`;

/**
 * Ensure generated full-validation projects can load and run AppForge's Vitest harness
 * after a clean install, without depending on undeclared Vite tooling.
 */
function ensureGeneratedTestDependencies(
  generatedFiles: Record<string, string>,
): void {
  const raw = generatedFiles["package.json"];
  if (!raw) return;

  try {
    const pkg = JSON.parse(raw) as {
      scripts?: unknown;
      devDependencies?: unknown;
    };
    const scripts =
      typeof pkg.scripts === "object" &&
      pkg.scripts !== null &&
      !Array.isArray(pkg.scripts)
        ? (pkg.scripts as Record<string, string>)
        : {};
    const devDependencies =
      typeof pkg.devDependencies === "object" &&
      pkg.devDependencies !== null &&
      !Array.isArray(pkg.devDependencies)
        ? (pkg.devDependencies as Record<string, string>)
        : {};

    pkg.scripts = scripts;
    pkg.devDependencies = devDependencies;
    scripts.test = scripts.test ?? "vitest run";
    devDependencies.vite = devDependencies.vite ?? "^5.4.21";
    devDependencies["@vitejs/plugin-react"] =
      devDependencies["@vitejs/plugin-react"] ?? "^4.2.1";
    devDependencies.vitest = devDependencies.vitest ?? "^3.2.7";
    devDependencies.jsdom = devDependencies.jsdom ?? "^24.0.0";
    devDependencies["@testing-library/react"] =
      devDependencies["@testing-library/react"] ?? "^14.2.0";
    devDependencies["@testing-library/jest-dom"] =
      devDependencies["@testing-library/jest-dom"] ?? "^6.4.0";
    generatedFiles["package.json"] = JSON.stringify(pkg, null, 2);
  } catch {
    // The build validator will fail invalid package.json explicitly.
  }
}

const VITEST_SETUP = `// filename: src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(() => cleanup());
window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addListener: vi.fn(), removeListener: vi.fn() }));
window.scrollTo = vi.fn();
window.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
global.fetch = vi.fn();
`;

/** Generate vitest files for code modules — used before validation in the build pipeline. */
export async function attachGeneratedTests(
  generatedFiles: Record<string, string>,
  techStack: string,
  requirementText = "",
): Promise<Record<string, string>> {
  const testFiles: Record<string, string> = {};
  const requirementContract = deriveRequirementContract(requirementText);
  if (requirementContract.length > 0) {
    generatedFiles[".appforge/requirements.json"] = JSON.stringify(
      { version: 1, requirements: requirementContract },
      null,
      2,
    );
  }
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
      requirementContract,
    );
    if (testResult) {
      testFiles[testResult.filename] = testResult.testFile;
    }
  }
  if (requirementContract.length > 0) {
    const behaviorTest = await generateRequirementBehaviorTest(
      generatedFiles,
      techStack,
      requirementContract,
    );
    if (behaviorTest) {
      testFiles["src/__tests__/requirements.behavior.test.tsx"] = behaviorTest;
    }
  }

  if (!generatedFiles["vitest.config.ts"] && !testFiles["vitest.config.ts"]) {
    testFiles["vitest.config.ts"] = VITEST_CONFIG;
  }
  if (
    !generatedFiles["src/__tests__/setup.ts"] &&
    !testFiles["src/__tests__/setup.ts"]
  ) {
    testFiles["src/__tests__/setup.ts"] = VITEST_SETUP;
  }
  ensureGeneratedTestDependencies(generatedFiles);
  return testFiles;
}

export const TestingAgent: Agent = {
  role: "testing",
  name: "Testing Agent",
  description:
    "Generates and runs Vitest unit tests for every code module. Feeds test failures back to the Coder for auto-fix.",
  async run(context: AgentContext): Promise<AgentResult> {
    const { prompt, architecture } = context;
    const files = architecture?.generatedFiles ?? {};
    const techStack = architecture?.techStack ?? "react-node";

    const testFiles: Record<string, string> = {};
    let testCount = 0;
    let skippedCount = 0;

    for (const [filename, content] of Object.entries(files)) {
      if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx"))
        continue;
      if (filename.endsWith(".md") || filename.endsWith(".json")) continue;

      const moduleName =
        filename
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? filename;
      const testResult = await generateTestsForModule(
        moduleName,
        String(content),
        String(techStack),
      );
      if (testResult) {
        testFiles[testResult.filename] = testResult.testFile;
        testCount++;
      } else {
        skippedCount++;
      }
    }

    // Also generate vitest config and setup if not present
    if (!files["vitest.config.ts"] && !testFiles["vitest.config.ts"]) {
      testFiles["vitest.config.ts"] = `// filename: vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'json'], threshold: { lines: 70, functions: 70 } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
`;
    }

    if (
      !files["src/__tests__/setup.ts"] &&
      !testFiles["src/__tests__/setup.ts"]
    ) {
      testFiles["src/__tests__/setup.ts"] = `// filename: src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(() => cleanup());
window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addListener: vi.fn(), removeListener: vi.fn() }));
window.scrollTo = vi.fn();
window.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
global.fetch = vi.fn();
`;
    }

    const summary = `Generated ${testCount} test files (${skippedCount} non-testable files skipped).`;
    const details = {
      framework: "Vitest + Testing Library",
      testFiles: Object.keys(testFiles),
      testCount,
      skippedCount,
      coverageTarget: { lines: 70, branches: 70 },
      instructions:
        "Run `npm test` to execute. If tests fail, the pipeline will auto-retry with error feedback.",
    };

    return { taskId: "testing-task", role: "testing", summary, details };
  },
};

export default TestingAgent;
