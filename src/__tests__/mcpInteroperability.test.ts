import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MCP_PROMPTS,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCES,
  MCP_RESOURCE_TEMPLATES,
  buildProjectReviewPrompt,
} from "../routes/mcp.js";

describe("MCP interoperability surface", () => {
  it("advertises safe account/project resources and project templates", () => {
    expect(MCP_RESOURCES.map((resource) => resource.uri)).toEqual([
      "appforge://account",
      "appforge://projects",
    ]);
    expect(
      MCP_RESOURCE_TEMPLATES.map((resource) => resource.uriTemplate),
    ).toEqual([
      "appforge://projects/{projectId}",
      "appforge://projects/{projectId}/agent-logs",
    ]);
  });

  it("publishes a reusable project review prompt", () => {
    expect(MCP_PROMPTS.map((prompt) => prompt.name)).toContain(
      "review_project_status",
    );
    const messages = buildProjectReviewPrompt(42);
    expect(messages[0].content.text).toContain("project 42");
    expect(messages[0].content.text).toContain(
      "Do not request or expose secrets",
    );
  });

  it("rejects invalid project identifiers before prompt generation", () => {
    expect(() => buildProjectReviewPrompt(0)).toThrow(
      "projectId must be a positive integer",
    );
    expect(() => buildProjectReviewPrompt(Number.NaN)).toThrow();
  });
  it("keeps the modern protocol version available for modern clients", () => {
    expect(MCP_PROTOCOL_VERSION).toBe("2026-07-28");
    const sourceText = readFileSync("src/routes/mcp.ts", "utf8");
    expect(sourceText).toContain("requested === MCP_PROTOCOL_VERSION");
    expect(sourceText).toContain("? MCP_PROTOCOL_VERSION");
  });
});
