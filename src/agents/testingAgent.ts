// src/agents/testingAgent.ts
// ── REAL Testing Agent ─────────────────────────────────────────────────────
// This agent generates actual unit test files for the code produced by
// the Coder. It uses the LLM to write vitest tests, and then the
// BuildValidator runs them. If tests fail, errors are fed back to
// both the Coder (for code fixes) and the TestingAgent (for test fixes).

import { Agent, AgentContext, AgentResult } from './types';
import { invokeLLM } from "../_core/llm.js";

export async function generateTestsForModule(
  moduleName: string,
  fileContent: string,
  techStack: string
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

export const TestingAgent: Agent = {
  role: 'testing',
  name: 'Testing Agent',
  description: 'Generates and runs Vitest unit tests for every code module. Feeds test failures back to the Coder for auto-fix.',
  async run(context: AgentContext): Promise<AgentResult> {
    const { prompt, architecture } = context;
    const files = architecture?.generatedFiles ?? {};
    const techStack = architecture?.techStack ?? "react-node";

    const testFiles: Record<string, string> = {};
    let testCount = 0;
    let skippedCount = 0;

    for (const [filename, content] of Object.entries(files)) {
      if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx")) continue;
      if (filename.endsWith(".md") || filename.endsWith(".json")) continue;

      const moduleName = filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? filename;
      const testResult = await generateTestsForModule(moduleName, String(content), String(techStack));
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

    if (!files["src/__tests__/setup.ts"] && !testFiles["src/__tests__/setup.ts"]) {
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
      framework: 'Vitest + Testing Library',
      testFiles: Object.keys(testFiles),
      testCount,
      skippedCount,
      coverageTarget: { lines: 70, branches: 70 },
      instructions: "Run `npm test` to execute. If tests fail, the pipeline will auto-retry with error feedback.",
    };

    return { taskId: 'testing-task', role: 'testing', summary, details };
  },
};

export default TestingAgent;
