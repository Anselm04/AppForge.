// src/agents/testingAgent.ts
// ── REAL Testing Agent ─────────────────────────────────────────────────
// This agent generates actual unit test files for the code produced by
// the Coder. It uses the LLM to write vitest tests, and then the
// BuildValidator runs them. If tests fail, errors are fed back to
// both the Coder (for code fixes) and the TestingAgent (for test fixes).

import { Agent, AgentContext, AgentResult } from "./types";
import { invokeLLM } from "../_core/llm.js";

export async function generateTestsForModule(
  moduleName: string,
  fileContent: string,
  techStack: string,
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
If the file is a utility, test pure functions directly.`,
      },
      {
        role: "user",
        content: `Module: ${moduleName}\nTech stack: ${techStack}\n\nSource code:\n${fileContent.slice(0, 3000)}\n\n${fileContent.length > 3000 ? "...(truncated for context)" : ""}`,
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

type ProductRequirement = { id: string; text: string };

function deriveProductRequirements(source: string): ProductRequirement[] {
  const normalized = source
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((item) => item.length >= 12)
    .slice(0, 12);

  const unique = [...new Set(normalized)];
  const texts =
    unique.length > 0
      ? unique
      : ["The generated product must implement the requested customer behavior."];

  return texts.map((text, index) => ({
    id: `REQ-${String(index + 1).padStart(3, "0")}`,
    text,
  }));
}

function stripGeneratedTestEnvelope(content: string): string {
  return content
    .replace(/^\`\`\`[a-zA-Z0-9_-]*\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .replace(/^\/\/\s*filename:\s*.+\r?\n?/i, "")
    .trim();
}

async function generateRequirementBehaviorTest(
  requirements: ProductRequirement[],
  generatedFiles: Record<string, string>,
  techStack: string,
): Promise<string | null> {
  const sourceContext = Object.entries(generatedFiles)
    .filter(
      ([path]) =>
        !path.endsWith(".test.ts") &&
        !path.endsWith(".test.tsx") &&
        !path.endsWith(".spec.ts") &&
        !path.endsWith(".spec.tsx") &&
        !path.endsWith(".json") &&
        !path.endsWith(".md"),
    )
    .slice(0, 12)
    .map(([path, content]) => `\n--- ${path} ---\n${content.slice(0, 1800)}`)
    .join("\n");

  const requirementList = requirements
    .map((requirement) => `${requirement.id}: ${requirement.text}`)
    .join("\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AppForge's behavioral verification agent.
Write ONE executable Vitest behavioral test file for the generated product.
The suite must validate customer-observable behavior derived from the supplied requirements, not merely assert that files or strings exist.
Every requirement ID MUST appear literally in the test file next to the behavior that proves it.
Use the generated product's public components/functions/routes where possible.
For React UI, use @testing-library/react and interact through the rendered UI.
Mock only external network/payment/database boundaries; do not mock the product behavior being verified.
Do not use tautological assertions such as expect(true).toBe(true).
Output only TypeScript/TSX test source. Start with // filename: src/__tests__/requirements.behavior.test.tsx.`,
      },
      {
        role: "user",
        content: `Tech stack: ${techStack}

Requirements:
${requirementList}

Generated source excerpts:
${sourceContext}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") return null;
  const cleaned = stripGeneratedTestEnvelope(content);
  if (!cleaned) return null;
  if (requirements.some((requirement) => !cleaned.includes(requirement.id))) {
    return null;
  }
  return cleaned;
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
  requirementSource = "",
): Promise<Record<string, string>> {
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
    testFiles["vitest.config.ts"] = VITEST_CONFIG;
  }
  if (
    !generatedFiles["src/__tests__/setup.ts"] &&
    !testFiles["src/__tests__/setup.ts"]
  ) {
    testFiles["src/__tests__/setup.ts"] = VITEST_SETUP;
  }

  const requirements = deriveProductRequirements(requirementSource);
  testFiles[".appforge/requirements.json"] = JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      requirements,
    },
    null,
    2,
  );
  const behavioralTest = await generateRequirementBehaviorTest(
    requirements,
    generatedFiles,
    techStack,
  );
  if (behavioralTest) {
    testFiles["src/__tests__/requirements.behavior.test.tsx"] = behavioralTest;
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
