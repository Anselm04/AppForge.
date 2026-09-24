import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function stringArray(text: string, name: string): string[] {
  const match = text.match(
    new RegExp(
      `(?:const|export\\s+const)\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
    ),
  );
  expect(match, `Missing ${name}`).toBeTruthy();
  return [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("repository source-of-truth boundaries", () => {
  it("uses the stack adapter registry as the only buildable-stack list", async () => {
    const { isValidTechStack } = await import("../agents/pipeline.js");
    const { STACK_ADAPTERS } = await import("../lib/stackAdapters.js");
    for (const adapter of STACK_ADAPTERS) {
      expect(isValidTechStack(adapter.id)).toBe(true);
    }
    for (const unsupported of [
      "vue-node",
      "unity-webgl",
      "godot-html5",
      "serverless-aws",
    ]) {
      expect(isValidTechStack(unsupported)).toBe(false);
    }
    // Home never carries its own stack list or sends a fixed stack.
    const home = source("src/pages/Home.tsx");
    expect(home).not.toMatch(/const\s+TECH_STACKS\s*=/);
    expect(home).not.toMatch(/techStack:\s*["']/);
  });

  it("treats pipeline parts as authoring source and pipeline.generated as output", () => {
    const assembler = source("scripts/assemble-pipeline.mjs");
    const facade = source("src/agents/pipeline.ts");

    expect(assembler).toContain("src/agents/.pipeline_parts");
    expect(assembler).toContain("src/agents/pipeline.generated.ts");
    expect(assembler).toContain("part${i}.txt");
    expect(facade).toContain('from "./pipeline.generated.js"');
  });

  it("keeps Drizzle app schema separate from Supabase preview migrations", () => {
    const drizzleReadme = source("src/db/README.md");
    const supabaseReadme = source("supabase/migrations/README.md");

    expect(drizzleReadme).toContain("Update `src/db/schema.ts`");
    expect(supabaseReadme).toContain(
      "**not** applied by the AppForge Express server",
    );
    expect(supabaseReadme).toContain(
      "Production app data uses **Drizzle ORM**",
    );
  });

  it("keeps the source-of-truth map explicit for future backlog work", () => {
    const map = source("docs/SOURCE_OF_TRUTH.md");
    expect(map).toContain("Agent build pipeline");
    expect(map).toContain("Runtime environment readiness");
    expect(map).toContain("App database schema");
    expect(map).toContain("Integration/plugin registry");
    expect(map).toContain("MCP server contract");
  });
});
