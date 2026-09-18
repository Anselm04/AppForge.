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
  requirementBrief = "",
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
When CUSTOMER REQUIREMENTS are supplied, prefer assertions that prove the module contributes to those observable requirements rather than merely mirroring implementation details.`,
      },
      {
        role: "user",
        content: `Module: ${moduleName}\nTech stack: ${techStack}\n${requirementBrief ? `\nCUSTOMER REQUIREMENTS:\n${requirementBrief.slice(0, 4000)}\n` : ""}\nSource code:\n${fileContent.slice(0, 3000)}\n\n${fileContent.length > 3000 ? "...(truncated for context)" : ""}`,
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

const REQUIREMENT_TEST_PATH = "src/__tests__/requirements.behavior.test.tsx";
const REQUIREMENT_MARKER = "APPFORGE_REQUIREMENT:REQ-001";

function cleanGeneratedTest(content: string): string {
  return content
    .replace(/^\`\`\`(?:tsx?|jsx?)?\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .replace(/^\/\/\s*filename:\s*.+\r?\n?/i, "")
    .trim();
}

export function createRequirementManifest(requirementBrief: string): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      source: "customer_description",
      requirements: [
        {
          id: "REQ-001",
          text: requirementBrief.trim(),
          behavioralTest: REQUIREMENT_TEST_PATH,
        },
      ],
    },
    null,
    2,
  );
}

async function generateRequirementBehaviorTest(
  generatedFiles: Record<string, string>,
  techStack: string,
  requirementBrief: string,
): Promise<string | null> {
  const requirement = requirementBrief.trim();
  if (!requirement) return null;

  const sourceContext = Object.entries(generatedFiles)
    .filter(
      ([path, content]) =>
        /\.(?:tsx?|jsx?)$/i.test(path) &&
        !/\.(?:test|spec)\.(?:tsx?|jsx?)$/i.test(path) &&
        typeof content === "string",
    )
    .sort(([a], [b]) => {
      const score = (path: string) =>
        /(?:^|\/)(?:App|main|index|page)\.(?:tsx?|jsx?)$/i.test(path) ? 0 : 1;
      return score(a) - score(b);
    })
    .slice(0, 8)
    .map(([path, content]) => `// SOURCE: ${path}\n${content.slice(0, 2400)}`)
    .join("\n\n")
    .slice(0, 14000);

  if (!sourceContext) return null;

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AppForge's requirement-verification Testing Agent.
Write ONE executable Vitest + Testing Library behavioral test file that proves the generated product satisfies the customer's requested observable behavior.
Use the supplied real source files. Import the actual component/module under test; do not invent APIs, selectors, exports, or filenames.
Prefer user-visible assertions: render the UI, interact with controls, and verify the requested visible/state behavior.
The test must fail when the requested behavior is missing or broken.
Do not test implementation details merely to make the test pass.
Mock only unavoidable external services.
Output ONLY the test file content. Do not use markdown fences.`,
      },
      {
        role: "user",
        content: `REQUIREMENT ID: REQ-001
CUSTOMER REQUIREMENT:
${requirement.slice(0, 6000)}

TECH STACK: ${techStack}

GENERATED SOURCE:
${sourceContext}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") return null;
  const cleaned = cleanGeneratedTest(content);
  if (!cleaned) return null;
  return `// ${REQUIREMENT_MARKER}\n${cleaned}\n`;
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
  requirementBrief = "",
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
      requirementBrief,
    );
    if (testResult) {
      testFiles[testResult.filename] = testResult.testFile;
    }
  }
  if (requirementBrief.trim()) {
    generatedFiles["_appforge/requirements.json"] =
      createRequirementManifest(requirementBrief);
    const requirementTest = await generateRequirementBehaviorTest(
      generatedFiles,
      techStack,
      requirementBrief,
    );
    if (requirementTest) {
      testFiles[REQUIREMENT_TEST_PATH] = requirementTest;
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
